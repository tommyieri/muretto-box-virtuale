/**
 * M5 — LA BANDA DEL MOTORE NUOVO, misurata sulle soste vere.
 *
 * Domanda pre-registrata: «in quale quota di casi la posizione VERA cade dentro
 * [posizione − banda, posizione + banda]?» Cancello: >= 80% (dichiarato 88,5%).
 *
 * Questo script NON scrive nulla su disco e non tocca demo/ né simulatore/.
 * Uso: node ai_lab/confronto/misura_M5_banda.mjs
 *
 * Cosa lo farebbe fallire (regola 4): se `banda` fosse assente su tutti i casi
 * con risposta, o se la copertura non fosse calcolabile, lo script esce 1.
 */
import { casi, rispostaNuovo, rispostaVecchio, censimento, garaNuova } from './banco.mjs';
import { regimeAlGiro } from '../../simulatore/scenario/risposta.mjs';

const pct = (x, n) => (n === 0 ? 'n/d' : `${((100 * x) / n).toFixed(1)}%`);
const f2 = (x) => (x === null || x === undefined || Number.isNaN(x) ? 'n/d' : x.toFixed(2));
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Ri-classifica previsione e verità sulla POPOLAZIONE COMUNE (intersezione). */
function comune(caso, ordinePrevisto) {
  if (!ordinePrevisto) return null;
  const prev = ordinePrevisto.map((x) => (Array.isArray(x) ? x[0] : x));
  const setVero = new Set(caso.ordineVero);
  const inter = new Set(prev.filter((d) => setVero.has(d)));
  if (!inter.has(caso.pilota)) return null;
  const pPrev = prev.filter((d) => inter.has(d)).indexOf(caso.pilota) + 1;
  const pVero = caso.ordineVero.filter((d) => inter.has(d)).indexOf(caso.pilota) + 1;
  return { pPrev, pVero, n: inter.size };
}

// ————————————————————————————————————————————————— raccolta
const CASI = casi();
const righe = [];
for (const c of CASI) {
  const n = rispostaNuovo(c);
  const v = rispostaVecchio(c);
  righe.push({ caso: c, n, v, cn: n.ok ? comune(c, n.ordine) : null, cv: v.ok ? comune(c, v.ordine) : null });
}

const conBanda = righe.filter((r) => r.n.ok && r.n.banda);
const okSenzaBanda = righe.filter((r) => r.n.ok && !r.n.banda);
const muti = righe.filter((r) => !r.n.ok);

if (conBanda.length === 0) {
  console.error('FALLITO: nessun caso con banda — M5 non è calcolabile.');
  process.exit(1);
}

const dentro = (r) => r.caso.posizioneVera >= r.n.banda.da && r.caso.posizioneVera <= r.n.banda.a;
const larghezza = (r) => r.n.banda.a - r.n.banda.da + 1;

const cens = censimento();
console.log('════════ M5 — LA BANDA DEL MOTORE NUOVO SULLE SOSTE VERE ════════\n');
console.log(`perimetro: ${CASI.length} soste ammesse su ${cens.soste_reali_trovate} soste reali trovate`);
console.log(`  esclusioni: ${JSON.stringify(cens.esclusi)}`);
console.log(`nuovo: risponde ${righe.length - muti.length}/${righe.length}  ·  muto ${muti.length}`);
console.log(`  con banda ${conBanda.length}  ·  ok ma banda null ${okSenzaBanda.length}`);
const motivi = {};
for (const m of muti) motivi[m.n.motivo?.slice(0, 70) ?? '?'] = (motivi[m.n.motivo?.slice(0, 70) ?? '?'] ?? 0) + 1;
for (const [k, n2] of Object.entries(motivi)) console.log(`  muto · ${n2}× ${k}`);

