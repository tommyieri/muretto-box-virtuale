// s01_manifest — il manifest è la verità sui dati (regola 7, E18).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un file sotto data/ è alterato, mancante o INTRUSO rispetto a
//      data/MANIFEST.sha256 (il verificatore esce != 0 sul repo reale);
//  (b) il verificatore ha perso il potere di fallire: su una fixture
//      deliberatamente corrotta (byte cambiato / file rimosso / file intruso /
//      nome con spazio) esce 0 invece di 1 — il caso E18: una validazione che
//      non valida.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const radice = path.join(qui, '..', '..');
const verificatore = path.join(radice, 'provenienza', 'verifica_manifest.mjs');
const generatore = path.join(radice, 'provenienza', 'genera_manifest.mjs');

const esegui = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

let errori = 0;
const attendi = (descr, r, codeAtteso) => {
  const code = r.status ?? 1;
  if (code !== codeAtteso) {
    errori += 1;
    console.error(`s01 FALLITA — ${descr}: exit ${code}, atteso ${codeAtteso}`);
    if (r.stdout) console.error(r.stdout.trim());
    if (r.stderr) console.error(r.stderr.trim());
  }
};

// (a) il repo reale è integro
attendi('data/ reale contro MANIFEST.sha256', esegui(verificatore, []), 0);

// (b) potere di fallire, su fixture minima
const tmp = mkdtempSync(path.join(os.tmpdir(), 's01-'));
try {
  const fixture = path.join(tmp, 'pulita');
  mkdirSync(path.join(fixture, 'data', 'sub'), { recursive: true });
  writeFileSync(path.join(fixture, 'data', 'a.json'), '{"x":1}\n');
  writeFileSync(path.join(fixture, 'data', 'sub', 'b.csv'), 'k,v\n1,2\n');
  attendi('generazione manifest fixture', esegui(generatore, ['--root', fixture]), 0);
  attendi('fixture pulita verifica', esegui(verificatore, ['--root', fixture]), 0);

  const conCaso = (nome, guasta) => {
    const copia = path.join(tmp, nome);
    cpSync(fixture, copia, { recursive: true });
    guasta(copia);
    attendi(`fixture "${nome}" DEVE far uscire 1 il verificatore`, esegui(verificatore, ['--root', copia]), 1);
  };
  conCaso('corrotta', (c) => writeFileSync(path.join(c, 'data', 'a.json'), '{"x":2}\n'));
  conCaso('mancante', (c) => rmSync(path.join(c, 'data', 'sub', 'b.csv')));
  conCaso('intruso', (c) => writeFileSync(path.join(c, 'data', 'intruso.json'), '{}\n'));
  conCaso('spazio', (c) => writeFileSync(path.join(c, 'data', 'con spazio.json'), '{}\n'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(errori === 0 ? 0 : 1);
