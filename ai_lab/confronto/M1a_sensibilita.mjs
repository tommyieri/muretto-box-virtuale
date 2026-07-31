// M1a_sensibilita — quanto e' solido il verdetto M1?
//   A. leave-one-race-out sul saldo (esatti nuovo − esatti vecchio), lettura A e B
//   B. il bias del vecchio sparisce in lettura A e riappare in lettura B: quanto vale il denominatore
//   C. il campione comune e' sbilanciato? (Monaco entra con 10 casi su 47)
//   D. il bias del nuovo e' costante o dipende dalla posizione di partenza / dal regime?
import { casi, rispostaVecchio, rispostaNuovo, gare } from './banco.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function comune(c, ov, on) {
  const sv = new Set(ov.map((x) => x[0])), sn = new Set(on.map((x) => x[0]));
  const S = new Set(c.ordineVero.filter((d) => sv.has(d) && sn.has(d)));
  if (!S.has(c.pilota)) return null;
  const r = (l) => l.filter((d) => S.has(d)).indexOf(c.pilota) + 1;
  return { su: S.size, vero: r(c.ordineVero), vecchio: r(ov.map((x) => x[0])), nuovo: r(on.map((x) => x[0])) };
}

const R = [];
for (const c of casi()) {
  const v = rispostaVecchio(c), n = rispostaNuovo(c);
  if (v.muto || n.muto) continue;
  const B = comune(c, v.ordine, n.ordine);
  R.push({ c, gara: c.gara, av: v.pos - c.posizioneVera, an: n.pos - c.posizioneVera,
           bv: B.vecchio - B.vero, bn: B.nuovo - B.vero, suV: v.su, suN: n.su, suVero: c.suQuantiVeri, suB: B.su,
           posCong: c.posizioneAlCongelamento, regime: c.regimeAlCongelamento, neutro: c.neutralizzato });
}
const es = (l, k) => l.filter((r) => r[k] === 0).length / l.length;

console.log(`base: ${R.length} casi con risposta da entrambi`);
console.log(`\nA. LEAVE-ONE-RACE-OUT — saldo esatti (nuovo − vecchio), in punti percentuali`);
console.log('   tolta la gara     n     A: vecchio→nuovo (saldo)      B: vecchio→nuovo (saldo)');
for (const g of ['(nessuna)', ...gare()]) {
  const l = g === '(nessuna)' ? R : R.filter((r) => r.gara !== g);
  const a = [100 * es(l, 'av'), 100 * es(l, 'an')], b = [100 * es(l, 'bv'), 100 * es(l, 'bn')];
  console.log(`   ${g.padEnd(16)} ${String(l.length).padStart(4)}    ${a[0].toFixed(1)}% → ${a[1].toFixed(1)}%  (${(a[1] - a[0] >= 0 ? '+' : '')}${(a[1] - a[0]).toFixed(1)})`
    + `        ${b[0].toFixed(1)}% → ${b[1].toFixed(1)}%  (${(b[1] - b[0] >= 0 ? '+' : '')}${(b[1] - b[0]).toFixed(1)})`);
}

console.log(`\nB. IL DENOMINATORE — errore CON SEGNO medio, stesso motore, due letture`);
console.log(`   vecchio  A ${media(R.map((r) => r.av)).toFixed(3)}   B ${media(R.map((r) => r.bv)).toFixed(3)}   scarto ${(media(R.map((r) => r.bv)) - media(R.map((r) => r.av))).toFixed(3)} posizioni`);
console.log(`   nuovo    A ${media(R.map((r) => r.an)).toFixed(3)}   B ${media(R.map((r) => r.bn)).toFixed(3)}   scarto ${(media(R.map((r) => r.bn)) - media(R.map((r) => r.an))).toFixed(3)} posizioni`);
console.log(`   campo mediano: verita' ${mediana(R.map((r) => r.suVero))} · vecchio ${mediana(R.map((r) => r.suV))} · nuovo ${mediana(R.map((r) => r.suN))} · intersezione ${mediana(R.map((r) => r.suB))}`);
console.log(`   su(vecchio) < su(verita') in ${R.filter((r) => r.suV < r.suVero).length}/${R.length} casi, scarto mediano ${mediana(R.map((r) => r.suV - r.suVero))}`);

console.log(`\nC. COMPOSIZIONE DEL CAMPIONE COMUNE (quanto pesa ogni gara)`);
for (const g of gare()) {
  const tot = casi().filter((c) => c.gara === g).length, com = R.filter((r) => r.gara === g).length;
  console.log(`   ${g.padEnd(16)} ammessi ${String(tot).padStart(3)} → comuni ${String(com).padStart(3)}  (${(100 * com / tot).toFixed(0)}%)  peso nel pool ${(100 * com / R.length).toFixed(1)}%`);
}

console.log(`\nD. IL BIAS DEL NUOVO E' COSTANTE? (errore con segno, lettura A)`);
const fasce = [[1, 5], [6, 10], [11, 15], [16, 25]];
for (const [a, b] of fasce) {
  const l = R.filter((r) => r.posCong >= a && r.posCong <= b);
  if (!l.length) continue;
  console.log(`   posizione al congelamento P${a}–P${b}: n=${String(l.length).padStart(3)}  vecchio ${media(l.map((r) => r.av)).toFixed(2).padStart(6)}  nuovo ${media(l.map((r) => r.an)).toFixed(2).padStart(6)}  |  esatti ${(100 * es(l, 'av')).toFixed(0)}% → ${(100 * es(l, 'an')).toFixed(0)}%`);
}
for (const [et, f] of [['verde al congelamento', (r) => r.regime === null], ['SC/VSC al congelamento', (r) => r.regime !== null]]) {
  const l = R.filter(f);
  if (!l.length) continue;
  console.log(`   ${et.padEnd(24)}: n=${String(l.length).padStart(3)}  vecchio ${media(l.map((r) => r.av)).toFixed(2).padStart(6)}  nuovo ${media(l.map((r) => r.an)).toFixed(2).padStart(6)}  |  esatti ${(100 * es(l, 'av')).toFixed(0)}% → ${(100 * es(l, 'an')).toFixed(0)}%`);
}
console.log(`\n   se al NUOVO si togliesse 1 posizione di bias (pos−1), esatti lettura A: ${(100 * R.filter((r) => r.an === 1).length / R.length).toFixed(1)}% (contro ${(100 * es(R, 'an')).toFixed(1)}% adesso)`);
console.log(`   se al VECCHIO si togliesse 1 posizione di bias, esatti lettura A: ${(100 * R.filter((r) => r.av === 1).length / R.length).toFixed(1)}% (contro ${(100 * es(R, 'av')).toFixed(1)}%)`);
