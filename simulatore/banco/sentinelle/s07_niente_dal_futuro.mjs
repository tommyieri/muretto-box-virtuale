// s07_niente_dal_futuro — E14: la tabella-neutralizzazione veniva dal futuro.
//
// `data/archivio/dal_futuro/` contiene materiale costruito A GARA FINITA
// (le finestre SC/VSC per gara, l'economia della neutralizzazione sul fondo).
// Nel vecchio repo è stato usato come se fosse live: nei percorsi dati e a
// congelamento entra solo informazione ≤ Lf.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un sorgente di provenienza/, engine/, fisica/, scenario/, live/ o web/
//      nomina `dal_futuro` (o `neutralizzazione.json` / `neutralizzazione_fondo.json`)
//      in un percorso dati: è E14 che rientra dalla finestra;
//  (b) il materiale dal futuro perde il suo README di marcatura, o il README
//      perde la marcatura esplicita: senza cartello, fra sei mesi è solo un
//      file di dati come gli altri;
//  (c) i file dal futuro spariscono dall'archivio o non sono più pinnati nel
//      manifest (l'archivio resta, marcato: non si cancella la storia).

import { banco } from '../asserzioni.mjs';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s07');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALBERI = ['provenienza', 'engine', 'fisica', 'scenario', 'live', 'web'];
const VIETATI = [/dal_futuro/, /neutralizzazione_fondo\.json/, /neutralizzazione\.json/];

// Esenzione DICHIARATA (stretta, per nome): i due curatori dell'archivio.
// L'importatore è chi DEPOSITA il materiale in data/archivio/dal_futuro/ e il
// generatore d'inventario lo CENSISCE: nominarlo è il loro mestiere. Nessuno
// dei due sta in un percorso dati (non leggono il contenuto per calcolarci
// sopra). Aggiungere un terzo nome a questa lista richiede la stessa
// giustificazione scritta qui, non un edit muto.
const CURATORI = new Set(['provenienza/importa_archivio.mjs', 'provenienza/genera_inventario.mjs']);

// (a) nessun sorgente dei percorsi dati nomina il materiale dal futuro
for (const albero of ALBERI) {
  const dir = path.join(radice, albero);
  if (!existsSync(dir)) continue;
  const visita = (d) => {
    for (const nome of readdirSync(d)) {
      const p = path.join(d, nome);
      if (statSync(p).isDirectory()) { visita(p); continue; }
      if (!/\.(mjs|js|py)$/.test(nome)) continue; // i README possono spiegare il divieto
      const rel = path.relative(radice, p).split(path.sep).join('/');
      if (CURATORI.has(rel)) continue;
      const testo = readFileSync(p, 'utf8');
      for (const vietato of VIETATI) {
        b.verifica(`${rel} non tocca il materiale dal futuro (${vietato.source}) — E14`, !vietato.test(testo));
      }
    }
  };
  visita(dir);
}

// (b) la marcatura esiste ed è esplicita
const readme = path.join(radice, 'data', 'archivio', 'dal_futuro', 'README.md');
b.verifica('il materiale dal futuro ha il suo README di marcatura', existsSync(readme));
if (existsSync(readme)) {
  const testo = readFileSync(readme, 'utf8');
  b.verifica('il README dichiara "VIENE DAL FUTURO"', /VIENE DAL FUTURO/.test(testo));
  b.verifica('il README dichiara il divieto sui percorsi live', /mai in percorsi live/i.test(testo));
  b.verifica('il README cita E14', /E14/.test(testo));
}

// (c) l'archivio resta, e resta pinnato
const dir = path.join(radice, 'data', 'archivio', 'dal_futuro');
const attesi = ['neutralizzazione.json', 'neutralizzazione_fondo.json'];
for (const f of attesi) b.verifica(`${f} è ancora in archivio (marcato, non cancellato)`, existsSync(path.join(dir, f)));
const manifest = readFileSync(path.join(radice, 'data', 'MANIFEST.sha256'), 'utf8');
for (const f of attesi) {
  b.verifica(`${f} è pinnato nel manifest`, manifest.includes(`data/archivio/dal_futuro/${f}`));
}

b.chiudi();
