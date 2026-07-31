// gare_2026.mjs — UNA definizione di "dove stanno i giri delle gare 2026"
// (regola 1). La gerarchia delle fonti — prima `ti_cache`, poi `Race.json` in
// `ti_archive` — vive qui e basta: inventario, ricostruzione, vista verde e
// banco la importano, nessuno la riscrive. Due copie di questa scelta
// significherebbero due inventari diversi della stessa stagione (E24).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { passoUtilizzabile } from './definizioni.mjs';

export function fontiGare2026(radice) {
  const dirCache = path.join(radice, 'data', 'gare_2026', 'ti_cache');
  const dirArch = path.join(radice, 'data', 'gare_2026', 'ti_archive');
  const nomi = new Set([
    ...readdirSync(dirCache).map((f) => f.replace(/\.json$/, '')),
    ...readdirSync(dirArch),
  ]);
  const fonti = {};
  for (const gara of [...nomi].sort()) {
    const cache = path.join(dirCache, `${gara}.json`);
    const race = path.join(dirArch, gara, 'Race.json');
    const fonteAbs = existsSync(cache) ? cache : race;
    if (!existsSync(fonteAbs)) {
      throw new Error(`gara 2026 senza grezzo giri: ${gara} — l'assenza si dichiara, non si salta (E24)`);
    }
    fonti[gara] = { fonteAbs, fonte: path.relative(radice, fonteAbs).split(path.sep).join('/') };
  }
  return fonti;
}

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

/** Righe adattate al contratto + indice per pilota + distanza di gara. */
export function caricaGara(fonteAbs, etichetta) {
  const { righe } = adattaColonnare(JSON.parse(readFileSync(fonteAbs, 'utf8')), { fonte: etichetta });
  return indicizza(righe);
}

export function caricaGare2026(radice) {
  const gare = {};
  for (const [gara, { fonteAbs, fonte }] of Object.entries(fontiGare2026(radice))) {
    gare[gara] = { fonte, fonteAbs, ...caricaGara(fonteAbs, gara) };
  }
  return gare;
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
    fuori.push({ drv, lap, eta: cella.tyre_age, t: cella.lap_time, stint: cella.stint });
  }
  fuori.sort((a, b) => (a.drv < b.drv ? -1 : a.drv > b.drv ? 1 : a.lap - b.lap));
  return fuori;
}
