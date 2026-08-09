// strategia.mjs — la risposta del muretto, resa leggibile.
//
// Entra l'oggetto-risposta del motore (lo stesso di data/vista/<gara>/<SIG>.json ed
// esattamente quello che restituisce rispostaLive), esce il pannello.
//
// COSA SI MOSTRA E COSA NO. Si mostrano le quattro cose che servono a decidere:
//   dove rientri · chi ti trovi davanti e dietro · quando conviene fermarsi · come finisce.
// Non si mostrano targhette, perimetri, orizzonti di validazione, coperture, elenchi di
// assunzioni: sono referti interni. Il DATO li conserva tutti — sparisce la resa.

import { el, nnum, MESCOLA_IT } from './muro.mjs?v=090826b';

const ORD = ['SOFT', 'MEDIUM', 'HARD'];

/** P3, P12… con il nulla gestito. */
const P = (n) => (n == null ? '—' : 'P' + n);

/* -------------------------------------------------------------- la curva
   Per ogni giro candidato: quanto costa fermarsi li' invece che nel momento
   migliore. Il minimo e' a zero per costruzione; la fascia chiara e' la
   finestra, cioe' i giri che il motore non distingue dall'ottimo. */
function curva(s, giroCorrente, onGiro) {
  const c = (s.curva || []).filter(p => p && Number.isFinite(p.delta_s));
  if (c.length < 2) return null;
  const W = 320, H = 92, ml = 4, mr = 4, mt = 8, mb = 18;
  const g0 = c[0].giroPit, g1 = c[c.length - 1].giroPit;
  const dmax = Math.max(0.6, ...c.map(p => p.delta_s));
  const X = g => ml + (g - g0) / Math.max(1, g1 - g0) * (W - ml - mr);
  // costo ZERO in basso, costo massimo in alto: la curva SALE dove fermarsi costa di piu'.
  const Y = d => (H - mb) - (d / dmax) * (H - mt - mb);

  const linea = c.map(p => `${X(p.giroPit).toFixed(1)},${Y(p.delta_s).toFixed(1)}`).join(' ');
  const area = `M${X(g0).toFixed(1)},${(H - mb).toFixed(1)} L${linea.replace(/ /g, ' L')} L${X(g1).toFixed(1)},${(H - mb).toFixed(1)} Z`;

  const fin = s.finestra;
  const min = s.minimo;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'curva');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `Costo della sosta per giro, dal giro ${g0} al ${g1}. Migliore: giro ${min?.giroPit ?? '—'}.`);

  let dentro = '';
  if (fin && fin.da != null && fin.a != null) {
    const x0 = X(Math.max(g0, fin.da)), x1 = X(Math.min(g1, fin.a));
    dentro = `<rect x="${x0.toFixed(1)}" y="${mt}" width="${Math.max(1, x1 - x0).toFixed(1)}"
      height="${H - mt - mb}" fill="rgba(47,213,118,.13)" rx="3"/>`;
  }
  const xmin = min ? X(min.giroPit) : null;
  svg.innerHTML = `
    ${dentro}
    <line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
    <path d="${area}" fill="rgba(255,30,60,.10)"/>
    <polyline points="${linea}" fill="none" stroke="#FF1E3C" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${xmin != null ? `<circle cx="${xmin.toFixed(1)}" cy="${Y(0).toFixed(1)}" r="4" fill="#2FD576"
        stroke="#08090C" stroke-width="2"/>` : ''}
    ${giroCorrente >= g0 && giroCorrente <= g1
      ? `<line x1="${X(giroCorrente).toFixed(1)}" y1="${mt - 4}" x2="${X(giroCorrente).toFixed(1)}"
           y2="${H - mb}" stroke="#24E3D2" stroke-width="1.5" stroke-dasharray="3 3"/>` : ''}
    <text x="${ml}" y="${H - 5}" fill="#737D8C" font-family="JetBrains Mono, monospace"
      font-size="9">${g0}</text>
    <text x="${W - mr}" y="${H - 5}" fill="#737D8C" text-anchor="end"
      font-family="JetBrains Mono, monospace" font-size="9">${g1}</text>`;

  // toccare la curva sceglie il giro: il grafico e' un comando, non un'illustrazione
  if (onGiro) {
    svg.style.cursor = 'pointer';
    const scegli = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX ?? ev.touches?.[0]?.clientX) - r.left) / r.width * W;
      const g = Math.round(g0 + (x - ml) / (W - ml - mr) * (g1 - g0));
      onGiro(Math.max(g0, Math.min(g1, g)));
    };
    svg.addEventListener('click', scegli);
  }
  return svg;
}

