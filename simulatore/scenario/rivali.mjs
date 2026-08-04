// rivali.mjs — I RIVALI NON SONO FERMI: quando si fermeranno, dedotto al congelamento.
//
// Prereg: ai_lab/confronto/PREREG_rivali_comportamentali.md.
//
// PERCHE' ESISTE. Ne' `genera_vista_gara.mjs`, ne' `genera_vista.mjs`, ne' il ponte live
// hanno mai passato un piano dei rivali: in PRODUZIONE il motore pianifica contro venti auto che non si
// fermano mai. Con `rho` e `vita_mescola` accesi quelle auto invecchiano la gomma fino alla
// bandiera e diventano lentissime — il mondo contro cui il pilota ottimizza non esiste.
//
// NIENTE DAL FUTURO (regola 5, E14). Al congelamento si sa che gomma ha addosso ogni
// rivale e da quanti giri. `vita_mescola` dice quanto dura quella gomma. Il resto e'
// sottrazione. Nessuna sosta vera dei rivali entra qui: quella sarebbe l'oracolo.
//
// PERCHE' NON E' IL MIRROR-PLAY DEGENERE. Quel tentativo dava a TUTTI i rivali la STESSA
// sosta, perche' usciva da una forma chiusa che dipende solo dalla gara: un grado di
// liberta' per gara, non per rivale. Qui ogni rivale ha la SUA gomma e la SUA eta', quindi
// la sua sosta. E' la differenza fra un parametro e un'osservazione.

import { mescolePerSoste } from './piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../provenienza/vocabolario.mjs';

/** La vita in giri di una mescola, dal sigillo. `null` se il sigillo e' spento o assente. */
function vitaDi(contesto, mescola) {
  const vm = contesto.vitaMescola ?? contesto.modello?.vita_mescola;
  if (vm?.attivo !== true || !vm.giri) return null;
  const g = vm.giri[mescola];
  return typeof g === 'number' && Number.isFinite(g) && g > 0 ? g : null;
}

/**
 * I PIANI DEI RIVALI, dedotti dallo stato al congelamento.
 *
 * @param g          la gara indicizzata (`perPilota`)
 * @param freezeLap  il congelamento: NIENTE oltre questo giro viene letto
 * @param pilota     il soggetto, che non e' un rivale di se' stesso
 * @param giroFinale la bandiera
 * @param contesto   per leggere `vita_mescola`
 * @param aCaso      `null` = comportamentale; una funzione ()=>[0,1) = PLACEBO (cancello R4):
 *                   la sosta cade a caso nella stessa finestra invece che a fine gomma
 * @returns `{ [drv]: [{ giro, mescola }] }` nella forma che `costruisciScenario` consuma,
 *          oppure `null` se la vita non e' disponibile (allora i rivali restano fermi come
 *          prima: un'assenza non diventa un piano inventato, regola 6).
 */
export function pianiComportamentali({ g, freezeLap, pilota, giroFinale }, contesto, aCaso = null) {
  const piani = {};
  let costruiti = 0;
  for (const [drv, celle] of g.perPilota) {
    if (drv === pilota) continue;
    const c = celle.get(freezeLap);
    if (!c) continue;
    if (c.compound === null || !MESCOLE_SLICK_ATTUALI.has(c.compound)) continue;
    if (c.tyre_age === null || !Number.isFinite(c.tyre_age)) continue;
    const vita = vitaDi(contesto, c.compound);
    if (vita === null) continue;

    const soste = [];
    // Le mescole gia' viste dal rivale FINO al congelamento: serve alla regola delle due
    // mescole, ed e' informazione presente (non futura).
    const usate = new Set();
    for (const [lap, cella] of celle) {
      if (lap > freezeLap) continue;
      if (cella.compound !== null && MESCOLE_SLICK_ATTUALI.has(cella.compound)) usate.add(cella.compound);
    }

    let giro = freezeLap;
    let eta = c.tyre_age;
    let mescola = c.compound;
    // Al piu' tre soste residue: oltre, si sta descrivendo un'altra gara.
    for (let k = 0; k < 3; k += 1) {
      const restanti = Math.max(1, Math.round(vitaDi(contesto, mescola) - eta));
      const quando = aCaso === null
        ? giro + restanti
        // PLACEBO: stessa finestra, giro sorteggiato. Serve a distinguere «il guadagno
        // viene dal QUANDO» da «il guadagno viene dall'ESISTERE di una sosta».
        : giro + 1 + Math.floor(aCaso() * Math.max(1, 2 * restanti - 1));
      if (quando >= giroFinale) break;
      const prossima = mescolePerSoste(1, usate)[0];
      soste.push({ giro: quando, mescola: prossima });
      usate.add(prossima);
      giro = quando; eta = 0; mescola = prossima;
    }
    if (soste.length) { piani[drv] = soste; costruiti += 1; }
  }
  return costruiti ? piani : null;
}
