// bandiera.mjs — IL PEZZO CONDIVISO fra chi misura la gara intera e chi giudica le regole.
//
// Non e' uno script: non stampa e non esegue niente all'import. E' il modulo che tiene
// UNA volta sola le cose che `gara_intera.mjs`, `voce6_bandiera.mjs` e il banco delle
// regole avevano ciascuno in casa propria — la verita' d'arrivo, gli ordini, il test dei
// segni, il bootstrap a blocchi.
//
// PERCHE' NASCE OGGI (03/08/2026). Costruendo il banco unico delle regole di reazione e'
// venuto fuori che i due numeri che il progetto cita piu' spesso non erano prodotti da
// nessuno script committato: il 36-12 a due giri e' una misura fatta a mano incrociando
// M1a e il test dei segni di voce6, e il 44-27 e' la somma a mano di due terzili che
// nessun programma stampa. I numeri sono veri e riproducibili — sono stati riprodotti
// prima di scrivere questa riga — ma vivevano in una testa e in un documento, non in un
// file eseguibile. Un banco che deve TARARSI su quei numeri non puo' poggiare su questo:
// per questo la logica si estrae qui, dove ha un solo posto (regola 1).
//
// Il caricamento di `arrivi_2026.csv` e `ordineVero` erano duplicati BYTE PER BYTE fra
// gara_intera.mjs e voce6_bandiera.mjs, e `mediana`/`media` in tre copie. E12 dice cosa
// costa avere due definizioni della stessa cosa: qui non ci sono piu'.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { cambiDiPosizione } from '../../simulatore/engine/kernel.mjs';
import { RADICE, garaNuova, garaSimDi, contestoNuovo, riclassifica, ingressiVecchio } from './banco.mjs';
import { evaluatePit } from '../../demo/pitscenario.mjs';

// Il congelamento NON e' una costante: si prova dal primo giro in cui un passo base
// esiste davvero (regola 6, PREREG_gara_intera_2.md §a).
export const CONGELAMENTO_MIN = 5;
export const CONGELAMENTO_MAX = 15;

export const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// ── la verita' d'arrivo, da una fonte DIVERSA dal byLap che il motore legge ──
let _arrivi = null;
export function arrivi() {
  if (_arrivi) return _arrivi;
  _arrivi = [];
  const righe = readFileSync(path.join(RADICE, 'data', 'arrivi_2026.csv'), 'utf8').trim().split('\n');
  const h = righe[0].split(',');
  for (const l of righe.slice(1)) {
    const c = l.split(',');
    const o = Object.fromEntries(h.map((k, i) => [k, c[i]]));
    o.classificato = o.classificato === 'True';
    o.pos_finale = Number(o.pos_finale);
    o.soste_piano = (o.soste || '').split(';').filter(Boolean)
      .map((s) => { const [giro, mescola] = s.split(':'); return { giro: Number(giro), mescola }; })
      .sort((a, b) => a.giro - b.giro);
    _arrivi.push(o);
  }
  return _arrivi;
}

export const perGara = (g) => arrivi().filter((x) => x.gara === g);
export const riga = (g, p) => arrivi().find((x) => x.gara === g && x.pilota === p) ?? null;

/** L'ordine d'arrivo VERO: i classificati per posizione finale crescente. */
export function ordineVero(g) {
  return perGara(g).filter((x) => x.classificato && Number.isFinite(x.pos_finale))
    .sort((a, b) => a.pos_finale - b.pos_finale).map((x) => x.pilota);
}

/**
 * L'ordine al giro del congelamento, per cum_time: e' il MODELLO NULLO (prereg §6).
 *
 * `perPilota` e' una Map di Map (pilota -> giro -> cella) e le celle NON portano il
 * numero di giro dentro di se': la prima scrittura di questa funzione la trattava come
 * un oggetto di array e restituiva sempre l'insieme vuoto, cioe' il modello nullo non
 * esisteva e G4 non era misurabile. Difetto dello strumento, non esito (E22).
 */
export function ordineAlGiro(gSim, lap) {
  const cum = {};
  for (const [drv, celle] of gSim.perPilota) {
    const c = celle.get(lap);
    if (c && Number.isFinite(c.cum_time)) cum[drv] = c.cum_time;
  }
  return Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
}

