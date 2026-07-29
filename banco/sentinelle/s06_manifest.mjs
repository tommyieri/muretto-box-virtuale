// S06 — Dati pinnati, fallimento rumoroso (Regola 7, contro E18).
// data/MANIFEST.sha256 è la verità: ogni file ereditato ha il suo hash. Il
// loader del vecchio repo validava con "size > 1000" da un branch mutabile:
// cache avvelenabile per sempre.
//
// FALLIREBBE SE: un file di data/ cambiasse contenuto (hash difforme),
// sparisse (mancante), o comparisse fuori manifest senza essere un artefatto
// locale dichiarato (extra); oppure se il verificatore stesso diventasse
// cieco — il controllo negativo con un manifest manomesso DEVE segnalare la
// difformità (contro E09: un test senza potere di fallire è un ornamento).
import { nuovoBanco, RADICE } from '../lib/attrezzi.mjs';
import { verificaManifest } from '../../provenienza/verifica_manifest.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const b = nuovoBanco('s06_manifest');

const esito = verificaManifest({ radice: RADICE });
b.verifica(esito.ok === true, 'manifest non verificato');
b.verifica(esito.difformi.length === 0, `file con hash difforme: ${esito.difformi.slice(0, 5).join(', ')}`);
b.verifica(esito.mancanti.length === 0, `file nel manifest ma assenti su disco: ${esito.mancanti.slice(0, 5).join(', ')}`);
b.verifica(esito.extra.length === 0, `file in data/ fuori manifest (non dichiarati come artefatti locali): ${esito.extra.slice(0, 5).join(', ')}`);
b.verifica(esito.contati >= 1000, `solo ${esito.contati} file verificati: il manifest si è svuotato`);

// controllo negativo: manometto UNA riga del manifest (primo carattere
// dell'hash ruotato) e il verificatore DEVE vedere la difformità
const testo = readFileSync(join(RADICE, 'data', 'MANIFEST.sha256'), 'utf8');
const manomesso = testo.replace(/^([0-9a-f])/, c => (c === '0' ? '1' : '0'));
const controllo = verificaManifest({ radice: RADICE, manifestTesto: manomesso });
b.verifica(controllo.ok === false && controllo.difformi.length === 1,
  'il verificatore NON ha visto un hash manomesso: è cieco');

b.fine();
