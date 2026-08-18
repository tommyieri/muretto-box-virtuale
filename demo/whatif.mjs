// whatif.mjs — la sosta si sposta, e la risposta la dà il motore vero.
//
// RISCRITTO IL 17/08/2026, il giorno stesso in cui la prima versione era andata online.
// Quella versione non aveva un difetto: aveva la forma dei dati sbagliata, e sopra ci
// aveva costruito una fisica propria. Leggeva `gara[PILOTA][giro]` mentre l'archivio è
// `laps[giro].cars[PILOTA]`, quindi:
//   · il menù dei piloti elencava i CAMPI del file (drivers, gara, laps, n_laps, pace);
//   · nessun giro verde superava il filtro, e il passo base cadeva sul ripiego `|| 85.0`
//     scritto nel codice — su Ungheria il giro vero è ~88,6 s;
//   · «posizione di rientro» era sempre P1, perché il confronto coi rivali non incontrava
//     mai un cumulato valido;
//   · «pit reale» era `metà dei giri`, e contava 22 giri (i piloti) su una gara di 70.
// Sotto quei numeri la targhetta diceva «misurato», e il degrado era un `0.0308` battuto a
// mano — arrotondamento del sigillo del kernel (contesto_live.json: 0,030776). Il difetto
// non è che il valore fosse inventato: è che era una COPIA A MANO, cioè la cosa esatta per
// cui esiste simulatore/gen_numeri_ereditati.py, e che sotto ci stavano numeri fabbricati.
//
// LA RIPARAZIONE NON È ARITMETICA, È DI PROPRIETÀ. Tutto ciò che serve esisteva già ed è
// sotto banco (demo/test_ese.mjs, demo/test_boxora.mjs): `ese.mjs::preparaGara` monta
// archivio, contesto e soste vere; `congelamentoPer` sceglie il congelamento; `eseguiRigioca`
// fa girare DUE BRACCI nello stesso motore. Qui non si calcola un tempo sul giro: si
// preparano gli ingressi, si chiama il kernel e si rende quello che risponde — Director
// compreso. Nessuna costante di fisica vive in questo file, ed è la condizione perché non
// possa più andare alla deriva da sola.
//
// IL CONFRONTO È SIM CONTRO SIM, e non sim contro reale. La differenza non è un dettaglio:
// contro il reale, il numero che esce è l'errore del modello SOMMATO all'effetto della
// scelta, e i due pezzi non si separano. Contro l'altro braccio dello stesso motore, il
// bias si cancella e resta la scelta. È la stessa ragione già scritta in ese_vista.mjs
// («stesso motore, stesse assunzioni: è il metro giusto»).
//
// L'ASSENZA È UNA RISPOSTA (regola 6). Se il pilota non ha un passo base al congelamento,
// se il Director respinge il run, se la gara non è simulabile: la pagina lo SCRIVE e non
// mostra numeri. Non esiste un ripiego che inventi un valore plausibile.

import { V, datiObbligatori } from './muro.mjs?v=090826b';
// `?v=080826b` è la stessa targhetta con cui ese_vista.mjs importa ese.mjs, e va tenuta
// uguale: due specificatori diversi sono due istanze di modulo, e questo ne scaricherebbe
// e ne parserebbe due volte l'intero kernel vendor.
import { preparaGara, congelamentoPer, posizioniPerGiro } from './ese.mjs?v=080826b';
import { eseguiRigioca } from './ese_vista.mjs?v=090826b';
// La costruzione del piano sta fuori di qui perché questo file non è importabile da Node
// (muro.mjs tocca `window` al caricamento) e quella logica DEVE stare sotto banco:
// demo/test_whatif.mjs. È il pezzo che ha sbagliato per primo.
import { sosteEditabili, pianoWhatIf } from './whatif_piano.mjs?v=090826b';

const $ = (s) => document.querySelector(s);

const rifJson = async (u) => {
  const sep = u.includes('?') ? '&' : '?';
  const r = await fetch(`${u}${sep}v=${V}`);
  if (!r.ok) throw new Error(`dato non raggiungibile: ${u}`);
  return r.json();
};