// ———————————————————————————————— 1. copertura complessiva
const cop = conBanda.filter(dentro).length;
console.log('\n──── 1. COPERTURA COMPLESSIVA (lettura grezza: posizioneVera dentro [da, a])');
console.log(`  ${cop}/${conBanda.length} = ${pct(cop, conBanda.length)}   [cancello prereg: >= 80%; dichiarato 88,5%]`);
console.log(`  CANCELLO M5: ${100 * cop / conBanda.length >= 80 ? 'PASSA' : 'CADE'}`);

// ———————————————————————————————— 2. per gara (blocchi = gare, E11)
console.log('\n──── 2. PER GARA (blocchi = gare: nessuna media fra gare senza dirlo)');
const perGara = new Map();
for (const r of conBanda) {
  if (!perGara.has(r.caso.gara)) perGara.set(r.caso.gara, []);
  perGara.get(r.caso.gara).push(r);
}
const quoteGara = [];
console.log('  gara               n    dentro   copertura   larghezza media');
for (const [g, rs] of [...perGara.entries()].sort()) {
  const d = rs.filter(dentro).length;
  const w = rs.reduce((a, r) => a + larghezza(r), 0) / rs.length;
  quoteGara.push(d / rs.length);
  console.log(`  ${g.padEnd(17)} ${String(rs.length).padStart(3)}  ${String(d).padStart(6)}   ${pct(d, rs.length).padStart(8)}   ${w.toFixed(2)}`);
}
console.log(`  mediana delle 11 quote di gara: ${(100 * mediana(quoteGara)).toFixed(1)}%  ·  gare sotto l'80%: ${quoteGara.filter((q) => q < 0.8).length}/${quoteGara.length}`);
console.log('\n  per gara, i DUE motori sugli stessi casi (dove rispondono entrambi):');
console.log('  gara               n    NUOVO banda   VECCHIO ±1');
for (const [g, rs0] of [...perGara.entries()].sort()) {
  const rs = rs0.filter((r) => r.v.ok);
  if (!rs.length) { console.log(`  ${g.padEnd(17)}   0        -            -`); continue; }
  const dn = rs.filter((r) => r.caso.posizioneVera >= r.n.banda.da && r.caso.posizioneVera <= r.n.banda.a).length;
  const dv = rs.filter((r) => r.caso.posizioneVera >= Math.max(1, r.v.pos - 1) && r.caso.posizioneVera <= Math.min(r.v.su, r.v.pos + 1)).length;
  console.log(`  ${g.padEnd(17)} ${String(rs.length).padStart(3)}  ${`${dn}/${rs.length}`.padStart(7)} ${pct(dn, rs.length).padStart(7)}   ${`${dv}/${rs.length}`.padStart(7)} ${pct(dv, rs.length).padStart(7)}`);
}
console.log(`\n  se i ${muti.length} muti si contano come non coperti (prereg: il silenzio è un esito): ${cop}/${CASI.length} = ${pct(cop, CASI.length)}`);
console.log('\n  solo contesto VERDE, per gara — da confrontare con `circuiti_sotto_livello` del file,');
console.log('  che oggi avvisa su Belgio (0,750) e Spagna (0,775) e su nessun altro circuito:');
for (const [g, rs0] of [...perGara.entries()].sort()) {
  const rs = rs0.filter((r) => r.n.banda.contesto === 'VERDE');
  if (!rs.length) continue;
  const d = rs.filter(dentro).length;
  const avv = rs[0].n.banda.circuito_sotto_livello ? `  ← il file avvisa (${rs[0].n.banda.circuito_sotto_livello.copertura})` : '';
  console.log(`    ${g.padEnd(17)} ${String(d).padStart(3)}/${String(rs.length).padEnd(3)} = ${pct(d, rs.length).padStart(6)}${avv}`);
}

