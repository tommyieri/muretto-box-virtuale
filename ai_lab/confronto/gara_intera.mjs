// gara_intera.mjs — LA GARA INTERA COL NOSTRO MOTORE, contro la realta'.
//
//     node ai_lab/confronto/gara_intera.mjs [--json]
//
// Dieci gare, dieci team diversi, dieci piloti diversi. Per ognuno si congela il
// piu' presto possibile e si simula FINO ALLA BANDIERA con la sua strategia vera:
// gli stessi giri di sosta, le stesse mescole. Poi si guarda dove il motore lo
// mette e dove e' finito davvero.
//
// Tutto passa dal motore vero: passo base, deriva carburante, degrado, rodaggio,
// pit-loss di circuito, fattore di neutralizzazione, Director. Nessuna scorciatoia,
// nessun ramo speciale per il test.
//
// Perimetro, metro, casi sporchi e cancelli stanno in PREREG_gara_intera.md, scritta
// PRIMA di far girare la prima simulazione. Qui non si decide niente: si esegue.
//
// TRE COSE CHE VANNO LETTE PRIMA DEI NUMERI (§1 della prereg):
//   1. non si parte dal giro 1 — prima del giro 5 non esiste un passo base da cui
//      partire, e inventarlo e' proprio cio' che la regola 6 vieta;
//   2. le soste vere sono INFORMAZIONE DAL FUTURO: si misura la FISICA, non la
//      capacita' di prevedere la strategia. Questi numeri non sono una previsione;
//   3. si proiettano ~55 giri contro i 5-10 validati: il motore lo dichiara da se'
//      con l'assunzione OLTRE_ORIZZONTE_VALIDATO, che resta attaccata a ogni caso.
//
// NON SCRIVE NIENTE su disco.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { cambiDiPosizione } from '../../simulatore/engine/kernel.mjs';
import { RADICE, gare, garaNuova, garaSimDi, contestoNuovo, riclassifica } from './banco.mjs';

// --rivali: ogni pilota riceve le SUE soste vere, non solo il soggetto. E' l'ingresso
// di laboratorio della Domanda B di PREREG_sorpassi.md, e rende SIMMETRICA
// l'informazione dal futuro. Spento, il costruttore non fa fermare nessun rivale in
// verde — che e' giusto in diretta e distorsivo qui.
const RIVALI = process.argv.includes('--rivali');

// Il congelamento NON e' una costante. La prima prereg diceva «il primo possibile» e
// poi lo scriveva come 5, dando per scontato che al giro 5 esistano quattro giri
// verdi. E' falso quando la gara parte neutralizzata (Belgio dietro la SC, Gran
// Bretagna sotto giallo): li' il motore non ha un passo base e si rifiuta di
// inventarlo (regola 6). Si prova dal giro 5 in avanti fino al primo in cui un passo
// base esiste davvero. Vedi PREREG_gara_intera_2.md §(a).
const CONGELAMENTO_MIN = 5;   // min_giri_base = 4, piu' il giro stesso
const CONGELAMENTO_MAX = 15;  // oltre, la proiezione non sarebbe piu' «la gara intera»

// ── il perimetro, copiato dalla prereg §2: meccanico, cieco all'esito ────────
const TEAM = ['Alpine', 'Aston Martin', 'Audi', 'Cadillac', 'Ferrari',
  'Haas F1 Team', 'McLaren', 'Mercedes', 'Racing Bulls', 'Red Bull Racing'];

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// ── la verita' d'arrivo, da una fonte DIVERSA dal byLap che il motore legge ──
const arrivi = [];
{
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
    arrivi.push(o);
  }
}
const perGara = (g) => arrivi.filter((x) => x.gara === g);
const riga = (g, p) => arrivi.find((x) => x.gara === g && x.pilota === p) ?? null;

/** L'ordine d'arrivo VERO: i classificati per posizione finale crescente. */
function ordineVero(g) {
  return perGara(g).filter((x) => x.classificato && Number.isFinite(x.pos_finale))
    .sort((a, b) => a.pos_finale - b.pos_finale).map((x) => x.pilota);
}

