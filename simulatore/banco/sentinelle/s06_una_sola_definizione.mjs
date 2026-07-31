// s06_una_sola_definizione — regola 1, la più importante (E12).
//
// Le definizioni derivate vivono in provenienza/definizioni.mjs e NESSUN altro
// modulo le ridefinisce: chi le usa le importa. Il vecchio repo ha pagato il
// 37% di divergenza replay/live perché "verde" esisteva in due posti.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un file fuori da provenienza/definizioni.mjs DICHIARA una funzione
//      verde/isVerde/neutralizzato/regimeNeutralizzato/isGreen (una seconda
//      definizione, anche identica: è comunque una seconda definizione);
//  (b) un file fuori dal modulo Provenienza scrive a mano l'alfabeto delle
//      esclusioni (`'2456'`, un confronto con '4'/'6' su uno status) invece di
//      importare le definizioni;
//  (c) definizioni.mjs smette di essere l'unico ESPORTATORE di verde/regime.
//
// Esente dalla scansione: banco/sentinelle/ (i test NOMINANO le definizioni
// per verificarle) e provenienza/ (è il proprietario).

import { banco } from '../asserzioni.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s06');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROPRIETARIO = 'provenienza/definizioni.mjs';

const sorgenti = [];
const visita = (dir) => {
  for (const nome of readdirSync(dir)) {
    if (['node_modules', '.git', '_archivio', 'data'].includes(nome)) continue;
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) visita(p);
    else if (nome.endsWith('.mjs') || nome.endsWith('.js') || nome.endsWith('.py')) {
      sorgenti.push(path.relative(radice, p).split(path.sep).join('/'));
    }
  }
};
visita(radice);
b.verifica('la scansione trova dei sorgenti da controllare', sorgenti.length > 0);

const DICHIARAZIONE = /(?:function|const|let|var|export\s+function|def)\s+(verde|isVerde|isGreen|neutralizzato|regimeNeutralizzato|isNeutralized)\b/;
const ALFABETO_A_MANO = /['"](?:2456|456|46)['"]|status[^\n]{0,40}(?:===|==|includes\()\s*['"][2456]['"]/;

for (const rel of sorgenti) {
  const esente = rel.startsWith('provenienza/') || rel.startsWith('banco/sentinelle/');
  if (esente) continue;
  const testo = readFileSync(path.join(radice, rel), 'utf8');
  const dich = testo.match(DICHIARAZIONE);
  b.verifica(`${rel} non ridichiara una definizione derivata${dich ? ` (trovato: ${dich[0]})` : ''}`, dich === null);
  const alf = testo.match(ALFABETO_A_MANO);
  b.verifica(`${rel} non riscrive a mano l'alfabeto delle esclusioni${alf ? ` (trovato: ${alf[0]})` : ''}`, alf === null);
}

// (c) il proprietario è uno solo, ed è quello dichiarato
const testoProprietario = readFileSync(path.join(radice, PROPRIETARIO), 'utf8');
b.verifica('definizioni.mjs esporta verde', /export function verde\b/.test(testoProprietario));
b.verifica('definizioni.mjs esporta regimeNeutralizzato', /export function regimeNeutralizzato\b/.test(testoProprietario));
for (const rel of sorgenti.filter((r) => r.startsWith('provenienza/') && r !== PROPRIETARIO)) {
  const testo = readFileSync(path.join(radice, rel), 'utf8');
  b.verifica(`${rel} (dentro Provenienza) non esporta una seconda verde`, !/export function verde\b/.test(testo));
}

b.chiudi();