// ———————————————————————————————— 3. neutralizzazione
console.log('\n──── 3. SOTTO / FUORI NEUTRALIZZAZIONE');
const gruppi = [
  ['contesto banda VERDE', (r) => r.n.banda.contesto === 'VERDE'],
  ['contesto banda NEUTRA', (r) => r.n.banda.contesto === 'NEUTRA'],
  ['regime al congelamento = null', (r) => r.caso.regimeAlCongelamento === null],
  ['regime al congelamento = SC', (r) => r.caso.regimeAlCongelamento === 'SC'],
  ['regime al congelamento = VSC', (r) => r.caso.regimeAlCongelamento === 'VSC'],
];
console.log('  gruppo                                  n   dentro   copertura   semi-ampiezza');
for (const [nome, f] of gruppi) {
  const rs = conBanda.filter(f);
  if (!rs.length) { console.log(`  ${nome.padEnd(38)}   0        -          -            -`); continue; }
  const d = rs.filter(dentro).length;
  const sa = [...new Set(rs.map((r) => r.n.banda.semi_ampiezza))].join('/');
  console.log(`  ${nome.padEnd(38)} ${String(rs.length).padStart(3)}  ${String(d).padStart(6)}   ${pct(d, rs.length).padStart(8)}   ±${sa}`);
}
console.log('\n  incrocio col FUTURO (solo diagnostica: il prodotto NON lo sa al congelamento)');
console.log('  contesto al congelamento × neutralizzato al giro della sosta:');
for (const ctx of ['VERDE', 'NEUTRA']) {
  for (const nz of [false, true]) {
    const rs = conBanda.filter((r) => r.n.banda.contesto === ctx && r.caso.neutralizzatoAlPit === nz);
    if (!rs.length) continue;
    const d = rs.filter(dentro).length;
    console.log(`    ${ctx.padEnd(7)} · sosta ${nz ? 'NEUTRALIZZATA' : 'in verde   '} : ${String(d).padStart(3)}/${String(rs.length).padEnd(3)} = ${pct(d, rs.length)}`);
  }
}

// ———————————————————————————————— 4. ampiezza
console.log('\n──── 4. PER AMPIEZZA DELLA BANDA');
const semi = {};
for (const r of conBanda) semi[r.n.banda.semi_ampiezza] = (semi[r.n.banda.semi_ampiezza] ?? 0) + 1;
console.log(`  valori distinti di semi_ampiezza osservati: ${Object.entries(semi).map(([k, v]) => `±${k}: ${v} casi (${pct(v, conBanda.length)})`).join('  ·  ')}`);
const larg = {};
for (const r of conBanda) {
  const w = larghezza(r);
  if (!larg[w]) larg[w] = [];
  larg[w].push(r);
}
console.log('  larghezza (posizioni coperte)   n    dentro   copertura');
for (const w of Object.keys(larg).sort((a, b) => a - b)) {
  const rs = larg[w];
  const d = rs.filter(dentro).length;
  console.log(`    ${String(w).padStart(2)} posizioni                 ${String(rs.length).padStart(3)}  ${String(d).padStart(6)}   ${pct(d, rs.length)}`);
}
const wMedia = conBanda.reduce((a, r) => a + larghezza(r), 0) / conBanda.length;
const suMedio = conBanda.reduce((a, r) => a + r.n.su, 0) / conBanda.length;
console.log(`  larghezza media: ${wMedia.toFixed(2)} posizioni su un campo medio di ${suMedio.toFixed(1)} auto = ${(100 * wMedia / suMedio).toFixed(1)}% dello schieramento`);
const tagliate = conBanda.filter((r) => r.n.banda.da === 1 || r.n.banda.a === r.n.su);
console.log(`  bande TAGLIATE dal bordo del campo (da=1 oppure a=su_quanti): ${tagliate.length} (${pct(tagliate.length, conBanda.length)}) — copertura ${pct(tagliate.filter(dentro).length, tagliate.length)}`);
const nonTagliate = conBanda.filter((r) => !(r.n.banda.da === 1 || r.n.banda.a === r.n.su));
console.log(`  bande NON tagliate: ${nonTagliate.length} — copertura ${pct(nonTagliate.filter(dentro).length, nonTagliate.length)}`);

