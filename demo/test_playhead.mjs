// test_playhead.mjs — il movimento del pallino sulla mappa live.
// Simula un feed GPS realistico (~3,8 Hz) con jitter di rete e qualche buco,
// e misura gli SCATTI: quanto si sposta il pallino da un fotogramma all'altro.
// Confronta la logica VECCHIA (playhead ricalcolato + clamp all'ultimo campione)
// con quella NUOVA (playhead monotono + breve prosecuzione).
//
//   node demo/test_playhead.mjs

globalThis.location = { search: '' };                  // live_config legge location
const { creaPlayhead, posizionaSu, creaLisciatore, creaRitmo, PH } = await import('./live_mappa.mjs');

let fail = 0;
const ok = (c, m) => c ? console.log('  ok:', m) : (fail++, console.log('  FAIL:', m));

// ---- feed simulato ----------------------------------------------------
// L'auto gira su un cerchio a velocita' costante: qualunque scatto che
// misuriamo viene dall'animazione, non dal moto.
const HZ = 3.8, PASSO = 1000 / HZ;          // ~263 ms fra campioni
const GIRO_MS = 90000, R = 100;             // giro da 90 s, raggio 100
const posVera = t => [R * Math.cos(2 * Math.PI * t / GIRO_MS), R * Math.sin(2 * Math.PI * t / GIRO_MS)];

function feed({ durataMs = 20000, jitterMs = 90, buchi = [] , seed = 7 } = {}) {
  // rand deterministico (niente Math.random: il test dev'essere ripetibile)
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const arrivi = [];                          // {wall, t, vb}
  for (let t = 0; t <= durataMs; t += PASSO) {
    if (buchi.some(([a, b]) => t >= a && t <= b)) continue;   // sessione muta
    const jit = (rnd() - 0.5) * 2 * jitterMs;                 // rete che ballonzola
    arrivi.push({ wall: t + 300 + jit, t, vb: posVera(t) });  // 300ms di trasporto
  }
  arrivi.sort((a, b) => a.wall - b.wall);
  return arrivi;
}

// FEED REALE (misurato sulla registrazione della qualifica 25/07/2026):
// il campionamento e' ~4,2 Hz ma la CONSEGNA e' ~1 Hz A RAFFICHE di ~4 frame.
// E' il caso che smaschera lo stimatore del ritmo.
function feedRaffiche({ durataMs = 20000, perRaffica = 4, gapMs = 1000, passoDatoMs = 240,
                        jitterMs = 60, seed = 11 } = {}) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const arrivi = []; let t = 0;
  for (let wall = 0; wall <= durataMs; wall += gapMs) {
    const jit = (rnd() - 0.5) * 2 * jitterMs;
    for (let k = 0; k < perRaffica; k++) {                    // 4 frame in ~3 ms
      arrivi.push({ wall: wall + 300 + jit + k * 1.2, t, vb: posVera(t) });
      t += passoDatoMs;
    }
  }
  return arrivi;
}