const stato = { gara: null, pilota: null, mescola: 'HARD', giroAlt: null, prep: null };
const cache = new Map();
let seq = 0;                       // l'ultima richiesta vince: i cambi sono più rapidi del kernel

/* ─────────────────────────────────────────────────────────── avvio */
(async () => {
  try {
    const [cal, manifest] = await Promise.all([
      datiObbligatori(`data/calendario_2026.json?v=${V}`),
      datiObbligatori(`data/giri_manifest.json?v=${V}`),
    ]);

    // L'ELENCO NON SI SCRIVE A MANO. La prima versione teneva le undici gare in una
    // costante: la dodicesima non sarebbe mai comparsa. Qui l'ordine è quello del
    // calendario e il filtro è il manifest — una gara entra quando ha davvero il lap chart.
    const conGara = new Set(Object.entries(manifest.gare ?? {})
      .filter(([, ss]) => (ss ?? []).some((s) => s.sessione === 'gara'))
      .map(([nome]) => nome));
    const gare = (cal.gare ?? []).map((g) => g.nome).filter((n) => conGara.has(n));
    if (!gare.length) throw new Error('nessuna gara con lap chart nel manifest');

    $('#sel-gara').innerHTML = gare.map((g) => `<option value="${g}">${g} (${cal.stagione})</option>`).join('');
    $('#sel-gara').addEventListener('change', (e) => cambiaGara(e.target.value));
    $('#sel-pilota').addEventListener('change', (e) => { stato.pilota = e.target.value; ancoraAllaSostaVera(); });
    $('#rng-giro').addEventListener('input', (e) => {
      stato.giroAlt = parseInt(e.target.value, 10);
      $('#txt-giro-alt').textContent = `Giro ${stato.giroAlt}`;
      ricalcola();
    });
    document.querySelectorAll('#btn-mescole .pil').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#btn-mescole .pil').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        stato.mescola = b.getAttribute('data-m');
        ricalcola();
      });
    });

    await cambiaGara(gare[gare.length - 1]);
  } catch (e) {
    fermati(`la pagina non parte: ${e.message}`);
  }
})();

/* ──────────────────────────────────────────────── la gara e il pilota */
async function cambiaGara(nome) {
  stato.gara = nome;
  $('#sel-gara').value = nome;
  dillo('preparo la gara nel motore…');
  try {
    if (!cache.has(nome)) cache.set(nome, await preparaGara(nome, { fetchJson: rifJson }));
    stato.prep = cache.get(nome);
  } catch (e) {
    return fermati(`${nome} non è simulabile: ${e.message}`);
  }
  const p = stato.prep;
  scriviTarghetta(p.contesto);      // per gara: è il contesto che il kernel riceve
  // I piloti sono quelli del lap chart, non le chiavi del file.
  const piloti = [...new Set(Object.keys(p.race.byLap[1] ?? {}))].sort();
  $('#sel-pilota').innerHTML = piloti.map((d) => `<option value="${d}">${d}</option>`).join('');
  stato.pilota = piloti.includes('NOR') ? 'NOR' : piloti[0];
  $('#sel-pilota').value = stato.pilota;

  const rng = $('#rng-giro');
  rng.min = 6;                       // sotto, il congelamento non trova un passo base
  rng.max = Math.max(7, p.race.n_laps - 1);
  ancoraAllaSostaVera();
}

/** Il cursore parte dalla sosta VERA del pilota: lo zero del confronto è lì. */
function ancoraAllaSostaVera() {
  const p = stato.prep;
  const soste = sosteEditabili(p.sosteVere[stato.pilota]);
  const rng = $('#rng-giro');
  const vera = soste.find((s) => s.giro >= Number(rng.min) && s.giro <= Number(rng.max));
  stato.giroAlt = vera ? vera.giro : Math.round((Number(rng.min) + Number(rng.max)) / 2);
  // La mescola parte da quella VERA di quella sosta: così l'ancora è un'ancora davvero, e
  // il delta ci legge zero. Se partisse da una mescola qualsiasi, al giro della sosta vera
  // la pagina mostrerebbe un delta diverso da zero senza che l'utente abbia scelto niente.
  if (vera?.mescola) impostaMescola(vera.mescola);
  rng.value = stato.giroAlt;
  $('#txt-giro-alt').textContent = `Giro ${stato.giroAlt}`;
  $('#kpi-pit-reale').textContent = soste.length 
    ? `${soste.length} sosta/e (g.${soste.map((s) => `${s.giro} ${s.mescola}`).join(', g.')})`
    : '— nessuna';
  ricalcola();
}

