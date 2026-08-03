#!/usr/bin/env node
// curva_orizzonte.mjs — DOVE FINISCE DAVVERO IL MOTORE.
//
//     node ai_lab/confronto/curva_orizzonte.mjs [--json]
//
// Esegue PREREG_curva_orizzonte.md. SOLA LETTURA: non tocca il motore, non accende niente,
// non ha un esito desiderato. Griglia, verita' e regole di lettura sono copiate dalla
// prereg e non si toccano.
//
// Di F1 si conoscono due punti isolati — a 2 giri il motore batte il vecchio 36-12
// (p = 0,0007), alla bandiera nessun motore batte il non-fare-niente (57-55, p = 0,92) —
// e nulla in mezzo. Questo file riempie il mezzo.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, casi, garaNuova, contestoNuovo, riclassifica, rispostaNuovo } from './banco.mjs';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { ordineAlGiro, letturaComune, vecchioConPasso, passoV2, testSegni, mediana } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const GRIGLIA = [2, 3, 4, 5, 6, 8, 10];      // prereg §2, fissata prima
const CONTAMINATO_SE = 1;                     // prereg §3: mediana soste-rivali >= 1

const mescolaDi = (gSim, lap, drv) => gSim.perPilota.get(drv)?.get(lap)?.compound ?? null;

/** Le soste VERE di rivali che cadono nella finestra (Lf, Lf+h]. Prereg §3. */
function sosteRivaliInFinestra(gSim, Lf, h, soggetto) {
  let n = 0;
  for (const [drv, celle] of gSim.perPilota) {
    if (drv === soggetto) continue;
    for (let lap = Lf + 1; lap <= Lf + h; lap += 1) if (celle.get(lap)?.in_lap === true) n += 1;
  }
  return n;
}

