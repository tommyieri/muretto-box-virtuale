// ENGINE / KERNEL — l'UNICA implementazione della simulazione (Regola 8).
// La statistica (fisica/) produce parametri JSON con targhetta; questo file
// li consuma. Nessun altro file, in nessuna lingua, simula (sentinella s07).
//
// Modello v2 del tempo sul giro:
//   t(pilota, giro) = base(pilota) + δ·(giro − 1) + ρ·età_gomma
//   la SOSTA azzera età_gomma (e monta il set nuovo)
// Il vantaggio della gomma nuova è SOLO l'azzeramento dell'età: niente sconti
// costanti perpetui post-sosta (E01: "fermati subito" in 718/718 casi).
// La deriva δ si applica a TUTTI i giri simulati: ciò che la misura sottrae,
// la simulazione ri-aggiunge (Regola 10, E02).

// t di un giro. L'assenza è null: qualunque ingrediente mancante → null,
// mai un numero plausibile (Regola 6).
export function tempoGiro({ base, eta, giro }, par) {
  if (base == null || eta == null || giro == null) return null;
  if (par == null || par.delta == null || par.rho == null) return null;
  return base + par.delta * (giro - 1) + par.rho * eta;
}

// Simulazione dal congelamento Lf al giro `giriTotali`.
//   griglia: { [pilota]: { base, eta, cum } } — stato misurato a Lf
//   piani:   { [pilota]: { giroSosta, perditaSosta } } — sosta opzionale
// Convenzione sosta: il giro `giroSosta` è l'in-lap (gomma vecchia, paga la
// perdita); l'out-lap `giroSosta+1` ha la gomma nuova a età 1.
//
// Con parametri incompleti il kernel SI RIFIUTA con un motivo: il conflitto
// su δ è aperto (E21) e non si sceglie in silenzio. Un pilota senza stato
// completo esce con cum null (E06), senza contaminare gli altri.
export function simula({ griglia, Lf, giriTotali, par, piani = {} }) {
  if (par == null || par.delta == null || par.rho == null) {
    return { ok: false, motivo: 'parametri incompleti (delta o rho null): il kernel non sceglie in silenzio — vedi fisica/stime/parametri_v2.json' };
  }
  if (Lf == null || giriTotali == null || giriTotali < Lf) {
    return { ok: false, motivo: `orizzonte non valido: Lf=${Lf}, giriTotali=${giriTotali}` };
  }
  for (const [pilota, piano] of Object.entries(piani)) {
    if (piano && (piano.giroSosta <= Lf || piano.giroSosta > giriTotali || piano.perditaSosta == null)) {
      return { ok: false, motivo: `piano sosta fuori contratto per ${pilota}: giroSosta=${piano.giroSosta} (lecito: ${Lf + 1}..${giriTotali}), perdita=${piano.perditaSosta}` };
    }
  }

  const cum = {};
  for (const [pilota, stato] of Object.entries(griglia)) {
    if (stato == null || stato.base == null || stato.eta == null || stato.cum == null) {
      cum[pilota] = null;   // niente passo → niente numero che sembra vero
      continue;
    }
    const piano = piani[pilota] ?? null;
    let totale = stato.cum;
    for (let giro = Lf + 1; giro <= giriTotali; giro++) {
      const eta = (piano && giro > piano.giroSosta) ? giro - piano.giroSosta
                                                    : stato.eta + (giro - Lf);
      totale += tempoGiro({ base: stato.base, eta, giro }, par);
      if (piano && giro === piano.giroSosta) totale += piano.perditaSosta;
    }
    cum[pilota] = totale;
  }

  const ordine = Object.keys(cum)
    .filter(p => cum[p] !== null)
    .sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
  return { ok: true, cum, ordine };
}