function impostaMescola(m) {
  stato.mescola = m;
  document.querySelectorAll('#btn-mescole .pil').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-m') === m);
  });
}

/* ─────────────────────────────────────────────────────── il calcolo */
async function ricalcola() {
  const mio_seq = ++seq;
  const p = stato.prep;
  if (!p || !stato.pilota || !stato.giroAlt) return;

  // NIENTE DA SPOSTARE È UNA RISPOSTA, non uno zero. Se il pilota non ha nemmeno una sosta
  // rappresentabile — a Monaco NOR si ritira senza fermarsi mai — questa pagina non ha un
  // oggetto: mostrare comunque un delta significherebbe spacciare «aggiungo una sosta dove
  // non ce n'era» per «sposto la sosta», che è un'altra domanda con un'altra risposta.
  const soste = sosteEditabili(p.sosteVere[stato.pilota]);
  if (!soste.length) {
    const t = p.tipoArrivo?.[stato.pilota];
    const perche = t === 'RIT' ? ' — si è ritirato' : t === 'NP' ? ' — non è partito' : '';
    $('#kpi-pit-sim').textContent = '—';
    return fermati(`${stato.pilota} non si è mai fermato in questa gara${perche}: non c'è una sosta da spostare`);
  }
  $('#kpi-pit-sim').textContent = `Giro ${stato.giroAlt}`;
  dillo('il motore sta rigiocando la gara…');

  // IL CONGELAMENTO. Non lo sceglie questa pagina: lo sceglie ese.mjs, col criterio già
  // usato dal BOX ORA — il più tardi possibile prima della sosta, purché il pilota abbia
  // un passo base. Se non lo trova, la risposta è il motivo, non un numero.
  const { freezeLap, motivo } = congelamentoPer({
    nome: p.nome, contesto: p.contesto, pilota: stato.pilota, giroSosta: stato.giroAlt,
  });
  if (mio_seq !== seq) return;
  if (freezeLap == null) return fermati(`niente da simulare: ${motivo}`);

  let esito;
  try {
    esito = eseguiRigioca({
      prep: p, pilota: stato.pilota, freeze: freezeLap,
      soste: pianoWhatIf(p.sosteVere[stato.pilota], freezeLap, stato.giroAlt, stato.mescola),
    });
  } catch (e) {
    return fermati(`il motore rifiuta questo scenario: ${e.message}`);
  }
  if (mio_seq !== seq) return;
  rendi(esito, freezeLap);
}

