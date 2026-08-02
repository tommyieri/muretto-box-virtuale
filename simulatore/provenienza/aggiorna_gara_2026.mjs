#!/usr/bin/env node
// aggiorna_gara_2026.mjs — IL PONTE CHE MANCAVA fra la gara appena pubblicata e il motore.
//
//     node provenienza/aggiorna_gara_2026.mjs <NomeGara> [--secco]
//
// PERCHE' ESISTE. Il 01/08/2026 il PO ha dato una direttiva: «quando si aggiunge una gara
// si deve aggiornare tutto e renderlo piu' preciso, e vale per tutto il progetto». Quel
// giorno e' stata costruita la ri-stima automatica del cuore (rho, delta70, rodaggio,
// banda) dentro auto_gara.py, e riferita come fatta.
//
// Era costruita a META', e il 02/08 la ricognizione lo ha misurato: `pipeline_gara.py`
// scrive il grezzo in `data/ti_archive/2026/<cartella TI>/Race.json`, mentre il motore
// legge `simulatore/data/gare_2026/{ti_cache,ti_archive}` — e NESSUNO SCRIVEVA LI'.
// L'Ungheria c'era entrata a mano, copiando i byte e traducendo il nome. Quindi la
// ri-stima girava, ogni domenica, su un ingresso CONGELATO A UNDICI GARE: si ricalcolava
// con diligenza sempre lo stesso numero, e nessuno se ne sarebbe accorto perche' tutto
// esce verde.
//
// Questo file e' il ponte, ed e' l'UNICA porta per le gare della stagione in corso
// (regola 1). `importa_archivio.mjs` resta la porta per il fondo ereditato, pinnata al
// vecchio repo: sono due mestieri diversi e non si fondono.
//
// COSA FA, e in quest'ordine perche' l'ordine e' la garanzia:
//   1. trova il grezzo dal REGISTRO (`data/gare_registro.json`), non indovinando percorsi;
//   2. lo fa passare dall'ADATTATORE: un file che il contratto-cella rifiuta non entra.
//      Un grezzo mutilato che entra si scopre due settimane dopo, in una stima storta;
//   3. lo installa in `data/gare_2026/ti_archive/<NomeGara>/Race.json`;
//   4. RI-PINNA il manifest verificando che l'unica differenza sia la gara nuova.
//
// COSA SI RIFIUTA DI FARE:
//   - sovrascrivere una gara gia' presente con byte DIVERSI. Il grezzo di una gara che
//     cambia da sotto e' un fatto grave (TI ritocca le sessioni), e va guardato da un
//     umano, non assorbito in silenzio. Con `--secco` si vede il diff e non si scrive;
//   - inventare la traduzione del nome: se la gara non e' nel registro, si ferma (E24);
//   - ri-pinnare se qualunque ALTRO file pinnato e' cambiato. Un manifest rigenerato alla
//     cieca benedice in silenzio qualunque cosa sia successa sotto `data/`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.join(QUI, '..');
const REPO = path.join(SIM, '..');

const argv = process.argv.slice(2);
const SECCO = argv.includes('--secco');
const nome = argv.find((a) => !a.startsWith('--'));
if (!nome) {
  console.error('uso: node provenienza/aggiorna_gara_2026.mjs <NomeGara> [--secco]');
  process.exit(1);
}

const sha = (b) => createHash('sha256').update(b).digest('hex');

// IL NOME DEL REGISTRO NON E' IL NOME DEL SIMULATORE, ed e' E24 in persona: il registro
// dice «Gran Bretagna» con lo spazio, il simulatore ha la cartella «GranBretagna». La
// traduzione e' la stessa registrata in data/INVENTARIO.md alla frontiera dell'import, e
// sta QUI perche' e' la stessa frontiera (regola 1). Uno spazio in un percorso spezza i
// glob e genera due inventari della stessa stagione.
const nomeSim = (n) => n.replace(/\s+/g, '');

// ── 1. il grezzo si trova dal REGISTRO, non indovinando ──────────────────────
const registro = JSON.parse(readFileSync(path.join(REPO, 'data', 'gare_registro.json'), 'utf8'));
const voce = registro[nome];
if (!voce) {
  console.error(`RIFIUTO: «${nome}» non e' nel registro delle gare (data/gare_registro.json).`);
  console.error('  Il nome canonico non si indovina: senza registro non si sa quale grezzo installare (E24).');
  console.error(`  Gare note: ${Object.keys(registro).join(', ')}`);
  process.exit(1);
}
const sorgente = path.join(REPO, voce.raw);
if (!existsSync(sorgente)) {
  console.error(`RIFIUTO: il registro dichiara ${voce.raw}, ma il file non esiste.`);
  process.exit(1);
}