// ---- i due motori ------------------------------------------------------
function simula(motore, arrivi, { fps = 60, durataMs = 20000 } = {}) {
  const campioni = [];
  let tMax = 0, wallTMax = 0, ritmoV = 1, intervalloMed = 260, i = 0;
  const ph = creaPlayhead(), lisc = creaLisciatore(), rit = creaRitmo();
  const salti = []; let prec = null; let ultimoRitmo = 1;
  for (let wall = 0; wall <= durataMs + 1500; wall += 1000 / fps) {
    while (i < arrivi.length && arrivi[i].wall <= wall) {      // consegna campioni
      const a = arrivi[i++];
      campioni.push({ t: a.t, vb: a.vb });
      if (campioni.length > 12) campioni.shift();
      if (a.t > tMax) {
        if (wallTMax) {                                        // stimatore VECCHIO
          const dW = wall - wallTMax, dT = a.t - tMax;
          if (dW > 30 && dT > 0) {
            ritmoV = ritmoV * 0.9 + Math.min(dT / dW, 100) * 0.1;
            intervalloMed = intervalloMed * 0.9 + Math.min(dT, 5000) * 0.1;
          }
        }
        rit.osserva(wall, a.t);                                // stimatore NUOVO
        tMax = a.t; wallTMax = wall;
      }
    }
    if (!campioni.length) continue;
    let p;
    if (motore === 'vecchio') {
      // com'era: ricalcolo da tMax a ogni frame + clamp all'ultimo campione
      const play = tMax + (wall - wallTMax) * ritmoV - 2 * intervalloMed;
      const clamp = Math.min(play, campioni[campioni.length - 1].t);
      p = posVecchia(campioni, clamp);
    } else {
      const r = rit.ritmo(), buf = rit.buffer(); ultimoRitmo = r;
      const bers = tMax + (wall - wallTMax) * r - buf;
      p = lisc.passo(posizionaSu(campioni, ph.passo(wall, bers, r, buf) ?? 0));
    }
    if (p && prec) salti.push(Math.hypot(p[0] - prec[0], p[1] - prec[1]));
    prec = p;
  }
  salti.ritmoFinale = ultimoRitmo; salti.ritmoVecchio = ritmoV;
  return salti;
}
// la vecchia posiziona(): interpolazione, ma inchioda sull'ultimo campione
function posVecchia(c, playhead) {
  if (!c.length) return null;
  if (c.length === 1 || playhead >= c[c.length - 1].t) return c[c.length - 1].vb;
  let i = c.length - 1;
  while (i > 0 && c[i - 1].t > playhead) i--;
  if (i === 0) return c[0].vb;
  const a = c[i - 1], b = c[i];
  const f = b.t === a.t ? 1 : (playhead - a.t) / (b.t - a.t);
  return [a.vb[0] + (b.vb[0] - a.vb[0]) * f, a.vb[1] + (b.vb[1] - a.vb[1]) * f];
}

const stat = s => {
  const o = [...s].sort((a, b) => a - b);
  const fermi = s.filter(x => x < 1e-9).length;
  return { max: o[o.length - 1], mediana: o[Math.floor(o.length / 2)] || 0,
           fermiPct: 100 * fermi / s.length, n: s.length };
};

console.log('\n== 1. feed normale (3,8 Hz, jitter ±90 ms) ==');
const arr = feed();
const V = stat(simula('vecchio', arr)), N = stat(simula('nuovo', arr));
console.log(`  vecchio: scatto max ${V.max.toFixed(2)}  mediana ${V.mediana.toFixed(2)}  fermo ${V.fermiPct.toFixed(1)}% dei frame`);
console.log(`  nuovo  : scatto max ${N.max.toFixed(2)}  mediana ${N.mediana.toFixed(2)}  fermo ${N.fermiPct.toFixed(1)}% dei frame`);
ok(N.max < V.max / 3, `lo scatto peggiore crolla (${V.max.toFixed(2)} -> ${N.max.toFixed(2)})`);
ok(N.fermiPct < V.fermiPct, `resta fermo molto meno spesso (${V.fermiPct.toFixed(1)}% -> ${N.fermiPct.toFixed(1)}%)`);
// uniformita': lo scatto peggiore vicino a quello tipico = moto regolare
ok(N.max / Math.max(N.mediana, 1e-9) < V.max / Math.max(V.mediana, 1e-9),
   'il moto e\' piu\' uniforme (rapporto max/mediana migliore)');

console.log('\n== 2. buco nel feed (1,2 s senza campioni) ==');
const arr2 = feed({ buchi: [[8000, 9200]] });
const V2 = stat(simula('vecchio', arr2)), N2 = stat(simula('nuovo', arr2));
console.log(`  vecchio: max ${V2.max.toFixed(2)}  fermo ${V2.fermiPct.toFixed(1)}%`);
console.log(`  nuovo  : max ${N2.max.toFixed(2)}  fermo ${N2.fermiPct.toFixed(1)}%`);
ok(N2.max < V2.max, `col buco, lo strappo alla ripresa e' minore (${V2.max.toFixed(2)} -> ${N2.max.toFixed(2)})`);
ok(N2.fermiPct < V2.fermiPct, `col buco resta meno fermo (${V2.fermiPct.toFixed(1)}% -> ${N2.fermiPct.toFixed(1)}%)`);