/** L'ordine previsto dal motore al giro Lf+h, con lo stesso piano a una sosta del caso. */
function motoreAOrizzonte(caso, h) {
  const gSim = garaNuova(caso.gara);
  const mescola = mescolaDi(gSim, caso.freezeLap, caso.pilota);
  if (mescola === null) return null;
  const target = caso.freezeLap + h;
  if (caso.pitLap >= target) return null;          // la sosta deve cadere dentro l'orizzonte
  // `giroFinale` e' la cucitura che il costruttore gia' espone (costruttore.mjs:169):
  // steps = giroFinale - freezeLap.
  //
  // SI PASSA DAL COSTRUTTORE, NON DA doveRientri, e la prima scrittura ci e' cascata:
  // `doveRientri` risponde alla domanda «dove rientri», quindi proietta fino al giro di
  // RIENTRO e basta — con giroFinale a Lf+10 la traccia si fermava lo stesso a Lf+2, e la
  // curva usciva vuota da 3 giri in su. Non era un risultato: era la funzione sbagliata.
  const contesto = { ...contestoNuovo(caso.gara), giroFinale: target };
  let esito;
  try {
    const sc = costruisciScenario({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
      giroPit: caso.pitLap, mescola }, contesto);
    esito = eseguiEValida(sc, contesto.costantiDirector);
  } catch { return null; }
  const fatal = (esito?.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
  if (fatal.length || !esito?.risultato?.traccia) return null;
  const cum = {};
  for (const [drv, passi] of Object.entries(esito.risultato.traccia)) {
    const p = passi?.find((x) => x.lap === target);
    if (p && Number.isFinite(p.cum_time)) cum[drv] = p.cum_time;
  }
  const ordine = Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
  return ordine.includes(caso.pilota) ? ordine : null;
}

const punti = [];
for (const h of GRIGLIA) {
  const coppie = [];
  const contaminazione = [];
  let scartati = 0;
  for (const c of casi()) {
    const gSim = garaNuova(c.gara);
    const target = c.freezeLap + h;
    const vero = ordineAlGiro(gSim, target);
    if (!vero.length) { scartati += 1; continue; }
    const nullo = ordineAlGiro(gSim, c.freezeLap);
    const motore = motoreAOrizzonte(c, h);
    if (!motore) { scartati += 1; continue; }
    // stesso metro e stessa popolazione per motore e nullo: terna comune
    const m = riclassifica(motore, vero, c.pilota, nullo);
    const n = riclassifica(nullo, vero, c.pilota, motore);
    if (!m || !n) { scartati += 1; continue; }
    coppie.push({ gara: c.gara, a: m.errore, b: n.errore });
    contaminazione.push(sosteRivaliInFinestra(gSim, c.freezeLap, h, c.pilota));
  }
  const t = testSegni(coppie);
  const medianaSoste = mediana(contaminazione) ?? 0;
  punti.push({
    orizzonte: h,
    n: t.n, vince: t.vinceA, perde: t.vinceB, pari: t.pari, saldo: t.vinceA - t.vinceB, p: t.p,
    scartati,
    soste_rivali_mediana: medianaSoste,
    contaminato: medianaSoste >= CONTAMINATO_SE,
  });
}

// ── il CONTROLLO a h = 2: il banco deve riprodurre il 36-12 gia' tarato ─────
const PASSO_V2 = passoV2();
const controllo = [];
for (const c of casi()) {
  const vp = vecchioConPasso(c, { passo: PASSO_V2 });
  const nn = rispostaNuovo(c);
  if (vp.muto || nn.muto) continue;
  const B = letturaComune(c, vp.ordine, nn.ordine);
  if (B) controllo.push({ gara: c.gara, a: B.nuovo - B.vero, b: B.vecchio - B.vero });
}
const tc = testSegni(controllo);
const controlloOk = tc.n === 235 && tc.vinceA === 36 && tc.vinceB === 12;

console.log('');
console.log('══ LA CURVA DELL\'ORIZZONTE — PREREG_curva_orizzonte.md ════════════════════');
console.log('   Sola lettura. Tutti i punti pubblicati, non il migliore (prereg §5).');
console.log('');
console.log(`   CONTROLLO a 2 giri (motore nuovo contro vecchio-pannello): ${tc.n} casi, ${tc.vinceA}-${tc.vinceB}, p=${tc.p.toFixed(4)}`);
console.log(`   ${controlloOk ? '✓ riproduce il 36-12 su 235 gia\' tarato: la curva si puo\' leggere'
  : '✗ NON riproduce il 36-12 su 235: la curva NON si legge, ci si ferma qui'}`);
if (!controlloOk) process.exit(1);

console.log('');
console.log('   MOTORE CONTRO IL NULLO (la forma di F1)');
console.log('   giri    n    vince-perde   pari    saldo        p      soste rivali in finestra');
for (const p of punti) {
  console.log(`   ${String(p.orizzonte).padStart(4)} ${String(p.n).padStart(5)}`
    + `${`${p.vince}-${p.perde}`.padStart(14)}${String(p.pari).padStart(7)}`
    + `${(p.saldo >= 0 ? `+${p.saldo}` : `${p.saldo}`).padStart(9)}`
    + `${p.p.toFixed(4).padStart(10)}`
    + `${String(p.soste_rivali_mediana).padStart(12)}${p.contaminato ? '   ⚠ CONTAMINATO' : ''}`);
}

const puliti = punti.filter((p) => !p.contaminato);
const vincenti = puliti.filter((p) => p.saldo > 0 && p.p < 0.05);
const frontiera = vincenti.length ? Math.max(...vincenti.map((p) => p.orizzonte)) : null;

console.log('');
if (frontiera === null) {
  console.log('   FRONTIERA: nessun orizzonte NON contaminato in cui il motore batta il nullo');
  console.log('   in modo significativo. Sui punti puliti il motore non si distingue dal');
  console.log('   non-fare-niente — nemmeno a 2 giri, dove pero\' batte il MOTORE VECCHIO.');
} else {
  console.log(`   FRONTIERA: ${frontiera} giri (ultimo orizzonte pulito con saldo > 0 e p < 0,05)`);
}
console.log(`   Punti contaminati (soste vere di rivali nella finestra, mediana ≥ ${CONTAMINATO_SE}): `
  + `${punti.filter((p) => p.contaminato).map((p) => p.orizzonte).join(', ') || 'nessuno'}`);

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'La curva dell\'orizzonte: a che distanza dal congelamento il motore batte ancora il non-fare-niente.',
      prereg: 'ai_lab/confronto/PREREG_curva_orizzonte.md',
      verita: 'rango per cum_time al giro Lf+h nel byLap pinnato, ri-classificato sulla popolazione comune motore/nullo/verita',
      limite_dichiarato: 'oltre ~4 giri le soste vere dei rivali entrano nella finestra: i punti con mediana >= 1 sono marcati CONTAMINATO e restano pubblicati',
      cosa_NON_e: 'non promuove e non boccia niente; F1 resta come firmato il 03/08',
      data: '2026-08-03',
    },
    controllo_2_giri: { ...tc, riproduce_36_12: controlloOk },
    punti,
    frontiera,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_curva_orizzonte.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