/**
 * L'ordine al giro del congelamento, per cum_time: e' il MODELLO NULLO (prereg §6).
 *
 * `perPilota` e' una Map di Map (pilota -> giro -> cella) e le celle NON portano il
 * numero di giro dentro di se': la prima scrittura di questa funzione la trattava
 * come un oggetto di array e restituiva sempre l'insieme vuoto, cioe' il modello
 * nullo non esisteva e G4 non era misurabile. Era un difetto dello strumento, non
 * un esito: corretto e rimisurato prima di leggere qualunque numero (E22).
 */
function ordineAlGiro(gSim, lap) {
  const cum = {};
  for (const [drv, celle] of gSim.perPilota) {
    const c = celle.get(lap);
    if (c && Number.isFinite(c.cum_time)) cum[drv] = c.cum_time;
  }
  return Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
}

/** L'ordine finale PREVISTO: per cum_time all'ultimo giro presente nella traccia. */
function ordinePrevisto(traccia, giroFinale) {
  if (!traccia) return null;
  const cum = {};
  for (const [drv, passi] of Object.entries(traccia)) {
    if (!passi || !passi.length) continue;
    // l'ultimo giro <= giroFinale che il motore ha davvero prodotto per lui
    let ultimo = null;
    for (const p of passi) if (p.lap <= giroFinale && (ultimo === null || p.lap > ultimo.lap)) ultimo = p;
    if (ultimo && Number.isFinite(ultimo.cum_time)) cum[drv] = { cum: ultimo.cum_time, lap: ultimo.lap };
  }
  const giri = Object.values(cum).map((x) => x.lap);
  return {
    ordine: Object.keys(cum).sort((a, b) => (cum[a].cum - cum[b].cum) || (a < b ? -1 : 1)),
    giro_min: giri.length ? Math.min(...giri) : null,
    giro_max: giri.length ? Math.max(...giri) : null,
  };
}

/** Le soste vere di TUTTI in quella gara, nel formato del costruttore. */
function pianiVeriDi(nomeSito) {
  const m = {};
  for (const r of perGara(nomeSito)) if (r.soste_piano.length) m[r.pilota] = r.soste_piano;
  return m;
}

