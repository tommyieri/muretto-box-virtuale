// PROVENIENZA / INVENTARIO — l'inventario delle gare vive in
// data/gare_registro.json e in NESSUN altro posto (E24: 8 gare lato Python,
// 10 nei test JS, mai più). Chi ha bisogno dell'elenco lo importa da qui;
// la sentinella s10 lo tiene agganciato ai file reali con attesa dichiarata.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

export function caricaInventario() {
  const registro = JSON.parse(readFileSync(join(RADICE, 'data', 'gare_registro.json'), 'utf8'));
  return Object.entries(registro).map(([nome, g]) => ({
    nome,          // nome italiano, chiave del registro
    ti: g.ti,      // nome TracingInsights
    raw: g.raw,    // percorso del grezzo, relativo alla radice
    cid: g.cid,    // id circuito (aggancia i prior di pit-loss)
  }));
}
