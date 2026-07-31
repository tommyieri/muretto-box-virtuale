// s02_inventario — un solo censimento, testato (E24).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) data/INVENTARIO.md diverge da ciò che è davvero su disco (una gara in
//      più o in meno, un conteggio righe diverso): `genera_inventario.mjs
//      --check` esce != 0 — il caso E24: 8 gare da una parte, 10 dall'altra;
//  (b) un percorso sotto data/ contiene uno spazio (i glob si spezzano);
//  (c) il nome canonico "Gran Bretagna" (con spazio) ricompare da qualche
//      parte sotto data/ o nell'inventario: il rename in "GranBretagna" è
//      registrato e definitivo;
//  (d) il confronto dell'inventario ha perso il potere di fallire: un
//      inventario manomesso passato con --file DEVE far uscire 1 il check.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const radice = path.join(qui, '..', '..');
const generatore = path.join(radice, 'provenienza', 'genera_inventario.mjs');
const dataDir = path.join(radice, 'data');

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s02 FALLITA — ${msg}`); };

// (a) inventario allineato al disco
{
  const r = spawnSync(process.execPath, [generatore, '--check'], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) {
    fallisci('INVENTARIO.md diverge dai file reali (rigenera con provenienza/genera_inventario.mjs)');
    if (r.stdout) console.error(r.stdout.trim());
    if (r.stderr) console.error(r.stderr.trim());
  }
}

// (b) + (c) nessuno spazio nei percorsi, niente "Gran Bretagna" canonico
const visita = (dir) => {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (nome.includes(' ')) fallisci(`percorso con spazio: ${path.relative(radice, p)}`);
    if (statSync(p).isDirectory()) visita(p);
  }
};
visita(dataDir);

const inventario = readFileSync(path.join(dataDir, 'INVENTARIO.md'), 'utf8');
if (!inventario.includes('GranBretagna')) fallisci('l\'inventario non registra il nome canonico GranBretagna');
if (/\| *Gran Bretagna *\|/.test(inventario)) fallisci('"Gran Bretagna" con lo spazio compare come nome canonico nell\'inventario');

// (d) potere di fallire del --check
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), 's02-'));
  try {
    const manomesso = path.join(tmp, 'INVENTARIO_manomesso.md');
    writeFileSync(manomesso, inventario.replace(/\d/, (d) => String((Number(d) + 1) % 10)));
    const r = spawnSync(process.execPath, [generatore, '--check', '--file', manomesso], { encoding: 'utf8' });
    if ((r.status ?? 1) !== 1) fallisci(`un inventario manomesso DEVE far uscire 1 il check (exit ${r.status})`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

process.exit(errori === 0 ? 0 : 1);
