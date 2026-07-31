// allarmi.mjs — gli ALLARMI su un piano. Non i vincoli: gli allarmi.
//
// CLAUDE.md dice che le durate degli stint 2026 sono DECISIONI dei team, non
// fisica, e che in live sono ALLARMI, mai stime. Questo modulo è la sola
// traduzione ammessa di quella frase in codice: guarda un piano già scelto e
// dice se esce dall'esperienza del 2026. Non lo cambia, e non può — è chiamato
// DOPO la ricerca, riceve il piano e restituisce un elenco.
//
// La separazione non è estetica: il cancello M4 di PREREG_multistint.md chiede
// che il piano proposto sia IDENTICO con e senza questo modulo. Se gli allarmi
// vivessero dentro l'ottimizzatore quel cancello non si potrebbe nemmeno
// formulare, e le decisioni dei muretti sarebbero entrate nella fisica per la
// porta di servizio — che è E16 con un altro vestito: misurare sul bersaglio
// sbagliato e chiamarlo ottimo.
//
// PERCHÉ p90 E NON LA MEDIANA. L'allarme serve a dire «questo stint è lungo
// rispetto a ciò che si è visto», e per quello conta la coda alta, non il
// centro. Un piano che propone 20 giri di MEDIUM quando la mediana è 19 non è
// notizia; uno che ne propone 35 quando il novantesimo percentile è 30 lo è.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const PERCORSO_STINT_2026 = 'data/viste/stint_2026.json';

export function caricaDurate2026(radice) {
  const vista = JSON.parse(readFileSync(path.join(radice, PERCORSO_STINT_2026), 'utf8'));
  if (!/DECISIONI dei team/.test(vista._targhetta?.natura ?? '')) {
    throw new Error('la vista degli stint 2026 ha perso la targhetta che ne dichiara la natura: senza quella non si sa che sono decisioni e non fisica (regola 2)');
  }
  return vista;
}

/**
 * Gli allarmi di un piano. Ogni allarme porta la sua targhetta: chi legge deve
 * sapere che sta guardando il comportamento dei muretti nel 2026, non un limite
 * fisico della gomma — che nessuno ha misurato.
 *
 * @returns `[{ codice, stint, descrizione, targhetta }]` — vuoto è una risposta.
 */
export function allarmiPiano(piano, durate2026) {
  const allarmi = [];
  if (piano === null) return allarmi;
  for (const stint of piano.stint) {
    const m = stint.mescola;
    const rif = m === null ? null : durate2026.per_mescola?.[m];
    if (!rif || rif.p90_giri === null || rif.p90_giri === undefined) {
      // Regola 6: senza riferimento non si inventa un allarme, e nemmeno la
      // sua assenza si spaccia per «tutto bene»: si dichiara.
      allarmi.push({
        codice: 'STINT_SENZA_RIFERIMENTO',
        stint: stint.indice,
        descrizione: `stint ${stint.indice} su ${m ?? 'mescola ignota'}: nessuna durata 2026 di confronto`,
        targhetta: 'assenza dichiarata, non assenza di allarme',
      });
      continue;
    }
    if (stint.giri > rif.p90_giri) {
      allarmi.push({
        codice: 'STINT_OLTRE_ESPERIENZA_2026',
        stint: stint.indice,
        descrizione: `stint ${stint.indice}: ${stint.giri} giri su ${m}, oltre il 90° percentile 2026 (${rif.p90_giri} giri; mediana ${rif.mediana_giri}, massimo ${rif.massimo_giri})`,
        targhetta: `misurato 2026 su ${rif.n_stint_decisione} stint chiusi — DECISIONI dei team, non un limite fisico della gomma: il modello non ha cliff e non sa dire se quello stint sia sostenibile`,
      });
    }
  }
  return allarmi;
}