console.log('\n== 2b. FEED VERO A RAFFICHE (4 frame insieme, 1 al secondo) ==');
console.log('   e\' il caso misurato sulla registrazione della qualifica: qui il vecchio');
console.log('   stimatore concludeva "ritmo 0,25" e il pallino strisciava, poi saltava.');
{
  const arrR = feedRaffiche();
  const sV = simula('vecchio', arrR), sN = simula('nuovo', arrR);
  const RV = stat(sV), RN = stat(sN);
  console.log(`  ritmo stimato: vecchio ${sV.ritmoVecchio.toFixed(2)}  ->  nuovo ${sN.ritmoFinale.toFixed(2)}  (vero = 1.00)`);
  console.log(`  vecchio: scatto max ${RV.max.toFixed(2)}  mediana ${RV.mediana.toFixed(2)}  fermo ${RV.fermiPct.toFixed(1)}%`);
  console.log(`  nuovo  : scatto max ${RN.max.toFixed(2)}  mediana ${RN.mediana.toFixed(2)}  fermo ${RN.fermiPct.toFixed(1)}%`);
  ok(Math.abs(sN.ritmoFinale - 1) < 0.12, `il ritmo torna ~1 (era ${sV.ritmoVecchio.toFixed(2)})`);
  ok(sV.ritmoVecchio < 0.6, 'confermato: il vecchio stimatore sbagliava di ~4x sulle raffiche');
  ok(RN.max < RV.max / 2, `scatto peggiore dimezzato e oltre (${RV.max.toFixed(2)} -> ${RN.max.toFixed(2)})`);
  ok(RN.fermiPct < 2, `il pallino non inchioda fra una raffica e l'altra (${RN.fermiPct.toFixed(1)}%)`);
}

console.log('\n== 3. il playhead e\' monotono e non salta ==');
{
  const ph = creaPlayhead();
  let t = 0, prec = null, indietro = 0, salti = 0;
  for (let w = 0; w < 12000; w += 16) {
    // bersaglio con rumore forte: il playhead NON deve seguirlo a scatti
    const bers = w + ((w % 500) < 250 ? 120 : -120);
    t = ph.passo(w, bers, 1, 600);
    if (prec !== null) { if (t < prec - 1e-9) indietro++; if (t - prec > 16 * 1.2) salti++; }
    prec = t;
  }
  ok(indietro === 0, 'non torna mai indietro (0 inversioni)');
  ok(salti === 0, 'non fa salti oltre +20% di velocita\'');
}

console.log('\n== 4. riaggancio secco su desync grosso (ricollegamento) ==');
{
  const ph = creaPlayhead();
  ph.passo(0, 1000, 1, 600); ph.passo(16, 1016, 1, 600);
  const dopo = ph.passo(32, 60000, 1, 600);          // +59 s: salto voluto
  ok(Math.abs(dopo - 60000) < 1, 'con uno scarto enorme si riaggancia subito');
  const ph2 = creaPlayhead(); ph2.passo(0, 1000, 1, 600);
  ph2.passo(16, 1300, 1, 600);                        // +300 ms: NON deve saltare
  ok(ph2.valore() < 1100, 'con uno scarto piccolo NON salta, si riallinea piano');
}

