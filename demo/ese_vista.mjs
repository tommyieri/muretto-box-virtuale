// ese_vista.mjs — LA VISTA dell'«E se?», condivisa fra ese.html e gara.html.
//
// Estratta dall'inline di ese.html il 08/08/2026, quando il rigioca e' entrato
// dentro la pagina di ogni gara (richiesta PO): due copie dello stesso render
// sarebbero E12. Qui vive SOLO la vista — editor delle soste, verdetto, torre,
// grafico, assunzioni. La fisica resta in ese.mjs (che chiama il costruttore
// unico); se qui comparisse un numero calcolato, sarebbe la seconda fisica.

import { rigioca, posizioniPerGiro, MESCOLE_EDITOR } from './ese.mjs?v=080826b';
import { t, tn, nnum, mescola, ITA } from './muro.mjs?v=190826b';

export { MESCOLE_EDITOR };

/** Una riga dell'editor: giro + mescola + togli. */
export function rigaSosta({ giro, mescola, min, max }) {
  const div = document.createElement('div');
  div.className = 'ese-sosta';
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = min; inp.max = max; inp.value = giro;
  const sel = document.createElement('select');
  for (const m of MESCOLE_EDITOR) {
    const o = document.createElement('option'); o.value = m; o.textContent = m; if (m === mescola) o.selected = true;
    sel.appendChild(o);
  }
  const del = document.createElement('button'); del.textContent = '×'; del.title = t('ese.togli_sosta');
  del.onclick = () => div.remove();
  div.append(t('ese.giro_sp'), inp, sel, del);
  return div;
}

export function leggiSoste(box) {
  return [...box.querySelectorAll('.ese-sosta')]
    .map((r) => ({ giro: Number(r.querySelector('input').value), mescola: r.querySelector('select').value }))
    .sort((a, b) => a.giro - b.giro);
}

/** L'editor precaricato con la strategia VERA del pilota (oltre il congelamento). */
export function riempiEditor({ box, notaEl, sosteVere, freeze, nLaps }) {
  box.replaceChildren();
  let sostituite = 0;
  for (const s of (sosteVere ?? [])) {
    if (freeze !== null && s.giro <= freeze) continue;   // già nello stato al congelamento
    const slick = MESCOLE_EDITOR.includes(s.mescola);
    if (!slick) sostituite += 1;
    box.appendChild(rigaSosta({ giro: s.giro, mescola: slick ? s.mescola : 'MEDIUM', min: (freeze ?? 1) + 1, max: nLaps - 1 }));
  }
  if (notaEl) {
    notaEl.textContent = sostituite ? t('ese.sostituite', { n: sostituite }) : '';
  }
}

/**
 * I DUE BRACCI: la strategia dell'utente e quella vera, nello stesso motore.
 * `vero` resta null se la strategia vera non e' simulabile (dichiarato in vista).
 */
export function eseguiRigioca({ prep, pilota, freeze, soste }) {
  const base = {
    nome: prep.nome, contesto: prep.contesto, pilota, freezeLap: freeze,
    sosteRivali: prep.sosteVere, nonClassificati: prep.nonClassificati,
    ritiriVeri: prep.ritiriVeri, neutraVera: prep.neutraVera,
  };
  const mio = rigioca({ ...base, soste });
  let vero = null;
  try {
    const sosteVereMie = (prep.sosteVere[pilota] ?? [])
      .filter((s) => s.giro > freeze && MESCOLE_EDITOR.includes(s.mescola));
    vero = rigioca({ ...base, soste: sosteVereMie });
  } catch (_) { /* dichiarato in vista */ }
  return { mio, vero };
}

/**
 * Il render completo dei risultati. `refs` = {risultati, verdetto, director,
 * torre, torreNota, grafico, assunzioniLista} — elementi DOM della pagina ospite.
 */