// ── un caso: congela, dagli la SUA strategia vera, corri fino alla bandiera ──
function corri(nomeSito, pilota) {
  const r = riga(nomeSito, pilota);
  if (!r) return { saltato: 'nessuna riga in arrivi_2026.csv' };
  if (!r.classificato) return { saltato: `non classificato (${r.tipo_arrivo})`, tipo_arrivo: r.tipo_arrivo };
  if (!r.soste_piano.length) return { saltato: 'nessuna sosta registrata: non c\'e\' pit-loss ne\' mescola da simulare' };

  const gSim = garaNuova(nomeSito);
  const contesto = contestoNuovo(nomeSito);

  // Si scende il congelamento finche' il motore non ha un passo base per lui. Le soste
  // gia' avvenute NON si rimettono nel piano: il costruttore legge lo stato vero fino al
  // congelamento, quindi il pilota ci arriva gia' con la gomma che aveva davvero e la sua
  // eta'. Rimetterle sarebbe farlo fermare due volte. Toglierle non toglie strategia.
  let sc = null; let esito = null; let prev = null; let congelamento = null; let ultimoMotivo = null;
  for (let lf = CONGELAMENTO_MIN; lf <= CONGELAMENTO_MAX; lf += 1) {
    const futuro = r.soste_piano.filter((s) => s.giro > lf);
    if (!futuro.length) { ultimoMotivo = `nessuna sosta oltre il giro ${lf}`; break; }
    let s2; let e2;
    try {
      s2 = costruisciScenario({
        gara: garaSimDi(nomeSito), freezeLap: lf, pilota, piano: futuro,
        pianiRivali: RIVALI ? pianiVeriDi(nomeSito) : undefined,
      }, contesto);
      e2 = eseguiEValida(s2, contesto.costantiDirector);
    } catch (e) { ultimoMotivo = `eccezione: ${e.message}`; continue; }
    const p2 = ordinePrevisto(e2.risultato.traccia, gSim.nGiri);
    if (!p2 || !p2.ordine.includes(pilota)) { ultimoMotivo = `nessun passo base al giro ${lf} (regola 6)`; continue; }
    sc = s2; esito = e2; prev = p2; congelamento = lf; break;
  }
  if (!prev) return { saltato: ultimoMotivo ?? `nessun passo base fra i giri ${CONGELAMENTO_MIN}-${CONGELAMENTO_MAX}` };

  const vero = ordineVero(nomeSito);
  const nullo = ordineAlGiro(gSim, congelamento);

  // STESSO METRO E STESSA POPOLAZIONE per il motore e per il modello nullo. Passando
  // l'uno come `altro` dell'altro, la ri-classificazione del banco restringe entrambi
  // alla TERNA comune (motore ∩ nullo ∩ verita'): i due errori hanno lo stesso
  // denominatore e G4 confronta due numeri confrontabili. Con popolazioni diverse il
  // concorrente piu' fortunato vincerebbe per il perimetro, non per il merito.
  const m = riclassifica(prev.ordine, vero, pilota, nullo);
  const n = riclassifica(nullo, vero, pilota, prev.ordine);
  if (!m) return { saltato: 'il pilota non e\' nella popolazione comune motore/nullo/verita\'' };

  // ── DOMANDA A · quanto movimento produce il motore, contro quanto ne avviene ──
  // `cambiDiPosizione` e' la definizione del kernel (QUANTI, non QUALI): conta quanti
  // piloti NON sono piu' dove stavano. Si applica due volte allo stesso ordine di
  // partenza, cosi' i due conteggi sono confrontabili.
  const comuni = new Set(nullo.filter((d) => vero.includes(d) && prev.ordine.includes(d)));
  const soloComuni = (o) => o.filter((d) => comuni.has(d));
  const lf0 = soloComuni(nullo);
  const cambiReali = cambiDiPosizione(lf0, soloComuni(vero));
  const cambiMotore = cambiDiPosizione(lf0, soloComuni(prev.ordine));

  const fatal = (esito.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
  return {
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
  };
}

// ── esecuzione ───────────────────────────────────────────────────────────────
const TUTTO = process.argv.includes('--tutto');

function cancelli(buoni, titolo, prereg) {
  const A = buoni.map((e) => Math.abs(e.errore));
  const N = buoni.filter((e) => e.errore_nullo !== null).map((e) => Math.abs(e.errore_nullo));
  const g1 = mediana(A);
  const g2 = A.filter((x) => x <= 3).length / A.length;
  const g3 = media(buoni.map((e) => e.errore));
  const g4 = N.length ? mediana(N) : null;
  const esito = (b) => (b ? 'PASSA' : 'FALLITO');
  console.log('');
  console.log(`  I CANCELLI — ${titolo} (soglie scritte prima, ${prereg})`);
  console.log(`    G1  mediana |errore|            ${g1}      soglia ≤ 3           ${esito(g1 <= 3)}`);
  console.log(`    G2  quota entro ±3 posizioni    ${(g2 * 100).toFixed(1)}%   soglia ≥ 60%         ${esito(g2 >= 0.6)}`);
  console.log(`    G3  bias medio con segno        ${g3 >= 0 ? '+' : ''}${g3.toFixed(2)}   soglia |·| ≤ 1,5     ${esito(Math.abs(g3) <= 1.5)}`);
  console.log(`    G4  batte il modello nullo      ${g1} vs ${g4}   strettamente meglio  ${esito(g4 !== null && g1 < g4)}`);
  console.log('');
  console.log(`    motore  |errore| medio ${media(A).toFixed(2)} · max ${Math.max(...A)} · esatti ${A.filter((x) => x === 0).length}/${A.length} · entro 1 ${A.filter((x) => x <= 1).length}`);
  console.log(`    nullo   |errore| medio ${N.length ? media(N).toFixed(2) : '—'} · max ${N.length ? Math.max(...N) : '—'} · esatti ${N.filter((x) => x === 0).length}/${N.length} · entro 1 ${N.filter((x) => x <= 1).length}`);
  // il confronto APPAIATO: chi vince caso per caso. Due mediane uguali possono
  // nascondere un motore che vince meta' dei casi e ne perde meta'.
  const paia = buoni.filter((e) => e.errore_nullo !== null);
  const vinte = paia.filter((e) => Math.abs(e.errore) < Math.abs(e.errore_nullo)).length;
  const perse = paia.filter((e) => Math.abs(e.errore) > Math.abs(e.errore_nullo)).length;
  console.log(`    appaiato: il motore vince ${vinte}, perde ${perse}, pari ${paia.length - vinte - perse} su ${paia.length}`);
  console.log(`    congelamento mediano al giro ${mediana(buoni.map((e) => e.congelamento))} · giri proiettati mediana ${mediana(buoni.map((e) => e.proiettati))} — il modello e' validato a 10`);

  // ── DOMANDA A · il censimento del movimento (PREREG_sorpassi.md) ──────────
  const cr = buoni.map((e) => e.cambi_reali);
  const cm = buoni.map((e) => e.cambi_motore);
  const resa = media(cr) > 0 ? media(cm) / media(cr) : null;
  console.log('');
  console.log(`    DOMANDA A · movimento: reali ${media(cr).toFixed(2)} cambi per caso (mediana ${mediana(cr)}) `
    + `su un campo di ${mediana(buoni.map((e) => e.campo))} auto`);
  console.log(`                           motore ${media(cm).toFixed(2)} (mediana ${mediana(cm)}) `
    + `→ RESA ${resa === null ? '—' : (resa * 100).toFixed(1) + '%'} ${resa !== null && resa < 0.5 ? '(bassa: sotto la soglia 50% dichiarata)' : '(alta: sopra la soglia 50% dichiarata)'}`);
  return { g1, g2, g3, g4, n: A.length, vinte, perse, resa };
}

// ── R2a: i dieci del PO ──────────────────────────────────────────────────────
const gareScelte = gare().slice(0, 10);
const esiti = [];
for (let i = 0; i < TEAM.length; i += 1) {
  const team = TEAM[i];
  const nomeSito = gareScelte[i];
  const duo = perGara(nomeSito).filter((x) => x.team === team).map((x) => x.pilota).sort();
  const tentativi = [];
  let scelto = null;
  for (const p of duo) {
    const e = corri(nomeSito, p);
    tentativi.push({ pilota: p, ...e });
    if (!e.saltato) { scelto = { team, gara: nomeSito, pilota: p, ...e }; break; }
  }
  esiti.push(scelto ?? {
    team, gara: nomeSito, pilota: duo.join('/') || '—',
    saltato: tentativi.map((t) => `${t.pilota}: ${t.saltato}`).join(' · ') || 'nessun pilota del team in questa gara',
  });
}

if (process.argv.includes('--json')) { console.log(JSON.stringify(esiti, null, 2)); process.exit(0); }

console.log('LA GARA INTERA COL NOSTRO MOTORE — dieci team, dieci piloti, dieci gare');
console.log('  congelamento ADATTIVO: il primo giro ≥ 5 in cui il motore ha davvero un passo base');
console.log(RIVALI
  ? '  soste vere di TUTTI (--rivali): informazione dal futuro SIMMETRICA — strumento di laboratorio'
  : '  soste vere del solo soggetto: informazione dal futuro ASIMMETRICA (i rivali non si fermano)');
console.log('  prereg: PREREG_gara_intera.md + PREREG_gara_intera_2.md');
console.log('');
console.log('  team              pilota gara          Lf  giri  strategia vera        prev  vero  err  nullo');
for (const e of esiti) {
  if (e.saltato) { console.log(`  ${e.team.padEnd(17)} ${e.pilota.padEnd(6)} ${e.gara.padEnd(13)} SALTATO — ${e.saltato}`); continue; }
  const seg = (x) => (x === null ? '  — ' : `${x > 0 ? '+' : ''}${x}`);
  console.log(`  ${e.team.padEnd(17)} ${e.pilota.padEnd(6)} ${e.gara.padEnd(13)} `
    + `${String(e.congelamento).padStart(2)} ${String(e.proiettati).padStart(5)}  ${e.strategia.padEnd(21)} `
    + `${String('P' + e.previsto).padStart(4)} ${String('P' + e.vero).padStart(5)} ${seg(e.errore).padStart(5)} ${seg(e.errore_nullo).padStart(5)}`);
}
const buoni = esiti.filter((e) => !e.saltato);
console.log('');
console.log(`  ${buoni.length}/10 casi utilizzabili · ${esiti.length - buoni.length} saltati (motivo dichiarato sopra)`);
if (buoni.length) cancelli(buoni, 'R2a, i dieci del PO', 'PREREG_gara_intera.md §5');

// ── R2b: tutto il perimetro, per dare POTENZA a G4 ───────────────────────────
if (TUTTO) {
  console.log('');
  console.log('══ R2b — TUTTO IL PERIMETRO ═══════════════════════════════════════════════');
  console.log('  Ogni coppia pilota-gara delle 11 gare. Serve a dare potenza a G4: il');
  console.log('  verdetto sul prodotto si legge QUI, non su dieci casi (PREREG_gara_intera_2.md).');
  const tutti = []; const scarti = {};
  for (const g of gare()) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota);
      if (e.saltato) { const k = e.saltato.replace(/\d+/g, 'N'); scarti[k] = (scarti[k] ?? 0) + 1; continue; }
      tutti.push({ gara: g, pilota: r.pilota, team: r.team, ...e });
    }
  }
  console.log('');
  console.log(`  ${tutti.length} casi utilizzabili su ${arrivi.length} coppie pilota-gara`);
  for (const [k, v] of Object.entries(scarti).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)} scartati — ${k}`);
  if (tutti.length) {
    cancelli(tutti, 'R2b, tutto il perimetro', 'PREREG_gara_intera_2.md');
    // MUOVERE LA QUANTITA' SBAGLIATA COSTA? Terzili sull'ECCESSO di movimento
    // (cambi del motore meno cambi veri): se il motore che inventa movimento
    // sbaglia di piu' di quello che ne inventa poco, il difetto non e' la
    // quantita' di sorpassi ma il fatto che nel kernel le auto si attraversano.
    console.log('');
    console.log('  L\'ECCESSO DI MOVIMENTO COSTA? (terzili su cambi_motore − cambi_reali)');
    const ord = [...tutti].sort((a, b) => (a.cambi_motore - a.cambi_reali) - (b.cambi_motore - b.cambi_reali));
    const t = Math.ceil(ord.length / 3);
    const fasce = [['ne inventa MENO del vero', ord.slice(0, t)],
      ['circa il giusto', ord.slice(t, 2 * t)],
      ['ne inventa PIU\' del vero', ord.slice(2 * t)]];
    for (const [nome, q] of fasce) {
      if (!q.length) continue;
      const ecc = media(q.map((x) => x.cambi_motore - x.cambi_reali));
      const em = media(q.map((x) => Math.abs(x.errore)));
      const en = media(q.map((x) => Math.abs(x.errore_nullo)));
      const v = q.filter((x) => Math.abs(x.errore) < Math.abs(x.errore_nullo)).length;
      const pz = q.filter((x) => Math.abs(x.errore) > Math.abs(x.errore_nullo)).length;
      console.log(`    ${nome.padEnd(26)} n=${String(q.length).padStart(3)}  eccesso medio ${((ecc >= 0 ? '+' : '') + ecc.toFixed(1)).padStart(5)}`
        + `   |errore| medio: motore ${em.toFixed(2)}  nullo ${en.toFixed(2)}   appaiato ${v}-${pz}`);
    }

    // BLOCCHI = GARE (E11): un verdetto medio puo' nascere da due gare estreme.
    console.log('');
    console.log('  G4 E MOVIMENTO, GARA PER GARA (blocchi = gare, E11)');
    console.log('    gara            n   motore  nullo   chi vince   cambi reali  motore   resa');
    for (const g of gare()) {
      const q = tutti.filter((x) => x.gara === g && x.errore_nullo !== null);
      if (!q.length) { console.log(`    ${g.padEnd(15)} —   nessun caso utilizzabile`); continue; }
      const m = mediana(q.map((x) => Math.abs(x.errore)));
      const n = mediana(q.map((x) => Math.abs(x.errore_nullo)));
      const cr = media(q.map((x) => x.cambi_reali));
      const cm = media(q.map((x) => x.cambi_motore));
      const rr = cr > 0 ? cm / cr : null;
      console.log(`    ${g.padEnd(15)} ${String(q.length).padStart(2)}   ${String(m).padStart(6)}  ${String(n).padStart(5)}   `
        + `${(m < n ? 'MOTORE' : m > n ? 'nullo' : 'pari').padEnd(9)}   ${cr.toFixed(1).padStart(11)}  ${cm.toFixed(1).padStart(6)}   `
        + `${rr === null ? '—' : (rr * 100).toFixed(0) + '%'}`);
    }
  }
}
