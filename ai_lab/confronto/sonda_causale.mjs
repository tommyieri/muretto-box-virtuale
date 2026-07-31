// sonda_causale.mjs — controllo del filtro causale e dei due conti sospetti.
//   node ai_lab/confronto/sonda_causale.mjs
import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { regimeDiCella, regimeDelCampo } from './lente_neutralizzazione.mjs';

const elenco = casi();
console.log('═══ 1 · IL FILTRO CAUSALE, APERTO ═══');
let mostrati = 0;
const conteggi = { casi: 0, davanti: 0, davantiNeutri: 0, dietro: 0, dietroNeutri: 0 };
for (const k of elenco) {
  const g = garaNuova(k.gara);
  const mie = g.perPilota.get(k.pilota);
  const mioL = regimeDiCella(mie.get(k.freezeLap));
  const mioPit = regimeDiCella(mie.get(k.pitLap));
  if (!(mioPit !== null && mioL === null)) continue;
  const campo = regimeDelCampo(g, k.freezeLap);
  if (campo.n === 0) continue;
  conteggi.casi += 1;
  const mio = mie.get(k.freezeLap).cum_time;
  let dav = 0, davN = 0, die = 0, dieN = 0;
  for (const [drv, celle] of g.perPilota) {
    if (drv === k.pilota) continue;
    const c = celle.get(k.freezeLap);
    if (!c || typeof c.cum_time !== 'number') continue;
    const n = regimeDiCella(c) !== null;
    if (c.cum_time <= mio) { dav += 1; if (n) davN += 1; } else { die += 1; if (n) dieN += 1; }
  }
  conteggi.davanti += dav; conteggi.davantiNeutri += davN;
  conteggi.dietro += die; conteggi.dietroNeutri += dieN;
  if (mostrati < 8) {
    console.log(`  ${k.id.padEnd(24)} L=${k.freezeLap} · davanti a me ${String(dav).padStart(2)} (neutri ${davN}) · dietro ${String(die).padStart(2)} (neutri ${dieN})`);
    mostrati += 1;
  }
}
console.log(`  TOTALE su ${conteggi.casi} casi: celle di chi ha gia' chiuso L ${conteggi.davanti}, di cui neutralizzate ${conteggi.davantiNeutri}`);
console.log(`                       celle di chi chiude L DOPO di me ${conteggi.dietro}, di cui neutralizzate ${conteggi.dietroNeutri}`);

console.log('\n═══ 2 · IL CAMPO AL GIRO L−1 (interamente passato per tutti) ═══');
let rec = 0, tot = 0, falsi = 0;
for (const k of elenco) {
  const g = garaNuova(k.gara);
  const mie = g.perPilota.get(k.pilota);
  const mioL = regimeDiCella(mie.get(k.freezeLap));
  const mioPit = regimeDiCella(mie.get(k.pitLap));
  const campoPrec = regimeDelCampo(g, k.freezeLap - 1);
  const acceso = mioL === null && campoPrec.frazione >= 0.25;
  if (mioPit !== null && mioL === null) tot += 1;
  if (acceso && mioPit !== null) rec += 1;
  if (acceso && mioPit === null) falsi += 1;
}
console.log(`  soste neutralizzate cieche: ${tot} · recuperate col campo a L−1 (>=25%): ${rec} · falsi positivi: ${falsi}`);

console.log('\n═══ 3 · PERCHE\' FATTORE 1,00 DA\' n=0 ═══');
const conRegime = elenco.filter((k) => regimeDiCella(garaNuova(k.gara).perPilota.get(k.pilota).get(k.freezeLap)) !== null);
const k0 = conRegime[0];
const base = contestoNuovo(k0.gara);
for (const f of [0.5, 1.0]) {
  const prior = { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: f, VSC: f } };
  try {
    const r = doveRientri({ gara: k0.garaSim, freezeLap: k0.freezeLap, pilota: k0.pilota, giroPit: k0.pitLap,
                            mescola: mescolaAlGiro(garaNuova(k0.gara), k0.freezeLap, k0.pilota) }, { ...base, prior });
    console.log(`  fattore ${f}: approvato=${r.approvato} pos=${r.posizione} violazioni=${JSON.stringify((r.direttore?.violazioni ?? []).map((v) => v.codice))}`);
  } catch (e) { console.log(`  fattore ${f}: eccezione ${e.message}`); }
}

console.log('\n═══ 4 · I RIVALI ASSUNTI, SENZA LE BANDIERE ROSSE ═══');
// una "sosta di massa" (bandiera rossa/ripartenza) = piu' di meta' campo con in_lap allo stesso giro
let assunti = 0, assuntiVeri = 0, realiTot = 0, mancati = 0, casiPuliti = 0, casiMassa = 0;
const perGara = {};
for (const k of conRegime) {
  const g = garaNuova(k.gara);
  const inLap = new Set();
  let vivi = 0;
  for (const [drv, celle] of g.perPilota) {
    const c = celle.get(k.pitLap);
    if (!c) continue;
    vivi += 1;
    if (c.in_lap === true && drv !== k.pilota) inLap.add(drv);
  }
  const massa = inLap.size > vivi / 2;
  if (massa) { casiMassa += 1; continue; }
  casiPuliti += 1;
  const mescola = mescolaAlGiro(g, k.freezeLap, k.pilota);
  if (mescola === null) continue;
  const r = doveRientri({ gara: k.garaSim, freezeLap: k.freezeLap, pilota: k.pilota, giroPit: k.pitLap, mescola },
                        contestoNuovo(k.gara));
  if (!r?.approvato || r.posizione == null) continue;  // pos null = regola 6: il motore NON risponde
  const miei = Object.keys(r.pits).filter((d) => d !== k.pilota);
  assunti += miei.length;
  realiTot += inLap.size;
  for (const d of miei) if (inLap.has(d)) assuntiVeri += 1;
  for (const d of inLap) if (!miei.includes(d)) mancati += 1;
  const pg = (perGara[k.gara] ??= { casi: 0, assunti: 0, veri: 0, reali: 0 });
  pg.casi += 1; pg.assunti += miei.length; pg.veri += miei.filter((d) => inLap.has(d)).length; pg.reali += inLap.size;
}
console.log(`  casi col regime al congelamento: ${conRegime.length} · di cui soste di MASSA (bandiera rossa) escluse: ${casiMassa} · puliti: ${casiPuliti}`);
console.log(`  rivali ASSUNTI ${assunti} · si sono fermati davvero ${assuntiVeri} (${assunti ? ((100 * assuntiVeri) / assunti).toFixed(1) : 'n/d'}%)`);
console.log(`  rivali fermati DAVVERO ${realiTot} · non assunti ${mancati}`);
for (const [gara, p] of Object.entries(perGara).sort()) {
  console.log(`    ${gara.padEnd(15)} casi ${String(p.casi).padStart(2)} · assunti ${String(p.assunti).padStart(3)} · azzeccati ${String(p.veri).padStart(3)} · reali ${String(p.reali).padStart(3)}`);
}
