// S10 — Inventario unico e testato (contro E24: 8 gare lato Python, 10 nei
// test JS, "Gran Bretagna" con lo spazio che spezzava i glob). L'inventario
// vive in data/gare_registro.json e in NESSUN altro posto; qui si verifica
// che corrisponda ai file reali e che la frontiera produca celle a contratto.
//
// L'ATTESA VIAGGIA COL GOLDEN (E07): 11 gare 2026 al 29/07/2026, elencate
// qui sotto per nome. Chi aggiunge una gara aggiorna QUESTA attesa nello
// stesso commit: è la firma consapevole, non un attrito.
//
// FALLIREBBE SE: l'inventario divergesse dall'attesa dichiarata; un cid o un
// nome fosse duplicato; un file raw mancasse; la frontiera producesse celle
// con chiavi diverse dalla shape unica del contratto, status fuori
// dall'alfabeto {1,2,4,5,6,7}, letterali 'None' non lavati, o buchi
// impliciti (una cella assente deve essere null, non saltata).
import { nuovoBanco, RADICE } from '../lib/attrezzi.mjs';
import { caricaInventario } from '../../provenienza/inventario.mjs';
import { caricaGaraGrezza } from '../../provenienza/frontiera.mjs';
import { ALFABETO_STATUS } from '../../provenienza/contratto.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const b = nuovoBanco('s10_inventario');

// attesa dichiarata il 2026-07-29
const ATTESE = ['Australia', 'Cina', 'Giappone', 'Miami', 'Canada', 'Monaco',
                'Spagna', 'Austria', 'Gran Bretagna', 'Belgio', 'Ungheria'];
const CHIAVI_CELLA = ['lap_time', 'cum_time', 'stint', 'compound', 'tyre_age',
                      'in_lap', 'out_lap', 'status', 'del'].sort().join(',');

const inventario = caricaInventario();
b.verifica(inventario.length === ATTESE.length,
  `${inventario.length} gare nell'inventario, attese ${ATTESE.length} (attesa dichiarata 2026-07-29)`);
b.verifica(ATTESE.every(n => inventario.some(g => g.nome === n)),
  `gare attese assenti: ${ATTESE.filter(n => !inventario.some(g => g.nome === n)).join(', ')}`);
b.verifica(new Set(inventario.map(g => g.cid)).size === inventario.length, 'cid duplicati nell\'inventario');
b.verifica(new Set(inventario.map(g => g.nome)).size === inventario.length, 'nomi duplicati nell\'inventario');

for (const gara of inventario) {
  if (!existsSync(join(RADICE, gara.raw))) {
    b.verifica(false, `${gara.nome}: file raw assente (${gara.raw})`);
    continue;
  }
  const byLap = caricaGaraGrezza(join(RADICE, gara.raw));
  const piloti = Object.keys(byLap);
  b.verifica(piloti.length >= 15, `${gara.nome}: solo ${piloti.length} piloti`);
  let celleViste = 0;
  for (const drv of piloti) {
    for (const cella of byLap[drv]) {
      if (cella === null) continue;   // il buco esplicito è lecito: è null, non assenza silenziosa
      celleViste += 1;
      const chiavi = Object.keys(cella).sort().join(',');
      if (chiavi !== CHIAVI_CELLA) {
        b.verifica(false, `${gara.nome}/${drv}: cella fuori contratto (${chiavi})`);
        break;
      }
      if (cella.status !== null && ![...cella.status].every(c => ALFABETO_STATUS.has(c))) {
        b.verifica(false, `${gara.nome}/${drv}: status '${cella.status}' fuori alfabeto`);
      }
      if (cella.compound === 'None' || cella.lap_time === 'None') {
        b.verifica(false, `${gara.nome}/${drv}: letterale 'None' oltre la frontiera (E05)`);
      }
      if (cella.lap_time !== null && typeof cella.lap_time !== 'number') {
        b.verifica(false, `${gara.nome}/${drv}: lap_time né numero né null`);
      }
    }
  }
  b.verifica(celleViste >= 500, `${gara.nome}: solo ${celleViste} celle — la frontiera ha perso la gara`);
}

b.fine();
