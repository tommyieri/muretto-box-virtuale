// piano.mjs — IL PIANO GOMME fino alla bandiera: la forma, e la ricerca.
//
// Questo modulo possiede DUE cose e nessuna terza:
//   · la FORMA — lo stint pianificato e il piano che lo contiene;
//   · la RICERCA — quale piano è il migliore.
//
// Non possiede fisica. Per sapere quanto costa un piano chiama
// `costruisciScenario`, che resta l'UNICO costruttore di scenari (E17). Se qui
// dentro comparisse una somma di tempi sul giro, sarebbero di nuovo due fisiche
// per due risposte adiacenti — l'errore che il costruttore unico esiste per
// impedire.
//
// ── LO STINT PIANIFICATO NON È LO STINT OSSERVATO ───────────────────────────
//
// `provenienza/` possiede lo stint OSSERVATO: `cella.stint` è un fatto del
// grezzo, e `data/viste/stint_fondo.json` ne contiene 6.985 misurati. Qui si
// costruisce lo stint PIANIFICATO: un tratto di gara che non è ancora successo.
// Ogni stint pianificato porta `da_dati: false`, perché un oggetto che descrive
// il futuro non deve poter essere scambiato per una misura (regola 2, E12).
//
// ── LA MESCOLA NON SI OTTIMIZZA, SI SODDISFA ────────────────────────────────
//
// Nel modello v2 la mescola non cambia il degrado (misurato 2026: SOFT−HARD
// p = 0,209; la Fase Mescola ha poi chiuso in negativo anche sul fondo). Quindi
// due piani che differiscono SOLO per le mescole costano esattamente uguale, e
// scegliere «la mescola migliore» sarebbe inventare una preferenza che i dati
// non hanno. La mescola qui si sceglie per SODDISFARE il regolamento 2026 —
// due slick sull'asciutto — con una regola deterministica dichiarata, e
// l'equivalenza in tempo esce come assunzione.

import { MESCOLE_SLICK_ATTUALI } from '../provenienza/vocabolario.mjs';
import { costruisciScenario } from './costruttore.mjs';
import { simulate } from '../engine/kernel.mjs';

/** Raggio della ricerca locale attorno alla forma chiusa, in giri. DICHIARATO:
 *  il prodotto non enumera tutti i piani interi (sono C(R−1,k)), parte
 *  dall'ottimo continuo e raffina. Il banco enumera invece TUTTO e verifica che
 *  la restrizione non perda l'ottimo (cancello M1). */
export const RAGGIO_RICERCA = 4;

/** Mescole slick della stagione corrente, in ordine deterministico. */
const ORDINE_MESCOLE = ['HARD', 'MEDIUM', 'SOFT'];

const intero = (v) => Number.isInteger(v);

/**
 * Uno stint PIANIFICATO. Non è una misura e lo dice.
 * `giro_fine` è l'ultimo giro percorso su quel set: il giro della sosta è
 * l'ULTIMO dello stint che si chiude (è l'in-lap, corso sulla gomma vecchia —
 * la stessa convenzione del kernel).
 */
export function creaStint({ indice, giro_inizio, giro_fine, mescola, eta_iniziale }) {
  if (!intero(indice) || indice < 1) throw new Error(`stint senza indice intero ≥ 1: ${JSON.stringify(indice)}`);
  if (!intero(giro_inizio) || !intero(giro_fine)) throw new Error(`stint ${indice} senza giri interi: ${giro_inizio}–${giro_fine}`);
  if (giro_fine < giro_inizio) throw new Error(`stint ${indice} finisce prima di iniziare: ${giro_inizio}–${giro_fine}`);
  if (mescola !== null && !MESCOLE_SLICK_ATTUALI.has(mescola)) {
    throw new Error(`stint ${indice}: mescola non valida ${JSON.stringify(mescola)} (E05)`);
  }
  if (typeof eta_iniziale !== 'number' || !Number.isFinite(eta_iniziale) || eta_iniziale < 0) {
    throw new Error(`stint ${indice} senza età iniziale utilizzabile: ${JSON.stringify(eta_iniziale)}`);
  }
  const giri = giro_fine - giro_inizio + 1;
  return Object.freeze({
    indice,
    giro_inizio,
    giro_fine,
    giri,
    mescola,
    eta_iniziale,
    eta_finale: eta_iniziale + giri,
    da_dati: false,
  });
}