/** L'ordine finale PREVISTO: per cum_time all'ultimo giro presente nella traccia. */
export function ordinePrevisto(traccia, giroFinale) {
  if (!traccia) return null;
  const cum = {};
  for (const [drv, passi] of Object.entries(traccia)) {
    if (!passi || !passi.length) continue;
    let ultimo = null;
    for (const p of passi) if (p.lap <= giroFinale && (ultimo === null || p.lap > ultimo.lap)) ultimo = p;
    if (ultimo && Number.isFinite(ultimo.cum_time)) cum[drv] = { cum: ultimo.cum_time, lap: ultimo.lap };
  }
  const giri = Object.values(cum).map((x) => x.lap);
  return {
    // GIRI PERCORSI PRIMA, POI TEMPO — la convenzione di ogni classifica vera. Fino al
    // 07/08 l'ordine era per solo cum: identico quando tutte le tracce arrivano allo
    // stesso giro (ogni uso pubblicato), SBAGLIATO con i ritiri dichiarati del kernel —
    // un cum di 30 giri e' piu' piccolo di uno di 57, e il ritirato usciva primo.
    ordine: Object.keys(cum).sort((a, b) => (cum[b].lap - cum[a].lap) || (cum[a].cum - cum[b].cum) || (a < b ? -1 : 1)),
    giro_min: giri.length ? Math.min(...giri) : null,
    giro_max: giri.length ? Math.max(...giri) : null,
  };
}

/** Le soste vere di TUTTI in quella gara, nel formato del costruttore. */
export function pianiVeriDi(nomeSito) {
  const m = {};
  for (const r of perGara(nomeSito)) if (r.soste_piano.length) m[r.pilota] = r.soste_piano;
  return m;
}

/**
 * UN CASO: congela, dai al pilota la SUA strategia vera, corri fino alla bandiera.
 *
 * `pianiRivali` e' l'UNICO ingresso che cambia il comportamento degli avversari, ed e'
 * per questo che qui e' un PARAMETRO e non piu' una costante letta da process.argv:
 * e' la cucitura su cui il banco delle regole innesta una regola di reazione. Passarlo
 * `undefined` e' la regola-identita' — «il rivale non reagisce mai» — cioe' esattamente
 * la configurazione con cui girano le misure gia' pubblicate.
 *
 * PUO' ESSERE UNA FUNZIONE DEL CONGELAMENTO, e dal 03/08/2026 per le regole lo DEVE
 * essere. Il congelamento non e' 5: si sceglie qui dentro, per singolo caso, ed e' oltre
 * il 5 in 49 casi su 193 (25,4%; distribuzione {5:144, 6:23, 7:4, 8:2, 9:19, 10:1}).
 * Un piano costruito per un congelamento piu' basso viene poi scartato in silenzio dal
 * costruttore (`s.giro > freezeLap`), quindi una regola valutata cosi' girerebbe come
 * REGOLA-IDENTITA' su un quarto del perimetro, con l'etichetta della regola nuova.
 * Il difetto era stato diagnosticato in REFERTO_mirrorplay_degenere.md prima di
 * spendere l'esperimento; qui e' chiuso.
 *
 * Un valore semplice resta accettato e vale per ogni congelamento: e' il caso
 * dell'oracolo, le cui soste vere non dipendono da quando si congela — ed e' la ragione
 * per cui questa riparazione lascia i numeri pubblicati bit-identici.
 *
 * ATTENZIONE al perimetro: s25_difesa fa fallire la suite se `pianiRivali` compare in un
 * percorso di web/, demo/ o scenario/. E' un ingresso di LABORATORIO e deve restare qui.
 */
