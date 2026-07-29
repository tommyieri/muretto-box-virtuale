// SCENARIO / DIRECTOR — il guardiano dell'OUTPUT, a runtime, prima della
// pagina. Distinzione costituzionale: il Banco valida il CODICE ai cancelli,
// il Director valida l'OUTPUT (paradossi fisici). Non si fondono.
// La sentinella s08 verifica che il Director non sia cieco né isterico.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const PRIORS = JSON.parse(readFileSync(join(RADICE, 'data', 'priors', 'pitloss_priors.json'), 'utf8'));

// Ogni controllo: codice, condizione di paradosso, messaggio. L'assenza di un
// campo nell'output NON fa scattare il controllo (si valida ciò che c'è; ciò
// che manca è responsabilità del contratto a monte).
const CONTROLLI = [
  {
    codice: 'D1_stazionario',
    // prior esterno: pavimento fisico dello stazionario 1,8 s → nessuna
    // perdita di sosta reale può stargli sotto
    scatta: out => out.perditaSosta != null && out.perditaSosta < PRIORS.stazionario_s.pavimento_fisico,
    messaggio: out => `perdita di sosta ${out.perditaSosta} s sotto il pavimento fisico (${PRIORS.stazionario_s.pavimento_fisico} s): paradosso, non un record`,
  },
  {
    codice: 'D2_nan',
    // un NaN è un null entrato in aritmetica: l'assenza doveva restare null
    scatta: out => out.cum != null && Object.values(out.cum).some(v => typeof v === 'number' && Number.isNaN(v)),
    messaggio: () => 'NaN nei cum: un null è entrato in aritmetica (Regola 6)',
  },
  {
    codice: 'D3_fermati_subito',
    // il sintomo E01: gomma fresca eppure conviene fermarsi al primo giro
    // disponibile — sul vecchio motore era vero in 718/718 casi, ed era un bug
    scatta: out => {
      if (out.curva == null || out.curva.length === 0 || out.etaAlCongelamento == null) return false;
      if (out.etaAlCongelamento > 2) return false;
      const prima = out.curva[0];
      const minimo = out.curva.reduce((m, p) => (p.delta < m.delta ? p : m));
      return minimo.giroSosta === prima.giroSosta && minimo.delta < 0;
    },
    messaggio: () => '"fermati subito" con gomma fresca: profuma di gradino perpetuo (E01), l\'output non va in pagina',
  },
  {
    codice: 'D4_due_mescole',
    // regolamento 2026: obbligo di 2 mescole slick sull'asciutto
    scatta: out => out.piano != null && out.piano.bagnato === false
      && new Set(out.piano.mescoleUsate ?? []).size < 2,
    messaggio: () => 'piano monomescola su asciutto: viola l\'obbligo 2026 delle due mescole slick',
  },
  {
    codice: 'D5_drs',
    // nel 2026 il DRS non esiste (Manual Override Mode): un output che ne
    // parla viene da un modello vecchio
    scatta: out => Object.values(out).some(v => typeof v === 'string' && /\bdrs\b/i.test(v)),
    messaggio: () => 'l\'output parla di DRS: nel 2026 non esiste (Manual Override Mode)',
  },
];

export function controllaOutput(output) {
  const violazioni = [];
  for (const c of CONTROLLI) {
    if (c.scatta(output)) violazioni.push({ codice: c.codice, messaggio: c.messaggio(output) });
  }
  return { ok: violazioni.length === 0, violazioni };
}
