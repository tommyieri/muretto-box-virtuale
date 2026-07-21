// Motore demo — funzione pura. Pace(tabella) -> Traffic -> Advance, per `steps` giri.
// Pit OPZIONALE: se pit=null, comportamento identico al golden (nessun caso senza pit cambia).
// pit = { driver, lap, loss } -> al giro `lap`, all'Advance, il pilota paga `loss` secondi (rientro dietro).
// Rivali sempre congelati (Mode A): il pit tocca solo l'auto scelta.
//
// DEGRADO OPZIONALE (aggancio del laboratorio, ai_lab/scienziato/PREREG_degrado.md §3).
// degrado = null -> comportamento BIT-IDENTICO a prima: il golden non si muove di un ulp.
// degrado = { [driver]: { rate, age0 } } -> il passo diventa  p + rate*(eta - age0),
// forma INCREMENTALE: eta0 e' l'eta gomma a cui `pace` e' stato misurato, quindi il degrado
// gia' dentro il passo base NON viene ri-contato (era il difetto del gancio v1: rate*(eta-1)
// su un pace_base gia' degradato). L'eta avanza con i giri simulati.
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
        // eta corrente = age0 + s  =>  (eta - age0) = s. Incrementale per costruzione.
        pending[d] = (degrado && degrado[d]) ? p + degrado[d].rate * s : p;
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
