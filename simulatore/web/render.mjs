// render.mjs — albero → DOM. L'unico file che tocca il documento.
//
// I componenti restituiscono alberi dichiarativi; questo li disegna. La
// separazione non è estetica: è ciò che permette all'audit del cancello P08 di
// camminare il VERO output di ogni componente in Node, senza un browser e senza
// una finta DOM. Se i componenti scrivessero direttamente nel documento,
// l'audit potrebbe solo grepparne i sorgenti.
//
// La targhetta si apre al tap: ogni quantità è un <button> che mostra natura,
// spiegazione, data, n e banda. Non c'è modo di disegnare un numero senza il
// suo bottone, perché il nodo `numero` passa da qui.

import { formatta } from './targhette.mjs';

const SVG = new Set(['svg', 'g', 'path', 'circle', 'line', 'rect', 'text']);
const ATTRIBUTI = {
  classe: 'class', etichetta: 'aria-label', ruolo: 'role', titolo: 'title',
  disabilitato: 'disabled', valore: 'data-valore', larghezza: 'width',
  altezza: 'height', raggio: 'rx', ancora: 'text-anchor',
};

function testoTarghetta(t) {
  const pezzi = [`${t.etichetta} — ${t.testo}`, `data: ${t.data}`];
  if (t.n !== null) pezzi.push(`n = ${t.n}`);
  if (t.banda !== null) pezzi.push(`banda: ${t.banda[0]} … ${t.banda[1]}`);
  return pezzi.join('\n');
}

export function disegna(nodo, dentroSvg = false) {
  if (nodo === null || nodo === undefined) return null;
  if (Array.isArray(nodo)) {
    const frammento = document.createDocumentFragment();
    for (const f of nodo) { const d = disegna(f, dentroSvg); if (d) frammento.append(d); }
    return frammento;
  }

  if (Object.hasOwn(nodo, 'numero')) {
    const bottone = document.createElement('button');
    bottone.className = `quantita natura-${nodo.targhetta.natura.toLowerCase()}${nodo.numero === null ? ' soppressa' : ''}`;
    bottone.type = 'button';
    bottone.textContent = formatta(nodo);
    bottone.title = nodo.numero === null
      ? `${nodo.motivo_soppressione}\n\n${testoTarghetta(nodo.targhetta)}`
      : testoTarghetta(nodo.targhetta);
    bottone.setAttribute('aria-label', bottone.title);
    bottone.addEventListener('click', () => bottone.classList.toggle('aperta'));
    const spiega = document.createElement('span');
    spiega.className = 'targhetta';
    spiega.textContent = bottone.title;
    bottone.append(spiega);
    return bottone;
  }

  if (Object.hasOwn(nodo, 'testo')) return document.createTextNode(nodo.testo);

  const svg = dentroSvg || SVG.has(nodo.tag);
  const e = svg
    ? document.createElementNS('http://www.w3.org/2000/svg', nodo.tag)
    : document.createElement(nodo.tag);
  for (const [chiave, valore] of Object.entries(nodo.attributi ?? {})) {
    if (valore === null || valore === undefined || valore === false) continue;
    if (chiave === 'trasla') { e.setAttribute('transform', `translate(${valore})`); continue; }
    if (chiave === 'viewBox') { e.setAttribute('viewBox', valore); continue; }
    const nome = ATTRIBUTI[chiave] ?? chiave;
    if (nome === 'disabled') { e.disabled = true; continue; }
    e.setAttribute(nome, String(valore));
  }
  for (const f of nodo.figli ?? []) { const d = disegna(f, svg); if (d) e.append(d); }
  return e;
}