// ———————————————————————————————— 5. confronti: è merito della banda o del motore?
console.log('\n──── 5. MERITO DELLA BANDA O DEL MOTORE? (stessi casi, lettura grezza)');
const base = conBanda;
const copertoDa = (r, pos, semiSotto, semiSopra, su) => {
  if (pos === null || pos === undefined) return false;
  const da = Math.max(1, pos - semiSotto);
  const a = Math.min(su, pos + semiSopra);
  return r.caso.posizioneVera >= da && r.caso.posizioneVera <= a;
};
const conf = [
  ['NUOVO, banda del modello (±1 verde / ±2 neutra)', base, (r) => dentro(r)],
  ['NUOVO, banda costante ±1 su tutti i casi', base, (r) => copertoDa(r, r.n.pos, 1, 1, r.n.su)],
  ['NUOVO, banda costante ±2 su tutti i casi', base, (r) => copertoDa(r, r.n.pos, 2, 2, r.n.su)],
  ['NUOVO, punto secco (±0)', base, (r) => r.n.pos === r.caso.posizioneVera],
  ['VECCHIO, punto secco (±0)', base.filter((r) => r.v.ok), (r) => r.v.pos === r.caso.posizioneVera],
  ['VECCHIO, banda ±1 (che il vecchio non ha)', base.filter((r) => r.v.ok), (r) => copertoDa(r, r.v.pos, 1, 1, r.v.su)],
  ['VECCHIO, banda ±2', base.filter((r) => r.v.ok), (r) => copertoDa(r, r.v.pos, 2, 2, r.v.su)],
  ['INERTE (resti dov\'eri al congelamento), ±1', base, (r) => copertoDa(r, r.caso.posizioneAlCongelamento, 1, 1, r.caso.suQuantiVeri)],
  ['INERTE, banda del modello (stessa semi-ampiezza)', base, (r) => copertoDa(r, r.caso.posizioneAlCongelamento, r.n.banda.semi_ampiezza, r.n.banda.semi_ampiezza, r.caso.suQuantiVeri)],
];
console.log('  regola                                              n    dentro   copertura');
for (const [nome, rs, f] of conf) {
  const d = rs.filter(f).length;
  console.log(`  ${nome.padEnd(50)} ${String(rs.length).padStart(3)}  ${String(d).padStart(6)}   ${pct(d, rs.length)}`);
}

console.log('\n  5b. STESSI IDENTICI CASI (dove rispondono ENTRAMBI i motori)');
const duo = base.filter((r) => r.v.ok);
const duoCom = duo.filter((r) => r.cn && r.cv);
console.log(`  n = ${duo.length} casi con risposta doppia (e ${duoCom.length} riclassificabili su popolazione comune)`);
const conf2 = [
  ['NUOVO, banda del modello', duo, (r) => dentro(r)],
  ['NUOVO, ±1 costante', duo, (r) => copertoDa(r, r.n.pos, 1, 1, r.n.su)],
  ['VECCHIO, ±1 costante', duo, (r) => copertoDa(r, r.v.pos, 1, 1, r.v.su)],
  ['NUOVO, ±2 costante', duo, (r) => copertoDa(r, r.n.pos, 2, 2, r.n.su)],
  ['VECCHIO, ±2 costante', duo, (r) => copertoDa(r, r.v.pos, 2, 2, r.v.su)],
];
for (const [nome, rs, f] of conf2) {
  const d = rs.filter(f).length;
  console.log(`    ${nome.padEnd(28)} ${String(d).padStart(3)}/${rs.length} = ${pct(d, rs.length)}`);
}
const bandaCom = (r, chi, s) => {
  const c = chi === 'n' ? r.cn : r.cv;
  const da = Math.max(1, c.pPrev - s); const a = Math.min(c.n, c.pPrev + s);
  return c.pVero >= da && c.pVero <= a;
};
console.log('    — su popolazione comune, stessi casi —');
console.log(`    NUOVO, banda del modello     ${duoCom.filter((r) => bandaCom(r, 'n', r.n.banda.semi_ampiezza)).length}/${duoCom.length} = ${pct(duoCom.filter((r) => bandaCom(r, 'n', r.n.banda.semi_ampiezza)).length, duoCom.length)}`);
console.log(`    NUOVO, ±1 costante           ${duoCom.filter((r) => bandaCom(r, 'n', 1)).length}/${duoCom.length} = ${pct(duoCom.filter((r) => bandaCom(r, 'n', 1)).length, duoCom.length)}`);
console.log(`    VECCHIO, ±1 costante         ${duoCom.filter((r) => bandaCom(r, 'v', 1)).length}/${duoCom.length} = ${pct(duoCom.filter((r) => bandaCom(r, 'v', 1)).length, duoCom.length)}`);
console.log(`    NUOVO, ±2 costante           ${duoCom.filter((r) => bandaCom(r, 'n', 2)).length}/${duoCom.length} = ${pct(duoCom.filter((r) => bandaCom(r, 'n', 2)).length, duoCom.length)}`);
console.log(`    VECCHIO, ±2 costante         ${duoCom.filter((r) => bandaCom(r, 'v', 2)).length}/${duoCom.length} = ${pct(duoCom.filter((r) => bandaCom(r, 'v', 2)).length, duoCom.length)}`);

