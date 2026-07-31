// allarmi_dati.mjs — la vista delle durate stint 2026, letta dal disco.
//
// `allarmiPiano` (in allarmi.mjs) e' pura: riceve le durate e confronta. Il
// caricamento sta qui perche' gli allarmi si mostrano anche nel pannello live,
// che gira nel browser: un `node:fs` nel modulo del confronto lo escluderebbe.
//
// Il controllo sulla targhetta resta attaccato al CARICAMENTO, non al
// confronto: e' li' che si stabilisce la natura del dato (regola 2), e chi
// riceve le durate gia' caricate non ha piu' modo di verificarla.
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