/* ─────────────────────────────────────────────────────── il referto */
function rendi({ mio, vero }, freezeLap) {
  const p = stato.prep, drv = stato.pilota;
  const { risultato, direttore, scenario } = mio;

  // UN RIFIUTO È UNA RISPOSTA: si mostra al posto dei numeri, non accanto.
  if (!direttore.approved) {
    const fatal = (direttore.violazioni ?? []).filter((v) => v.severita === 'FATAL');
    $('#riga-director').innerHTML = '<span class="no">■ il Simulation Director RESPINGE questo run:</span> '
      + fatal.map((v) => v.messaggio ?? v.codice).join(' · ');
    svuota();
    return;
  }
  const sosp = (direttore.violazioni ?? []).filter((v) => v.severita === 'SOSPETTO').length;
  $('#riga-director').innerHTML = '<span class="ok">■ Simulation Director: approvato</span>'
    + (sosp ? ` · ${sosp} sospetti (non bloccanti)` : '')
    + ` · congelamento al giro ${freezeLap}`;

  const posDi = (run) => { const i = run?.risultato?.ordine?.indexOf(drv) ?? -1; return i < 0 ? null : i + 1; };
  const pReale = p.arrivoReale.find((r) => r.drv === drv)?.posizione ?? null;
  const pVera = posDi(vero);
  const pMia = posDi(mio);
  $('#verdetto').innerHTML = `
    <div class="kpi-box"><div class="tit">gara reale</div>
      <div class="val">${pReale == null ? '—' : 'P' + pReale}</div>
      <span class="sub">dal lap chart, senza penalità post-gara</span></div>
    <div class="kpi-box"><div class="tit">strategia vera · nel motore</div>
      <div class="val">${pVera == null ? '—' : 'P' + pVera}</div>
      <span class="sub">${vero ? 'stesso motore, stesse assunzioni: è il metro giusto'
                               : 'non simulabile (gomme non-slick o soste illeggibili) — dichiarato'}</span></div>
    <div class="kpi-box"><div class="tit">con la tua sosta</div>
      <div class="val">${pMia == null ? '—' : 'P' + pMia}</div>
      <span class="sub">sosta spostata al giro ${stato.giroAlt}, mescola ${stato.mescola}</span></div>`;

  // POSIZIONE AL RIENTRO: dal run What-If, contro i rivali DELLO STESSO RUN. Confrontare
  // un cumulato simulato coi cumulati reali degli altri — come faceva la prima versione —
  // mette due orologi diversi sullo stesso asse.
  const posGiro = posizioniPerGiro(risultato.traccia);
  const rientro = posGiro[stato.giroAlt + 1]?.[drv] ?? posGiro[stato.giroAlt]?.[drv] ?? null;
  $('#kpi-pos-rientro').textContent = rientro == null ? '—' : `P${rientro}`;

  // DELTA ALLA BANDIERA & DIAGNOSI INGEGNERISTICA:
  const elD = $('#kpi-delta-tempo');
  const cumMio = risultato.cum?.[drv], cumVero = vero?.risultato?.cum?.[drv];
  if (typeof cumMio === 'number' && typeof cumVero === 'number') {
    const d = cumMio - cumVero;
    elD.textContent = `${d > 0 ? '+' : ''}${d.toFixed(2)} s`;
    elD.className = `val ${d < -0.05 ? 'pos' : (d > 0.05 ? 'neg' : '')}`;
    
    // Spiegazione telemetrica ingegneristica per il pilota
    const sosteMie = sosteEditabili(p.sosteVere[drv]);
    const primaSosta = sosteMie[0]?.giro;
    let diagTxt = '';
    if (primaSosta && Math.abs(stato.giroAlt - primaSosta) >= 1) {
      const diffGiri = stato.giroAlt - primaSosta;
      if (diffGiri < 0) {
        diagTxt = `Sosta anticipata di ${Math.abs(diffGiri)} giri rispetto alla strategia reale (g.${primaSosta}). Stint finale più lungo di ${Math.abs(diffGiri)} giri.`;
      } else {
        diagTxt = `Sosta posticipata di ${diffGiri} giri rispetto alla strategia reale (g.${primaSosta}). Stint 1 esteso su gomma più usurata.`;
      }
    }
    const neutraGiro = (p.neutraVera?.[stato.giroAlt] || p.neutraVera?.[stato.giroAlt - 1]);
    if (neutraGiro) {
      diagTxt += (diagTxt ? ' · ' : '') + '⚠️ Sosta simulata in regime di Safety Car / VSC reale';
    }
    const subDelta = document.querySelector('#kpi-delta-tempo + .sub') || document.createElement('span');
    subDelta.className = 'sub';
    subDelta.innerHTML = `What-If meno strategia vera, stesso motore${diagTxt ? `<br><small style="color:var(--ciano)">${diagTxt}</small>` : ''}`;
  } else {
    elD.textContent = '—';
    elD.className = 'val';
  }

  rendiAssunzioni(scenario, direttore);
  disegna(mio, vero, drv);
}

