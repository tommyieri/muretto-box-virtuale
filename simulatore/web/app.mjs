// app.mjs — il collante. Carica la vista, disegna i tre componenti, cambia
// scenario. Nessun calcolo: se qui comparisse un'operazione su un tempo sul
// giro, sarebbe una seconda implementazione della fisica dentro la pagina
// (regola 8) — e la sentinella s20 la troverebbe.

import { disegna } from './render.mjs';
import { pannello } from './pannello.mjs';
import { curva } from './curva.mjs';
import { mappa } from './mappa.mjs';

const vista = await (await fetch('./vista/demo.json')).json();
const scelta = document.querySelector('#scenario');
const contenitore = document.querySelector('#contenuto');

for (const [i, s] of vista.scenari.entries()) {
  const o = document.createElement('option');
  o.value = String(i);
  o.textContent = `${s.gara} · ${s.pilota} · giro ${s.freeze_lap}${s.regime ? ` · ${s.regime}` : ''}`;
  scelta.append(o);
}

function mostra(i) {
  const s = vista.scenari[i];
  contenitore.replaceChildren();
  for (const componente of [pannello, curva, mappa]) {
    contenitore.append(disegna(componente(vista, s)));
  }
}

scelta.addEventListener('change', () => mostra(Number(scelta.value)));
mostra(0);
