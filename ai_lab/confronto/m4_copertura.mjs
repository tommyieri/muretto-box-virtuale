// m4_copertura.mjs — METRICA M4: COPERTURA, E QUANTO VALGONO I CASI PERSI.
//
//   node ai_lab/confronto/m4_copertura.mjs           (a) (b) (c) (d) sulle soste vere
//   node ai_lab/confronto/m4_copertura.mjs --largo   in piu': (e) i congelamenti generici
//   node ai_lab/confronto/m4_copertura.mjs --largo --passo 2   (sottocampiona i giri)
//
// La domanda di M4 non e' «quante risposte perde il nuovo» ma «SE QUELLE CHE PERDE ERANO
// BUONE». Tacere dove il vecchio sbagliava e' un guadagno; tacere dove indovinava e' una
// perdita netta. Il cancello pre-registrato e' esattamente questo confronto.
//
// DUE LETTURE DELL'ERRORE, ed e' obbligatorio darle entrambe (difetto P2 del collaudo):
//   A · GREZZA        |pos − posizioneVera|, cioe' i due campi che il banco consegna.
//                     `pos` e' pero' un rango dentro la popolazione DI QUEL MOTORE, e le
//                     popolazioni non coincidono con quella della verita'.
//   B · POPOLAZIONE COMUNE  la previsione e la verita' RI-CLASSIFICATE sull'intersezione
//                     fra i piloti che il motore ha simulato e quelli che la verita' ha.
//                     Bilaterale (motore ∩ verita'): a differenza della lettura B a tre vie
//                     del collaudo, questa si puo' calcolare ANCHE quando l'altro motore e'
//                     muto — ed e' proprio il sottoinsieme che M4 deve misurare.
// Se le due letture dessero verdetti diversi, si scrive che li danno.
//
// Nessuna scrittura su disco. Non tocca demo/, simulatore/, data/.

import {
  casi, censimento, rispostaVecchio, rispostaNuovo, datiVecchio, garaSimDi, gare,
} from './banco.mjs';

const argv = process.argv.slice(2);
const LARGO = argv.includes('--largo');
const PASSO = (() => { const i = argv.indexOf('--passo'); return i >= 0 ? Number(argv[i + 1]) : 1; })();

// ————————————————————————————————————————————————————————————————— utensili
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const fx = (x, n = 3) => (x == null ? 'n/d' : x.toFixed(n));

// PRNG deterministico per il test di permutazione (nessun Math.random: il numero deve
// essere lo stesso a ogni esecuzione).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutazione sulle etichette: la mediana del gruppo A e' diversa da quella del gruppo B
 * piu' di quanto capiterebbe per caso? Restituisce la p a due code.
 */
function permutazione(gruppoA, gruppoB, stat = mediana, iter = 20000, seme = 20260731) {
  if (!gruppoA.length || !gruppoB.length) return null;
  const tutti = [...gruppoA, ...gruppoB];
  const nA = gruppoA.length;
  const osservato = Math.abs(stat(gruppoA) - stat(gruppoB));
  const rnd = mulberry32(seme);
  let almenoQuanto = 0;
  for (let i = 0; i < iter; i += 1) {
    const v = [...tutti];
    for (let k = v.length - 1; k > 0; k -= 1) {
      const j = Math.floor(rnd() * (k + 1));
      [v[k], v[j]] = [v[j], v[k]];
    }
    const d = Math.abs(stat(v.slice(0, nA)) - stat(v.slice(nA)));
    if (d >= osservato - 1e-12) almenoQuanto += 1;
  }
  return { osservato, p: (almenoQuanto + 1) / (iter + 1) };
}
const quotaEsatti = (v) => (v.length ? v.filter((x) => x === 0).length / v.length : 0);

