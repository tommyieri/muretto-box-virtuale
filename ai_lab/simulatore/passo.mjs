// passo.mjs — FASE 1: IL MODELLO DEL TEMPO SUL GIRO, simmetrico.
//
// Una sola equazione, usata nei due versi. E' tutto qui:
//
//     MISURA    base(d)          = mediana sui giri verdi di [ t - delta*(giro-1) - rho*(eta-eta0) ]
//     PREDICE   t_atteso(d,giro) = base(d) + delta*(giro-1) + rho*(eta-eta0)
//
// PERCHE' LA SIMMETRIA E' IL PUNTO, e non il valore dei coefficienti.
// Il motore di oggi SOTTRAE il carburante quando misura (`pace_base` normalizza a serbatoio
// vuoto) e non lo RI-AGGIUNGE mai quando simula: engine/LIMITI_NOTI.md §1 misura il conto,
// -1,480 s/giro su -1,86 totali. Un modello che sottrae e ri-aggiunge LA STESSA quantita' e'
// corretto per costruzione: se delta e' sbagliato del 10%, l'errore si cancella sul livello e
// resta solo sull'estrapolazione, che e' un pezzo molto piu' piccolo. Per questo la Fase 1 si
// puo' pubblicare anche con un delta imperfetto — ed e' esattamente la regola del PO.
//
// DELTA, NON "FUEL". `delta` qui e' la DERIVA DI GARA per giro, cioe' carburante + evoluzione
// pista + gestione, che questi dati non separano (ai_lab/simulatore/PREREG_fase1.md §0/E3).
// Il nome FUEL_COEFF sarebbe una bugia comoda.
//
// RHO E' PREVISTO E SPENTO. In Fase 1 rho = 0: il degrado ha il suo cancello ed e' la Fase 2.
// Il parametro c'e' per non dover riscrivere questo file fra due settimane.

export const MIN_GIRI_VERDI = 3;    // stessa soglia del kernel: sotto, il passo non si misura

// deriva PER GIRO a partire dal Delta di gara (scivolamento totale dal giro 1 al giro N).
// Delta positivo = i giri diventano piu' veloci  ->  delta per giro NEGATIVO.
export function derivaPerGiro(delta, nLaps) {
  if (delta == null || !(nLaps > 1)) return 0;
  return -delta / (nLaps - 1);
}

const verde = c => c && c.lap_time != null && !c.neutralized && !c.in_lap && !c.out_lap
  && ['SOFT', 'MEDIUM', 'HARD'].includes(c.compound);

function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// base(d) al RIFERIMENTO (giro 1, eta = eta0), dai soli giri verdi dello stint in corso al
// giro L. Causale: guarda solo il passato, come il kernel.
export function passoBase(byLap, nLaps, L, drv, { delta = 0, rho = 0, eta0 = 0 } = {}) {
  const cur = byLap[L]?.[drv];
  if (!cur || cur.stint == null) return null;
  const d = derivaPerGiro(delta, nLaps);
  const v = [];
  for (let k = 1; k <= L; k++) {
    const c = byLap[k]?.[drv];
    if (!c || c.stint !== cur.stint || !verde(c)) continue;
    const eta = typeof c.tyre_age === 'number' ? c.tyre_age : eta0;
    v.push(c.lap_time - d * (k - 1) - rho * (eta - eta0));
  }
  return v.length >= MIN_GIRI_VERDI ? mediana(v) : null;
}

// tutti i piloti in un colpo solo: {sigla -> base}
export function passiBase(byLap, nLaps, L, piloti, opz = {}) {
  const out = {};
  for (const d of piloti) {
    const p = passoBase(byLap, nLaps, L, d, opz);
    if (p != null) out[d] = p;
  }
  return out;
}

// tempo atteso al giro `lap` con gomma di eta `eta`
export function tempoAtteso(base, lap, nLaps, { delta = 0, rho = 0, eta0 = 0, eta = null } = {}) {
  return base + derivaPerGiro(delta, nLaps) * (lap - 1)
              + (rho ? rho * ((eta ?? eta0) - eta0) : 0);
}

// SIMULAZIONE SIMMETRICA. Stessa struttura di demo/gradino.mjs::simulaConSoste — stesso ordine
// delle operazioni, stesso cap del traffico, stessa iniezione del pit-loss — ma il passo di
// ogni giro viene dall'equazione qui sopra invece di essere piatto.
//
// `gradino` resta com'e' in produzione: in Fase 1 NON si tocca. L'unica differenza rispetto a
// oggi e' che il passo segue la deriva misurata. Cosi' il confronto isola una cosa sola.
export function simulaSimmetrico({ base, byLap, nLaps, freezeLap, steps, pits = [],
                                   delta = 0, rho = 0, gradino = null,
                                   ZONE = 0, STRENGTH = 1.0, track = 1.0 }) {
  const drivers = Object.keys(base);
  const cum = {};
  for (const d of drivers) {
    const c = byLap[freezeLap]?.[d];
    if (typeof c?.cum_time === 'number') cum[d] = c.cum_time;
  }
  // ETA' GOMMA, tenuta esplicitamente. Prima qui c'era `fermi.has(d) ? s : eta0+s`, che dopo
  // la sosta contava i giri dal CONGELAMENTO invece che DALLA SOSTA: la gomma nuova nasceva
  // gia' vecchia di quanti giri erano passati. Con eta esplicita non c'e' modo di sbagliarlo.
  const eta = {};
  for (const d of drivers) {
    const c = byLap[freezeLap]?.[d];
    eta[d] = typeof c?.tyre_age === 'number' ? c.tyre_age : 0;
  }
  const fermi = new Set();
  const dg = derivaPerGiro(delta, nLaps);

  for (let s = 0; s < steps; s++) {
    const cur = freezeLap + s;
    const p = {};
    for (const d of drivers) {
      if (cum[d] == null) continue;
      p[d] = base[d] + dg * (cur - 1)
           + (gradino != null && fermi.has(d) ? gradino : 0)
           + (rho ? rho * eta[d] : 0);
    }
    // traffico: identico al kernel (ZONE 0 = cap spento, com'e' in produzione)
    const cand = drivers.filter(d => d in p && cum[d] != null)
      .sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
    const eff = { ...p };
    if (ZONE > 0) {
      for (let i = 1; i < cand.length; i++) {
        const d = cand[i], dfr = cand[i - 1];
        const gap = cum[d] - cum[dfr];
        if (eff[d] < eff[dfr] && gap < ZONE) eff[d] += track * STRENGTH * (eff[dfr] - eff[d]);
      }
    }
    const diQuestoGiro = pits.filter(x => x.lap === cur);
    for (const d of drivers) {
      if (!(d in eff) || cum[d] == null) continue;
      cum[d] += eff[d];
      eta[d] += 1;                       // la gomma invecchia di un giro
    }
    // LA SOSTA E' UN AZZERAMENTO, non uno sconto. Avviene DOPO il giro: l'in-lap si percorre
    // sulla gomma vecchia, e il giro seguente parte da eta 0. E' qui che nasce l'ottimo
    // interno: anticipare la sosta accorcia il primo stint e allunga il secondo, e la somma
    // delle eta' vissute ha un minimo in mezzo.
    for (const x of diQuestoGiro) {
      if (cum[x.driver] != null) cum[x.driver] += x.loss;
      eta[x.driver] = 0;
      fermi.add(x.driver);
    }
  }
  return cum;
}
