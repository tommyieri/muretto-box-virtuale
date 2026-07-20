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

// ---------------------------------------------------------------- stato
// Riduttore puro, SENZA DOM: testabile in Node (test_live_timing.mjs).
export function creaStatoTiming() {
  const piloti = new Map();   // num -> {sigla, colore}
  const timing = new Map();   // num -> {pos,gap,in_pit,last_lap,best_lap,interval,sectors,micro}
  const CAMPI = ['pos', 'gap', 'in_pit', 'last_lap', 'best_lap',
                 'interval', 'sectors', 'micro'];

  function voce(num) {
    let v = timing.get(num);
    if (!v) {
      v = { pos: null, gap: '', in_pit: false, last_lap: null,
            best_lap: null, interval: null, sectors: [], micro: [] };
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
      return `<div class="tw-row${r.in_pit ? ' tw-pit' : ''}">`
        + `<div class="tw-main">`
        +   `<span class="tw-pos">${r.pos ?? '–'}</span>`
        +   `<span class="tw-col" style="background:${esc(r.colore)}"></span>`
        +   `<span class="tw-sig">${esc(r.sigla)}</span>`
        +   `<span class="tw-time">${tempo ? esc(tempo) : '—'}</span>`
        +   `<span class="tw-gap ${g.cls}">${g.txt}</span>`
        +   `<span class="tw-tag">${r.in_pit ? 'PIT' : ''}</span>`
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
