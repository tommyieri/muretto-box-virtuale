// live_timing.mjs — torre di cronometraggio live (Fase 3 / R2, ADDITIVO).
//
// Consuma gli STESSI eventi del collettore gia' usati da live_mappa.mjs
// (snapshot, driver_list, timing_update). Disegna una classifica per
// posizione con: gap dal leader, best lap, ultimo giro, stato pit,
// tempi di settore S1/S2/S3 (colorati viola=assoluto, verde=personale)
// e le BARRETTE MICRO-SETTORE.
//
// Nessun dato inventato. I campi arrivano gia' dal collettore in
// timing_update (SignalR: decoder.py::vista_pilota; OpenF1: mappa_openf1).
// I codici Status dei micro-settori sono MISURATI sul feed reale
// (registrazione Spa 2026-07-19): 0=non percorso, 2048=giallo,
// 2049=verde, 2051=viola (assoluto), 2064=pit; altri (2052/2068/...) =
// neutro. La mappa colore vive qui ed e' dichiarata sotto (COL_SEG).
//
// In qualifica il feed ordina per giro veloce e il gap dal leader E' il
// gap dalla pole: la stessa torre vale per quali e gara.
//
// Onesta': fuori sessione (setAcceso(false)) la torre si SVUOTA. Mai
// numeri finti, mai una riga congelata.

// codici Status micro-settore -> colore (MISURATI, non assunti)
const COL_SEG = {
  0: '#2a333f',      // non ancora percorso
  2048: '#f5d43c',   // giallo (piu' lento)
  2049: '#3fbf6f',   // verde (personale)
  2051: '#a05cff',   // viola (assoluto di sessione)
  2064: '#4a5464',   // pit lane
};
const COL_SEG_ALTRO = '#39424f';   // 2052/2068/... : neutro dichiarato

import { tyreColor } from './timeline.mjs?v=220726a';

// ---------------------------------------------------------------- stato
// Riduttore puro, SENZA DOM: testabile in Node (test_live_timing.mjs).
export function creaStatoTiming() {
  const piloti = new Map();   // num -> {sigla, colore}
  const timing = new Map();   // num -> {pos,gap,in_pit,last_lap,best_lap,interval,sectors,micro,
                              //         compound,tyre_age}
  // compound/tyre_age ARRIVANO GIA' dal cavo — live/replay.py li mette nei diff di
  // timing_update (Fase C, dal TimingAppData SignalR) e live/collector/stint_poller.py li
  // ricava da OpenF1 v1/stints dove SignalR non arriva. Non li teneva NESSUNO: cadevano
  // qui, nel riduttore, perche' il contratto non li elencava. In diretta la classifica non
  // diceva su che gomma sei — l'unica cosa che la torre del replay mostra sempre.
  const CAMPI = ['pos', 'gap', 'in_pit', 'last_lap', 'best_lap',
                 'interval', 'sectors', 'micro', 'compound', 'tyre_age', 'retired'];

  function voce(num) {
    let v = timing.get(num);
    if (!v) {
      v = { pos: null, gap: '', in_pit: false, last_lap: null,
            best_lap: null, interval: null, sectors: [], micro: [],
            // null e non '': non sapere su che gomma sei e' diverso da non averla
            compound: null, tyre_age: null };
      timing.set(num, v);
    }
    return v;
  }

  function fondiTiming(num, diff) {
    const v = voce(num);
    for (const k of CAMPI) if (k in diff) v[k] = diff[k];
  }

  function fondiPilota(num, d) {
    const p = piloti.get(num) || {};
    piloti.set(num, { sigla: d.sigla ?? p.sigla, colore: d.colore ?? p.colore });
  }

  function applica(e) {
    if (!e || !e.type) return;
    if (e.type === 'timing_update') {
      for (const [num, diff] of Object.entries(e.cars || {})) fondiTiming(num, diff);
    } else if (e.type === 'driver_list') {
      for (const [num, d] of Object.entries(e.cars || {})) fondiPilota(num, d);
    } else if (e.type === 'snapshot') {
      piloti.clear();
      timing.clear();
      for (const [num, d] of Object.entries(e.driver_list || {})) fondiPilota(num, d);
      for (const [num, c] of Object.entries(e.cars || {})) fondiTiming(num, c);
    } else if (e.type === 'reset_sessione') {
      // cambio sessione: si lascia andare tutto. Senza questo, i piloti di una sessione
      // passata (es. i rookie di FP1 coi loro numeri) restano nella torre come fantasmi
      // finche' non si ricarica la pagina.
      piloti.clear();
      timing.clear();
    }
    // position_frame / track_status / session_status: non toccano la torre
  }

  function righe() {
    const out = [];
    for (const [num, t] of timing) {
      const p = piloti.get(num) || {};
      out.push({
        num,
        pos: t.pos,
        gap: t.gap || '',
        in_pit: !!t.in_pit,
        last_lap: t.last_lap || null,
        best_lap: t.best_lap || null,
        interval: t.interval || null,
        sectors: Array.isArray(t.sectors) ? t.sectors : [],
        micro: Array.isArray(t.micro) ? t.micro : [],
        sigla: p.sigla || num,
        colore: p.colore || '#9aa4b5',
        // ?? e non ||: tyre_age 0 e' un'eta valida (giro d'uscita), non un'assenza
        compound: t.compound ?? null,
        tyre_age: t.tyre_age ?? null,
        retired: !!t.retired,
      });
    }
    out.sort((a, b) => {
      const pa = a.pos == null ? Infinity : a.pos;
      const pb = b.pos == null ? Infinity : b.pos;
      if (pa !== pb) return pa - pb;
      return String(a.sigla).localeCompare(String(b.sigla));
    });
    return out;
  }

  function svuota() { piloti.clear(); timing.clear(); }

  return { applica, righe, svuota };
}

