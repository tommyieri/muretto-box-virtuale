// strategia.mjs — la risposta del muretto, resa leggibile.
//
// Entra l'oggetto-risposta del motore (lo stesso di data/vista/<gara>/<SIG>.json ed
// esattamente quello che restituisce rispostaLive), esce il pannello.
//
// COSA SI MOSTRA E COSA NO. Si mostrano le quattro cose che servono a decidere:
//   dove rientri · chi ti trovi davanti e dietro · quando conviene fermarsi · come finisce.
// Non si mostrano targhette, perimetri, orizzonti di validazione, coperture, elenchi di
// assunzioni: sono referti interni. Il DATO li conserva tutti — sparisce la resa.

import { el, nnum, mescola, t, tn } from './muro.mjs?v=190826b';

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
    t('strat.aria_curva', { da: g0, a: g1, best: min?.giroPit ?? '—' }));

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
    el('h4', {}, t('strat.come_finisce')),
    el('div', { class: 'st-soste' },
      alt.slice().sort((a, b) => a.k - b.k).map(a => el('div', {
        class: 'st-sosta' + (a === migliore ? ' meglio' : ''),
      },
        el('b', { class: 'n' }, P(a.posizione)),
        el('span', {}, a.k === 0 ? t('gara.nessuna_sosta')
                                 : tn('strat.n_sosta_1', 'strat.n_sosta_n', a.k))))),
    el('p', { class: 'st-nota' }, t('strat.nota_soste')));
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
    el('span', { class: 'st-occ' }, t('strat.se_ti_fermi', { n: s.freeze_lap + 1 })),
    el('div', { class: 'st-riga' },
      el('b', { class: 'st-pos n' }, P(pan.posizione)),
      el('div', { class: 'st-di' },
        el('span', {}, pan.su_quanti ? t('strat.su_n_in_pista', { n: pan.su_quanti }) : ''),
        banda && banda.da != null
          ? el('span', { class: 'st-banda' }, t('strat.banda', { da: P(banda.da), a: P(banda.a) }))
          : null)),
    pan.giro_di_rientro
      ? el('p', { class: 'st-sub' }, t('strat.rientri_al_giro', { n: pan.giro_di_rientro }))
      : null));

  /* ---- il secondo numero del muretto: quanto vai piu' forte, e per quanto ----
     Fino al 13/08/2026 il pannello diceva solo DOVE rientri. «E quanto guadagno al giro?»
     e' la domanda che viene subito dopo, e non aveva risposta da nessuna parte.
     Il guadagno immediato non dipende dalla mescola (a gomma nuova nessuna e' oltre la sua
     vita): cio' che la mescola decide e' per QUANTI GIRI quel guadagno regge. Le due cose
     stanno insieme, altrimenti la prima sembra dire che scegliere non conta. */
  if (Number.isFinite(opz.guadagno) && opz.guadagno > 0) {
    const m = opz.mescolaNuova;
    f.append(el('div', { class: 'st-guadagno' },
      el('div', { class: 'st-g-riga' },
        el('b', { class: 'n' }, `−${nnum(opz.guadagno, 2)} s`),
        el('span', {}, t('strat.al_giro_rientro'))),
      Number.isFinite(opz.vitaGiri)
        ? el('p', { class: 'st-nota', stile: { margin: '8px 0 0' }, html:
            t('strat.tiene_giri', { m: mescola(m), n: Math.round(opz.vitaGiri) }) })
        : null));
  }

  /* ---- chi ti trovi intorno */
  const vicino = (titolo, v) => el('div', { class: 'st-vic' },
    el('span', {}, titolo),
    v?.drv ? el('b', {}, v.drv) : el('b', { class: 'nulla' }, t('strat.nessuno')),
    // il distacco si scrive solo se c'e': un «— s» sotto un nome sembra un guasto
    (v?.drv && Number.isFinite(v.gap_s)) ? el('i', { class: 'n' }, `${nnum(v.gap_s, 1)} s`) : null);
  const d = pan.davanti, r = pan.dietro;
  if (d?.drv || r?.drv) {
    f.append(el('div', { class: 'st-vicini' },
      vicino(t('strat.davanti'), d), vicino(t('strat.dietro'), r)));
  }

  /* ---- quando conviene */
  const c = curva(s, opz.giro, opz.onGiro);
  if (c) {
    const fin = s.finestra, min = s.minimo;
    f.append(el('div', { class: 'st-blocco' },
      el('h4', {}, t('strat.quando_fermarsi')),
      c,
      el('p', { class: 'st-nota' },
        min ? el('span', { html: t('strat.momento_migliore', { n: min.giroPit }) + ' ' }) : null,
        fin && fin.n_giri > 1
          ? el('span', {}, t('strat.finestra', { da: fin.da, a: fin.a }))
          : null)));
  }

  /* ---- come finisce */
  const q = quanteSoste(s);
  if (q) f.append(q);

  /* ---- i due numeri che governano tutto ----
     «Monta X» NON si scrive piu' da `s.mescola_scelta`. Nel motore
     `mescola = mescolaScelta ?? attuale` (risposta.mjs), quindi senza una scelta esplicita
     quel campo E' la gomma gia' montata: il pannello invitava a rimontare la stessa mescola,
     cioe' proprio il piano che il Direttore squalifica per REG01. La gomma che si montera'
     la dice il chiamante, che e' l'unico a saperlo (`opz.mescolaNuova`). */
  const perdita = s.perdita?.valore;
  const neutra = s.regime === 'SC' || s.regime === 'VSC';
  f.append(el('div', { class: 'st-piedi' },
    perdita != null
      ? el('span', {}, t('strat.perdita_box') + ' ', el('b', { class: 'n' }, `${nnum(perdita, 1)} s`))
      : null,
    opz.mescolaNuova ? el('span', {}, t('strat.monti') + ' ', el('b', {}, mescola(opz.mescolaNuova))) : null,
    neutra ? el('span', { class: 'st-neutra' },
      t(s.regime === 'SC' ? 'strat.sotto_sc' : 'strat.sotto_vsc')) : null));

  return f;
}