// ———————————————————————————————————————————————————————————— i due errori
/** A · l'errore grezzo: i due campi che il banco consegna. */
function erroreGrezzo(r, c) {
  if (r.muto || r.pos == null) return null;
  return Math.abs(r.pos - c.posizioneVera);
}
/** B · l'errore sulla popolazione comune motore ∩ verita' (bilaterale). */
function erroreComune(r, c) {
  if (r.muto || !r.ordine) return null;
  const suoi = new Set(r.ordine.map((x) => (Array.isArray(x) ? x[0] : x)));
  const S = c.ordineVero.filter((d) => suoi.has(d));
  if (!S.includes(c.pilota) || S.length < 3) return null;
  const mio = r.ordine.map((x) => (Array.isArray(x) ? x[0] : x))
    .filter((d) => S.includes(d)).indexOf(c.pilota) + 1;
  const vero = S.indexOf(c.pilota) + 1;   // ordineVero e' gia' in ordine di cum vero
  return { err: Math.abs(mio - vero), segno: mio - vero, su: S.length };
}

function riassunto(etichetta, err) {
  const n = err.length;
  const esatti = err.filter((x) => x === 0).length;
  const entro1 = err.filter((x) => x <= 1).length;
  return { etichetta, n, mediana: mediana(err), media: media(err), esatti, entro1,
           quotaEsatti: n ? esatti / n : null, quotaEntro1: n ? entro1 / n : null };
}
function stampaRiga(r) {
  console.log(`    ${r.etichetta.padEnd(34)} n=${String(r.n).padStart(3)}`
    + `  mediana ${String(r.mediana ?? 'n/d').padStart(4)}`
    + `  media ${fx(r.media, 2).padStart(5)}`
    + `  esatti ${String(r.esatti).padStart(3)} (${pct(r.esatti, r.n).padStart(6)})`
    + `  entro1 ${String(r.entro1).padStart(3)} (${pct(r.entro1, r.n).padStart(6)})`);
}

// ============================================================================
console.log('══════════════════════════════════════════════════════════════════════');
console.log('M4 — COPERTURA E ACCURATEZZA DEI CASI PERSI');
console.log('══════════════════════════════════════════════════════════════════════');

const elenco = casi();
const cens = censimento();
console.log(`\nperimetro: ${elenco.length} soste vere ammesse su ${cens.soste_reali_trovate} soste reali`
  + ` (escluse: ${Object.entries(cens.esclusi).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' · ')})`);

// una sola valutazione per caso, riusata da tutte le sezioni
const tavola = elenco.map((c) => {
  const v = rispostaVecchio(c);
  const n = rispostaNuovo(c);
  return {
    c, v, n,
    vRisp: !v.muto && v.pos != null,
    nRisp: !n.muto && n.pos != null,
    errVA: erroreGrezzo(v, c), errNA: erroreGrezzo(n, c),
    errVB: erroreComune(v, c), errNB: erroreComune(n, c),
  };
});

// ————————————————————————————————————————————————————————————————— (a)
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('(a) LA TAVOLA DEI MUTI');
console.log('──────────────────────────────────────────────────────────────────────');
const entrambi = tavola.filter((t) => t.vRisp && t.nRisp);
const soloV = tavola.filter((t) => t.vRisp && !t.nRisp);
const soloN = tavola.filter((t) => !t.vRisp && t.nRisp);
const nessuno = tavola.filter((t) => !t.vRisp && !t.nRisp);
const N = tavola.length;
console.log(`    entrambi rispondono      : ${String(entrambi.length).padStart(3)}  (${pct(entrambi.length, N)})`);
console.log(`    solo il VECCHIO risponde : ${String(soloV.length).padStart(3)}  (${pct(soloV.length, N)})   ← i CASI PERSI del cancello M4`);
console.log(`    solo il NUOVO risponde   : ${String(soloN.length).padStart(3)}  (${pct(soloN.length, N)})   ← i casi GUADAGNATI`);
console.log(`    nessuno dei due          : ${String(nessuno.length).padStart(3)}  (${pct(nessuno.length, N)})`);
console.log(`    ─ copertura VECCHIO ${tavola.filter((t) => t.vRisp).length}/${N} (${pct(tavola.filter((t) => t.vRisp).length, N)})`
  + `  ·  copertura NUOVO ${tavola.filter((t) => t.nRisp).length}/${N} (${pct(tavola.filter((t) => t.nRisp).length, N)})`
  + `  ·  saldo ${tavola.filter((t) => t.nRisp).length - tavola.filter((t) => t.vRisp).length}`);