/**
 * Il piano: le soste, e gli stint DERIVATI da esse. I due elenchi non si
 * mantengono in parallelo — prima o poi divergerebbero, ed è la stessa ragione
 * per cui `verde` vive in un posto solo.
 *
 * @param soste      `[{ giro, mescola }]`, in ordine crescente di giro.
 * @param freezeLap  Lf: lo stint in corso al congelamento è lo stint 1.
 * @param giroFinale l'ultimo giro del piano (la bandiera, di norma).
 * @param mescolaAlCongelamento  quella osservata: NON si sceglie, c'è già.
 * @param etaAlCongelamento      l'età alla fine del giro Lf.
 */
export function creaPiano({ soste, freezeLap, giroFinale, mescolaAlCongelamento, etaAlCongelamento }) {
  if (!Array.isArray(soste)) throw new Error('le soste del piano devono essere un elenco');
  if (!intero(freezeLap) || !intero(giroFinale)) throw new Error('il piano richiede freezeLap e giroFinale interi');
  if (giroFinale <= freezeLap) throw new Error(`piano vuoto: giroFinale ${giroFinale} non sta dopo il congelamento ${freezeLap}`);

  let precedente = freezeLap;
  for (const s of soste) {
    if (!intero(s?.giro)) throw new Error(`sosta del piano senza giro intero: ${JSON.stringify(s)}`);
    if (s.giro <= precedente) throw new Error(`soste non in ordine crescente, o sosta al giro ${s.giro} non dopo ${precedente}`);
    if (s.giro >= giroFinale) throw new Error(`sosta al giro ${s.giro}: una sosta all'ultimo giro o oltre non è un piano`);
    precedente = s.giro;
  }

  const stint = [];
  let inizio = freezeLap + 1;
  let mescola = mescolaAlCongelamento;
  let eta = etaAlCongelamento;
  soste.forEach((s, i) => {
    stint.push(creaStint({ indice: i + 1, giro_inizio: inizio, giro_fine: s.giro, mescola, eta_iniziale: eta }));
    inizio = s.giro + 1;
    mescola = s.mescola;
    eta = 0;
  });
  stint.push(creaStint({ indice: soste.length + 1, giro_inizio: inizio, giro_fine: giroFinale, mescola, eta_iniziale: eta }));

  return Object.freeze({
    k: soste.length,
    soste: soste.map((s) => Object.freeze({ giro: s.giro, mescola: s.mescola })),
    stint: Object.freeze(stint),
    freeze_lap: freezeLap,
    giro_finale: giroFinale,
  });
}

/**
 * LA FORMA CHIUSA (PREREG_multistint.md, derivata prima di misurare).
 *
 * base e deriva dipendono dal GIRO e non dal piano: sono identiche per ogni
 * piano sullo stesso orizzonte e si cancellano nel confronto. Resta
 * `ρ·Σ età + k·P`, il cui minimo a k fissato ha stint uguali salvo il primo,
 * accorciato dell'età già consumata:
 *
 *   m_i = i·(R + a)/(k + 1) − a          (giro di sosta, relativo a Lf)
 *   costo*(k) = ρ·[ (R+a)²/(2(k+1)) − a²/2 + R/2 ] + k·P
 *
 * Per k = 1 dà m_1 = (R − a)/2: l'ottimo analitico già in vigore (G0″).
 */