/** Le tre gomme come comando.
 *  `attuale` = quella che ha su adesso · `scelta` = quella che monterai.
 *
 *  LE DUE COSE ERANO DISEGNATE UGUALI, ed era la trappola peggiore della pagina:
 *  `class: 'st-m' + ((scelta || attuale) === m ? ' on' : '')`. All'apertura la gomma
 *  montata appariva premuta pur non essendo stata scelta da nessuno, e siccome
 *  `onScegli(scelta === m ? null : m)` confronta con `scelta` (che era null), cliccare
 *  quella che sembrava gia' premuta la SELEZIONAVA davvero — cioe' chiedeva di rimontare la
 *  stessa mescola, e il Direttore rispondeva con «pena la squalifica» a un gesto che
 *  sembrava non fare niente. Adesso sono due stati distinti: «ce l'hai su» e' un'etichetta,
 *  «premuto» e' una scelta. */
export function selettoreMescole({ scelta, attuale, onScegli }) {
  return el('div', { class: 'st-mescbox' },
    el('span', { class: 'st-occ' }, t('index.hero_gomma')),
    el('div', { class: 'st-mesc', role: 'group', 'aria-label': t('strat.aria_mescole') },
    ORD.map(m => el('button', {
      class: 'st-m' + (scelta === m ? ' on' : '') + (attuale === m ? ' su' : ''),
      type: 'button',
      'aria-pressed': String(scelta === m),
      title: attuale === m ? t('strat.gia_su_title') : null,
      onclick: () => onScegli(scelta === m ? null : m),
    },
      el('span', { class: 'gomma ' + m }),
      mescola(m),
      attuale === m ? el('i', { class: 'st-su' }, t('strat.ce_lhai_su')) : null))));
}
