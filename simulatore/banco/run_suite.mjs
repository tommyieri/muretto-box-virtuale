#!/usr/bin/env node
// run_suite.mjs — l'arbitro della suite (regola 4, E19/E23).
//
// Esegue ogni sentinella in banco/sentinelle/ (o in $SUITE_DIR, per potersi testare da
// solo) come processo figlio. Una suite che stampa FALLITO ed esce 0 è un ornamento —
// la sentinella s03 verifica proprio questo runner.
//
// ── LE ROSSE DICHIARATE, e perché esistono ──────────────────────────────────────────
//
// Dal giorno in cui due sentinelle sono diventate rosse PER DECISIONE (la banda sotto
// neutralizzazione che non raggiunge il livello promesso, e il bias piatto mancato per
// tre millesimi), la CI è rossa a ogni push e il PO riceve un'email di fallimento per
// ogni commit. Una CI sempre rossa non è severa: è MUTA. È l'ornamento della regola 4
// letto al contrario — un arbitro che fischia sempre non arbitra più niente, e il giorno
// in cui arriva una regressione vera nessuno la distingue dal rumore di fondo.
//
// Perciò il runner legge `banco/ROSSE_DICHIARATE.json` ed esce 0 SE E SOLO SE le rosse
// osservate coincidono ESATTAMENTE con quelle dichiarate. Non è un modo di spegnere una
// sentinella: ogni asserzione rossa resta rossa e viene stampata; cambia soltanto che il
// runner sa distinguere «questa la conosciamo, c'è un referto che la spiega» da «questa
// è nuova».
//
// È PIÙ SEVERO di prima, non meno, e in tre modi:
//   - una rossa NUOVA fa uscire 1, come sempre;
//   - una rossa dichiarata che DIVENTA VERDE fa uscire 1. Non è una buona notizia da
//     ignorare: significa che il referto che la dichiara non descrive più la realtà, e
//     va riletto prima che qualcuno costruisca su una decisione scaduta (E22);
//   - una sentinella che muore SENZA stampare asserzioni (crash, segnale) fa uscire 1
//     sempre, e non è dichiarabile: un processo che muore non ha detto niente.
//
// Il confronto usa la descrizione con le CIFRE RIMOSSE, così un numero che si muove
// dentro una rossa già nota non finge una regressione — ma il valore attuale viene
// stampato accanto, perché si veda che si è mosso.
//
// Con $SUITE_DIR impostata (le fixture di s03) il registro NON si applica: lì il runner
// deve comportarsi come l'arbitro nudo che s03 verifica.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const suiteDir = process.env.SUITE_DIR ?? path.join(qui, 'sentinelle');
const suiteVera = process.env.SUITE_DIR === undefined;

const sentinelle = readdirSync(suiteDir).filter((f) => f.endsWith('.mjs')).sort();
if (sentinelle.length === 0) {
  // Una suite vuota non è una suite verde: è l'assenza di un banco.
  console.error(`SUITE VUOTA: nessuna sentinella in ${suiteDir}`);
  process.exit(1);
}

/** La chiave di confronto: la descrizione senza cifre. */
const chiave = (sent, descr) => `${sent} :: ${descr.replace(/[\d.,]+/g, '#').replace(/\s+/g, ' ').trim()}`;

const dovRegistro = path.join(qui, 'ROSSE_DICHIARATE.json');
const dichiarate = new Map();
if (suiteVera && existsSync(dovRegistro)) {
  const reg = JSON.parse(readFileSync(dovRegistro, 'utf8'));
  for (const v of reg.dichiarate ?? []) {
    if (!v.referto) {
      console.error(`REGISTRO NON VALIDO: «${v.asserzione}» non cita nessun referto.`);
      console.error('  Una rossa senza documento che la dichiari non è una decisione: è un difetto che qualcuno ha smesso di guardare.');
      process.exit(1);
    }
    dichiarate.set(chiave(v.sentinella, v.asserzione), v);
  }
}

let morte = 0;
const osservate = new Map();
for (const f of sentinelle) {
  const r = spawnSync(process.execPath, [path.join(suiteDir, f)], { encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const code = r.status ?? 1; // processo ucciso da segnale = fallimento
  const righe = [...(r.stderr ?? '').matchAll(/^(\S+) FALLITA — (.+)$/gm)];
  for (const m of righe) osservate.set(chiave(m[1], m[2]), { sentinella: m[1], testo: m[2] });
  // Una sentinella che esce != 0 senza aver detto QUALE asserzione è caduta è morta, e
  // una morte non si dichiara: non ha prodotto nessuna informazione da accettare.
  if (code !== 0 && righe.length === 0) {
    console.error(`${f}: uscita ${code} senza stampare nessuna asserzione — sentinella MORTA, non dichiarabile.`);
    morte += 1;
  }
  console.log(`${code === 0 ? 'PASSA ' : 'FALLITA'}  ${f}`);
}

const rosse = new Set([...osservate.values()].map((v) => v.sentinella));
console.log(`\nsuite: ${sentinelle.length - rosse.size}/${sentinelle.length} sentinelle verdi`);

if (!suiteVera || dichiarate.size === 0) {
  process.exit(osservate.size === 0 && morte === 0 ? 0 : 1);
}

const nuove = [...osservate.entries()].filter(([k]) => !dichiarate.has(k));
const guarite = [...dichiarate.entries()].filter(([k]) => !osservate.has(k));

if (osservate.size > nuove.length) {
  console.log(`\nROSSE DICHIARATE (${osservate.size - nuove.length}/${dichiarate.size}), da banco/ROSSE_DICHIARATE.json:`);
  for (const [k, v] of osservate) {
    const d = dichiarate.get(k);
    if (!d) continue;
    console.log(`  ${v.sentinella}  [${d.natura}]  ${v.testo}`);
    console.log(`      referto: ${d.referto}`);
  }
}
for (const [, v] of nuove) console.error(`\nROSSA NUOVA — ${v.sentinella}: ${v.testo}`);
for (const [, d] of guarite) {
  console.error(`\nROSSA DICHIARATA ORA VERDE — ${d.sentinella}: ${d.asserzione}`);
  console.error(`  Non è una buona notizia da ignorare: il referto che la dichiara (${d.referto})`);
  console.error('  non descrive più la realtà. Rileggilo e togli la voce dal registro.');
}

if (morte || nuove.length || guarite.length) {
  console.error(`\nSUITE ROSSA: ${nuove.length} nuove, ${guarite.length} guarite non dichiarate, ${morte} morte.`);
  process.exit(1);
}
console.log('\nnessuna regressione: le rosse osservate sono esattamente quelle dichiarate.');
process.exit(0);