// ———————————————————————————————— 6. lettura sulla POPOLAZIONE COMUNE
console.log('\n──── 6. LETTURA B — TUTTO RI-CLASSIFICATO SULLA POPOLAZIONE COMUNE');
console.log('  (la banda del nuovo è un rango nella SUA popolazione: qui previsione, verità e');
console.log('   banda vivono nella stessa popolazione, così il denominatore non entra nel conto)');
const conCom = conBanda.filter((r) => r.cn);
const copB = conCom.filter((r) => {
  const s = r.n.banda.semi_ampiezza;
  const da = Math.max(1, r.cn.pPrev - s);
  const a = Math.min(r.cn.n, r.cn.pPrev + s);
  return r.cn.pVero >= da && r.cn.pVero <= a;
}).length;
console.log(`  copertura su popolazione comune: ${copB}/${conCom.length} = ${pct(copB, conCom.length)}`);
const comVec = base.filter((r) => r.v.ok && r.cv);
const copBv = comVec.filter((r) => {
  const da = Math.max(1, r.cv.pPrev - 1);
  const a = Math.min(r.cv.n, r.cv.pPrev + 1);
  return r.cv.pVero >= da && r.cv.pVero <= a;
}).length;
console.log(`  VECCHIO con banda ±1, stessa lettura: ${copBv}/${comVec.length} = ${pct(copBv, comVec.length)}`);
const dSu = conBanda.map((r) => r.n.su - r.caso.suQuantiVeri);
console.log(`  scarto di denominatore su_nuovo − su_vero: mediana ${mediana(dSu)}, diverso da zero in ${dSu.filter((x) => x !== 0).length}/${dSu.length} casi`);

// ———————————————————————————————— 7. calibrata o solo larga?
console.log('\n──── 7. CALIBRATA O SOLO LARGA?');
console.log('  copertura per unità di larghezza, e semi-ampiezza che servirebbe per l\'80%');
for (const ctx of ['VERDE', 'NEUTRA']) {
  const rs = conBanda.filter((r) => r.n.banda.contesto === ctx);
  if (!rs.length) continue;
  const d = rs.filter(dentro).length;
  const w = rs.reduce((a, r) => a + larghezza(r), 0) / rs.length;
  const dich = rs[0].n.banda.copertura_fuori_campione;
  console.log(`  ${ctx}: n=${rs.length} · copertura ${pct(d, rs.length)} · dichiarata ${(100 * dich).toFixed(1)}% · scarto ${((100 * d) / rs.length - 100 * dich).toFixed(1)} punti · larghezza media ${w.toFixed(2)}`);
  for (let s = 0; s <= 6; s += 1) {
    const c2 = rs.filter((r) => copertoDa(r, r.n.pos, s, s, r.n.su)).length;
    const w2 = rs.reduce((a, r) => a + (Math.min(r.n.su, r.n.pos + s) - Math.max(1, r.n.pos - s) + 1), 0) / rs.length;
    console.log(`     ±${s}: copertura ${pct(c2, rs.length).padStart(6)} · larghezza media ${w2.toFixed(2)}`);
  }
}
const err = conBanda.map((r) => Math.abs(r.n.pos - r.caso.posizioneVera));
console.log(`  |errore| del punto (grezzo): mediana ${mediana(err)} · p80 ${[...err].sort((a, b) => a - b)[Math.floor(0.8 * (err.length - 1))]} · p90 ${[...err].sort((a, b) => a - b)[Math.floor(0.9 * (err.length - 1))]} · max ${Math.max(...err)}`);
const errB = conCom.map((r) => Math.abs(r.cn.pPrev - r.cn.pVero));
console.log(`  |errore| del punto (popolazione comune): mediana ${mediana(errB)} · p80 ${[...errB].sort((a, b) => a - b)[Math.floor(0.8 * (errB.length - 1))]} · p90 ${[...errB].sort((a, b) => a - b)[Math.floor(0.9 * (errB.length - 1))]}`);

