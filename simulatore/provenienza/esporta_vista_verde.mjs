#!/usr/bin/env node
// esporta_vista_verde.mjs — la porta da cui la statistica Python riceve i dati.
//
// Python NON ri-definisce "verde" (sarebbe E12, la seconda definizione che è
// costata il 37% di divergenza replay/live): il filtro lo applica QUI il
// modulo che lo possiede, e Python legge il risultato. È la stessa divisione
// della regola 8 letta al contrario — il kernel resta in una lingua, la
// statistica riceve dati già definiti e restituisce JSON con targhetta.
//
// La vista contiene SOLO i giri con passo utilizzabile (verde + lap_time
// presente) e i campi che servono a stimare il modello v2. `n_giri` è la
// distanza della gara (massimo giro osservato su TUTTI i piloti, verdi o no):
// serve a convertire δ₇₀ in deriva per giro.
//
// Uso: node provenienza/esporta_vista_verde.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { passoUtilizzabile } from './definizioni.mjs';
import { sha256File } from './manifest_lib.mjs';

export const PERCORSO_VISTA = 'data/viste/vista_verde_2026.json';

export function costruisciVista(radice) {
  const dirCache = path.join(radice, 'data', 'gare_2026', 'ti_cache');
  const dirArch = path.join(radice, 'data', 'gare_2026', 'ti_archive');
  const nomi = new Set([
    ...readdirSync(dirCache).map((f) => f.replace(/\.json$/, '')),
    ...readdirSync(dirArch),
  ]);

  const gare = {};
  for (const gara of [...nomi].sort()) {
    const cache = path.join(dirCache, `${gara}.json`);
    const race = path.join(dirArch, gara, 'Race.json');
    const fonteAbs = existsSync(cache) ? cache : race;
    if (!existsSync(fonteAbs)) throw new Error(`gara 2026 senza grezzo giri: ${gara}`);
    const fonte = path.relative(radice, fonteAbs).split(path.sep).join('/');
    const { righe } = adattaColonnare(JSON.parse(readFileSync(fonteAbs, 'utf8')), { fonte });

    let nGiri = 0;
    for (const { lap } of righe) if (Number.isInteger(lap) && lap > nGiri) nGiri = lap;

    const verdi = [];
    for (const { drv, lap, cella } of righe) {
      if (!passoUtilizzabile(cella)) continue;
      if (cella.tyre_age === null) continue; // senza età non si stima il degrado (regola 6)
      verdi.push({ drv, lap, eta: cella.tyre_age, t: cella.lap_time, stint: cella.stint });
    }
    verdi.sort((a, b) => (a.drv < b.drv ? -1 : a.drv > b.drv ? 1 : a.lap - b.lap));
    gare[gara] = { fonte, sha256: sha256File(fonteAbs), n_giri: nGiri, n_righe: verdi.length, righe: verdi };
  }
  return gare;
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gare = costruisciVista(radice);
  const vista = {
    _targhetta: {
      tipo: 'misurato sul grezzo 2026 — vista dei soli giri con passo utilizzabile',
      definizione: 'provenienza/definizioni.mjs · passoUtilizzabile = verde && lap_time non nullo',
      generata_da: 'provenienza/esporta_vista_verde.mjs',
      perche: 'la statistica Python legge da qui invece di ri-definire il verde (regola 1, E12)',
      campi: 'drv · lap (giro di gara) · eta (età gomma) · t (tempo sul giro, s) · stint',
    },
    gare,
  };
  const dest = path.join(radice, PERCORSO_VISTA);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  const tot = Object.values(gare).reduce((n, g) => n + g.n_righe, 0);
  for (const [g, v] of Object.entries(gare)) console.log(`${g.padEnd(14)} ${String(v.n_righe).padStart(5)} giri verdi su ${v.n_giri} giri di gara`);
  console.log(`TOTALE ${tot} righe → ${PERCORSO_VISTA}`);
}
