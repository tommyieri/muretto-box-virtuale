// gare_indice.mjs — indicizzare righe gia' adattate, e sceglierne quelle buone
// per stimare un passo. PURO: nessun accesso al disco.
//
// PERCHE' STA IN UN MODULO A PARTE, staccato da gare_2026.mjs. Quel modulo sa
// DOVE stanno i grezzi del 2026 e li legge; queste due funzioni non leggono
// niente — trasformano righe che qualcun altro ha gia' in mano. La differenza
// era invisibile finche' tutto girava in Node, ed e' diventata decisiva quando
// il pannello LIVE ha dovuto eseguire il costruttore di scenari nel browser:
// `costruttore.mjs` chiama `osservazioniVerdi`, e importarla da un modulo che
// fa `import ... from 'node:fs'` bastava a rendere l'intero motore non
// caricabile in pagina. Il calcolo non dipende dal disco: ora nemmeno il grafo
// degli import lo dice.
//
// La sentinella s26 verifica che da qui in giu' non compaia mai node:fs.
import { passoUtilizzabile } from './definizioni.mjs';

/** Indice per pilota + distanza di gara, da righe gia adattate al contratto. */
export function indicizza(righe) {
  const perPilota = new Map();
  let nGiri = 0;
  for (const { drv, lap, cella } of righe) {
    if (Number.isInteger(lap) && lap > nGiri) nGiri = lap;
    if (!perPilota.has(drv)) perPilota.set(drv, new Map());
    perPilota.get(drv).set(lap, cella);
  }
  return { righe, perPilota, nGiri };
}

/**
 * I giri utilizzabili per stimare un passo: verdi, con tempo E con età gomma.
 * L'età nulla esce (regola 6): senza età non si stima un degrado, e mettere
 * uno zero plausibile al suo posto è esattamente ciò che la regola vieta.
 */
export function osservazioniVerdi(righe) {
  const fuori = [];
  for (const { drv, lap, cella } of righe) {
    if (!passoUtilizzabile(cella) || cella.tyre_age === null) continue;
    // `mescola` viaggia con l'osservazione dal 04/08/2026: senza, `stimaBasi` non
    // potrebbe sottrarre il termine di vita che `creaPasso` ri-aggiunge, e sarebbe E02
    // sotto un altro nome — cio' che si toglie misurando va rimesso simulando (regola 10).
    fuori.push({ drv, lap, eta: cella.tyre_age, t: cella.lap_time, stint: cella.stint, mescola: cella.compound });
  }
  fuori.sort((a, b) => (a.drv < b.drv ? -1 : a.drv > b.drv ? 1 : a.lap - b.lap));
  return fuori;
}
