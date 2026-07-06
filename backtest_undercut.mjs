// backtest_undercut.mjs — Fase 2.2: il modello contro gli undercut REALMENTE tentati.
// KPI dichiarato PRIMA dei risultati (data/UNDERCUT_NOTA.txt):
//   G-U1: accuracy totale (n=406) >= baseline maggioranza (67.2%) + 8 punti -> >= 75%
//   G-U2: accuracy 2026 (n=31)   >= baseline 2026 (68%) — non-peggioramento
//   G-U3: sui DIFFICILI (gap0 in (1.0, 3.5]) accuracy >= maggioranza-difficili + 8 punti
// Modello a zero parametri fittati sugli esiti -> nessun training, fuori-campione per
// costruzione; breakdown per gara riportato comunque (equivalente leave-one-race-out).
// gamma: per-gara 2026 dalla tabella congelata; storico 2023-25 = mediane 2026 per
// compound (fallback dichiarato, piu' grezzo -> KPI secondario ma vincolante su G-U1).
import fs from 'fs';
import { valutaUndercut } from './modello_undercut.mjs';

// tabella gamma lin+log (congelata, Fase 2.1-bis)
const gamma = {};                       // gara -> compound -> gamma
for (const r of fs.readFileSync('data/degrado_gamma_linlog.csv', 'utf8').trim().split('\n').slice(1)) {
  const [gara, comp, g] = r.split(',');
  (gamma[gara] = gamma[gara] || {})[comp] = parseFloat(g);
}
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const gammaMed = {};                    // fallback per storico / (gara,compound) n.id.
for (const c of ['SOFT', 'MEDIUM', 'HARD'])
  gammaMed[c] = mediana(Object.values(gamma).map(g => g[c]).filter(v => v != null));

// warm-in prior (misurato, ~2000 stint): penalita' g0+g1 per compound
const warmin = {};
for (const r of fs.readFileSync('data/warmin_prior.csv', 'utf8').trim().split('\n').slice(1)) {
  const [comp, gs, w] = r.split(',');
  warmin[comp] = (warmin[comp] || 0) + parseFloat(w);
}

const casi2026 = JSON.parse(fs.readFileSync('data/undercut_casi_2026.json', 'utf8'));
const casiSt   = JSON.parse(fs.readFileSync('data/undercut_casi_storico.json', 'utf8'));

function predici(c, storico) {
  const gA = storico ? gammaMed[c.comp_A] : (gamma[c.gara]?.[c.comp_A] ?? gammaMed[c.comp_A]);
  const gB = storico ? gammaMed[c.comp_B] : (gamma[c.gara]?.[c.comp_B] ?? gammaMed[c.comp_B]);
  return valutaUndercut({ gap0: c.gap0, K: c.K, lifeB: c.life_B, gammaA: gA, gammaB: gB,
                          warminA: warmin[c.comp_A] });
}

function valutaSet(casi, storico, nome) {
  let giusti = 0, n = 0, nulli = 0;
  const perGara = {};
  const righe = [];
  for (const c of casi) {
    const p = predici(c, storico);
    if (!p.ok) { nulli++; continue; }
    n++;
    const ok = p.undercut_riuscito_previsto === c.riuscito;
    if (ok) giusti++;
    (perGara[c.gara] = perGara[c.gara] || [0, 0])[ok ? 0 : 1]++;
    righe.push({ ...c, previsto: p.undercut_riuscito_previsto, giusto: ok });
  }
  const magg = Math.max(...['t', 'f'].map(x =>
    righe.filter(r => r.riuscito === (x === 't')).length)) / n;
  console.log(`\n=== ${nome}: n=${n} (fuori dominio: ${nulli}) ===`);
  console.log(`accuracy ${(100 * giusti / n).toFixed(1)}%  vs baseline maggioranza ${(100 * magg).toFixed(1)}%`);
  return { righe, acc: giusti / n, magg, perGara };
}

const r26 = valutaSet(casi2026, false, 'GARE 2026 (gamma per-gara)');
console.log('per gara 2026:', Object.fromEntries(Object.entries(r26.perGara)
  .map(([g, [ok, no]]) => [g, `${ok}/${ok + no}`])));
const rst = valutaSet(casiSt, true, 'STORICO 2023-25 (gamma = mediane 2026 per compound)');

// KPI totale e split facili/difficili (banda dichiarata: gap0 in (1.0, 3.5])
const tutte = [...r26.righe, ...rst.righe];
const acc = r => r.length ? r.filter(x => x.giusto).length / r.length : NaN;
const maggior = r => r.length ? Math.max(r.filter(x => x.riuscito).length, r.filter(x => !x.riuscito).length) / r.length : NaN;
const diff = tutte.filter(r => r.gap0 > 1.0 && r.gap0 <= 3.5);
const faci = tutte.filter(r => !(r.gap0 > 1.0 && r.gap0 <= 3.5));

console.log(`\n=== KPI (soglie dichiarate prima) ===`);
const tot_acc = acc(tutte), tot_magg = maggior(tutte);
console.log(`G-U1 totale   : accuracy ${(100 * tot_acc).toFixed(1)}% vs baseline ${(100 * tot_magg).toFixed(1)}% ` +
            `(soglia ${(100 * tot_magg + 8).toFixed(1)}%) -> ${tot_acc >= tot_magg + 0.08 ? 'PASS' : 'FAIL'}`);
console.log(`G-U2 2026     : accuracy ${(100 * r26.acc).toFixed(1)}% vs baseline ${(100 * r26.magg).toFixed(1)}% ` +
            `-> ${r26.acc >= r26.magg ? 'PASS' : 'FAIL'}`);
console.log(`G-U3 difficili: n=${diff.length}, accuracy ${(100 * acc(diff)).toFixed(1)}% vs maggioranza ` +
            `${(100 * maggior(diff)).toFixed(1)}% (soglia ${(100 * maggior(diff) + 8).toFixed(1)}%) -> ` +
            `${acc(diff) >= maggior(diff) + 0.08 ? 'PASS' : 'FAIL'}`);
console.log(`(facili       : n=${faci.length}, accuracy ${(100 * acc(faci)).toFixed(1)}% vs maggioranza ${(100 * maggior(faci)).toFixed(1)}%)`);
