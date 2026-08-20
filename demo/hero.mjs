// ============================================================================
// hero.mjs — LA HERO DELLA LANDING COME DEMO INTERATTIVA
//
// Progetto: NOTA_HERO.md. Dati: demo/data/hero.json, scritto da gen_hero.mjs
// chiamando lo STESSO motore della pagina-gara — dal 01/08/2026 il simulatore nuovo,
// simulatore/scenario/costruttore.mjs::doveRientri.
// Nessun numero di questo file e' scritto a mano.
//
// ARCHITETTURA — undici moduli indipendenti, un solo direttore.
// Ogni modulo e' una funzione pura `(ctx) -> { tl, finale }`:
//     tl()      restituisce una GSAP timeline nuova, gia' pronta da incastrare
//     finale()  mette il modulo nel suo stato finale SENZA animare
// I moduli non si conoscono e non si chiamano fra loro: li compone solo il
// Direttore (M11), che e' l'unico a possedere il tempo e la macchina a stati.
// Per questo TOWER o PITSTOP si porterebbero via di peso su un'altra pagina.
//
// PRESTAZIONI — si anima solo transform, opacity e stroke-dashoffset. Mai
// width/height/top/left, mai filtri, mai box-shadow in tween: tutto resta sul
// compositor, quindi fuori dal CLS e dentro i 60 fps.
//
// ONESTA' — la mescola NON muove nessun numero, ed e' misurato due volte: sul
// motore vecchio 0 casi su 24, sul motore nuovo 0 posizioni cambiate su 4.943
// scenari con mescola diversa (nel 2026 le mescole non separano il degrado,
// p = 0,209). Cio' che muove la risposta e' il MOMENTO della sosta, ed e' quello
// che la hero fa scegliere — l'unica leva vera, e infatti l'unica interattiva.
//
// DAL 01/08/2026 I NUMERI VENGONO DALLO STESSO MOTORE DELLA PAGINA-GARA. Prima no,
// e le due si contraddicevano: la hero diceva "P4 su 10" dove la pagina diceva
// "P6 su 20" — la hero non vedeva meta' schieramento perche' filtrava su un passo
// che a meta' gara mancava a dieci piloti.
// ============================================================================

// la targhetta di cache vive in un posto solo (muro.mjs::V) e serve alla fetch
// congelata di hero.json qui sotto
import { V, t, tn, nnum } from './muro.mjs?v=190826f';

const FONTE = 'data/hero.json';
const VENDOR = 'vendor/';         // relativo al documento: i file sono UMD, non moduli

// --------------------------------------------------------------- utilita'
const q = (r, s) => r.querySelector(s);
// IL SEPARATORE DECIMALE VIENE DALLA LINGUA, non da qui: «18,40» letto da un inglese
// e' milleottocentoquaranta. `nnum` di muro.mjs lo sa gia', e questa e' la stessa
// funzione con lo stesso ripiego a trattino.
const num = (v, d = 2) => v == null ? '—' : nnum(v, d);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// GSAP arriva SOLO quando serve davvero: hero visibile e movimento consentito.
// Chi ha prefers-reduced-motion o non scorre fin qui non paga 30 KB gzip.
//
// Via <script> e non via import(): i file vendorizzati sono le build UMD, e la loro
// intestazione fa `(this || self).window = ...`. In contesto modulo `this` e'
// undefined, si finisce su `window.window` che e' di sola lettura, e l'import muore.
// Con un tag classico il wrapper trova il globale che si aspetta.
function carica(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => ok();
    s.onerror = () => no(new Error(`non caricato: ${src}`));
    document.head.appendChild(s);
  });
}

let _gsap = null;
async function caricaGsap() {
  if (_gsap) return _gsap;
  await carica(`${VENDOR}gsap.min.js`);                 // prima il core: i plugin lo cercano
  await Promise.all([
    carica(`${VENDOR}MotionPathPlugin.min.js`),
    carica(`${VENDOR}DrawSVGPlugin.min.js`),
  ]);
  const g = window.gsap;
  if (!g) throw new Error('gsap non disponibile');
  g.registerPlugin(window.MotionPathPlugin, window.DrawSVGPlugin);
  g.defaults({ ease: 'power2.out' });
  _gsap = g;
  return g;
}