export function corri(nomeSito, pilota, { pianiRivali = undefined, modello = null, tetto = null, ritiriRivali = undefined, neutralizzazioneVera = undefined, ripartenzaGiri = undefined, conTraccia = false } = {}) {
  const r = riga(nomeSito, pilota);
  if (!r) return { saltato: 'nessuna riga in arrivi_2026.csv' };
  if (!r.classificato) return { saltato: `non classificato (${r.tipo_arrivo})`, tipo_arrivo: r.tipo_arrivo };
  if (!r.soste_piano.length) return { saltato: 'nessuna sosta registrata: non c\'e\' pit-loss ne\' mescola da simulare' };

  const gSim = garaNuova(nomeSito);
  const contesto = tetto === null ? contestoNuovo(nomeSito, modello)
    : { ...contestoNuovo(nomeSito, modello), tetto };

  // Si scende il congelamento finche' il motore non ha un passo base per lui. Le soste
  // gia' avvenute NON si rimettono nel piano: il costruttore legge lo stato vero fino al
  // congelamento, quindi il pilota ci arriva gia' con la gomma che aveva davvero e la
  // sua eta'. Rimetterle sarebbe farlo fermare due volte.
  let sc = null; let esito = null; let prev = null; let congelamento = null; let ultimoMotivo = null;
  let pianiUsati = null;
  for (let lf = CONGELAMENTO_MIN; lf <= CONGELAMENTO_MAX; lf += 1) {
    const futuro = r.soste_piano.filter((s) => s.giro > lf);
    if (!futuro.length) { ultimoMotivo = `nessuna sosta oltre il giro ${lf}`; break; }
    // La regola si interroga AL CONGELAMENTO DI QUESTO TENTATIVO, non a 5 per tutti, e
    // riceve anche CHI e' il soggetto e COSA fara': una regola di reazione deve poter
    // reagire a qualcuno. Il piano del soggetto e' informazione ammessa — e' la premessa
    // della metrica, il soggetto riceve la sua strategia vera — mentre le soste dei
    // RIVALI non lo sono mai (E14). La distinzione e' la linea su cui vive tutta la
    // famiglia, e per questo il contesto porta `futuro` (il soggetto) e nient'altro.
    const piani = typeof pianiRivali === 'function' ? pianiRivali(lf, { pilota, futuro }) : pianiRivali;
    let s2; let e2;
    try {
      s2 = costruisciScenario({
        gara: garaSimDi(nomeSito), freezeLap: lf, pilota, piano: futuro, pianiRivali: piani,
        // i ritiri e le neutralizzazioni VERE (ingressi di laboratorio, 07/08):
        // undefined in ogni misura pubblicata — i numeri a referto restano bit-identici
        ritiriRivali, neutralizzazioneVera, ripartenzaGiri,
      }, contesto);
      e2 = eseguiEValida(s2, contesto.costantiDirector);
    } catch (e) { ultimoMotivo = `eccezione: ${e.message}`; continue; }
    const p2 = ordinePrevisto(e2.risultato.traccia, gSim.nGiri);
    if (!p2 || !p2.ordine.includes(pilota)) { ultimoMotivo = `nessun passo base al giro ${lf} (regola 6)`; continue; }
    sc = s2; esito = e2; prev = p2; congelamento = lf; pianiUsati = piani; break;
  }
  if (!prev) return { saltato: ultimoMotivo ?? `nessun passo base fra i giri ${CONGELAMENTO_MIN}-${CONGELAMENTO_MAX}` };

  const vero = ordineVero(nomeSito);
  const nullo = ordineAlGiro(gSim, congelamento);

  // STESSO METRO E STESSA POPOLAZIONE per il motore e per il modello nullo: passando
  // l'uno come `altro` dell'altro, la ri-classificazione restringe entrambi alla TERNA
  // comune (motore ∩ nullo ∩ verita'). Con popolazioni diverse vincerebbe il piu'
  // fortunato per il perimetro, non per il merito.
  const m = riclassifica(prev.ordine, vero, pilota, nullo);
  const n = riclassifica(nullo, vero, pilota, prev.ordine);
  if (!m) return { saltato: 'il pilota non e\' nella popolazione comune motore/nullo/verita\'' };

  // quanto movimento produce il motore, contro quanto ne avviene davvero.
  // `cambiDiPosizione` e' la definizione del kernel (QUANTI, non QUALI).
  const comuni = new Set(nullo.filter((d) => vero.includes(d) && prev.ordine.includes(d)));
  const soloComuni = (o) => o.filter((d) => comuni.has(d));
  const lf0 = soloComuni(nullo);
  const cambiReali = cambiDiPosizione(lf0, soloComuni(vero));
  const cambiMotore = cambiDiPosizione(lf0, soloComuni(prev.ordine));

  const fatal = (esito.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');

  // LA SONDA DELLA CUCITURA. Non basta che la regola PROPONGA un piano: il costruttore
  // scarta le soste con `giro <= freezeLap` e quelle con mescola non slick, e lo fa in
  // silenzio. Queste due righe dicono quanto della regola e' davvero arrivato al motore.
  // Se divergono, la regola sta girando in parte come identita' — che e' il difetto che
  // ha reso il mirror-play non solo debole ma SBAGLIATO, e che nessuno avrebbe visto
  // senza guardare il piano dopo il filtro invece che prima.
  const propostiA = pianiUsati ? Object.keys(pianiUsati).filter((d) => d !== pilota && pianiUsati[d]?.length).length : 0;
  const arrivatiA = Object.entries(sc.pits ?? {}).filter(([d, v]) => d !== pilota && v?.length).length;

  return {
    rivali_con_piano_proposto: propostiA,
    rivali_con_sosta_nel_motore: arrivatiA,
    cambi_reali: cambiReali, cambi_motore: cambiMotore, campo: comuni.size,
    n_giri: gSim.nGiri,
    congelamento,
    proiettati: gSim.nGiri - congelamento,
    strategia: r.soste_piano.map((s) => `${s.giro}:${s.mescola}`).join(' '),
    soste_ereditate: r.soste_piano.filter((s) => s.giro <= congelamento).length,
    partenza: r.partenza,
    previsto: m.pos, vero: m.posVera, errore: m.errore, su: m.su,
    nullo: n ? n.pos : null, errore_nullo: n ? n.errore : null,
    tipo_arrivo: r.tipo_arrivo,
    pit_loss_s: sc.perdita ?? sc.pitLoss ?? null,
    oltre_orizzonte: (sc.assunzioni ?? []).some((a) => (a.codice ?? a) === 'OLTRE_ORIZZONTE_VALIDATO'),
    director_fatal: fatal.length,
    traccia_fino_a: prev.giro_max,
    // STRUMENTAZIONE, non fisica (13/08). Due campi in piu' nel referto, additivi:
    // nessun numero pubblicato cambia, perche' nessuno di questi due entra in un
    // conto. Servono a `pavimento_gara_intera.mjs` per due cose che senza di loro
    // non si possono verificare: quanti giri di questo caso sono davvero compressi
    // (un cancello che gira dove la compressione non c'e' e' vuoto, ed e' l'errore
    // che ha reso C2 impassabile), e i tempi sul giro con cui contare i giri sotto
    // il pavimento sulla STESSA corsa che produce l'errore di posizione.
    neutra_giri: sc.neutralizzazione ? Object.keys(sc.neutralizzazione.perGiro).length : 0,
    neutra_perGiro: sc.neutralizzazione ? sc.neutralizzazione.perGiro : null,
    // il contatore del pavimento, cosi' com'e' uscito dal kernel (14/08, D3 della
    // PREREG_compressione_pavimento_2). Passa e basta: non entra in nessun conto, e
    // senza pavimento la chiave non esiste nemmeno nel risultato.
    clamp_pavimento: esito.risultato.clampPavimento ?? null,
    traccia: conTraccia ? esito.risultato.traccia : undefined,
  };
}

// ── la metrica a DUE GIRI, che viveva dentro M1a_errore_posizione.mjs ────────

/** Il passo v2 come lo configura il pannello (deriva + degrado dal modello pubblicato). */
export function passoV2() {
  const mp = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
  return { delta: mp.deriva.delta_gara_s, rho: mp.degrado.rho_s_giro };
}

/**
 * IL MOTORE VECCHIO NELLA CONFIGURAZIONE DEL PANNELLO (passo v2, gradino spento).
 *
 * `rispostaVecchio` non espone `passo`: lo si passa costruendo gli argomenti con
 * `ingressiVecchio` — che e' proprio la porta che il banco apre per questo — e
 * chiamando `evaluatePit` con gli stessi identici ingressi piu' `passo`. Col passo v2
 * il gradino si SPEGNE, altrimenti lo stesso effetto viene contato due volte.
 */
export function vecchioConPasso(caso, { troncato = true, orizzonte = 0, passo = null } = {}) {
  const ing = ingressiVecchio(caso, { troncato, orizzonte });
  const arg = { ...ing.argomenti, passo, gradino: passo ? null : ing.argomenti.gradino };
  let r;
  try { r = evaluatePit(arg); } catch (e) { return { ok: false, muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null }; }
  if (!r || r.ok !== true) return { ok: false, muto: true, motivo: r?.reason ?? 'nessuna risposta', pos: null, su: null, ordine: null };
  return { ok: true, muto: false, motivo: null, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto };
}

/**
 * LETTURA B — la ri-classificazione sulla popolazione comune ai DUE motori piu' la
 * verita'. Tiene solo le sigle presenti in tutti e tre e ri-conta il rango del pilota
 * dentro quell'insieme: nessun numero viene inventato, si riusa l'ordinamento che
 * ciascun motore ha gia' prodotto.
 *
 * Vive qui dal 03/08/2026: era una copia in casa di M1a, e PREREG_voce6_bandiera.md la
 * dichiarava debito aperto («M1a, M1b, M4 e M5 se la riscrivono in casa»).
 */
export function letturaComune(caso, ordVecchio, ordNuovo) {
  if (!ordVecchio || !ordNuovo) return null;
  const sv = new Set(ordVecchio.map((x) => x[0]));
  const sn = new Set(ordNuovo.map((x) => x[0]));
  const comune = caso.ordineVero.filter((d) => sv.has(d) && sn.has(d));
  if (!comune.includes(caso.pilota)) return null;
  const S = new Set(comune);
  const rango = (lista) => lista.filter((d) => S.has(d)).indexOf(caso.pilota) + 1;
  return {
    su: comune.length,
    vero: rango(caso.ordineVero),
    vecchio: rango(ordVecchio.map((x) => x[0])),
    nuovo: rango(ordNuovo.map((x) => x[0])),
  };
}

// ── il metro statistico, che esisteva in UNA copia dentro voce6_bandiera.mjs ──

/**
 * TEST DEI SEGNI bilaterale sui discordanti. `coppie` = [{a, b}] con a, b errori
 * (si confrontano i valori ASSOLUTI: vince chi sbaglia meno).
 *
 * Il p-value dei due numeri che questo progetto cita di piu' (36-12 e 13-28) veniva
 * calcolato A MANO: nessuno script committato lo produceva. Ora sta qui.
 */
export function testSegni(coppie) {
  const vinceA = coppie.filter((c) => Math.abs(c.a) < Math.abs(c.b)).length;
  const vinceB = coppie.filter((c) => Math.abs(c.a) > Math.abs(c.b)).length;
  const pari = coppie.length - vinceA - vinceB;
  const nd = vinceA + vinceB;
  const lg = (k) => { let s = 0; for (let i = 2; i <= k; i += 1) s += Math.log(i); return s; };
  let p = 1;
  if (nd > 0) {
    const m = Math.min(vinceA, vinceB);
    let acc = 0;
    for (let k = 0; k <= m; k += 1) acc += Math.exp(lg(nd) - lg(k) - lg(nd - k) - nd * Math.LN2);
    p = Math.min(1, 2 * acc);
  }
  return { n: coppie.length, vinceA, vinceB, pari, discordanti: nd, p };
}

/**
 * BOOTSTRAP A BLOCCHI = GARE (E11: mai poolare fra gare), seme fisso e dichiarato.
 * `valore(campione)` riceve un array di casi e torna il numero di cui si vuole l'IC.
 */
export function bootstrapBlocchiGare(casi, valore, { ripetizioni = 10000, seme = 20260802 } = {}) {
  const perG = {};
  for (const c of casi) (perG[c.gara] ??= []).push(c);
  const blocchi = Object.values(perG);
  if (!blocchi.length) return { ic95: [null, null], ripetizioni: 0, seme };
  let s = seme;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const v = [];
  for (let b = 0; b < ripetizioni; b += 1) {
    const camp = [];
    for (let i = 0; i < blocchi.length; i += 1) camp.push(...blocchi[Math.floor(rnd() * blocchi.length)]);
    if (!camp.length) continue;
    const x = valore(camp);
    if (Number.isFinite(x)) v.push(x);
  }
  v.sort((a, b) => a - b);
  return {
    ic95: v.length ? [v[Math.floor(0.025 * v.length)], v[Math.floor(0.975 * v.length)]] : [null, null],
    ripetizioni: v.length,
    seme,
  };
}
