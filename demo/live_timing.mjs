// live_timing.mjs — torre di cronometraggio live (Fase 3, ADDITIVO).
//
// Consuma gli STESSI eventi del collettore gia' usati da live_mappa.mjs
// (snapshot, driver_list, timing_update) e disegna una classifica
// ordinata per posizione con: gap dal leader, ultimo giro, stato pit.
//
// NESSUN dato nuovo dal collettore: pos / gap / in_pit / last_lap
// viaggiano GIA' dentro timing_update (mappa_openf1.py: v1/position ->
// pos, v1/intervals.gap_to_leader -> gap, v1/laps -> last_lap). Sul
// ramo SignalR gli stessi campi escono da decoder.py::vista_pilota.
// Qui si disegnano soltanto: e' rendering puro, non tocca il motore.
//
// Onesta' dei dati (regola muretto): fuori sessione la torre si SVUOTA
// (setAcceso(false) -> nessuna riga). Mai numeri finti, mai una riga
// congelata che sembra viva. Il gap "" del leader (come dal feed) viene
// mostrato come "LEADER", non come "+0.000" inventato.

// ---------------------------------------------------------------- stato
// Riduttore puro, SENZA DOM: testabile in Node (test_live_timing.mjs).
export function creaStatoTiming() {
  const piloti = new Map();   // num -> {sigla, colore}
  const timing = new Map();   // num -> {pos, gap, in_pit, last_lap}

  function voce(num) {
    let v = timing.get(num);
    if (!v) {
      v = { pos: null, gap: '', in_pit: false, last_lap: null };
      timing.set(num, v);
    }
    return v;
  }

  function fondiTiming(num, diff) {
    const v = voce(num);
    for (const k of ['pos', 'gap', 'in_pit', 'last_lap'])
      if (k in diff) v[k] = diff[k];
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
      // lo snapshot RIALLINEA tutto: cars puo' portare i campi timing gia'
      // fusi dalla Replica del collettore (position_frame + timing_update).
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
        sigla: p.sigla || num,
        colore: p.colore || '#9aa4b5',
      });
    }
    // posizione nota prima (crescente); ignote in fondo, in ordine di sigla
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
export function creaTorreTiming({ tbody, nota }) {
  const stato = creaStatoTiming();
  let acceso = false, rafId = null;

  function gap(r) {
    if (r.pos === 1 || r.gap === '') return { txt: 'LEADER', cls: 'tw-lead' };
    return { txt: r.gap, cls: '' };
  }

  function disegna() {
    rafId = null;
    if (!acceso) { tbody.innerHTML = ''; if (nota) nota.hidden = false; return; }
    if (nota) nota.hidden = true;
    tbody.innerHTML = stato.righe().map(r => {
      const g = gap(r);
      return `<tr class="${r.in_pit ? 'tw-pit' : ''}">`
        + `<td class="tw-pos">${r.pos ?? '–'}</td>`
        + `<td class="tw-drv"><span class="tw-col" style="background:${r.colore}"></span>${r.sigla}</td>`
        + `<td class="tw-gap ${g.cls}">${g.txt}</td>`
        + `<td class="tw-lap">${r.last_lap ?? '—'}</td>`
        + `<td class="tw-tag">${r.in_pit ? 'PIT' : ''}</td>`
        + `</tr>`;
    }).join('');
  }

  function programma() { if (rafId == null) rafId = requestAnimationFrame(disegna); }

  return {
    applica(e) { stato.applica(e); programma(); },
    setAcceso(v) {
      const n = !!v;
      if (n === acceso) return;
      acceso = n;
      if (!n) stato.svuota();   // fuori sessione: si svuota (onesta')
      programma();
    },
    _stato: stato,   // per i test
  };
}