console.log('\n    PERCHE\' TACCIONO (motivo dichiarato dal motore)');
for (const [nome, sel, chi] of [['VECCHIO', (t) => !t.vRisp, (t) => t.v], ['NUOVO', (t) => !t.nRisp, (t) => t.n]]) {
  const m = new Map();
  for (const t of tavola.filter(sel)) {
    const raw = chi(t).motivo ?? 'senza motivo';
    const k = raw.startsWith('respinto dal Director') ? 'respinto dal Director' : raw;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  console.log(`    ${nome}: ${m.size ? [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(' · ') : 'mai muto'}`);
}

console.log('\n    PER GARA (blocchi = gare, prereg E11)');
console.log(`    ${'gara'.padEnd(16)} ${'casi'.padStart(5)} ${'entrambi'.padStart(9)} ${'soloV'.padStart(6)} ${'soloN'.padStart(6)} ${'nessuno'.padStart(8)} ${'cop.V'.padStart(7)} ${'cop.N'.padStart(7)}`);
for (const g of gare()) {
  const t = tavola.filter((x) => x.c.gara === g);
  const e = t.filter((x) => x.vRisp && x.nRisp).length;
  const sv = t.filter((x) => x.vRisp && !x.nRisp).length;
  const sn = t.filter((x) => !x.vRisp && x.nRisp).length;
  const no = t.filter((x) => !x.vRisp && !x.nRisp).length;
  console.log(`    ${g.padEnd(16)} ${String(t.length).padStart(5)} ${String(e).padStart(9)} ${String(sv).padStart(6)} ${String(sn).padStart(6)} ${String(no).padStart(8)}`
    + ` ${pct(e + sv, t.length).padStart(7)} ${pct(e + sn, t.length).padStart(7)}`);
}

// ————————————————————————————————————————————————————————————————— (b)
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('(b) I CASI PERSI ERANO BUONI? — errore del VECCHIO sui casi in cui il NUOVO tace');
console.log('──────────────────────────────────────────────────────────────────────');
function blocco(nome, chiRisponde, chiTace, estraiA, estraiB) {
  const tuttiRisp = tavola.filter(chiRisponde);
  const persi = tuttiRisp.filter(chiTace);
  const tenuti = tuttiRisp.filter((t) => !chiTace(t));
  for (const [tag, estrai, mappa] of [['A · GREZZA (|pos − posizioneVera|)', estraiA, (x) => x],
                                      ['B · POPOLAZIONE COMUNE (motore ∩ verita\')', estraiB, (x) => x.err]]) {
    const tutti = tuttiRisp.map(estrai).filter((x) => x != null).map(mappa);
    const p = persi.map(estrai).filter((x) => x != null).map(mappa);
    const k = tenuti.map(estrai).filter((x) => x != null).map(mappa);
    console.log(`\n    LETTURA ${tag}`);
    stampaRiga(riassunto(`${nome} · TUTTI i casi in cui risponde`, tutti));
    stampaRiga(riassunto(`${nome} · casi TENUTI (rispondono in 2)`, k));
    stampaRiga(riassunto(`${nome} · casi PERSI (l'altro tace)`, p));
    if (p.length && k.length) {
      const perm = permutazione(p, k);
      const permE = permutazione(p, k, quotaEsatti);
      const dMed = mediana(p) - mediana(k), dMedia = media(p) - media(k);
      console.log(`      Δ persi−tenuti: mediana ${dMed > 0 ? '+' : ''}${dMed}  ·  media ${dMedia > 0 ? '+' : ''}${fx(dMedia, 2)}`
        + `  ·  quota esatti ${(100 * (quotaEsatti(p) - quotaEsatti(k))).toFixed(1)} punti`);
      console.log(`      permutazione: sulle mediane p=${fx(perm.p, 4)} · sulla quota di esatti p=${fx(permE.p, 4)}`
        + `  (${Math.min(perm.p, permE.p) < 0.05 ? 'almeno una distinguibile dal caso' : 'NON distinguibile dal caso'})`);
      console.log(`      verdetto: sui casi persi il ${nome} sbagliava `
        + `${dMed > 0 ? 'DI PIU\'' : dMed < 0 ? 'DI MENO' : 'ALLO STESSO MODO'} della sua media `
        + `⇒ tacere li' e' un ${dMed > 0 ? 'GUADAGNO' : dMed < 0 ? 'DANNO' : 'PAREGGIO'} (mediana)`);
    } else {
      console.log('      (sottoinsieme vuoto: niente da confrontare)');
    }
  }
}
blocco('VECCHIO', (t) => t.vRisp, (t) => !t.nRisp, (t) => t.errVA, (t) => t.errVB);

// ————————————————————————————————————————————————————————————————— (c)
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('(c) LO SPECCHIO — errore del NUOVO sui casi in cui il VECCHIO tace');
console.log('──────────────────────────────────────────────────────────────────────');
blocco('NUOVO', (t) => t.nRisp, (t) => !t.vRisp, (t) => t.errNA, (t) => t.errNB);

// ———————————————————————————————————————————————————————— (b2) per fascia
// I casi persi sulle soste vere sono 12: troppo pochi per un verdetto. Ma il campione
// largo (sezione e) mostra che il silenzio del nuovo e' una REGIONE, non una manciata di
// casi: i primi giri. Allora la domanda «i casi persi erano buoni?» si riformula in
// «QUANTO VALE IL MOTORE VECCHIO NELLA REGIONE IN CUI IL NUOVO TACE?», e li' n e' grande.
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('(b2) LA REGIONE DEL SILENZIO — accuratezza dei due motori per fascia di giro');
console.log('──────────────────────────────────────────────────────────────────────');
{
  const fasce = [[4, 8], [9, 13], [14, 20], [21, 30], [31, 45], [46, 99]];
  console.log(`    ${'fascia'.padEnd(8)} ${'casi'.padStart(5)} ${'ris.V'.padStart(6)} ${'ris.N'.padStart(6)}`
    + ` ${'VECCHIO med|es% (A)'.padStart(20)} ${'VECCHIO med|es% (B)'.padStart(20)} ${'NUOVO med|es% (B)'.padStart(20)}`);
  for (const [a, b] of fasce) {
    const t = tavola.filter((x) => x.c.pitLap >= a && x.c.pitLap <= b);
    if (!t.length) continue;
    const vA = t.map((x) => x.errVA).filter((x) => x != null);
    const vB = t.map((x) => x.errVB).filter((x) => x != null).map((x) => x.err);
    const nB = t.map((x) => x.errNB).filter((x) => x != null).map((x) => x.err);
    const cella = (v) => (v.length ? `${mediana(v)} | ${pct(v.filter((x) => x === 0).length, v.length)} (n=${v.length})` : 'n/d');
    console.log(`    ${`${a}-${b}`.padEnd(8)} ${String(t.length).padStart(5)} ${String(t.filter((x) => x.vRisp).length).padStart(6)} ${String(t.filter((x) => x.nRisp).length).padStart(6)}`
      + ` ${cella(vA).padStart(20)} ${cella(vB).padStart(20)} ${cella(nB).padStart(20)}`);
  }
  // il taglio che conta: la regione in cui il nuovo e' strutturalmente muto (sosta <= 13)
  const dentro = tavola.filter((x) => x.c.pitLap <= 13 && x.vRisp);
  const fuori = tavola.filter((x) => x.c.pitLap > 13 && x.vRisp);
  for (const [tag, estrai] of [['A · grezza', (x) => x.errVA], ['B · popolazione comune', (x) => (x.errVB ? x.errVB.err : null)]]) {
    const d = dentro.map(estrai).filter((x) => x != null);
    const f = fuori.map(estrai).filter((x) => x != null);
    const perm = permutazione(d, f);
    const permE = permutazione(d, f, quotaEsatti);
    console.log(`\n    VECCHIO, lettura ${tag} — sosta <= giro 13 (dove il nuovo e' quasi sempre muto) contro sosta > 13`);
    stampaRiga(riassunto('  sosta <= 13', d));
    stampaRiga(riassunto('  sosta >  13', f));
    console.log(`      Δ dentro−fuori: mediana ${mediana(d) - mediana(f) > 0 ? '+' : ''}${mediana(d) - mediana(f)}`
      + `  ·  media ${media(d) - media(f) > 0 ? '+' : ''}${fx(media(d) - media(f), 2)}`
      + `  ·  quota esatti ${(100 * (quotaEsatti(d) - quotaEsatti(f))).toFixed(1)} punti`
      + `  ·  permutazione mediane p=${perm ? fx(perm.p, 4) : 'n/d'} · quota esatti p=${permE ? fx(permE.p, 4) : 'n/d'}`);
  }
}

// ————————————————————————————————————————————————————————————————— (d)
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('(d) DOVE STANNO I CASI PERSI / GUADAGNATI');
console.log('──────────────────────────────────────────────────────────────────────');
function distribuzione(nome, gruppo) {
  if (!gruppo.length) { console.log(`\n    ${nome}: nessun caso`); return; }
  console.log(`\n    ${nome} — n=${gruppo.length}`);
  const giri = gruppo.map((t) => t.c.pitLap);
  const frazione = gruppo.map((t) => t.c.pitLap / t.c.nGiri);
  console.log(`      giro della sosta: min ${Math.min(...giri)} · mediana ${mediana(giri)} · max ${Math.max(...giri)}`
    + `  ·  frazione di gara mediana ${fx(mediana(frazione), 2)}`);
  const fasce = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 99]];
  console.log(`      per fascia di giro: ${fasce.map(([a, b]) => `${a}-${b}: ${giri.filter((g) => g >= a && g <= b).length}`).join(' · ')}`);
  const perGara = new Map();
  for (const t of gruppo) perGara.set(t.c.gara, (perGara.get(t.c.gara) ?? 0) + 1);
  console.log(`      per gara: ${[...perGara.entries()].sort((a, b) => b[1] - a[1]).map(([g, k]) => `${g} ${k}`).join(' · ')}`);
  const neu = gruppo.filter((t) => t.c.neutralizzato).length;
  const reg = new Map();
  for (const t of gruppo) { const r = t.c.regimeAlCongelamento ?? 'verde'; reg.set(r, (reg.get(r) ?? 0) + 1); }
  console.log(`      al congelamento: flag neutralized ${neu}/${gruppo.length} (${pct(neu, gruppo.length)})`
    + `  ·  regime ${[...reg.entries()].map(([r, k]) => `${r} ${k}`).join(' · ')}`);
  const mesc = new Map();
  for (const t of gruppo) { const m = t.c.mescolaAlCongelamento ?? 'assente'; mesc.set(m, (mesc.get(m) ?? 0) + 1); }
  console.log(`      mescola al congelamento: ${[...mesc.entries()].sort((a, b) => b[1] - a[1]).map(([m, k]) => `${m} ${k}`).join(' · ')}`);
  const senzaPasso = gruppo.filter((t) => !t.c.passoVecchioDisponibile).length;
  console.log(`      senza passo del vecchio: ${senzaPasso}/${gruppo.length}`);
  console.log(`      elenco: ${gruppo.map((t) => t.c.id).join(' , ')}`);
}
distribuzione('CASI PERSI (solo il vecchio risponde)', soloV);
distribuzione('CASI GUADAGNATI (solo il nuovo risponde)', soloN);
distribuzione('MUTI DA ENTRAMBI', nessuno);