// ── 2. il contratto decide se questo grezzo e' utilizzabile ──────────────────
const byte = readFileSync(sorgente);
let righe;
try {
  ({ righe } = adattaColonnare(JSON.parse(byte.toString('utf8')), { fonte: voce.raw }));
} catch (e) {
  console.error(`RIFIUTO: il grezzo di ${nome} non passa l'adattatore — ${e.message}`);
  console.error('  Un grezzo mutilato che entra si scopre due settimane dopo, dentro una stima storta.');
  process.exit(1);
}
const piloti = new Set(righe.map((r) => r.drv)).size;
const nGiri = righe.reduce((m, r) => Math.max(m, r.lap), 0);
if (piloti < 10 || nGiri < 20) {
  console.error(`RIFIUTO: ${nome} ha ${piloti} piloti e ${nGiri} giri — non e' una gara finita.`);
  process.exit(1);
}

// ── 3. l'installazione, che non sovrascrive di nascosto ──────────────────────
const cartella = nomeSim(nome);
const dest = path.join(SIM, 'data', 'gare_2026', 'ti_archive', cartella, 'Race.json');
const gia = existsSync(dest) ? readFileSync(dest) : null;
if (gia && sha(gia) === sha(byte)) {
  console.log(`${cartella}: gia' aggiornata (${righe.length} righe, ${piloti} piloti, ${nGiri} giri) — niente da fare.`);
  process.exit(0);
}
if (gia) {
  console.error(`RIFIUTO: ${cartella} e' gia' installata con byte DIVERSI.`);
  console.error(`  su disco  ${sha(gia).slice(0, 16)}`);
  console.error(`  sorgente  ${sha(byte).slice(0, 16)}`);
  console.error('  Il grezzo di una gara che cambia da sotto e\' un fatto grave (TI ritocca le sessioni):');
  console.error('  va guardato da un umano, non assorbito in silenzio. Rimuovi il file a mano per accettarlo.');
  process.exit(1);
}
if (SECCO) {
  console.log(`[secco] ${cartella} entrerebbe: ${righe.length} righe, ${piloti} piloti, ${nGiri} giri`);
  console.log(`[secco] destinazione: ${path.relative(REPO, dest)}`);
  process.exit(0);
}
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, byte);
console.log(`${cartella}: installata — ${righe.length} righe, ${piloti} piloti, ${nGiri} giri`);

// ── 4. il manifest, ri-pinnato SOLO se l'unica differenza e' la gara nuova ───
const dovManifest = path.join(SIM, 'data', 'MANIFEST.sha256');
const leggi = () => new Map(readFileSync(dovManifest, 'utf8').split('\n')
  .filter((r) => r && !r.startsWith('#'))
  .map((r) => { const [h, ...p] = r.split(/\s+/); return [p.join(' '), h]; }));
const prima = leggi();
execFileSync(process.execPath, [path.join(QUI, 'genera_manifest.mjs')], { cwd: SIM, stdio: 'pipe' });
const dopo = leggi();

const atteso = path.relative(SIM, dest).split(path.sep).join('/');
const cambiati = [...dopo.entries()].filter(([f, h]) => prima.get(f) !== h).map(([f]) => f);
const spariti = [...prima.keys()].filter((f) => !dopo.has(f));
const inattesi = cambiati.filter((f) => f !== atteso).concat(spariti);
if (inattesi.length) {
  writeFileSync(dovManifest, [...prima.entries()].map(([f, h]) => `${h}  ${f}`).join('\n'));
  console.error(`RIFIUTO IL PIN: oltre alla gara nuova sono cambiati ${inattesi.length} file pinnati:`);
  for (const f of inattesi.slice(0, 10)) console.error(`  ${f}`);
  console.error('  Un manifest rigenerato alla cieca benedice in silenzio qualunque cosa sia successa.');
  console.error('  Il manifest e\' stato RIMESSO com\'era; la gara resta installata. Guarda quei file.');
  process.exit(1);
}
console.log(`manifest: pinnata la gara nuova (${dopo.size} file, +${dopo.size - prima.size})`);
