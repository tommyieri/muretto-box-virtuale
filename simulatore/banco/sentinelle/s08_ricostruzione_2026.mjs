// s08_ricostruzione_2026 — la baseline è riproducibile, o non è una baseline.
//
// banco/golden/ricostruzione_2026.json è il conteggio celle totali/verdi/
// neutralizzate per ogni gara 2026, con l'hash dei conteggi e l'hash della
// fonte di ogni gara. Questa sentinella RICALCOLA tutto dal grezzo pinnato e
// pretende che coincida: è il modo in cui un cambio silenzioso di definizione
// (E12) o di dato (E18) si fa vedere subito.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) i conteggi ricalcolati divergono dal golden committato — qualcuno ha
//      toccato `verde`, `regimeNeutralizzato` o l'adapter senza rimisurare
//      (E22: numeri pubblicati e mai rimisurati dopo un fix);
//  (b) l'hash dei conteggi nel golden non corrisponde ai conteggi che il golden
//      stesso contiene (un golden modificato a mano, E07);
//  (c) l'hash della fonte di una gara non corrisponde più al file su disco o a
//      data/MANIFEST.sha256: la baseline è stata misurata su un dato diverso
//      da quello pinnato (regola 7);
//  (d) sparisce una gara: la baseline copre tutte le gare dell'inventario,
//      niente mappe parziali (E24).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ricostruisci2026, PERCORSO_GOLDEN } from '../../provenienza/ricostruisci_2026.mjs';
import { sha256Testo, canonico } from '../../provenienza/hash_lib.mjs';
import { leggiManifest } from '../../provenienza/manifest_lib.mjs';

const b = banco('s08');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const golden = JSON.parse(readFileSync(path.join(radice, PERCORSO_GOLDEN), 'utf8'));
const reale = ricostruisci2026(radice);

// (a) conteggi ricalcolati == golden
b.uguale('i conteggi per gara coincidono col golden', reale.gare, golden.gare);
b.uguale('i totali coincidono col golden', reale.totali, golden.totali);

// (b) l'hash nel golden descrive i conteggi nel golden
b.uguale('hash_conteggi del golden = hash dei suoi conteggi',
  golden.hash_conteggi, sha256Testo(canonico({ gare: golden.gare, totali: golden.totali })));
b.uguale('hash_conteggi ricalcolato = hash_conteggi del golden', reale.hash_conteggi, golden.hash_conteggi);

// (c) le fonti sono quelle pinnate nel manifest
const { attesi } = leggiManifest(radice);
for (const [gara, c] of Object.entries(golden.gare)) {
  b.uguale(`${gara}: la fonte è pinnata nel manifest con lo stesso hash`, c.sha256, attesi.get(c.fonte));
}

// (d) copertura piena rispetto all'inventario
const inventario = readFileSync(path.join(radice, 'data', 'INVENTARIO.md'), 'utf8');
const gareInventario = [...inventario.matchAll(/^\| ([A-Za-z]+) \| (?:\d+|null[^|]*) \| ti_/gm)].map((m) => m[1]);
b.verifica('l\'inventario dichiara delle gare 2026 da coprire', gareInventario.length > 0);
for (const gara of gareInventario) {
  b.verifica(`${gara} è nella baseline (niente mappe parziali, E24)`, Object.hasOwn(golden.gare, gara));
}
b.uguale('la baseline non copre gare che l\'inventario non conosce',
  Object.keys(golden.gare).filter((g) => !gareInventario.includes(g)), []);

b.chiudi();