export function formaChiusa({ R, a, k, rho = null, perdita = null }) {
  if (!intero(R) || R < 1) throw new Error(`R non utilizzabile: ${JSON.stringify(R)}`);
  if (typeof a !== 'number' || a < 0) throw new Error(`età al congelamento non utilizzabile: ${JSON.stringify(a)}`);
  if (!intero(k) || k < 0) throw new Error(`k non utilizzabile: ${JSON.stringify(k)}`);
  const L = (R + a) / (k + 1);
  const relativi = [];
  for (let i = 1; i <= k; i += 1) relativi.push(i * L - a);
  const costo = (rho === null || perdita === null)
    ? null
    : rho * ((R + a) ** 2 / (2 * (k + 1)) - (a ** 2) / 2 + R / 2) + k * perdita;
  return { lunghezza_stint: L, lunghezza_primo_stint: L - a, giri_sosta_relativi: relativi, costo };
}

/** Il numero di soste che minimizza il costo, a valori reali: (k+1)* = (R+a)·√(ρ/2P). */
export function kOttimoContinuo({ R, a, rho, perdita }) {
  if (typeof rho !== 'number' || rho <= 0) throw new Error(`ρ non utilizzabile: ${JSON.stringify(rho)}`);
  if (typeof perdita !== 'number' || perdita <= 0) throw new Error(`perdita non utilizzabile: ${JSON.stringify(perdita)}`);
  return (R + a) * Math.sqrt(rho / (2 * perdita)) - 1;
}

/**
 * La sequenza di mescole che SODDISFA il regolamento 2026 (due slick
 * sull'asciutto), data quella già usata. Deterministica e dichiarata: non è una
 * scelta di prestazione, perché la mescola non cambia il degrado.
 *
 * Con almeno una sosta: la prima sosta monta una mescola DIVERSA da quelle già
 * usate se ne mancano; le successive tornano sull'ordine dichiarato. Con zero
 * soste non c'è niente da scegliere — ed è il piano stesso a essere illegale se
 * il pilota non ha già due mescole, il che è una proprietà del piano, non un
 * problema da nascondere qui.
 */
/**
 * Le mescole slick che il pilota ha GIA' usato fino al congelamento.
 * Informazione <= Lf, mai oltre (E14). INTERNA di proposito: chi sta fuori la
 * riceve gia' calcolata in `pianoOttimo().mescole_gia_usate`, cosi' esiste una
 * sola derivazione e non serve una seconda porta da sorvegliare.
 */
function mescoleSlickUsate(gara, pilota, freezeLap) {
  const usate = new Set();
  for (const [lap, c] of gara.perPilota.get(pilota) ?? []) {
    if (lap <= freezeLap && c.compound !== null && MESCOLE_SLICK_ATTUALI.has(c.compound)) usate.add(c.compound);
  }
  return usate;
}

export function mescolePerSoste(k, mescoleGiaUsate) {
  const usate = new Set(mescoleGiaUsate);
  const scelte = [];
  for (let i = 0; i < k; i += 1) {
    const mancante = ORDINE_MESCOLE.find((m) => !usate.has(m));
    const scelta = usate.size >= 2 ? ORDINE_MESCOLE[0] : (mancante ?? ORDINE_MESCOLE[0]);
    usate.add(scelta);
    scelte.push(scelta);
  }
  return scelte;
}

/**
 * Valuta UN piano: costruisce lo scenario (fisica del costruttore unico) e
 * restituisce il cumulato del pilota alla bandiera. `null` se il pilota esce
 * dalla simulazione (regola 6) — un piano non valutabile non è un piano lento.
 */