function rendiAssunzioni(scenario, direttore) {
  const ul = $('#assunzioni');
  ul.replaceChildren();
  const agg = (html) => { const li = document.createElement('li'); li.innerHTML = html; ul.appendChild(li); };
  if (scenario.orizzonte) {
    agg(`<b>ORIZZONTE</b> — proiezione fino al giro ${scenario.orizzonte.giroFinale}: decine di giri `
      + 'contro i ~6 validati della risposta. <small>misurato: sulla gara intera il motore e '
      + '«non cambia niente» sono indistinguibili</small>');
  }
  for (const a of scenario.assunzioni ?? []) {
    agg(`<b>${a.codice}</b> — ${a.descrizione} <small>· ${a.targhetta ?? ''}</small>`);
  }
  for (const n of direttore.riepilogo?.non_verificabili ?? []) {
    agg(`<b>NON VERIFICATO</b> — <small>${n}</small>`);
  }
}

/**
 * La targhetta cita i sigilli CHE HANNO PRODOTTO QUESTI NUMERI, e li cita per nome.
 *
 * ATTENZIONE, È UNA TRAPPOLA IN CUI SONO GIÀ CADUTO. Nel repo convivono DUE rho, e sono
 * di due modelli diversi: `demo/data/modello_passo_2026.json` (0,038922) appartiene al
 * modello simmetrico di Fase 1 in demo/passo.mjs, mentre il kernel — quello che questa
 * pagina fa girare — usa `vendor/simulatore/motore/contesto_live.json` (0,030776). La
 * prima stesura di questa targhetta mostrava il primo mentre il motore girava col secondo:
 * una provenienza che non corrisponde a chi ha fatto il conto è esattamente il difetto per
 * cui questa pagina era stata spenta, in forma più educata. I valori si leggono dal
 * `contesto` che il kernel ha ricevuto, e non da un file scelto a mano.
 */
function scriviTarghetta(c) {
  const rho = c.modello?.rho ?? {}, vita = c.vitaMescola ?? {}, sog = c.sogliaSorpasso ?? {};
  const ic = (a) => Array.isArray(a) ? `[${a[0].toFixed(4)}; ${a[1].toFixed(4)}]` : '—';
  const giri = vita.giri ? Object.entries(vita.giri).map(([m, g]) => `${m} ${g}`).join(' · ') : '—';
  $('#box-targhetta').innerHTML = '<b>Da dove vengono i numeri</b><br>'
    + `• Degrado: <b>${rho.valore ?? '—'}</b> s/giro · IC95 ${ic(rho.ic95)}<br>`
    + `<small>&nbsp;&nbsp;${rho.targhetta ?? ''}</small><br>`
    + `• Carburante δ₇₀: <b>${c.modello?.delta_70?.scelto ?? '—'}</b> s su 70 kg<br>`
    + `• Vita mescola: <b>${vita.attivo ? giri : 'spenta'}</b> giri<br>`
    + `• Soglia di sorpasso: <b>${sog.attivo ? `${sog.soglia_comune} s/giro` : 'spenta'}</b><br>`
    + `• Orizzonte validato: <b>${c.orizzonteRisposta?.giri ?? '—'}</b> giri<br>`
    + '<small>sigillo: vendor/simulatore/motore/contesto_live.json — è il contesto che il '
    + 'kernel ha ricevuto per QUESTA gara. Pit-loss, neutralizzazioni e ritiri li applica il '
    + 'motore e li dichiara qui sotto, nelle assunzioni.</small>';
}

