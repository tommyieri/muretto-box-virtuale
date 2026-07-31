// manifest_lib.mjs — l'unica definizione di "manifest di data/" (regola 1).
// Usata da genera_manifest.mjs e verifica_manifest.mjs: chi la usa la importa,
// mai la ridefinisce.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const NOME_MANIFEST = 'MANIFEST.sha256';

// Elenca i file sotto <root>/data (percorsi relativi alla root, separatore /),
// escluso il manifest stesso. I percorsi con spazi NON sono ammessi (E24):
// vengono restituiti a parte perché il chiamante fallisca rumorosamente.
export function elencaFileData(root) {
  const file = [];
  const conSpazi = [];
  const visita = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const p = path.join(dir, nome);
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (statSync(p).isDirectory()) {
        if (nome.includes(' ')) conSpazi.push(rel + '/');
        visita(p);
      } else {
        if (rel === `data/${NOME_MANIFEST}`) continue;
        (nome.includes(' ') ? conSpazi : file).push(rel);
      }
    }
  };
  visita(path.join(root, 'data'));
  return { file, conSpazi };
}

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

// Legge il manifest: righe "hash␠␠percorso"; le righe che iniziano con '#'
// sono intestazione di provenienza. Una riga malformata è un errore, non si
// ignora in silenzio.
export function leggiManifest(root) {
  const testo = readFileSync(path.join(root, 'data', NOME_MANIFEST), 'utf8');
  const attesi = new Map();
  const malformate = [];
  for (const riga of testo.split('\n')) {
    if (riga === '' || riga.startsWith('#')) continue;
    const m = riga.match(/^([0-9a-f]{64})  (\S.*)$/);
    if (m) attesi.set(m[2], m[1]);
    else malformate.push(riga);
  }
  return { attesi, malformate };
}
