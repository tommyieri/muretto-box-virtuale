// test_f1db_checksum.mjs — sorveglianza su data/pit_loss_circuito_f1db.csv.
//
// Il CSV e' ORFANO (nessun generatore committato) ma CONSUMATO dalla produzione:
// pipeline_gara.py lo travasa nello staging di ogni gara nuova (e ora e' il TIPICO
// di circuito dell'architettura per-gara — vedi NOTA_PITLOSS_PERGARA.md). Nessun
// golden lo copre: questo checksum e' l'unico allarme se qualcosa lo tocca.
// Storia: l'unica modifica legittima finora e' l'attivazione Silverstone
// 29,12 -> 20,80 (NOTA_SILVERSTONE.md, ATT6, checkpoint PO).
import { createHash } from 'crypto';
import fs from 'fs';

const FILE = 'data/pit_loss_circuito_f1db.csv';
// SHA-256 atteso — stato al 16/07/2026 (silverstone 20,80, tutte le altre righe durate f1db).
const ATTESO = '03a22c6eab4a719db07430ae2801063b038a15de14fa6d7467c23036a1243f09';

const hash = createHash('sha256').update(fs.readFileSync(FILE)).digest('hex');
if (hash !== ATTESO) {
  console.error(`✗ test_f1db_checksum: il CSV f1db e' cambiato: file senza generatore, ogni
modifica deve essere deliberata e documentata. Se la modifica e' voluta, aggiornare il
checksum QUI e motivare nel commit.
  atteso : ${ATTESO}
  trovato: ${hash}`);
  process.exit(1);
}
console.log(`✓ test_f1db_checksum: ${FILE} invariato (sha256 ${hash.slice(0, 16)}…)`);
