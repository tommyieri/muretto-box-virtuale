// Motore demo — funzione pura. Pace(tabella) -> Traffic -> Advance, per `steps` giri.
// Pit OPZIONALE: se pit=null, comportamento identico al golden (nessun caso senza pit cambia).
// pit = { driver, lap, loss } -> al giro `lap`, all'Advance, il pilota paga `loss` secondi (rientro dietro).
// Rivali sempre congelati (Mode A): il pit tocca solo l'auto scelta.
export function simulate({ state, pace, track = 1.0, steps = 5, freezeLap = 0, pit = null,
                           ZONE = 1.5, STRENGTH = 1.0 }) {
  const drivers = Object.keys(state);
  const cum = {};
  for (const d of drivers) cum[d] = state[d].cum_time;

  for (let s = 0; s < steps; s++) {
    const curLap = freezeLap + s;
    const pending = {};
    for (const d of drivers) {
      const p = pace[d];
      if (p !== undefined && p !== null) pending[d] = p;
    }
    const cand = drivers
      .filter(d => d in pending && cum[d] !== null && cum[d] !== undefined)
      .sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : (a > b ? 1 : 0)));
    const eff = { ...pending };
    for (let i = 1; i < cand.length; i++) {
      const d = cand[i], dfr = cand[i - 1];
      const gap = cum[d] - cum[dfr];
      if (eff[d] < eff[dfr] && gap < ZONE) {
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
