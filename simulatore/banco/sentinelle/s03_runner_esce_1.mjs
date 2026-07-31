// s03_runner_esce_1 — la CI deve saper fallire (regola 4, E19/E23).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) run_suite.mjs inghiotte l'exit code: una suite con una sentinella che
//      esce 1 non fa uscire 1 il runner (la CI diventa un ornamento);
//  (b) il runner grida al lupo: una suite tutta verde non esce 0;
//  (c) una suite VUOTA esce 0 (l'assenza di un banco spacciata per banco verde);
//  (d) l'helper banco/asserzioni.mjs perde la potenza di fallire: se `chiudi()`
//      uscisse 0 dopo un'asserzione falsa, OGNI sentinella che lo usa passerebbe
//      per sempre — un ornamento con dentro tutto il banco (regola 4).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(qui, '..', 'run_suite.mjs');

const conSuite = (dir) =>
  spawnSync(process.execPath, [runner], { encoding: 'utf8', env: { ...process.env, SUITE_DIR: dir } });

let errori = 0;
const tmp = mkdtempSync(path.join(os.tmpdir(), 's03-'));
try {
  const rossa = path.join(tmp, 'rossa');
  mkdirSync(rossa);
  writeFileSync(path.join(rossa, 'passa.mjs'), 'process.exit(0);\n');
  writeFileSync(path.join(rossa, 'fallisce.mjs'), "console.error('FALLITO di proposito'); process.exit(1);\n");
  if ((conSuite(rossa).status ?? 1) !== 1) { errori += 1; console.error('s03 FALLITA — suite con un fallimento non esce 1'); }

  const verde = path.join(tmp, 'verde');
  mkdirSync(verde);
  writeFileSync(path.join(verde, 'passa.mjs'), 'process.exit(0);\n');
  if ((conSuite(verde).status ?? 1) !== 0) { errori += 1; console.error('s03 FALLITA — suite tutta verde non esce 0'); }

  const vuota = path.join(tmp, 'vuota');
  mkdirSync(vuota);
  if ((conSuite(vuota).status ?? 1) !== 1) { errori += 1; console.error('s03 FALLITA — suite vuota non esce 1'); }

  // (d) l'helper del banco, provato su se stesso
  const helper = pathToFileURL(path.join(qui, '..', 'asserzioni.mjs')).href;
  const conAsserzione = (corpo) => {
    const dir = path.join(tmp, `h${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir);
    writeFileSync(path.join(dir, 'fixture.mjs'),
      `import { banco } from ${JSON.stringify(helper)};\nconst b = banco('fixture');\n${corpo}\nb.chiudi();\n`);
    return conSuite(dir).status ?? 1;
  };
  const casi = [
    ["b.verifica('falsa di proposito', false);", 1, 'asserzione falsa'],
    ["b.verifica('truthy ma non true', 'sì');", 1, 'condizione truthy non booleana'],
    ["b.uguale('diversi', 1, 2);", 1, 'uguale su valori diversi'],
    ["b.esplode('non lancia', () => 42);", 1, 'esplode su funzione che non lancia'],
    ["b.verifica('vera', true); b.uguale('uguali', 1, 1); b.esplode('lancia', () => { throw new Error('x'); });", 0, 'asserzioni tutte vere'],
  ];
  for (const [corpo, atteso, descr] of casi) {
    const code = conAsserzione(corpo);
    if (code !== atteso) { errori += 1; console.error(`s03 FALLITA — asserzioni.mjs con ${descr}: exit ${code}, atteso ${atteso}`); }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(errori === 0 ? 0 : 1);
