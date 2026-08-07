// s40_inventario_codice — il perimetro-dal-registro, esteso al CODICE del motore.
//
// Il buco che chiude: piano_rotto.mjs (mutante di piano.mjs, due righe diverse,
// costruito per provare che s39 ha potere di fallire) è stato committato dentro
// scenario/ ed è vissuto su main senza che nessuna guardia se ne accorgesse.
// Il perimetro-dal-registro esisteva per data/ (s02) e per demo/
// (test_debito_demo), non per il sorgente di simulatore/. E s14 è cieca a una
// copia ombra: controlla per nome di funzione, e il mutante esporta gli stessi
// nomi già registrati da piano.mjs.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un file presente in engine/, scenario/ o provenienza/ che NON sta in
//      banco/REGISTRO_CODICE.json — un intruso, il caso piano_rotto;
//  (b) un file elencato nel registro che NON esiste più su disco — una perdita
//      silenziosa (il registro mentirebbe);
//  (c) una sottocartella inattesa dentro quelle tre cartelle (il motore è
//      piatto per costruzione; una cartella nuova è una decisione, non un
//      dettaglio);
//  (d) il confronto ha perso il potere di fallire: un elenco fabbricato con un
//      intruso e una perdita DEVE produrre esattamente quei due problemi.
//
// Chi aggiunge un modulo di proposito aggiunge la riga al registro NELLO STESSO
// commit: è il costo dichiarato del perimetro, non un ostacolo.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const radice = path.join(qui, '..', '..');

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s40 FALLITA — ${msg}`); };

/**
 * Il confronto, puro perché (d) possa provarlo su elenchi fabbricati.
 * @returns {{intrusi: string[], perdite: string[]}}
 */
export const confronta = (attesi, reali) => ({
  intrusi: reali.filter((f) => !attesi.includes(f)).sort(),
  perdite: attesi.filter((f) => !reali.includes(f)).sort(),
});

// (a) + (b) + (c) — le tre cartelle contro il registro
const registro = JSON.parse(readFileSync(path.join(qui, '..', 'REGISTRO_CODICE.json'), 'utf8'));
for (const [cartella, attesi] of Object.entries(registro.cartelle)) {
  const dir = path.join(radice, cartella);
  const voci = readdirSync(dir);
  const reali = [];
  for (const nome of voci) {
    if (statSync(path.join(dir, nome)).isDirectory()) {
      fallisci(`${cartella}/${nome} è una sottocartella: il motore è piatto, una cartella nuova va decisa (e registrata)`);
      continue;
    }
    reali.push(nome);
  }
  const { intrusi, perdite } = confronta(attesi, reali);
  for (const f of intrusi) fallisci(`${cartella}/${f} non sta in REGISTRO_CODICE.json: intruso (il caso piano_rotto)`);
  for (const f of perdite) fallisci(`${cartella}/${f} sta nel registro ma non esiste: perdita silenziosa`);
}

// (d) — potere di fallire, su elenchi fabbricati
{
  const esito = confronta(['a.mjs', 'b.mjs'], ['a.mjs', 'ombra.mjs']);
  const ok = esito.intrusi.length === 1 && esito.intrusi[0] === 'ombra.mjs'
    && esito.perdite.length === 1 && esito.perdite[0] === 'b.mjs';
  if (!ok) fallisci(`il confronto ha perso il potere di fallire: su un elenco fabbricato con 1 intruso e 1 perdita ha risposto ${JSON.stringify(esito)}`);
}

process.exit(errori === 0 ? 0 : 1);
