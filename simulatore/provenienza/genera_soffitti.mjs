#!/usr/bin/env node
// genera_soffitti.mjs — il "soffitto" di ogni circuito: il giro più lento
// realmente percorso sotto neutralizzazione di campo. È il GEMELLO del
// pavimento, e il commento di genera_pavimenti.mjs vale qui parola per parola
// con il segno rovesciato: sopra quel tempo un giro neutralizzato è un
// paradosso, non un risultato.
//
// Uso: node provenienza/genera_soffitti.mjs
//
// A COSA SERVE. La terza forma della compressione (PREREG_terza_forma.md) fa
// pagare la contrazione dei distacchi al CAPOFILA invece che agli inseguitori:
// nessun giro si accorcia più, ma il primo della fila si allunga il suo. Senza
// un limite superiore quella consegna può produrre un giro che nessuno ha mai
// guidato, che è lo stesso difetto del pavimento visto dall'altro lato.
//
// IL PERIMETRO, e sono tre esclusioni tutte dichiarate:
//  · NEUTRALIZZAZIONE DI CAMPO, non regime della singola auto — `regimePerGiroDiCampo`
//    è l'unica definizione del repo (regola 1) e chiede che più di metà del campo sia
//    sotto regime: un 4 su una macchina sola è una gialla di settore;
//  · niente BANDIERA ROSSA: un giro che contiene la sospensione dura quanto la
//    sospensione, e non è un giro. Sarebbe il valore più alto di ogni circuito che ne
//    ha avuta una, e sarebbe l'unico numero che questo file produce;
//  · niente IN-LAP né OUT-LAP: la corsia box è un'altra cosa, ed è lo stesso perimetro
//    con cui κ è stato misurato.
//
// L'assenza resta null: un circuito senza neutralizzazioni misurate NON prende un
// soffitto somigliante (regola 6), e il kernel semplicemente non applica il vincolo.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from './gare_2026.mjs';
import { regimePerGiroDiCampo } from './definizioni.mjs';
import { sha256File } from './manifest_lib.mjs';

export const PERCORSO_SOFFITTI = 'data/modelli/soffitti_2026.json';

export function costruisciSoffitti(radice) {
  const gare = caricaGare2026(radice);
  const fuori = {};
  for (const [nome, gara] of Object.entries(gare)) {
    const perPilota = new Map();
    for (const { drv, lap, cella } of gara.righe) {
      if (!perPilota.has(drv)) perPilota.set(drv, new Map());
      perPilota.get(drv).set(lap, cella);
    }
    const regime = regimePerGiroDiCampo(perPilota);
    let massimo = null;
    let nGiri = 0;
    const conta = { SC: 0, VSC: 0 };
    for (const { lap, cella } of gara.righe) {
      const r = regime[lap];
      if (r !== 'SC' && r !== 'VSC') continue;       // RED escluso: non è un giro
      if (cella.lap_time === null || cella.lap_time === undefined) continue;
      if (cella.in_lap === true || cella.out_lap === true) continue;
      nGiri += 1;
      conta[r] += 1;
      if (massimo === null || cella.lap_time > massimo) massimo = cella.lap_time;
    }
    fuori[nome] = {
      soffitto_s: massimo === null ? null : Number(massimo.toFixed(3)),
      n_giri_neutralizzati: nGiri,
      per_regime: conta,
      fonte: gara.fonte,
      sha256: sha256File(gara.fonteAbs),
    };
  }
  return fuori;
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gare = costruisciSoffitti(radice);
  const fuori = {
    _targhetta: {
      tipo: 'misurato sul grezzo 2026 — giro più lento osservato sotto neutralizzazione di campo, per gara',
      definizione: 'provenienza/definizioni.mjs · regimePerGiroDiCampo ∈ {SC, VSC}, niente in-lap/out-lap',
      esclusioni: 'bandiera ROSSA esclusa: un giro che contiene la sospensione non è un giro',
      uso: 'limite fisico superiore della compressione nella terza forma (PREREG_terza_forma.md): il capofila non può pagare più di così',
      limite: 'è il massimo su UNA stagione e su queste 11 gare: un circuito senza neutralizzazioni misurate non ha soffitto (null, non un valore di ripiego)',
      gemello: 'data/modelli/pavimenti_2026.json — stessa regola, segno opposto',
      generato_da: 'provenienza/genera_soffitti.mjs',
      data: '2026-08-15',
    },
    gare,
  };
  const dest = path.join(radice, PERCORSO_SOFFITTI);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(fuori, null, 2) + '\n');
  for (const [g, v] of Object.entries(gare)) console.log(`${g.padEnd(14)} ${v.soffitto_s}s su ${v.n_giri_neutralizzati} giri neutralizzati (SC ${v.per_regime.SC} · VSC ${v.per_regime.VSC})`);
  console.log(`scritto: ${PERCORSO_SOFFITTI}`);
}