/* -------------------------------------------------------- quante soste */
function quanteSoste(s) {
  const alt = s.piano?.alternative;
  if (!Array.isArray(alt) || alt.length < 2) return null;
  const migliore = alt.reduce((a, b) => (b.posizione < a.posizione ? b : a), alt[0]);
  return el('div', { class: 'st-blocco' },
    el('h4', {}, 'Come finisce'),
    el('div', { class: 'st-soste' },
      alt.slice().sort((a, b) => a.k - b.k).map(a => el('div', {
        class: 'st-sosta' + (a === migliore ? ' meglio' : ''),
      },
        el('b', { class: 'n' }, P(a.posizione)),
        el('span', {}, a.k === 0 ? 'nessuna sosta' : a.k === 1 ? '1 sosta' : `${a.k} soste`)))),
    el('p', { class: 'st-nota' }, 'La posizione al traguardo, se da qui in avanti fai quel numero di soste.'));
}

/* --------------------------------------------------------- il pannello */
/**
 * @param s        oggetto-risposta del motore
 * @param opz      {pilota, giro, nGiri, mescola, onGiro(g), onBox(), mescolaScelta, onMescola(m)}
 */
export function pannello(s, opz = {}) {
  const f = document.createDocumentFragment();
  if (!s) return f;

  if (s.senza_risposta) {
    f.append(el('div', { class: 'st-muto' }, s.senza_risposta));
    return f;
  }

  const pan = s.pannello || {};
  const banda = pan.banda_posizione;

  /* ---- il verdetto: la cosa per cui si e' aperta la pagina */
  f.append(el('div', { class: 'st-verdetto' },
    el('span', { class: 'st-occ' }, `Se ti fermi al giro ${s.freeze_lap + 1}`),
    el('div', { class: 'st-riga' },
      el('b', { class: 'st-pos n' }, P(pan.posizione)),
      el('div', { class: 'st-di' },
        el('span', {}, pan.su_quanti ? `su ${pan.su_quanti} in pista` : ''),
        banda && banda.da != null
          ? el('span', { class: 'st-banda' }, `verosimile tra ${P(banda.da)} e ${P(banda.a)}`)
          : null)),
    pan.giro_di_rientro
      ? el('p', { class: 'st-sub' }, `Rientri in pista al giro ${pan.giro_di_rientro}.`)
      : null));

  /* ---- chi ti trovi intorno */
  const vicino = (titolo, v) => el('div', { class: 'st-vic' },
    el('span', {}, titolo),
    v?.drv ? el('b', {}, v.drv) : el('b', { class: 'nulla' }, 'nessuno'),
    // il distacco si scrive solo se c'e': un «— s» sotto un nome sembra un guasto
    (v?.drv && Number.isFinite(v.gap_s)) ? el('i', { class: 'n' }, `${nnum(v.gap_s, 1)} s`) : null);
  const d = pan.davanti, r = pan.dietro;
  if (d?.drv || r?.drv) {
    f.append(el('div', { class: 'st-vicini' }, vicino('davanti', d), vicino('dietro', r)));
  }

  /* ---- quando conviene */
  const c = curva(s, opz.giro, opz.onGiro);
  if (c) {
    const fin = s.finestra, min = s.minimo;
    f.append(el('div', { class: 'st-blocco' },
      el('h4', {}, 'Quando fermarsi'),
      c,
      el('p', { class: 'st-nota' },
        min ? el('span', {}, 'Il momento migliore è il ', el('b', {}, `giro ${min.giroPit}`), '. ') : null,
        fin && fin.n_giri > 1
          ? el('span', {}, `Fra il giro ${fin.da} e il ${fin.a} cambia poco: è la finestra.`)
          : null)));
  }

  /* ---- come finisce */
  const q = quanteSoste(s);
  if (q) f.append(q);

  /* ---- i due numeri che governano tutto */
  const perdita = s.perdita?.valore;
  const neutra = s.regime === 'SC' || s.regime === 'VSC';
  f.append(el('div', { class: 'st-piedi' },
    perdita != null ? el('span', {}, 'Perdita ai box ', el('b', { class: 'n' }, `${nnum(perdita, 1)} s`)) : null,
    s.mescola_scelta ? el('span', {}, 'Monta ', el('b', {}, MESCOLA_IT[s.mescola_scelta] || s.mescola_scelta.toLowerCase())) : null,
    neutra ? el('span', { class: 'st-neutra' },
      s.regime === 'SC' ? 'Con la safety car fermarsi costa molto meno.'
                        : 'Con la virtual safety car fermarsi costa un po\' meno.') : null));

  return f;
}

/** Le tre gomme come comando. `attuale` e' quella che ha su adesso. */
export function selettoreMescole({ scelta, attuale, onScegli }) {
  return el('div', { class: 'st-mescbox' },
    el('span', { class: 'st-occ' }, 'Che gomma monti'),
    el('div', { class: 'st-mesc', role: 'group', 'aria-label': 'Che gomma montare' },
    ORD.map(m => el('button', {
      class: 'st-m' + ((scelta || attuale) === m ? ' on' : ''),
      type: 'button',
      'aria-pressed': String((scelta || attuale) === m),
      onclick: () => onScegli(scelta === m ? null : m),
    },
      el('span', { class: 'gomma ' + m }),
      m === 'SOFT' ? 'morbida' : m === 'MEDIUM' ? 'media' : 'dura'))));
}