// ============================================================================
// COSTRUZIONE DEL DOM — dai dati, una volta sola, prima di qualunque animazione.
// Le misure dei contenitori sono gia' fissate dal CSS (aspect-ratio, min-height,
// altezze di riga): riempirli dopo non sposta niente. CLS 0 per costruzione.
// ============================================================================
function costruisci(root, H) {
  const P = H.pilota;
  root.style.setProperty('--h-car', P.colore);

  // ---- M2 la pista: il nastro e' il giro GPS reale, lo stesso di gara.html
  const [, , VW, VH] = H.pista.viewBox;
  q(root, '.hero-pista').innerHTML = `
    <svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path class="hero-alone"  d="${H.pista.d}"/>
      <path class="hero-nastro" id="hero-nastro" d="${H.pista.d}"/>
      <path class="hero-mezzo"  d="${H.pista.d}"/>
      ${H.pista.pit_d ? `<path class="hero-corsia" id="hero-corsia" d="${H.pista.pit_d}"/>` : ''}
      <line class="hero-sf" x1="${H.pista.sf.x}" y1="${H.pista.sf.y}"
            x2="${H.pista.sf.x}" y2="${H.pista.sf.y}"
            transform="rotate(${H.pista.sf.ang + 90} ${H.pista.sf.x} ${H.pista.sf.y}) translate(0,-9)"
            stroke-dasharray="0 0" style="--l:18"/>
      <path class="hero-scia" id="hero-scia" d="${H.pista.d}" fill="none"
            stroke="${P.colore}" stroke-width="7" stroke-linecap="round" opacity="0"/>
      <circle class="hero-auto" id="hero-auto" r="8" cx="0" cy="0" opacity="0"/>
    </svg>`;
  // la tacca del traguardo: una linea di 18 unita' centrata sul punto 0
  const sf = q(root, '.hero-sf');
  sf.setAttribute('y1', H.pista.sf.y - 9);
  sf.setAttribute('y2', H.pista.sf.y + 9);

  // ---- M4 l'HUD
  q(root, '.hero-hud').innerHTML = `
    <span>${t('hero.giro')} <b data-giro>0</b>/${H.n_laps}</span>
    <span class="hero-hud-sig"><i></i>${esc(P.sig)} &middot; P${P.pos}</span>
    <span class="hero-hud-gomma"><i></i>${esc(P.compound)}<span> &middot; ${P.tyre_age} ${t('hero.giri_sigla')}</span></span>`;

  // ---- M5 la torre
  q(root, '.hero-tower').innerHTML =
    `<li class="hero-tower-h" role="presentation">${t('com.classifica')} &middot; ${t('com.giro', { n: H.giro })}</li>` +
    H.torre_partenza.map(r => rigaHTML(r)).join('');

  // ---- M6 la domanda
  q(root, '.hero-prompt').innerHTML = `
    <span class="hero-prompt-t">BOX?</span>
    <span class="hero-luci"><i></i><i></i><i></i></span>`;

  // ---- M9 il pannello sosta
  q(root, '.hero-pit').innerHTML = `
    <span class="hero-pit-t" data-pit>0,00</span>
    <span class="hero-pit-l">${t('hero.sosta_corso')}</span>
    <span class="hero-pit-g"><i></i><i></i><i></i><i></i></span>`;

  // ---- M7 le due scelte: etichette e risposte vengono dal motore
  q(root, '.hero-choices').innerHTML = H.scelte.map((s, i) => {
    const bandiera = s.giro_neutralizzato ? t('hero.neutralizzato') : t('hero.bandiera_verde');
    const et = etichetta(s, H);
    return `
    <button type="button" class="hero-choice" data-scelta="${s.id}"
            aria-pressed="false" ${i === 0 ? 'data-attesa="1"' : ''}
            aria-label="${esc(et)}: ${t('hero.aria_scelta', { giro: s.giro, bandiera, pos: s.pos })}">
      <span class="hero-choice-k">${i === 0 ? ICO_BOX : ICO_ATTESA}${esc(et)}</span>
      <span class="hero-choice-q">${t('com.giro', { n: s.giro })} &middot; ${bandiera}</span>
      <span class="hero-choice-r">${t('hero.rientri')} <b>P${s.pos}</b></span>
    </button>`; }).join('');
  q(root, '.hero-choices').setAttribute('aria-busy', 'false');

  // ---- M8 le gomme
  const M = H.mescole;
  // LE GOMME SI MOSTRANO, NON SI SCELGONO — come nel pannello, e per la stessa
  // ragione misurata: cambiando mescola la risposta non si muove (0 casi su 24 sul
  // motore vecchio, 0 posizioni su 4.943 su quello nuovo). Erano bottoni con
  // `aria-pressed`, cioe' si annunciavano come un comando anche a chi usa uno
  // screen reader, e l'unica cosa che facevano era illuminarsi a vicenda.
  q(root, '.hero-mesc-r').innerHTML = ['SOFT', 'MEDIUM', 'HARD'].map(m => `
    <span class="hero-mesc-b${m === M.monta ? ' hero-mesc-on' : ''}" data-m="${m}"
          title="${m === M.monta ? t('hero.gomma_su') + ' ' : ''}${t('hero.durata_max', { n: M.durata_max_oggi[m] ?? '—' })}">
      <i></i>${m}
    </span>`).join('');

  // ---- la riga sotto la torre: i due numeri che il motore usa, senza la loro origine.
  // La provenienza (targhetta, costo realizzato in gara, sorgente del giro GPS) resta nel
  // dato — hero.json la porta ancora — ma dal 04/08/2026 non si stampa in home.
  // FACOLTATIVA: una pagina che non la vuole non deve far morire la hero. Prima
  // l'assenza di questo elemento buttava un'eccezione QUI, cioe' prima che il
  // direttore fosse agganciato: la scena si costruiva e poi restava immobile per
  // sempre, senza che niente in pagina lo dicesse.
  const fonte = q(root, '.hero-fonte');
  if (fonte) {
    fonte.innerHTML =
      t('hero.fonte_pitloss', { s: num(H.pitloss.s) })
      + (H.degrado ? ' ' + t('hero.fonte_degrado', { rho: num(H.degrado.rho_s_giro, 3) }) : '');
  }
}

