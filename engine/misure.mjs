// ENGINE / MISURE — lo stato al congelamento Lf, misurato SOLO su celle con
// giro ≤ Lf. Ogni misura qui dentro è invariante al troncamento per
// costruzione e per sentinella (s01, Regola 5): se una futura modifica legge
// oltre Lf, il banco la ferma (E15).
//
// La destagionalizzazione usa LA STESSA equazione del kernel (Regola 10):
// il termine sottratto è tempoGiro a base zero — ciò che si toglie misurando
// si ri-aggiunge simulando, per costruzione.
import { tempoGiro } from './kernel.mjs';
import { verdePasso } from '../provenienza/contratto.mjs';

// sotto questa soglia il passo non si misura: meglio un null dichiarato che
// una mediana su due giri (Regola 6)
export const MIN_GIRI_VERDI = 3;

// passo base destagionalizzato: mediana su giri verdi ≤ Lf di
// (lap_time − δ·(giro−1) − ρ·età). Con parametri incompleti → null.
export function passoAlCongelamento(celle, Lf, par) {
  if (par == null || par.delta == null || par.rho == null) return null;
  const residui = [];
  for (let i = 0; i < Math.min(Lf, celle.length); i++) {
    const cella = celle[i];
    if (!verdePasso(cella) || cella.tyre_age == null) continue;
    const correzione = tempoGiro({ base: 0, eta: cella.tyre_age, giro: i + 1 }, par);
    residui.push(cella.lap_time - correzione);
  }
  if (residui.length < MIN_GIRI_VERDI) return null;
  return mediana(residui);
}

// stato puntuale a Lf: se il pilota non ha la cella del giro Lf (ritirato,
// buco dati) lo stato è null — esce dalla simulazione con null esplicito
export function etaAlCongelamento(celle, Lf) {
  const cella = Lf >= 1 && Lf <= celle.length ? celle[Lf - 1] : null;
  return cella == null ? null : cella.tyre_age;
}

export function cumAlCongelamento(celle, Lf) {
  const cella = Lf >= 1 && Lf <= celle.length ? celle[Lf - 1] : null;
  return cella == null ? null : cella.cum_time;
}

// la griglia che il kernel consuma: { [pilota]: { base, eta, cum } }.
// Un pilota senza stato completo resta in griglia con i suoi null: l'assenza
// viaggia dichiarata, non sparisce (E06).
export function grigliaAlCongelamento(byLap, Lf, par) {
  const griglia = {};
  for (const [pilota, celle] of Object.entries(byLap)) {
    const eta = etaAlCongelamento(celle, Lf);
    const cum = cumAlCongelamento(celle, Lf);
    const base = (eta == null || cum == null) ? null : passoAlCongelamento(celle, Lf, par);
    griglia[pilota] = { base, eta, cum };
  }
  return griglia;
}

function mediana(valori) {
  const v = [...valori].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