/* ─────────────────────────────────────────────────────── il grafico */
// Il distacco fra i DUE RUN, giro per giro. Non contro il reale: contro l'altro braccio.
function disegna(mio, vero, drv) {
  const svg = $('#svg-whatif');
  svg.replaceChildren();
  const tm = (mio.risultato.traccia ?? {})[drv] ?? [];
  const tv = (vero?.risultato?.traccia ?? {})[drv] ?? [];
  if (!tm.length || !tv.length) {
    svg.innerHTML = '<text x="400" y="190" fill="var(--fioco)" text-anchor="middle" '
      + 'font-family="\'JetBrains Mono\',monospace" font-size="13">'
      + 'senza il braccio «strategia vera» non c\'è un distacco da disegnare</text>';
    return;
  }
  const perGiro = new Map(tv.filter((x) => typeof x.cum_time === 'number').map((x) => [x.lap, x.cum_time]));
  const punti = tm.filter((x) => typeof x.cum_time === 'number' && perGiro.has(x.lap))
                  .map((x) => ({ lap: x.lap, d: x.cum_time - perGiro.get(x.lap) }));
  if (punti.length < 2) return;

  const W = 800, H = 380, padL = 62, padR = 30, padT = 26, padB = 40;
  const iW = W - padL - padR, iH = H - padT - padB;
  const laps = punti.map((p) => p.lap), ds = punti.map((p) => p.d);
  const l0 = Math.min(...laps), l1 = Math.max(...laps);
  let d0 = Math.min(...ds, 0), d1 = Math.max(...ds, 0);
  const marg = Math.max(1, (d1 - d0) * 0.15); d0 -= marg; d1 += marg;
  const X = (l) => padL + (l1 === l0 ? 0 : (l - l0) / (l1 - l0)) * iW;
  const Y = (d) => padT + iH - ((d - d0) / (d1 - d0)) * iH;
  const ns = 'http://www.w3.org/2000/svg';
  const nodo = (t, a) => { const n = document.createElementNS(ns, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
  const testo = (x, y, s, col, anc = 'middle', sz = 10) => {
    const n = nodo('text', { x, y, fill: col, 'text-anchor': anc, 'font-family': "'JetBrains Mono',monospace", 'font-size': sz });
    n.textContent = s; return n;
  };

  const passo = Math.max(0.5, Math.round((d1 - d0) / 5 * 2) / 2);
  for (let d = Math.ceil(d0 / passo) * passo; d <= d1; d += passo) {
    svg.appendChild(nodo('line', { x1: padL, y1: Y(d), x2: W - padR, y2: Y(d), stroke: 'var(--bordo)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    svg.appendChild(testo(padL - 8, Y(d) + 4, `${d > 0 ? '+' : ''}${d.toFixed(1)}s`, 'var(--fioco)', 'end'));
  }
  svg.appendChild(nodo('line', { x1: padL, y1: Y(0), x2: W - padR, y2: Y(0), stroke: 'var(--calmo)', 'stroke-width': 1.5 }));
  svg.appendChild(testo(W - padR, Y(0) - 6, 'strategia vera, stesso motore (0,0 s)', 'var(--calmo)', 'end'));

  if (stato.giroAlt >= l0 && stato.giroAlt <= l1) {
    svg.appendChild(nodo('line', { x1: X(stato.giroAlt), y1: padT, x2: X(stato.giroAlt), y2: H - padB, stroke: '#00E5FF', 'stroke-width': 2 }));
    svg.appendChild(testo(X(stato.giroAlt), H - padB + 20, `sosta What-If (g.${stato.giroAlt})`, '#00E5FF'));
  }
  svg.appendChild(nodo('polyline', {
    points: punti.map((p) => `${X(p.lap)},${Y(p.d)}`).join(' '),
    fill: 'none', stroke: '#00E5FF', 'stroke-width': 2.5,
  }));
  svg.appendChild(testo(padL, H - 10, `giro ${l0}`, 'var(--fioco)', 'start'));
  svg.appendChild(testo(W - padR, H - 10, `giro ${l1}`, 'var(--fioco)', 'end'));
  svg.appendChild(testo(padL, padT - 10, 'sopra la linea = la tua sosta perde tempo', 'var(--fioco)', 'start'));
}

/* ─────────────────────────────────────────────────────── i silenzi */
function dillo(msg) { $('#riga-director').textContent = msg; }

function svuota() {
  $('#verdetto').replaceChildren();
  $('#assunzioni').replaceChildren();
  $('#svg-whatif').replaceChildren();
  for (const id of ['#kpi-pos-rientro', '#kpi-delta-tempo']) {
    $(id).textContent = '—';
    $(id).className = 'val';
  }
}

function fermati(msg) {
  $('#riga-director').innerHTML = `<span class="no">■ ${msg}</span>`;
  svuota();
}
