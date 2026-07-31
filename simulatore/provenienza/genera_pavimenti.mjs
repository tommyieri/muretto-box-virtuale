#!/usr/bin/env node
// genera_pavimenti.mjs — il "pavimento" di ogni circuito: il giro verde più
// veloce osservato. Serve al Director come limite fisico inferiore: sotto quel
// tempo (meno il margine dichiarato) un giro verde è un paradosso, non un
// risultato.
//
// È MISURATO, non inventato: esce dal grezzo pinnato passando per l'unica
// definizione di verde (regola 1). Il margine con cui il Director lo usa NON
// sta qui — sta in data/priors/director_limiti.json, perché è politica di
// guardia, non misura. Dato e politica restano separati.
//
// Uso: node provenienza/genera_pavimenti.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from './gare_2026.mjs';
import { verde } from './definizioni.mjs';
import { sha256File } from './manifest_lib.mjs';

export const PERCORSO_PAVIMENTI = 'data/modelli/pavimenti_2026.json';

export function costruisciPavimenti(radice) {
  const gare = caricaGare2026(radice);
  const fuori = {};
  for (const [nome, gara] of Object.entries(gare)) {
    let minimo = null;
    let nVerdi = 0;
    for (const { cella } of gara.righe) {
      if (!verde(cella) || cella.lap_time === null) continue;
      nVerdi += 1;
      if (minimo === null || cella.lap_time < minimo) minimo = cella.lap_time;
    }
    fuori[nome] = {
      // L'assenza resta null: una gara senza giri verdi non prende un
      // pavimento somigliante (regola 6).
      pavimento_s: minimo === null ? null : Number(minimo.toFixed(3)),
      n_giri_verdi: nVerdi,
      fonte: gara.fonte,
      sha256: sha256File(gara.fonteAbs),
    };
  }
  return fuori;
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gare = costruisciPavimenti(radice);
  const fuori = {
    _targhetta: {
      tipo: 'misurato sul grezzo 2026 — giro verde più veloce osservato per gara',
      definizione: 'provenienza/definizioni.mjs · verde && lap_time non nullo',
      uso: 'limite fisico inferiore del Director; il margine di tolleranza è dichiarato a parte in data/priors/director_limiti.json',
      limite: 'è il minimo su UNA stagione e su queste 11 gare: non è un record assoluto, e un circuito non elencato non ha pavimento (null, non un valore di ripiego)',
      generato_da: 'provenienza/genera_pavimenti.mjs',
      data: '2026-07-29',
    },
    gare,
  };
  const dest = path.join(radice, PERCORSO_PAVIMENTI);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(fuori, null, 2) + '\n');
  for (const [g, v] of Object.entries(gare)) console.log(`${g.padEnd(14)} ${v.pavimento_s}s su ${v.n_giri_verdi} giri verdi`);
  console.log(`scritto: ${PERCORSO_PAVIMENTI}`);
}