// ———————————————————————————————— 8. dove manca
console.log('\n──── 8. I CASI FUORI BANDA — di quanto si manca');
const fuori = conBanda.filter((r) => !dentro(r));
const scarti = {};
for (const r of fuori) {
  const s = r.caso.posizioneVera < r.n.banda.da ? r.n.banda.da - r.caso.posizioneVera : r.caso.posizioneVera - r.n.banda.a;
  scarti[s] = (scarti[s] ?? 0) + 1;
}
console.log(`  ${fuori.length} casi fuori · distanza dal bordo: ${Object.entries(scarti).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}→${v}`).join('  ')}`);
const versoSotto = fuori.filter((r) => r.caso.posizioneVera > r.n.banda.a).length;
console.log(`  il nuovo è OTTIMISTA (vera peggiore della banda) in ${versoSotto}/${fuori.length}, pessimista in ${fuori.length - versoSotto}`);
console.log('  peggiori 8:');
for (const r of [...fuori].sort((a, b) => {
  const sa = a.caso.posizioneVera < a.n.banda.da ? a.n.banda.da - a.caso.posizioneVera : a.caso.posizioneVera - a.n.banda.a;
  const sb = b.caso.posizioneVera < b.n.banda.da ? b.n.banda.da - b.caso.posizioneVera : b.caso.posizioneVera - b.n.banda.a;
  return sb - sa;
}).slice(0, 8)) {
  console.log(`    ${r.caso.id.padEnd(26)} banda P${r.n.banda.da}–P${r.n.banda.a} (${r.n.banda.contesto}, su ${r.n.su}) · vera P${r.caso.posizioneVera} su ${r.caso.suQuantiVeri} · regime@L ${r.caso.regimeAlCongelamento ?? 'verde'} · neutr@pit ${r.caso.neutralizzatoAlPit}`);
}
// ———————————————————————————————— 9. il segno: la banda è stretta o è SPOSTATA?
console.log('\n──── 9. BIAS CON SEGNO — la banda è stretta o è mal CENTRATA?');
const segno = (rs) => mediana(rs.map((r) => r.n.pos - r.caso.posizioneVera));
const media = (rs) => rs.reduce((a, r) => a + (r.n.pos - r.caso.posizioneVera), 0) / rs.length;
console.log('  errore con segno (previsto − vero): positivo = il nuovo mette il pilota TROPPO INDIETRO');
for (const [nome, f] of [
  ['tutti', () => true],
  ['contesto VERDE', (r) => r.n.banda.contesto === 'VERDE'],
  ['contesto NEUTRA', (r) => r.n.banda.contesto === 'NEUTRA'],
  ['sosta poi in verde (futuro)', (r) => r.caso.neutralizzatoAlPit === false],
  ['sosta poi NEUTRALIZZATA (futuro)', (r) => r.caso.neutralizzatoAlPit === true],
]) {
  const rs = conBanda.filter(f);
  console.log(`    ${nome.padEnd(34)} n=${String(rs.length).padStart(3)} · mediana ${String(segno(rs)).padStart(5)} · media ${media(rs).toFixed(2).padStart(6)} · dichiarato dal file: bias_mediano_posizioni = 0`);
}
console.log('\n  banda ASIMMETRICA: minima (sotto, sopra) con copertura >= 80%, per contesto');
for (const ctx of ['VERDE', 'NEUTRA']) {
  const rs = conBanda.filter((r) => r.n.banda.contesto === ctx);
  let best = null;
  for (let so = 0; so <= 6; so += 1) for (let sp = 0; sp <= 6; sp += 1) {
    let d = 0; let w = 0;
    for (const r of rs) {
      const da = Math.max(1, r.n.pos - so); const a = Math.min(r.n.su, r.n.pos + sp);
      w += a - da + 1;
      if (r.caso.posizioneVera >= da && r.caso.posizioneVera <= a) d += 1;
    }
    if (d / rs.length >= 0.8 && (!best || w / rs.length < best.w)) best = { so, sp, d, w: w / rs.length };
  }
  const att = rs.filter(dentro).length;
  const attW = rs.reduce((a, r) => a + larghezza(r), 0) / rs.length;
  console.log(`    ${ctx}: oggi (−${rs[0].n.banda.semi_ampiezza}, +${rs[0].n.banda.semi_ampiezza}) → ${pct(att, rs.length)} con larghezza ${attW.toFixed(2)}`);
  console.log(`           minima all'80%: (−${best.so}, +${best.sp}) → ${pct(best.d, rs.length)} con larghezza ${best.w.toFixed(2)}`);
}