const ICO_BOX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>`;
const ICO_ATTESA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>`;
const ICO_RIVEDI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`;

/** L'ETICHETTA DELLA SCELTA NON SI LEGGE PIU' DAL DATO, e non e' un capriccio.
 *  hero.json la porta scritta in italiano («BOX ORA», «ASPETTA 8 GIRI») perche' la
 *  scrive gen_hero.mjs, che gira una volta a gara e non sa in che lingua verra' letta.
 *  Quello che il dato porta davvero e' l'`id` ('ora'/'dopo') e il giro: da li' l'etichetta
 *  si ricostruisce in tutt'e due le lingue. Un testo dentro un artefatto e' un testo che
 *  ha gia' scelto una lingua per sempre. */
function etichetta(s, H) {
  if (s.id === 'ora') return t('hero.et_ora');
  const ora = H.scelte.find(x => x.id === 'ora');
  const n = ora ? s.giro - ora.giro : 0;
  return tn('hero.et_dopo_1', 'hero.et_dopo_n', n);
}

/** «Mantieni la posizione» / «Guadagni 2 posizioni»: una copia sola, non due.
 *  Le due copie c'erano davvero, in OUTCOME e nel ramo senza animazione, ed erano gia'
 *  divergenti prima di questo lavoro (una mostrava lo scarto fra le due strade, l'altra
 *  no). Tradurne una e non l'altra sarebbe stato il modo piu' facile di lasciare una
 *  frase italiana in mezzo al sito inglese, senza che nessuno la vedesse mai. */
function titoloVerdetto(d, pos) {
  if (d === 0) return pos === 1 ? t('hero.resti_comando') : t('hero.mantieni');
  return d < 0 ? tn('hero.guadagni_1', 'hero.guadagni_n', -d)
               : tn('hero.perdi_1', 'hero.perdi_n', d);
}

function doveVerdetto(s) {
  if (s.sotto_sc) return t('hero.gap_non_quant', { n: s.soste_rivali_assunte });
  return s.davanti
    ? t('hero.dietro_di', { chi: esc(s.davanti), s: num(s.gap_davanti) })
    : t('hero.in_testa');
}

function rigaHTML(r) {
  return `<li class="hero-row" data-sig="${esc(r.sig)}" ${r.io ? 'data-io="1"' : ''}
              style="border-left-color:${esc(r.colore)}">
    <span class="hero-row-p">${r.pos}</span>
    <span class="hero-row-s">${esc(r.sig)}</span>
    <span class="hero-row-g">${r.gap == null ? '&mdash;' : '+' + num(r.gap)}</span>
  </li>`;
}

// ============================================================================
// I MODULI
// ============================================================================

// ---------------------------------------------------------- M2 · TRACK -----
// Scopo: rendere la scena riconoscibile in meno di mezzo secondo.
// Stato iniziale: path completo, drawSVG 0%. Trigger: hero visibile. Durata 1,2 s.
function TRACK(gsap, root) {
  const alone = q(root, '.hero-alone'), nastro = q(root, '.hero-nastro'),
        mezzo = q(root, '.hero-mezzo'), corsia = q(root, '.hero-corsia'),
        sf = q(root, '.hero-sf');
  const tutti = [alone, nastro, mezzo, corsia].filter(Boolean);

  const finale = () => {
    gsap.set(tutti, { drawSVG: '100%' });
    gsap.set(sf, { opacity: 1, scale: 1 });
  };
  const tl = () => {
    const seq = gsap.timeline();
    gsap.set(tutti, { drawSVG: '0%' });
    gsap.set(sf, { opacity: 0, scale: 0, transformOrigin: 'center' });
    seq.to(alone,  { drawSVG: '100%', duration: .9, ease: 'power2.inOut' }, 0)
     .to(nastro, { drawSVG: '100%', duration: .9, ease: 'power2.inOut' }, .08)
     .to(mezzo,  { drawSVG: '100%', duration: .9, ease: 'power2.inOut' }, .16);
    if (corsia) seq.to(corsia, { drawSVG: '100%', duration: .5, ease: 'power2.out' }, .55);
    seq.to(sf, { opacity: 1, scale: 1, duration: .3, ease: 'back.out(2)' }, .7);
    return seq;
  };
  return { tl, finale };
}

// ------------------------------------------------------------ M3 · CAR -----
// Scopo: dare un soggetto alla scena. Senza un'auto che gira, la pista e' un logo.
// autoRotate = false di proposito: e' un marker di timing, non un'automobilina —
// ruotarlo suggerirebbe un modello fisico che il prodotto non ha.
// La scia e' lo STESSO path del nastro con un tratteggio corto: essendo il giro a
// velocita' costante (ease none), dashoffset e pallino restano in fase per costruzione.
function CAR(gsap, root, H) {
  const auto = q(root, '#hero-auto'), scia = q(root, '#hero-scia'),
        nastro = q(root, '#hero-nastro'), corsia = q(root, '#hero-corsia');
  const LEN = nastro.getTotalLength();
  const CODA = LEN * .035;
  const GIRO = 5.2;                                   // secondi per giro, ritmo di lettura
  scia.setAttribute('stroke-dasharray', `${CODA} ${LEN}`);

  let giroTw = null, frazione = 0;

  const posa = (f) => {
    gsap.set(auto, { motionPath: { path: nastro, align: nastro, alignOrigin: [.5, .5], start: f, end: f } });
    scia.setAttribute('stroke-dashoffset', String(-f * LEN));
  };

  function gira(da = 0) {
    giroTw?.kill();
    const prox = { f: da };
    giroTw = gsap.to(prox, {
      f: da + 1, duration: GIRO, ease: 'none', repeat: -1,
      onUpdate() { frazione = prox.f % 1; posa(frazione); scia.setAttribute('stroke-dashoffset', String(-frazione * LEN)); },
    });
    return giroTw;
  }

  const finale = () => { gsap.set([auto, scia], { opacity: 1 }); posa(H.pista.frazione_uscita + .12); };

  const tl = () => {
    const seq = gsap.timeline();
    posa(0);
    seq.to(auto, { opacity: 1, duration: .25 }, 0)
     .to(scia, { opacity: .55, duration: .35 }, .05)
     .add(() => gira(0), 0);
    return seq;
  };

  // ferma il giro e porta il pallino all'ingresso corsia box (via piu' breve in avanti)
  function versoBox() {
    giroTw?.pause();
    const da = frazione, resto = (H.pista.frazione_ingresso - da + 1) % 1;
    const prox = { f: da };
    return gsap.to(prox, {
      f: da + resto, duration: Math.min(1.05, .3 + resto * 1.3), ease: 'power1.in',
      onUpdate() { frazione = prox.f % 1; posa(frazione); },
    });
  }
  const scivola = (a, b, dur, ease) => corsia
    ? gsap.to(auto, { motionPath: { path: corsia, align: corsia, alignOrigin: [.5, .5], start: a, end: b }, duration: dur, ease })
    : gsap.to({}, { duration: dur });

  return { tl, finale, gira, versoBox, scivola,
           nascondiScia: () => gsap.to(scia, { opacity: 0, duration: .25 }),
           mostraScia: () => gsap.to(scia, { opacity: .55, duration: .35 }),
           riparti: () => gira(H.pista.frazione_uscita) };
}

// ------------------------------------------------------------ M4 · HUD -----
// Scopo: ancorare la scena a dei fatti. Il contatore giro e' in mono tabulare:
// cambiando cifra non muove nulla intorno a se'.
function HUD(gsap, root, H) {
  const box = q(root, '.hero-hud'), g = q(root, '[data-giro]');
  const finale = () => { gsap.set(box, { opacity: 1, y: 0 }); g.textContent = H.giro; };
  const tl = () => {
    const seq = gsap.timeline();
    const n = { v: 0 };
    seq.fromTo(box, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .3 }, 0)
     .to(n, { v: H.giro, duration: .8, ease: 'power2.out', snap: { v: 1 },
              onUpdate: () => { g.textContent = Math.round(n.v); } }, .05);
    return seq;
  };
  return { tl, finale };
}

// ---------------------------------------------------------- M5 · TOWER -----
// Scopo: e' il modulo che porta il significato. La classifica E' lo stato che cambia.
// Il riordino e' un FLIP fatto a mano: misuro le posizioni prima, riscrivo il DOM,
// animo il solo delta in `y`. Una transform per riga, zero layout dentro il tween.
function TOWER(gsap, root, H) {
  const lista = q(root, '.hero-tower');
  const righe = () => [...lista.querySelectorAll('.hero-row')];

  const finale = () => gsap.set(righe(), { opacity: 1, y: 0 });
  const tl = () => gsap.timeline().fromTo(righe(),
    { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, stagger: .055 });

  function riordina(nuove) {
    const prima = new Map();
    righe().forEach(li => prima.set(li.dataset.sig, li.offsetTop));
    lista.querySelectorAll('.hero-row').forEach(li => li.remove());
    lista.insertAdjacentHTML('beforeend', nuove.map(rigaHTML).join(''));

    const seq = gsap.timeline();
    righe().forEach(li => {
      const y0 = prima.get(li.dataset.sig);
      if (y0 == null) { seq.fromTo(li, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: .45 }, .1); return; }
      const dy = y0 - li.offsetTop;
      if (dy) seq.fromTo(li, { y: dy }, { y: 0, duration: .7, ease: 'power3.inOut' }, 0);
      if (li.dataset.io) seq.fromTo(li, { scale: 1 }, { scale: 1.04, duration: .22, yoyo: true, repeat: 1, ease: 'power2.out' }, .55);
    });
    return seq;
  }
  function scrivi(nuove) {                    // senza animazione (reduced motion)
    lista.querySelectorAll('.hero-row').forEach(li => li.remove());
    lista.insertAdjacentHTML('beforeend', nuove.map(rigaHTML).join(''));
  }
  return { tl, finale, riordina, scrivi };
}

// --------------------------------------------------------- M6 · PROMPT -----
// Scopo: trasformare uno spettatore in un decisore. E' la cerniera della hero.
// `letter-spacing` non e' compositabile, ma qui anima un solo nodo di 4 caratteri
// per mezzo secondo: il costo e' sotto il rumore, e l'effetto "la radio chiama i box"
// non si ottiene altrimenti.
function PROMPT(gsap, root) {
  const box = q(root, '.hero-prompt'), t = q(root, '.hero-prompt-t'),
        luci = [...root.querySelectorAll('.hero-luci i')];
  let respiro = null;
  const finale = () => { gsap.set(box, { opacity: 0 }); respiro?.kill(); };
  const tl = () => {
    const T = gsap.timeline();
    T.fromTo(box, { opacity: 0 }, { opacity: 1, duration: .35 }, 0)
     .fromTo(t, { letterSpacing: '.5em', opacity: 0 }, { letterSpacing: '.16em', opacity: 1, duration: .5, ease: 'power2.out' }, 0)
     .fromTo(luci, { opacity: .18 }, { opacity: 1, duration: .18, stagger: .11 }, .2)
     .add(() => {
       respiro = gsap.to(luci, { opacity: .3, duration: .7, yoyo: true, repeat: -1, stagger: { each: .12, yoyo: true }, ease: 'sine.inOut' });
     });
    return T;
  };
  const verde = () => {
    respiro?.kill();
    q(root, '.hero-luci').classList.add('e-verde');
    return gsap.to(luci, { opacity: 1, duration: .2, stagger: .05 });
  };
  const spegni = () => gsap.to(box, { opacity: 0, duration: .3 });
  return { tl, finale, verde, spegni };
}

// --------------------------------------------------------- M7 · CHOICE -----
// Scopo: E' la demo. Due strade reali, ognuna col suo esito gia' calcolato dal motore.
// Il "glow pulsante" e' opacity su un alone gia' disegnato + un micro-scale: niente
// blur animato, niente box-shadow.
function CHOICE(gsap, root) {
  const carte = [...root.querySelectorAll('.hero-choice')];
  let pulsa = null;
  const finale = () => gsap.set(carte, { opacity: 1, y: 0, scale: 1 });
  const tl = () => gsap.timeline()
    .fromTo(carte, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .45, stagger: .09, ease: 'back.out(1.4)' })
    .add(() => { pulsa = gsap.to(carte[0], { scale: 1.015, duration: .85, yoyo: true, repeat: -1, ease: 'sine.inOut' }); });

  // Le carte restano SEMPRE cliccabili e raggiungibili da tastiera, anche prima del
  // cancello: toglierle dal flusso di tab per due secondi e mezzo sarebbe un buco di
  // accessibilita' in cambio di niente. Chi ha fretta clicca subito e il Direttore
  // manda l'intro al finale (vedi dirigi()). `attiva` governa solo l'aspetto.
  const gruppo = () => carte[0].closest('.hero-choices');
  function reset() {                       // torna a due strade pari, nessuna scelta
    pulsa?.kill();
    gruppo().removeAttribute('data-deciso');
    carte.forEach((c, i) => {
      c.setAttribute('aria-pressed', 'false');
      c.removeAttribute('data-attesa');
      gsap.set(c, { scale: 1 });
      if (i === 0) c.setAttribute('data-attesa', '1');
    });
  }
  function segna(id) {
    pulsa?.kill();
    gruppo().setAttribute('data-deciso', '');
    carte.forEach(c => {
      const mio = c.dataset.scelta === id;
      c.setAttribute('aria-pressed', String(mio));
      c.removeAttribute('data-attesa');
      gsap.to(c, { scale: mio ? 1.02 : 1, duration: .3, ease: 'back.out(2)' });
    });
  }
  return { tl, finale, reset, segna, carte, fermaPulsazione: () => pulsa?.kill() };
}

// ------------------------------------------------------- M8 · COMPOUND -----
// Scopo: il segnale F1 piu' riconoscibile al mondo, e il gesto vero del muretto.
// NON muove la risposta, e la nota accanto lo dice. Vedi NOTA_HERO.md §1.2.
function COMPOUND(gsap, root) {
  const b = [...root.querySelectorAll('.hero-mesc-b')];
  const blocco = q(root, '.hero-mesc');
  const finale = () => gsap.set([blocco, ...b], { opacity: 1, scale: 1 });
  const tl = () => gsap.timeline()
    .fromTo(blocco, { opacity: 0 }, { opacity: 1, duration: .25 }, 0)
    .fromTo(b, { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: .3, stagger: .06, ease: 'back.out(2)' }, 0);
  const segna = (m) => b.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === m)));
  return { tl, finale, segna, bottoni: b };
}

// -------------------------------------------------------- M9 · PITSTOP -----
// Scopo: rendere fisica la decisione. Tre segmenti: ingresso, fermo, uscita.
// Il tempo mostrato dal contatore e' vero (2,41 s); la durata percepita e' compressa,
// perche' 2,4 secondi di pallino fermo in una hero sono un'eternita'.
function PITSTOP(gsap, root, car) {
  const box = q(root, '.hero-pit'), t = q(root, '[data-pit]'),
        gomme = [...root.querySelectorAll('.hero-pit-g i')];
  const SOSTA = 2.41;
  const finale = () => gsap.set(box, { opacity: 0, visibility: 'hidden' });

  function tl() {
    const T = gsap.timeline();
    const n = { v: 0 };
    T.add(car.versoBox())                                            // 1. arriva all'ingresso
     .add(car.nascondiScia(), '<')
     .add(car.scivola(0, .45, .55, 'power1.in'))                     // 2. scende in corsia
     .set(box, { visibility: 'visible', immediateRender: false }, '<')
     .fromTo(box, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .25, immediateRender: false }, '<')
     .to(n, { v: SOSTA, duration: 1.1, ease: 'none', snap: { v: .01 },
              onUpdate: () => { t.textContent = num(n.v); } }, '<')
     .to(gomme, { backgroundColor: '#34D178', duration: .12, stagger: .12 }, '<+=0.15')
     .add(car.scivola(.45, 1, .7, 'power1.out'))                     // 3. risale ed esce
     .to(box, { opacity: 0, duration: .3 }, '<+=0.25')
     .set(box, { visibility: 'hidden', immediateRender: false })
     .set(gomme, { clearProps: 'backgroundColor', immediateRender: false })
     .add(() => { car.riparti(); })
     .add(car.mostraScia(), '<');
    return T;
  }
  return { tl, finale };
}

// -------------------------------------------------------- M10 · OUTCOME ----
// Scopo: chiudere il ciclo causa -> effetto in una riga che si legge senza pensarci.
// Il flash e' un velo in opacity, non un cambio di colore di sfondo.
function OUTCOME(gsap, root, H) {
  const box = q(root, '.hero-verdetto');
  const flash = q(root, '.hero-verdetto-flash');
  const corpo = q(root, '.hero-verdetto-corpo');
  const partenza = H.pilota.pos;

  function testo(s) {
    const altra = H.scelte.find(x => x.id !== s.id);
    const d = s.pos - partenza;
    const esito = d <= 0 ? 'su' : 'giu';
    const titolo = titoloVerdetto(d, s.pos);
    // sotto neutralizzazione i gap sono soppressi dal motore: si dice, non si riempie
    const dove = doveVerdetto(s);
    const dd = altra.pos - s.pos;
    return { esito, html: `
      <div class="hero-verdetto-top">
        <span class="hero-verdetto-pos">P${s.pos}</span>
        <span class="hero-verdetto-t">${titolo}</span>
      </div>
      <div class="hero-verdetto-alt">${dove}<br>
        ${t('hero.altra_strada')} &middot; <b>${esc(etichetta(altra, H).toLowerCase())}</b> &rarr; P${altra.pos}${
          dd ? ` (${dd > 0 ? '&minus;' : '+'}${Math.abs(dd)})` : ''}</div>` };
  }

  const scrivi = (s) => { const r = testo(s); box.dataset.esito = r.esito; corpo.innerHTML = r.html; };
  const finale = () => { scrivi(H.scelte[0]); gsap.set(corpo, { opacity: 1, y: 0 }); };

  // Il verdetto non esiste ancora quando la timeline si costruisce: `scrivi` crea i
  // nodi al momento giusto e solo dopo si anima quello che e' appena nato. Per questo
  // il corpo si nasconde con .set (immediateRender: false) e non con un fromTo.
  function tl(s) {
    const T = gsap.timeline();
    T.set(corpo, { opacity: 0, y: 8, immediateRender: false })
     .add(() => {
       scrivi(s);
       gsap.to(corpo, { opacity: 1, y: 0, duration: .35, ease: 'back.out(1.6)' });
       gsap.fromTo(q(root, '.hero-verdetto-pos'),
                   { scale: .82 }, { scale: 1, duration: .4, delay: .06, ease: 'back.out(2.4)' });
     })
     .fromTo(flash, { opacity: 0 }, { opacity: .9, duration: .18, yoyo: true, repeat: 1,
                                      ease: 'power2.out', immediateRender: false }, '<')
     .to({}, { duration: .45 });                       // tiene la durata reale del beat
    return T;
  }
  return { tl, finale, scrivi };
}

// --------------------------------------------------------- la firma + CTA --
function FIRMA(gsap, root) {
  const f = q(root, '.hero-firma'), cta = q(root, '.hero-cta .btn-p');
  const finale = () => gsap.set([f, cta], { opacity: 1, y: 0 });
  const tl = () => gsap.timeline()
    .fromTo(f, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .45 })
    .fromTo(cta, { scale: 1 }, { scale: 1.035, duration: .4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=.15');
  return { tl, finale };
}

// ============================================================================
// M11 · IL DIRETTORE — l'unico che possiede il tempo.
// armato -> corre -> chiede -> ‖cancello‖ -> sosta -> verdetto -> riposo
// ============================================================================
async function dirigi(root, H) {
  const gsap = await caricaGsap();
  const mm = gsap.matchMedia();

  const track = TRACK(gsap, root);
  const car = CAR(gsap, root, H);
  const hud = HUD(gsap, root, H);
  const tower = TOWER(gsap, root, H);
  const prompt = PROMPT(gsap, root);
  const choice = CHOICE(gsap, root);
  const comp = COMPOUND(gsap, root);
  const pit = PITSTOP(gsap, root, car);
  const out = OUTCOME(gsap, root, H);
  const firma = FIRMA(gsap, root);
  const moduli = [track, car, hud, tower, prompt, choice, comp, pit, out, firma];

  const scelta = (id) => H.scelte.find(s => s.id === id) || H.scelte[0];
  let stato = 'armato', attesaTimer = null, atto2 = null;

  // ---- riposo: tutto attivo, si puo' passare da una strada all'altra all'infinito
  function riposo() {
    stato = 'riposo';
    root.classList.add('e-riposo');
    choice.carte.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.scelta === scelto)));
  }

  // ---- atto 2: la sosta, il riordino, il verdetto
  let scelto = H.scelte[0].id;
  function decidi(id, { animato = true } = {}) {
    clearTimeout(attesaTimer);
    scelto = id;
    const s = scelta(id);
    choice.segna(id);

    if (!animato) {                                  // reduced motion / cambio a riposo
      tower.scrivi(s.torre); out.scrivi(s); riposo(); return;
    }
    stato = 'sosta';
    atto2?.kill();
    atto2 = gsap.timeline({ onComplete: riposo })
      .add(prompt.spegni(), 0)
      .add(pit.tl(), 0)
      .add(tower.riordina(s.torre), '-=1.05')
      .add(out.tl(s), '-=.35')
      .add(firma.tl(), '-=.2');
  }

  // ---- cambio di strada a riposo: niente sosta, solo il ribaltamento e il verdetto
  function ricambia(id) {
    if (id === scelto) return;
    scelto = id;
    const s = scelta(id);
    choice.segna(id);
    gsap.timeline().add(tower.riordina(s.torre), 0).add(out.tl(s), '-=.4');
  }

  // ------------------------------------------------------------- ascolti
  // Un click vale in qualunque momento. Se arriva prima del cancello, l'intro salta
  // al suo finale e si decide subito: chi ha gia' capito non deve aspettare la messa
  // in scena. Durante la sosta si ignora — quella e' la risposta che sta arrivando.
  choice.carte.forEach(c => c.addEventListener('click', () => {
    const id = c.dataset.scelta;
    if (stato === 'sosta') return;
    if (stato === 'riposo') { ricambia(id); return; }
    clearTimeout(attesaTimer);
    master?.pause().progress(1);
    decidi(id);
  }));
  comp.bottoni.forEach(b => b.addEventListener('click', () => comp.segna(b.dataset.m)));

  const rivedi = q(root, '.hero-rivedi');
  rivedi.addEventListener('click', () => { atto2?.kill(); riparti(); });

  // ------------------------------------------------------- atto 1 + cancello
  let master = null;
  function riparti() {
    // il timer della catena automatica va spento qui: chi preme «rivedi» mentre l'attesa
    // e' ancora armata si trovava la scena ripartita E la scelta d'ufficio, insieme.
    clearTimeout(attesaTimer);
    root.classList.remove('e-riposo');
    stato = 'armato';
    choice.reset();
    tower.scrivi(H.torre_partenza);
    q(root, '.hero-verdetto-corpo').innerHTML =
      `<p class="hero-verdetto-attesa">${t('index.hero_attesa')}</p>`;
    root.querySelector('.hero-verdetto').removeAttribute('data-esito');
    gsap.set(q(root, '.hero-firma'), { opacity: 0 });
    q(root, '.hero-luci')?.classList.remove('e-verde');

    master?.kill();
    master = gsap.timeline()
      .add(track.tl(), 0)
      .add(hud.tl(), .15)
      .add(tower.tl(), .45)
      .add(car.tl(), 1.05)
      .add(prompt.tl(), 1.6)
      .add(() => { stato = 'chiede'; }, 2.3)
      .add(choice.tl(), 2.4)
      .add(comp.tl(), 2.55)
      .addPause('+=0.05', () => {                     // ‖ IL CANCELLO ‖
        // chi non tocca vede comunque il finale: dopo 2,8 s decide la casa
        attesaTimer = setTimeout(() => { master.play(); decidi(H.scelte[0].id); }, 2800);
      });
  }

  // ---------------------------------------------- reduced motion: stato finale
  mm.add('(prefers-reduced-motion: reduce)', () => {
    moduli.forEach(m => m.finale());
    tower.scrivi(scelta(scelto).torre);
    out.scrivi(scelta(scelto));
    comp.segna(H.mescole.monta);
    root.classList.add('e-finale');
    riposo();
    return () => {};
  });
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    riparti();
    return () => { master?.kill(); atto2?.kill(); clearTimeout(attesaTimer); };
  });

  // fuori schermo o scheda in secondo piano: la hero non consuma un frame
  const io = new IntersectionObserver(([e]) => {
    if (!master) return;
    if (e.isIntersecting) { if (stato !== 'chiede') master.play(); gsap.ticker.lagSmoothing(500, 33); }
    else master.pause();
  }, { threshold: .12 });
  io.observe(root);
  document.addEventListener('visibilitychange', () => {
    if (!master) return;
    document.hidden ? master.pause() : (stato !== 'chiede' && master.play());
  });
}

// ============================================================================
// LA HERO SENZA GSAP — non e' un ripiego, e' un percorso di prima classe.
// Ci finisce chi ha prefers-reduced-motion (e allora GSAP non viene nemmeno
// scaricato: 30 KB gzip risparmiati a chi non li userebbe) e chi ha una rete o un
// browser che la libreria non se la porta a casa. Tutto resta leggibile,
// cliccabile e vero: cambia solo che non si muove niente.
// ============================================================================
function statico(root, H) {
  const lista = q(root, '.hero-tower'), corpo = q(root, '.hero-verdetto-corpo');
  const box = q(root, '.hero-verdetto'), partenza = H.pilota.pos;
  let scelto = H.scelte[0].id;

  q(root, '[data-giro]').textContent = H.giro;
  root.classList.add('e-finale', 'e-riposo');

  // il pallino, fermo appena fuori dalla corsia box: nessun tween, solo geometria
  const nastro = q(root, '#hero-nastro'), auto = q(root, '#hero-auto');
  if (nastro && auto) {
    const p = nastro.getPointAtLength(nastro.getTotalLength() * (H.pista.frazione_uscita + .12));
    auto.setAttribute('cx', p.x); auto.setAttribute('cy', p.y); auto.setAttribute('opacity', '1');
  }

  function applica(id) {
    scelto = id;
    const s = H.scelte.find(x => x.id === id);
    const altra = H.scelte.find(x => x.id !== id);
    const d = s.pos - partenza;
    lista.querySelectorAll('.hero-row').forEach(li => li.remove());
    lista.insertAdjacentHTML('beforeend', s.torre.map(rigaHTML).join(''));
    box.dataset.esito = d <= 0 ? 'su' : 'giu';
    corpo.innerHTML = `
      <div class="hero-verdetto-top">
        <span class="hero-verdetto-pos">P${s.pos}</span>
        <span class="hero-verdetto-t">${titoloVerdetto(d, s.pos)}</span>
      </div>
      <div class="hero-verdetto-alt">${doveVerdetto(s)}<br>
        ${t('hero.altra_strada')} &middot; <b>${esc(etichetta(altra, H).toLowerCase())}</b> &rarr; P${altra.pos}</div>`;
    root.querySelectorAll('.hero-choice').forEach(c =>
      c.setAttribute('aria-pressed', String(c.dataset.scelta === id)));
  }

  root.querySelectorAll('.hero-choice').forEach(c => {
    c.removeAttribute('data-attesa');
    c.addEventListener('click', () => applica(c.dataset.scelta));
  });
  // (il listener delle gomme e' stato tolto: erano bottoni che si illuminavano a
  // vicenda e basta — vedi la nota su .hero-mesc-r)
  q(root, '.hero-rivedi').hidden = true;
  applica(scelto);
}

// ============================================================================
// AVVIO
// ============================================================================
export async function creaHero(root) {
  if (!root) return;
  let H;
  try {
    // niente credentials 'omit': il <link rel=preload crossorigin> non combaciava e il
    // browser scaricava hero.json DUE volte, dicendolo in console. Il preload e' stato
    // tolto dalla pagina, e qui resta la fetch normale.
    //
    // LA TARGHETTA SERVE PROPRIO QUI. `force-cache` dice al browser: se ce l'hai, tienilo,
    // non chiedere. Senza un'URL che cambia, una hero rigenerata (posizioni della torre,
    // gara nuova) non arriverebbe MAI a chi ha gia' visitato la home — e sarebbe l'unico
    // punto del sito dove il must-revalidate di Vercel non ci salva, perche' la richiesta
    // al server non parte proprio. `?v=` la fa ripartire il giorno in cui V cambia.
    const r = await fetch(`${FONTE}?v=${V}`, { cache: 'force-cache' });
    if (!r.ok) throw new Error(`hero.json ${r.status}`);
    H = await r.json();
  } catch (e) {
    // Se il dato non c'e' non si inventa niente: restano titolo, promessa e CTA,
    // che sono in HTML statico. La scena sparisce, il resto della landing vive.
    console.warn('[hero] dati non disponibili:', e.message);
    root.querySelector('.hero-stage')?.remove();
    q(root, '.hero-grid')?.style.setProperty('grid-template-columns', '1fr');
    return;
  }
  costruisci(root, H);
  q(root, '.hero-rivedi').innerHTML = `${ICO_RIVEDI}Rivedi`;

  // Chi non vuole movimento non paga la libreria del movimento.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { statico(root, H); return; }

  // LAZY LOAD VERO: GSAP parte solo quando la hero entra davvero in viewport.
  // Sopra la piega succede subito; da un link con ancora, o su una scheda aperta
  // in secondo piano, non succede affatto finche' non serve.
  const avvia = async () => {
    try { await dirigi(root, H); }
    catch (e) { console.warn('[hero] animazione non disponibile:', e.message); statico(root, H); }
  };
  const io = new IntersectionObserver((v, obs) => {
    if (!v.some(x => x.isIntersecting)) return;
    obs.disconnect(); avvia();
  }, { rootMargin: '120px' });
  io.observe(root);
}