export function rendiRisultati({ refs, prep, pilota, freeze, mio, vero, teamCol = {} }) {
  refs.risultati.hidden = false;
  const { risultato, direttore, scenario } = mio;

  // Director: un rifiuto è una risposta (regola 6), e si mostra al posto dei numeri.
  if (!direttore.approved) {
    const fatal = (direttore.violazioni ?? []).filter((v) => v.severita === 'FATAL');
    refs.director.innerHTML = `<span class="no">■ ${t('sim.respinge')}</span> `
      + fatal.map((v) => v.messaggio ?? v.codice).join(' · ');
    refs.verdetto.replaceChildren(); refs.torre.replaceChildren();
    refs.grafico.replaceChildren(); refs.assunzioniLista.replaceChildren();
    return;
  }
  const sosp = (direttore.violazioni ?? []).filter((v) => v.severita === 'SOSPETTO').length;
  refs.director.innerHTML = `<span class="ok">■ ${t('sim.approvato')}</span>${sosp ? ` · ${t('sim.sospetti', { n: sosp })}` : ''}`;

  // verdetto a tre caselle
  const posDi = (run) => { const i = run.risultato.ordine.indexOf(pilota); return i < 0 ? null : i + 1; };
  const reale = prep.arrivoReale.find((r) => r.drv === pilota)?.posizione ?? null;
  const pMia = posDi(mio);
  const pVera = vero ? posDi(vero) : null;
  const scarto = (pVera !== null && pMia !== null)
    ? (pMia < pVera ? '▲ ' + tn('ese.pos_su_1', 'ese.pos_su_n', pVera - pMia)
     : pMia > pVera ? '▼ ' + tn('ese.pos_giu_1', 'ese.pos_giu_n', pMia - pVera)
     : t('ese.pos_pari'))
    : '';
  refs.verdetto.innerHTML = `
    <div class="ese-box"><small>${t('sim.gara_reale')}</small><b>${reale === null ? '—' : 'P' + reale}</b>
      <span class="sub">${t('ese.dal_lapchart')}</span></div>
    <div class="ese-box"><small>${t('sim.strategia_vera')}</small><b>${pVera === null ? '—' : 'P' + pVera}</b>
      <span class="sub">${t(vero ? 'sim.metro_giusto' : 'sim.non_simulabile')}</span></div>
    <div class="ese-box tua"><small>${t('ese.la_tua')}</small><b>${pMia === null ? '—' : 'P' + pMia}</b>
      <span class="sub">${scarto}</span></div>`;

  // torre
  const torre = refs.torre; torre.replaceChildren();
  const cum = risultato.cum;
  const capo = risultato.ordine[0];
  const realePos = Object.fromEntries(prep.arrivoReale.map((r) => [r.drv, r.posizione]));
  risultato.ordine.forEach((drv, i) => {
    const tr = document.createElement('tr');
    if (drv === pilota) tr.className = 'me';
    const team = prep.race.byLap[freeze]?.[drv]?.team ?? prep.race.byLap[1]?.[drv]?.team;
    const col = teamCol[team] ?? '#6b7280';
    const dRe = realePos[drv] != null ? realePos[drv] - (i + 1) : null;
    const freccia = dRe === null ? '' : dRe > 0 ? `<span class="su">▲${dRe}</span>` : dRe < 0 ? `<span class="giu">▼${-dRe}</span>` : '<span class="pari">=</span>';
    tr.innerHTML = `<td class="pos">P${i + 1}</td>`
      + `<td><span class="bar" style="background:${col}"></span>${drv}</td>`
      + `<td class="gap">${i === 0 ? '' : '+' + (cum[drv] - cum[capo]).toFixed(1) + ' s'}</td>`
      + `<td>${freccia}</td>`;
    torre.appendChild(tr);
  });
  // i ritirati veri: fuori classifica al loro giro, come nella gara vera
  for (const rit of (risultato.ritirati ?? [])) {
    const tr = document.createElement('tr');
    const team = prep.race.byLap[freeze]?.[rit.drv]?.team ?? prep.race.byLap[1]?.[rit.drv]?.team;
    const col = teamCol[team] ?? '#6b7280';
    tr.innerHTML = `<td class="pos">RIT</td>`
      + `<td style="opacity:.55"><span class="bar" style="background:${col}"></span>${rit.drv}</td>`
      + `<td class="gap" style="opacity:.55">${t('com.giro', { n: rit.lap })}</td>`
      + `<td><span class="pari" title="${t('ese.rit_title')}">${t('ese.rit_vero')}</span></td>`;
    torre.appendChild(tr);
  }
  const fuori = (risultato.esclusi ?? []).map((x) => x.drv).join(', ');
  refs.torreNota.textContent = t('ese.torre_nota')
    + (fuori ? ' ' + t('ese.fuori_sim', { chi: fuori }) : '');

  // grafico posizioni per giro: reale, tua, vera
  disegnaGrafico({ svg: refs.grafico, prep, pilota, freeze, mio, vero });

  // assunzioni del motore, rese SEMPRE (la condizione della deroga s25)
  const ul = refs.assunzioniLista; ul.replaceChildren();
  const liOr = document.createElement('li');
  liOr.innerHTML = t('sim.orizzonte', { giro: scenario.orizzonte?.giroFinale ?? '—' });
  ul.appendChild(liOr);
  // le assunzioni le scrive il kernel, in italiano: si dichiara invece di riscriverle
  // (lo stesso ragionamento, per esteso, sta in whatif.mjs::rendiAssunzioni)
  if (!ITA && (scenario.assunzioni?.length || direttore.riepilogo?.non_verificabili?.length)) {
    const li = document.createElement('li');
    li.innerHTML = `<small>${t('sim.avviso_kernel')}</small>`;
    ul.appendChild(li);
  }
  for (const a of scenario.assunzioni ?? []) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${a.codice}</b> — ${a.descrizione} <small>· ${a.targhetta ?? ''}</small>`;
    ul.appendChild(li);
  }
  for (const n of direttore.riepilogo?.non_verificabili ?? []) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${t('sim.non_verificato')}</b> — <small>${n}</small>`;
    ul.appendChild(li);
  }
}

