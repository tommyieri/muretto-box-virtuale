// modello_undercut.mjs — Fase 2.2: il modello undercut/overcut. NON collegato alla UI:
// l'attivazione in produzione e' una decisione separata del product owner (vedi
// data/UNDERCUT_NOTA.txt per KPI, verdetto e limiti).
//
// FISICA (zero parametri adattati sugli esiti — tutto misurato altrove):
//   Durante i K giri di overlap (A su gomma nuova, B ancora fuori sulla vecchia),
//   A guadagna per giro il differenziale di degrado; l'evoluzione pista si elide
//   (stesso giro-sessione) e il pit-loss si elide (lo pagano entrambi).
//     margine = SUM_{k=1..K} [ gammaB*(lifeB_Q - K + k) - gammaA*k ] - warminA
//   con: gammaB/gammaA = degrado s/giro per (gara, compound) dalla tabella lin+log
//   congelata (data/degrado_gamma_linlog.csv, Fase 2.1-bis); lifeB_Q = eta' gomma di B
//   al suo in-lap; warminA = penalita' primo+secondo giro lanciato della gomma nuova
//   di A (data/warmin_prior.csv, misurato su ~2000 stint).
//   Previsione: undercut RIUSCITO se margine > gap0 (il gap dietro B al giro prima
//   dell'in-lap di A). Overcut = lettura duale: se l'undercut di A e' previsto
//   fallire, l'allungo di B e' previsto pagare.
//
// GUARDRAIL DI DOMINIO (null onesto, mai numero inventato):
//   fuori range dei casi osservati (gap0 fuori (0,5], K fuori [1,4]), gamma mancante
//   per (gara, compound), neutralizzazione attiva, input non numerici -> null.

export function valutaUndercut({ gap0, K, lifeB, gammaA, gammaB, warminA,
                                 sotto_neutralizzazione = false }) {
  if (sotto_neutralizzazione) return { ok: false, perche: 'SC/VSC: fuori dominio (gap biased)' };
  for (const [nome, v] of [['gap0', gap0], ['K', K], ['lifeB', lifeB]])
    if (typeof v !== 'number' || !isFinite(v)) return { ok: false, perche: `input mancante: ${nome}` };
  if (gammaA == null || gammaB == null) return { ok: false, perche: 'degrado non misurato per questa (gara, compound)' };
  if (typeof warminA !== 'number') return { ok: false, perche: 'warm-in mancante' };
  if (!(gap0 > 0 && gap0 <= 5.0)) return { ok: false, perche: 'gap0 fuori dal dominio osservato (0, 5]s' };
  if (!(K >= 1 && K <= 4)) return { ok: false, perche: 'finestra overlap fuori dal dominio osservato [1, 4] giri' };

  let margine = -warminA;
  for (let k = 1; k <= K; k++) margine += gammaB * (lifeB - K + k) - gammaA * k;
  return {
    ok: true,
    margine: margine,                       // secondi guadagnati previsti nell'overlap
    delta_previsto: margine - gap0,         // >0: A previsto davanti dopo la sequenza
    undercut_riuscito_previsto: margine > gap0,
  };
}