// ----------------------------------------------------------- vista DOM
export function creaTorreTiming({ lista, nota }) {
  const stato = creaStatoTiming();
  let acceso = false, rafId = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function gap(r) {
    if (r.pos === 1 || r.gap === '') return { txt: 'LEADER', cls: 'tw-lead' };
    return { txt: esc(r.gap), cls: '' };
  }

  function colSet(best) {
    return best === 'o' ? '#a05cff' : (best === 'p' ? '#3fbf6f' : '#cfd6e2');
  }

  function tag(r) {
    if (r.retired) return '<span class="tw-tag tw-tag-rit">OUT</span>';
    if (r.in_pit) return '<span class="tw-tag">PIT</span>';
    return '<span class="tw-tag"></span>';
  }

  // LA GOMMA, come nella torre del replay: pallino del colore della mescola + eta' in giri.
  // Il colore viene da timeline.mjs::tyreColor, che e' gia' la tabella di quell'altra torre:
  // due torri che mostrano la stessa cosa non devono avere due palette (nel repo ce n'erano
  // gia' tre). Mescola assente => niente pallino: in diretta capita di non sapere ancora su
  // che gomma sia un pilota, e un pallino grigio direbbe «gomma ignota» come se fosse una
  // mescola. Meglio non dire niente che dire una cosa che non si sa (regola 6).
  function gomma(r) {
    if (!r.compound) return '<span class="tw-gomma"></span>';
    // esc() INLINE su ogni interpolazione, anche sul colore che viene da un elenco chiuso:
    // il banco pretende di vederlo qui, e ha ragione a pretenderlo. Il compound arriva da un
    // WebSocket, e la regola «tutto cio' che entra in innerHTML passa da esc()» vale piu' del
    // ragionamento caso per caso su quale campo sia gia' sicuro (e' il difetto del 31/07).
    return `<span class="tw-gomma" title="${esc(r.compound)}">`
      + `<i class="tw-mescola" style="background:${esc(tyreColor(r.compound) || 'var(--dim)')}"></i>`
      + `<span class="tw-eta">${esc(typeof r.tyre_age === 'number' ? r.tyre_age : '')}</span></span>`;
  }

  function barraMicro(seg) {
    if (!Array.isArray(seg) || !seg.length) return '';
    return seg.map(s => `<i class="tw-seg" style="background:${COL_SEG[s] || COL_SEG_ALTRO}"></i>`).join('');
  }

  function blocchiSettori(r) {
    const sec = r.sectors || [];
    const mic = r.micro || [];
    if (!sec.length && !mic.length) return '';
    let html = '';
    for (let i = 0; i < 3; i++) {
      const s = sec[i] || { t: null, best: null };
      const m = mic[i] || [];
      html += `<div class="tw-sec">`
        + `<span class="tw-sec-t" style="color:${colSet(s.best)}">${s.t ? esc(s.t) : '–'}</span>`
        + `<div class="tw-bar">${barraMicro(m)}</div>`
        + `</div>`;
    }
    return `<div class="tw-sectors">${html}</div>`;
  }

  function disegna() {
    rafId = null;
    if (!acceso) { lista.innerHTML = ''; if (nota) nota.hidden = false; return; }
    if (nota) nota.hidden = true;
    lista.innerHTML = stato.righe().map(r => {
      const g = gap(r);
      const tempo = r.best_lap || r.last_lap;
      // data-sigla: la torre e' anche il modo per SCEGLIERE il pilota, come la
      // classifica in gara.html. Chi la disegna non sa cosa ci farai: espone il dato
      // e basta, il gestore del click vive nella pagina.
      return `<div class="tw-row${r.in_pit ? ' tw-pit' : ''}${r.retired ? ' tw-retired' : ''}" data-sigla="${esc(r.sigla)}"${r.retired ? ' data-ritirato="1"' : ''}>`
        + `<div class="tw-main">`
        // esc() ANCHE QUI. Era l'unico campo della riga che finiva in innerHTML
        // grezzo mentre tutti i fratelli (sigla, colore, tempo, gap, settori) erano
        // protetti — e i dati di questa torre arrivano da un WebSocket, cioe' da
        // fuori. Con l'override ?ws= era la via per far eseguire codice sull'origine
        // del sito. Trovato dall'audit di pre-pubblicazione del 31/07/2026.
        +   `<span class="tw-pos">${esc(r.pos ?? '–')}</span>`
        +   `<span class="tw-col" style="background:${esc(r.colore)}"></span>`
        +   `<span class="tw-sig">${esc(r.sigla)}</span>`
        +   `<span class="tw-time">${tempo ? esc(tempo) : '—'}</span>`
        +   `<span class="tw-gap ${g.cls}">${g.txt}</span>`
        +   gomma(r)
        +   tag(r)
        + `</div>`
        + blocchiSettori(r)
        + `</div>`;
    }).join('');
  }

  function programma() { if (rafId == null) rafId = requestAnimationFrame(disegna); }

  return {
    applica(e) { stato.applica(e); programma(); },
    setAcceso(v) {
      const n = !!v;
      if (n === acceso) return;
      acceso = n;
      if (!n) stato.svuota();
      programma();
    },
    _stato: stato,   // per i test
  };
}

/** Una sessione gia' corsa (quali_*.json, libere_*.json, sprint_*.json) nella forma che la
 *  torre consuma. Stava scritta QUATTRO volte identica — quali.html, libere.html,
 *  sprint.html e live.html — con l'unica differenza del nome del parametro. Quattro copie
 *  della stessa traduzione, pronte a divergere alla prima aggiunta di campo: E12.
 *
 *  Serve perche' la torre e' nata per il feed in DIRETTA e parla la lingua degli snapshot;
 *  una sessione archiviata e' la stessa classifica senza il tempo che scorre. `last_lap` e
 *  gli stati pista/sessione restano null: non sono mancanti per errore, non esistono
 *  proprio in un file di archivio (regola 6). */
export function snapshotDaSessione(sessione) {
  const driver_list = {}, cars = {};
  for (const p of (sessione?.piloti || [])) {
    driver_list[p.num] = { sigla: p.sigla, colore: p.colore };
    cars[p.num] = {
      pos: p.pos, gap: p.gap || '', last_lap: null,
      best_lap: p.best || null, in_pit: false,
      sectors: Array.isArray(p.sectors) ? p.sectors : [], micro: [],
    };
  }
  return { type: 'snapshot', driver_list, cars, track_status: null, session_status: null };
}