export function valutaPiano({ gara, freezeLap, pilota, piano, sosteAtteseRivali }, contesto) {
  const scenario = costruisciScenario(
    // `sosteAtteseRivali` VIAGGIA FINO QUI dal 04/08/2026. Prima non arrivava: pianoOttimo lo
    // ignorava, quindi il pianificatore ottimizzava contro venti auto ferme — anche in
    // produzione, dove nessuno lo passava. Prereg: PREREG_rivali_comportamentali.md.
    { gara, freezeLap, pilota, piano: piano.soste, sosteAtteseRivali },
    { ...contesto, giroFinale: piano.giro_finale },
  );
  const risultato = simulate({
    state: scenario.state, pace: scenario.pace, freezeLap: scenario.freezeLap,
    // `neutralizzazione` viaggia con lo scenario come `pits` e `pace`: se questa
    // riga mancasse, "quando fermarti" girerebbe su una fisica e "dove rientri"
    // su un'altra — E17 nella forma esatta in cui il vecchio repo l'ha pagata.
    steps: scenario.steps, pits: scenario.pits, neutralizzazione: scenario.neutralizzazione ?? null,
    tetto: scenario.tetto ?? null,
  });
  // LA POSIZIONE viaggia accanto al tempo dal 04/08/2026. `ordine` e' gia' la lista dei
  // piloti per cumulato con i null esclusi (regola 6): chi non ha passo non e' «dietro»,
  // non c'e'. `popolazione` esce insieme perche' due ranghi su popolazioni diverse non si
  // confrontano, e col tetto acceso il nostro piano puo' toccare il cumulato di un rivale.
  // Prereg: ai_lab/pianificatore/PREREG_obiettivo_posizione.md §2.
  const i = risultato.ordine.indexOf(pilota);
  return {
    totale: risultato.cum[pilota] ?? null,
    posizione: i < 0 ? null : i + 1,
    popolazione: risultato.ordine.length,
    scenario,
  };
}

/**
 * L'OBIETTIVO, in un posto solo (regola 1).
 *
 * `tempo`      minimizza il cumulato alla bandiera — cio' che il motore ha sempre fatto.
 * `posizione`  minimizza la coppia (posizione, cumulato) in ordine LESSICOGRAFICO: prima
 *              la posizione, e a parita' di posizione il tempo.
 *
 * Non c'e' una somma pesata, e non e' una svista: un cambio in secondi-per-posizione
 * sarebbe un parametro libero tarato in casa su undici gare — la forma esatta del fattore
 * per circuito spento il 04/08. Cosi' i parametri liberi sono ZERO, e dove la posizione non
 * distingue l'obiettivo resta identico a quello di prima, bit per bit.
 *
 * `null` non vince mai: un piano non valutabile non e' un piano veloce (regola 6).
 */
/**
 * IL VINCOLO DELLA VITA: nessuno stint puo' finire oltre l'eta' massima della sua mescola.
 *
 * Legge `eta_finale`, che `creaStint` calcola gia': non ricalcola niente (regola 1).
 * Una mescola SCONOSCIUTA non viene vincolata — un'assenza non diventa mai un muro
 * (regola 6), e inventare un limite per una gomma che non si sa quale sia sarebbe peggio
 * che non averne.
 */
export function pianoFattibile(piano, vitaMassima) {
  if (!vitaMassima) return true;
  for (const st of piano.stint) {
    if (st.mescola === null) continue;
    const max = vitaMassima[st.mescola];
    if (typeof max === 'number' && st.eta_finale > max) return false;
  }
  return true;
}

export const OBIETTIVI = Object.freeze(['tempo', 'posizione']);
export function meglioDi(a, b, obiettivo) {
  if (a === null || a.totale === null) return false;
  if (b === null || b.totale === null) return true;
  if (obiettivo === 'posizione' && a.posizione !== null && b.posizione !== null && a.posizione !== b.posizione) {
    return a.posizione < b.posizione;
  }
  return a.totale < b.totale - 1e-9;
}

/**
 * LA RICERCA. Per ogni k da 0 a kMax: si parte dai giri di sosta della forma
 * chiusa, arrotondati, e si raffina con una discesa per coordinate entro
 * `RAGGIO_RICERCA` giri. La restrizione è DICHIARATA (enumerare tutti i piani
 * interi costa C(R−1,k)); il banco enumera esaustivamente e verifica che non
 * faccia perdere l'ottimo (cancello M1).
 *
 * @returns `{ migliore, per_k, assunzioni }` — `migliore` è il piano col
 *          cumulato minore, `per_k` tiene tutti i k valutati perché la risposta
 *          «due soste costano 3 s più di una» è un'informazione, non uno scarto.
 */