function disegnaGrafico({ svg, prep, pilota, freeze, mio, vero }) {
  svg.replaceChildren();
  const N = prep.race.n_laps;
  const campo = Math.max(20, prep.arrivoReale.length);
  const X = (lap) => 30 + (lap - 1) / (N - 1) * 670;
  const Y = (pos) => 12 + (pos - 1) / (campo - 1) * 270;
  const linea = (punti, colore, tratteggio = '') => {
    if (punti.length < 2) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    p.setAttribute('points', punti.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', colore); p.setAttribute('stroke-width', '2');
    if (tratteggio) p.setAttribute('stroke-dasharray', tratteggio);
    svg.appendChild(p);
  };
  const ptsReale = [];
  for (let L = 1; L <= N; L += 1) {
    const p = prep.posizioniReali[L]?.[pilota];
    if (p) ptsReale.push([X(L), Y(p)]);
  }
  linea(ptsReale, '#94a3b8');
  const daTraccia = (run, colore, tratteggio) => {
    if (!run) return;
    const pos = posizioniPerGiro(run.risultato.traccia);
    const pts = [];
    for (let L = freeze; L <= N; L += 1) { const p = pos[L]?.[pilota]; if (p) pts.push([X(L), Y(p)]); }
    linea(pts, colore, tratteggio);
  };
  daTraccia(vero, '#60a5fa', '5,4');
  daTraccia(mio, '#4ade80');
  const fl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  fl.setAttribute('x1', X(freeze)); fl.setAttribute('x2', X(freeze));
  fl.setAttribute('y1', 6); fl.setAttribute('y2', 294);
  fl.setAttribute('stroke', 'rgba(255,255,255,.25)'); fl.setAttribute('stroke-dasharray', '3,4');
  svg.appendChild(fl);
}