// ———————————————————————————————— 10. quanto pesa la CONVENZIONE del contesto
console.log('\n──── 10. CONTROFATTUALE: il contesto assegnato come nel banco di calibrazione');
console.log('  (simulatore/banco/misure/rientro.mjs::regimeDellaSosta guarda i giri L e L+1,');
console.log('   cioè il FUTURO rispetto al congelamento L−1 che usa il prodotto)');
const regimeSosta = (r) => regimeAlGiro(garaNuova(r.caso.gara), r.caso.pitLap, r.caso.pilota)
  ?? regimeAlGiro(garaNuova(r.caso.gara), r.caso.rientroLap, r.caso.pilota);
let copCf = 0; const wCf = [];
const cfConteggi = { VERDE: 0, NEUTRA: 0, cambiati: 0 };
for (const r of conBanda) {
  const ctx = regimeSosta(r) !== null ? 'NEUTRA' : 'VERDE';
  cfConteggi[ctx] += 1;
  if (ctx !== r.n.banda.contesto) cfConteggi.cambiati += 1;
  const s = ctx === 'NEUTRA' ? 2 : 1;
  const da = Math.max(1, r.n.pos - s); const a = Math.min(r.n.su, r.n.pos + s);
  wCf.push(a - da + 1);
  if (r.caso.posizioneVera >= da && r.caso.posizioneVera <= a) copCf += 1;
}
console.log(`  contesto ricalcolato: VERDE ${cfConteggi.VERDE} · NEUTRA ${cfConteggi.NEUTRA} · cambia in ${cfConteggi.cambiati}/${conBanda.length} casi`);
console.log(`  copertura con la convenzione del banco: ${copCf}/${conBanda.length} = ${pct(copCf, conBanda.length)} (larghezza media ${(wCf.reduce((a, b) => a + b, 0) / wCf.length).toFixed(2)})`);
console.log(`  copertura con la convenzione del prodotto: ${cop}/${conBanda.length} = ${pct(cop, conBanda.length)}`);
console.log(`  → la convenzione da sola sposta ${((100 * copCf) / conBanda.length - (100 * cop) / conBanda.length).toFixed(1)} punti: il resto del divario con l'88,5% NON è la convenzione`);

console.log('\n════════ fine M5 ════════');
