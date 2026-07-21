// Motore demo — funzione pura. Pace(tabella) -> Traffic -> Advance, per `steps` giri.
// Pit OPZIONALE: se pit=null, comportamento identico al golden (nessun caso senza pit cambia).
// pit = { driver, lap, loss } -> al giro `lap`, all'Advance, il pilota paga `loss` secondi (rientro dietro).
// Rivali sempre congelati (Mode A): il pit tocca solo l'auto scelta.
//
// DEGRADO OPZIONALE (aggancio del laboratorio, ai_lab/scienziato/PREREG_degrado.md §3).
// degrado = null -> comportamento BIT-IDENTICO a prima: il golden non si muove di un ulp.
//
// degrado = { [pilota]: { rate, eta, eta0 } }   ->   passo(s) = p + rate * ((eta + s) - eta0)
//     rate  s/giro per ogni giro di vita gomma
//     eta   eta della gomma AL GIRO DI CONGELAMENTO
//     eta0  eta della gomma A CUI `pace` E' STATO MISURATO
//
// PERCHE' SERVONO DUE ETA' E NON UNA. `pace` non e' il passo a gomma nuova: e' la MEDIANA
// dei giri puliti dello stint fino a qui, quindi porta gia' dentro il degrado accumulato
// fino all'eta MEDIANA di quel window. Il termine giusto e' l'incremento DA QUEL
// RIFERIMENTO, non da zero e non da gomma nuova. E' la stessa forma M1 gia' validata in
// replay per il pannello scenari (demo/pitbande.mjs, BIAS +0,42 -> +0,05).
//
// FINO AL 21/07/2026 QUI C'ERA UNA TRAPPOLA: il commento prometteva `rate*(eta - eta0)` ma
// il codice faceva `rate * s`, cioe' dava per scontato eta0 == eta (passo misurato all'eta
// attuale). Non e' vero: misurato sul fondo 2026, la gomma dei giri simulati e' in mediana
// 9,15 giri PIU VECCHIA del window che ha prodotto `pace`. Chi avesse acceso il gancio
// avrebbe applicato una frazione della correzione senza accorgersene, e il termine costante
// mai. Il campo c'era, il codice non lo leggeva.
//
// SICURO PER ASSENZA: se mancano `eta` o `eta0`, il degrado NON si applica affatto. Meglio
// un effetto visibilmente assente che una forma sbagliata applicata di nascosto.
// TRAFFICO OPZIONALE (modello live del laboratorio, ai_lab/scienziato/PREREG_traffico_live.md).
// traffico = null -> comportamento BIT-IDENTICO: resta il cap ZONE/STRENGTH di oggi.
// traffico = { a, lam } -> al posto del cap, la penalita' misurata dal fondo:
//     i(gap) = a * exp(-gap/lam)   sommata al passo di chi ha qualcuno davanti.
// Il cap e la penalita' non convivono: o l'uno o l'altra, mai sommati.
export function simulate({ state, pace, track = 1.0, steps = 5, freezeLap = 0, pit = null,
                           ZONE = 1.5, STRENGTH = 1.0, degrado = null, traffico = null }) {
  const drivers = Object.keys(state);
  const cum = {};
  for (const d of drivers) cum[d] = state[d].cum_time;

  for (let s = 0; s < steps; s++) {
    const curLap = freezeLap + s;
    const pending = {};
    for (const d of drivers) {
      const p = pace[d];
      if (p !== undefined && p !== null) {
        const g = degrado && degrado[d];
        // l'eta avanza coi giri simulati; il riferimento e' l'eta a cui `pace` fu misurato
        pending[d] = (g && g.rate && g.eta != null && g.eta0 != null)
          ? p + g.rate * ((g.eta + s) - g.eta0)
          : p;
      }
    }
    const cand = drivers
      .filter(d => d in pending && cum[d] !== null && cum[d] !== undefined)
      .sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : (a > b ? 1 : 0)));
    const eff = { ...pending };
    for (let i = 1; i < cand.length; i++) {
      const d = cand[i], dfr = cand[i - 1];
      const gap = cum[d] - cum[dfr];
      if (traffico) {
        eff[d] = eff[d] + traffico.a * Math.exp(-gap / traffico.lam);
      } else if (eff[d] < eff[dfr] && gap < ZONE) {
        eff[d] = eff[d] + track * STRENGTH * (eff[dfr] - eff[d]);
      }
    }
    for (const d of drivers) {
      if (d in eff && cum[d] !== null && cum[d] !== undefined) {
        cum[d] = cum[d] + eff[d];
        if (pit && d === pit.driver && curLap === pit.lap) cum[d] += pit.loss; // iniezione pit
      }
    }
  }
  return cum;
}