// distribuzione di riferimento: tutti i casi, per far vedere se i persi sono spostati
{
  const giri = tavola.map((t) => t.c.pitLap);
  const fasce = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 99]];
  console.log(`\n    RIFERIMENTO — tutti i ${tavola.length} casi: per fascia di giro `
    + fasce.map(([a, b]) => `${a}-${b}: ${giri.filter((g) => g >= a && g <= b).length}`).join(' · ')
    + `  ·  mediana ${mediana(giri)}`);
  const neu = tavola.filter((t) => t.c.neutralizzato).length;
  console.log(`    RIFERIMENTO — flag neutralized al congelamento: ${neu}/${tavola.length} (${pct(neu, tavola.length)})`);
}

// ————————————————————————————————————————————————————————————————— (e)
if (LARGO) {
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('(e) CAMPIONE LARGO — I CONGELAMENTI GENERICI (nessuna verita\': solo copertura)');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('    Le soste vere sono poche e concentrate a meta\' gara: non bastano a vedere il');
  console.log('    silenzio di inizio gara. Qui si chiede a ENTRAMBI la stessa domanda per ogni');
  console.log('    pilota in pista a ogni giro di congelamento L (sosta a L+1, rientro a L+2).');
  console.log(`    Passo sui giri: ${PASSO}`);
  const t0 = Date.now();
  const fasce = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 30], [31, 40], [41, 99]];
  const perFascia = fasce.map(() => ({ n: 0, v: 0, nu: 0, sv: 0, sn: 0 }));
  const motiviN = new Map(); const motiviV = new Map();
  let tot = 0, copV = 0, copN = 0, soloVL = 0, soloNL = 0;
  const perGaraL = new Map();
  const perGiro = new Map();   // giro assoluto -> {n, v, nu}
  for (const g of gare()) {
    const { byLap, nLaps, G } = datiVecchio(g);
    const garaSim = garaSimDi(g);
    const riga = { n: 0, v: 0, nu: 0, sv: 0, sn: 0, svPresto: 0 };
    for (let L = 3; L <= nLaps - 2; L += PASSO) {
      const cars = byLap[L]; if (!cars) continue;
      for (const pilota of Object.keys(cars)) {
        if (typeof cars[pilota].cum_time !== 'number') continue;   // non e' in pista
        const caso = { id: `${g}|${pilota}|${L + 1}`, gara: g, garaSim, pilota,
                       freezeLap: L, pitLap: L + 1, rientroLap: L + 2, nGiri: nLaps };
        const rv = rispostaVecchio(caso);
        const rn = rispostaNuovo(caso);
        const okV = !rv.muto && rv.pos != null;
        const okN = !rn.muto && rn.pos != null;
        tot += 1; riga.n += 1;
        if (okV) { copV += 1; riga.v += 1; } else {
          const k = (rv.motivo ?? 'senza motivo').startsWith('respinto') ? 'respinto dal Director' : (rv.motivo ?? 'senza motivo');
          motiviV.set(k, (motiviV.get(k) ?? 0) + 1);
        }
        if (okN) { copN += 1; riga.nu += 1; } else {
          const k = (rn.motivo ?? 'senza motivo').startsWith('respinto dal Director') ? 'respinto dal Director' : (rn.motivo ?? 'senza motivo');
          motiviN.set(k, (motiviN.get(k) ?? 0) + 1);
        }
        if (okV && !okN) { soloVL += 1; riga.sv += 1; if (L + 1 <= 15) riga.svPresto += 1; }
        if (!okV && okN) { soloNL += 1; riga.sn += 1; }
        const fi = fasce.findIndex(([a, b]) => L + 1 >= a && L + 1 <= b);
        if (fi >= 0) { perFascia[fi].n += 1; if (okV) perFascia[fi].v += 1; if (okN) perFascia[fi].nu += 1;
                       if (okV && !okN) perFascia[fi].sv += 1; if (!okV && okN) perFascia[fi].sn += 1; }
        const pg = perGiro.get(L + 1) ?? { n: 0, v: 0, nu: 0 };
        pg.n += 1; if (okV) pg.v += 1; if (okN) pg.nu += 1; perGiro.set(L + 1, pg);
      }
    }
    perGaraL.set(g, riga);
    void G;
  }
  console.log(`\n    domande poste: ${tot}  (in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(`    risponde il VECCHIO : ${copV}  (${pct(copV, tot)})`);
  console.log(`    risponde il NUOVO   : ${copN}  (${pct(copN, tot)})`);
  console.log(`    SALDO del nuovo     : ${copN - copV}`);
  console.log(`    solo il vecchio     : ${soloVL}   ·   solo il nuovo: ${soloNL}`);
  console.log(`\n    PERCHE' TACE IL NUOVO: ${[...motiviN.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(' · ') || 'mai'}`);
  console.log(`    PERCHE' TACE IL VECCHIO: ${[...motiviV.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(' · ') || 'mai'}`);
  console.log(`\n    COPERTURA PER FASCIA DI GIRO DELLA SOSTA`);
  console.log(`    ${'fascia'.padEnd(10)} ${'domande'.padStart(8)} ${'vecchio'.padStart(14)} ${'nuovo'.padStart(14)} ${'soloV(persi)'.padStart(13)} ${'soloN'.padStart(7)}`);
  fasce.forEach(([a, b], i) => {
    const r = perFascia[i]; if (!r.n) return;
    console.log(`    ${`${a}-${b}`.padEnd(10)} ${String(r.n).padStart(8)} ${`${r.v} (${pct(r.v, r.n)})`.padStart(14)} ${`${r.nu} (${pct(r.nu, r.n)})`.padStart(14)} ${String(r.sv).padStart(13)} ${String(r.sn).padStart(7)}`);
  });
  console.log(`\n    PRIMI GIRI, UNO PER UNO (giro della sosta)`);
  console.log(`    ${'giro'.padStart(5)} ${'domande'.padStart(8)} ${'vecchio'.padStart(14)} ${'nuovo'.padStart(14)}`);
  for (const giro of [...perGiro.keys()].sort((a, b) => a - b).slice(0, 14)) {
    const r = perGiro.get(giro);
    console.log(`    ${String(giro).padStart(5)} ${String(r.n).padStart(8)} ${`${r.v} (${pct(r.v, r.n)})`.padStart(14)} ${`${r.nu} (${pct(r.nu, r.n)})`.padStart(14)}`);
  }
  console.log(`\n    PER GARA`);
  console.log(`    ${'gara'.padEnd(16)} ${'domande'.padStart(8)} ${'vecchio'.padStart(14)} ${'nuovo'.padStart(14)} ${'saldo'.padStart(7)} ${'soloV'.padStart(6)} ${'di cui <=15'.padStart(12)} ${'soloN'.padStart(6)}`);
  for (const [g, r] of perGaraL) {
    console.log(`    ${g.padEnd(16)} ${String(r.n).padStart(8)} ${`${r.v} (${pct(r.v, r.n)})`.padStart(14)} ${`${r.nu} (${pct(r.nu, r.n)})`.padStart(14)} ${String(r.nu - r.v).padStart(7)}`
      + ` ${String(r.sv).padStart(6)} ${`${r.svPresto} (${pct(r.svPresto, r.sv)})`.padStart(12)} ${String(r.sn).padStart(6)}`);
  }
}

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('FINE M4');
console.log('══════════════════════════════════════════════════════════════════════');
