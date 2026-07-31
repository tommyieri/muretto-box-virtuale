#!/usr/bin/env node
// ricostruisci_2026.mjs — la baseline: per ogni gara 2026, quante celle
// esistono, quante sono verdi (filtro passo), quante sono regime neutralizzato
// — calcolate SOLO da adapter + definizioni sul grezzo pinnato. Contro questi
// numeri si confronterà tutto il resto (replay, live, motore).
//
// Il risultato vive in banco/golden/ricostruzione_2026.json con:
//   - per gara: fonte, sha256 della fonte, conteggi;
//   - hash_conteggi: sha256 della forma canonica dei conteggi.
// La sentinella s08 ricalcola e pretende coincidenza (E07: le attese viaggiano
// COI golden; E22: si rimisura dopo ogni fix, o si etichetta pre-fix).
//
// VIETATO qui (E14): qualunque input costruito a gara finita. Si legge solo il
// grezzo per-giro; niente tabelle di neutralizzazione d'archivio.
//
// Uso: node provenienza/ricostruisci_2026.mjs          → riscrive il golden
//      (la verifica è compito di s08, non di questo script)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { fontiGare2026 } from './gare_2026.mjs';
import { verde, regimeNeutralizzato, passoUtilizzabile } from './definizioni.mjs';
import { sha256File } from './manifest_lib.mjs';
import { canonico, sha256Testo } from './hash_lib.mjs';

export const PERCORSO_GOLDEN = 'banco/golden/ricostruzione_2026.json';

export function ricostruisci2026(radice) {
  const fonti = fontiGare2026(radice);

  const gare = {};
  const totali = { celle: 0, verdi: 0, neutralizzate: 0, passo_utilizzabile: 0 };
  for (const [gara, { fonteAbs, fonte }] of Object.entries(fonti)) {
    const { righe } = adattaColonnare(JSON.parse(readFileSync(fonteAbs, 'utf8')), { fonte });

    const c = { fonte, sha256: sha256File(fonteAbs), celle: righe.length, verdi: 0, neutralizzate: 0, passo_utilizzabile: 0 };
    for (const { cella } of righe) {
      if (verde(cella)) c.verdi += 1;
      if (regimeNeutralizzato(cella)) c.neutralizzate += 1;
      if (passoUtilizzabile(cella)) c.passo_utilizzabile += 1;
    }
    gare[gara] = c;
    totali.celle += c.celle;
    totali.verdi += c.verdi;
    totali.neutralizzate += c.neutralizzate;
    totali.passo_utilizzabile += c.passo_utilizzabile;
  }

  return { gare, totali, hash_conteggi: sha256Testo(canonico({ gare, totali })) };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = ricostruisci2026(radice);
  const golden = {
    _targhetta: {
      tipo: 'misurato su questa gara — baseline di ricostruzione dal grezzo pinnato',
      definizioni: 'provenienza/definizioni.mjs (verde a due livelli, E12/E03)',
      generato_da: 'provenienza/ricostruisci_2026.mjs',
      verificato_da: 'banco/sentinelle/s08_ricostruzione_2026.mjs',
    },
    gare: r.gare,
    totali: r.totali,
    hash_conteggi: r.hash_conteggi,
  };
  const dest = path.join(radice, PERCORSO_GOLDEN);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(golden, null, 2) + '\n');

  console.log('gara            celle  verdi  neutr  passo');
  for (const [g, c] of Object.entries(r.gare)) {
    console.log(`${g.padEnd(14)} ${String(c.celle).padStart(6)} ${String(c.verdi).padStart(6)} ${String(c.neutralizzate).padStart(6)} ${String(c.passo_utilizzabile).padStart(6)}`);
  }
  const t = r.totali;
  console.log(`${'TOTALE'.padEnd(14)} ${String(t.celle).padStart(6)} ${String(t.verdi).padStart(6)} ${String(t.neutralizzate).padStart(6)} ${String(t.passo_utilizzabile).padStart(6)}`);
  console.log(`hash_conteggi: ${r.hash_conteggi}`);
  console.log(`golden scritto: ${PERCORSO_GOLDEN}`);
}