console.log('\n== 5. prosecuzione limitata (non vola via) ==');
{
  const c = [{ t: 0, vb: [0, 0] }, { t: 250, vb: [10, 0] }];   // 10 unita' / 250 ms
  const subito = posizionaSu(c, 250);
  const poco = posizionaSu(c, 250 + 200);
  const tanto = posizionaSu(c, 250 + 5000);
  ok(Math.abs(subito[0] - 10) < 1e-9, 'sull\'ultimo campione sta sul dato vero');
  ok(poco[0] > 10 && poco[0] < 20, 'poco dopo prosegue di poco');
  const maxAtteso = 10 + 10 / 250 * PH.EXTRAP_MAX_MS;
  ok(Math.abs(tanto[0] - maxAtteso) < 1e-9, `la prosecuzione e' tappata a ${PH.EXTRAP_MAX_MS} ms`);
  ok(posizionaSu([], 100) === null, 'senza campioni non inventa una posizione');
  ok(posizionaSu([{ t: 0, vb: [1, 2] }], 999)[0] === 1, 'con un solo campione resta li\'');
}

console.log('\n== 6. lisciatore: niente teletrasporti, ma segue davvero ==');
{
  const l = creaLisciatore();
  l.passo([0, 0]);
  const a = l.passo([10, 0]);                     // bersaglio lontano ma plausibile
  ok(a[0] > 0 && a[0] < 10, 'non ci arriva di colpo: ci va incontro');
  let p = a; for (let i = 0; i < 30; i++) p = l.passo([10, 0]);
  ok(Math.abs(p[0] - 10) < 0.1, 'in pochi fotogrammi ci arriva (non resta indietro)');
  const l2 = creaLisciatore();
  l2.passo([0, 0]);
  const salto = l2.passo([500, 500]);             // auto nuova / cambio sessione
  ok(salto[0] === 500, 'su un balzo enorme si posiziona di netto (niente strisciata)');
  ok(creaLisciatore().passo(null) === null, 'senza bersaglio non inventa');
}


// ---- LE TENUTE NON DEVONO FERMARE IL PALLINO --------------------------
// Il feed ripete l'ultima posizione quando non ne ha una nuova (misurato sul grezzo 2026:
// 38% al Belgio, 76,9% all'Ungheria). Se una ripetizione entra nel buffer, posizionaSu()
// interpola fra due punti IDENTICI e restituisce una costante: il pallino si ferma e poi
// salta. E' il difetto che nel replay si vedeva all'ultima curva dell'Hungaroring.
{
  // buffer con una TENUTA in mezzo: due campioni identici a t=0 e t=263
  const conTenuta = [
    { t: 0,    vb: [0, 0] },
    { t: 263,  vb: [0, 0] },        // ripetizione: il feed non aveva niente di nuovo
    { t: 526,  vb: [20, 0] },
  ];
  // senza la tenuta, il buffer che il modulo costruisce oggi
  const pulito = [
    { t: 0,    vb: [0, 0] },
    { t: 526,  vb: [20, 0] },
  ];
  const a = posizionaSu(conTenuta, 130);    // a meta' fra t=0 e t=263
  const b = posizionaSu(pulito, 130);
  ok(a[0] === 0, 'con la tenuta nel buffer il pallino resta FERMO (e il difetto)');
  ok(b[0] > 3 && b[0] < 7, `senza la tenuta il pallino avanza (x=${b[0].toFixed(1)})`);

  // e il modulo, oggi, la tenuta non la mette proprio nel buffer: si verifica sul
  // comportamento osservabile di creaLisciatore + posizionaSu su un feed che ripete
  const liscio = creaLisciatore();
  let fermi = 0, tot = 0, prec = null;
  for (let k = 0; k < 60; k++) {
    // feed che ripete due volte su tre, come all'Ungheria
    const idx = Math.floor(k / 3);
    const campioni = [];
    for (let j = 0; j <= idx; j++) campioni.push({ t: j * 263, vb: [j * 20, 0] });
    const p = posizionaSu(campioni, idx * 263 + (k % 3) * 88);
    const q = liscio.passo(p);
    if (prec) { tot++; if (Math.abs(q[0] - prec[0]) < 1e-9) fermi++; }
    prec = [q[0], q[1]];
  }
  ok(fermi / tot < 0.2, `il pallino non resta fermo su un feed che ripete (fermi ${(100*fermi/tot).toFixed(0)}%)`);
}

console.log(fail ? `\n${fail} FAIL` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