export function pianoOttimo({
  gara, freezeLap, pilota, giroFinale, kMax = 3, mescolaPrimaSosta = null, sosteAtteseRivali = undefined,
  // LA VITA MASSIMA come VINCOLO, non come penalita'. `null` ⇒ il vincolo non esiste e
  // questo file si comporta bit per bit come prima (prereg: PREREG_vita_vincolo.md).
  // Mappa mescola → eta' massima ammessa alla FINE di uno stint. Il passo non si tocca:
  // il termine morbido di `vita_mescola` resta dov'era e fa quello che ha sempre fatto.
  vitaMassima = null,
  // L'OBIETTIVO E' UN INGRESSO DICHIARATO, e il suo valore di riserva e' quello di sempre:
  // finche' nessuno passa `obiettivo`, questo file si comporta bit per bit come prima del
  // 04/08/2026. L'accensione e' una riga sola, e passa dai cancelli di
  // ai_lab/pianificatore/PREREG_obiettivo_posizione.md.
  obiettivo = 'tempo',
}, contesto) {
  if (!OBIETTIVI.includes(obiettivo)) throw new Error(`obiettivo sconosciuto: ${JSON.stringify(obiettivo)} — ammessi ${OBIETTIVI.join(', ')}`);
  const g = contesto.gare[gara];
  if (!g) throw new Error(`gara sconosciuta: ${gara}`);
  const cella = g.perPilota.get(pilota)?.get(freezeLap);
  if (!cella) throw new Error(`${pilota} non ha una cella al congelamento ${freezeLap}`);
  if (cella.tyre_age === null) {
    // Regola 6: senza età al congelamento non esiste un piano, e non se ne
    // inventa uno partendo da un'età plausibile.
    return { migliore: null, per_k: [], motivo: `${pilota} non ha età gomma al congelamento: nessun piano` };
  }
  const fine = giroFinale ?? contesto.nGiriGara;
  const R = fine - freezeLap;
  const a = cella.tyre_age;
  const usate = mescoleSlickUsate(g, pilota, freezeLap);

  // ── il REGOLAMENTO è un vincolo sullo spazio dei piani, non una preferenza ──
  // Nel 2026 chi completa una gara asciutta deve aver usato due mescole slick.
  // Se al congelamento il pilota ne ha usata una sola e il piano arriva alla
  // bandiera, «non fermarsi più» non è un piano lento: è una squalifica, e non
  // deve nemmeno entrare nel confronto. Il vincolo viene dal REGOLAMENTO, non
  // da un adattamento ai dati — ed è il Director a farlo rispettare a valle
  // (REG01), che è il motivo per cui i due guardiani restano distinti.
  const haUsatoBagnato = [...g.perPilota.get(pilota)]
    .some(([lap, c]) => lap <= freezeLap && c.compound !== null && !MESCOLE_SLICK_ATTUALI.has(c.compound));
  const finoAllaBandiera = fine === contesto.nGiriGara;
  const kMinimo = (finoAllaBandiera && !haUsatoBagnato && usate.size < 2) ? 1 : 0;

  const perK = [];
  for (let k = kMinimo; k <= kMax; k += 1) {
    if (k > 0 && R - 1 < k) break; // non ci stanno k soste distinte prima della bandiera
    // LA PRIMA SOSTA PUO' ESSERE IMPOSTA DALL'UTENTE. E' cio' che rende il selettore
    // mescola un comando invece di un'informazione: tu scegli cosa monti ADESSO, il
    // pianificatore ottimizza il resto sapendolo. Le soste successive restano sue, e il
    // vincolo delle due mescole slick continua a valere — la scelta si aggiunge a `usate`,
    // non lo scavalca.
    const mescole = mescolaPrimaSosta && k > 0
      ? [mescolaPrimaSosta, ...mescolePerSoste(k - 1, new Set([...usate, mescolaPrimaSosta]))]
      : mescolePerSoste(k, usate);
    const partenza = formaChiusa({ R, a, k }).giri_sosta_relativi
      .map((m) => Math.round(m));
    const costruisci = (relativi) => {
      const ordinati = [...relativi].sort((x, y) => x - y);
      for (let i = 0; i < ordinati.length; i += 1) {
        // giri ammessi: da Lf+1 a giroFinale−1, tutti distinti
        if (ordinati[i] < 1 || ordinati[i] > R - 1) return null;
        if (i > 0 && ordinati[i] <= ordinati[i - 1]) return null;
      }
      const p = creaPiano({
        soste: ordinati.map((m, i) => ({ giro: freezeLap + m, mescola: mescole[i] })),
        freezeLap, giroFinale: fine,
        mescolaAlCongelamento: cella.compound,
        etaAlCongelamento: a,
      });
      return pianoFattibile(p, vitaMassima) ? p : null;
    };

    // discesa per coordinate: una sosta alla volta, entro il raggio dichiarato
    let correnti = partenza.map((m) => Math.min(Math.max(m, 1), R - 1));
    let piano = costruisci(correnti);
    if (piano === null && k > 0) {
      // l'arrotondamento ha prodotto giri coincidenti: si separano di forza
      correnti = correnti.map((m, i) => Math.min(Math.max(m, 1 + i), R - 1 - (k - 1 - i)));
      piano = costruisci(correnti);
    }
    if (piano === null) continue;
    let migliore = valutaPiano({ gara, freezeLap, pilota, piano, sosteAtteseRivali }, contesto);
    if (migliore.totale === null) { perK.push({ k, piano, totale: null }); continue; }

    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (let i = 0; i < correnti.length; i += 1) {
        for (let d = -RAGGIO_RICERCA; d <= RAGGIO_RICERCA; d += 1) {
          if (d === 0) continue;
          const prova = [...correnti];
          prova[i] += d;
          const p = costruisci(prova);
          if (p === null) continue;
          const v = valutaPiano({ gara, freezeLap, pilota, piano: p, sosteAtteseRivali }, contesto);
          if (meglioDi(v, migliore, obiettivo)) {
            correnti = prova; piano = p; migliore = v; cambiato = true;
          }
        }
      }
    }
    perK.push({ k, piano, totale: migliore.totale, posizione: migliore.posizione, popolazione: migliore.popolazione, scenario: migliore.scenario });
  }

  const valutabili = perK.filter((x) => x.totale !== null);
  const migliore = valutabili.length
    ? valutabili.reduce((m, x) => (meglioDi(x, m, obiettivo) ? x : m))
    : null;

  // NESSUN PIANO FATTIBILE: il vincolo si RILASSA e lo dichiara (prereg §4).
  // Un prodotto che non risponde e' peggio di un prodotto che risponde dicendo di aver
  // allentato un vincolo. Il caso si marca e chi misura lo conta: se fosse la maggioranza,
  // il vincolo non sarebbe un vincolo ma un interruttore che spegne il pianificatore.
  if (migliore === null && vitaMassima) {
    const senza = pianoOttimo({
      gara, freezeLap, pilota, giroFinale, kMax, mescolaPrimaSosta, sosteAtteseRivali, obiettivo,
      vitaMassima: null,
    }, contesto);
    return { ...senza, vincolo_rilassato: true };
  }
  return {
    migliore,
    per_k: perK.map((x) => ({ k: x.k, totale: x.totale, posizione: x.posizione ?? null, soste: x.piano.soste.map((s) => s.giro) })),
    obiettivo,
    mescole_gia_usate: [...usate].sort(),
    k_minimo: kMinimo,
    vincolo_regolamento: kMinimo > 0
      ? `al congelamento ${pilota} ha usato una sola mescola slick (${[...usate].join(', ') || 'nessuna'}) e il piano arriva alla bandiera: almeno una sosta è OBBLIGATORIA (regolamento 2026, due slick sull'asciutto). Non è una preferenza del modello`
      : null,
  };
}
