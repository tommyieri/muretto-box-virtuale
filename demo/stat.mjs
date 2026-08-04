// stat.mjs — il kit condiviso della sezione Statistiche, costruito SOPRA stato.mjs.
//
// PERCHE' ESISTE. stato.mjs (scheletro, errore, prendiJSON) era importato da tre pagine
// su quindici: sembrava infrastruttura adottata e non lo era — dati.html e forza.html
// gestivano l'errore a mano con un <p> «Dati non ancora disponibili», senza scheletro e
// senza «Riprova». Il precedente giusto era la minoranza. La sezione nuova parte da li'
// e ci aggiunge le quattro cose che una pagina di statistiche ripete a ogni modulo.
//
// LA DISTINZIONE CHE CONTA: `assente()` NON e' `mostraErrore()`. Un dato che manca per un
// motivo dichiarato (Monaco non ha telemetria utilizzabile) non e' un guasto di rete, e
// mostrarlo con l'icona di allarme e il bottone «Riprova» insegna al lettore che il sito
// e' rotto quando invece sta dicendo la verita'. Sono due stati diversi e si vedono diversi.
import { scheletro, mostraErrore, prendiJSON } from './stato.mjs?v=250724a';

export { scheletro, mostraErrore, prendiJSON };

export const esc = s => String(s ?? '')
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** '2026-08-04T18:20:11Z' -> '4 agosto 2026'. Su una data-solo non applica il fuso. */
export function dataIt(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? String(iso) : `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * LA TARGHETTA. Ogni tabella della sezione porta addosso da dove viene e quando e' stata
 * calcolata. Non e' decorazione: se le viste si ri-aggiornano a ogni gara e nessuna porta
 * la data, un articolo di maggio cita un numero che oggi non esiste piu' e nessuno se ne
 * accorge. `calcolato_il` e' l'ora di CALCOLO — mai la data della gara, che e' un'altra cosa.
 */
export function targhetta(dati, extra = []) {
  const p = dati?.provenienza ?? {};
  const per = dati?.perimetro ?? {};
  const voci = [];
  if (dati?.calcolato_il) voci.push(['calcolato il', dataIt(dati.calcolato_il)]);
  if (p.f1db_release_letta) {
    const disallineata = p.f1db_release_pinnata && p.f1db_release_pinnata !== p.f1db_release_letta;
    voci.push(['fonte', `f1db ${esc(p.f1db_release_letta)}`
      + (disallineata ? ` <span title="Il pin in data/f1db_release.txt dice ${esc(p.f1db_release_pinnata)}: questo artefatto e' stato costruito da un'altra release, e lo dichiara invece di nasconderlo.">(pin: ${esc(p.f1db_release_pinnata)})</span>` : '')]);
  }
  if (per.gare?.length) voci.push(['perimetro', `${per.gare.length} gare`]);
  if (per.anni?.length) voci.push(['anni', `${per.anni[0]}–${per.anni[per.anni.length - 1]}`]);
  if (dati?._generatore) voci.push(['generatore', esc(dati._generatore)]);
  for (const [k, v] of extra) voci.push([k, v]);
  return `<div class="stat-targhetta">${voci
    .map(([k, v]) => `<div><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`)
    .join('')}</div>`;
}

/** La copertura DICHIARATA: cosa manca, e per quale motivo. Vuoto se non manca niente. */
export function copertura(dati) {
  const assenti = dati?.perimetro?.assenti ?? [];
  if (!assenti.length) return '';
  return `<div class="stat-assente"><b>Questa vista non copre tutta la stagione</b>${assenti
    .map(a => `<div>&mdash; <b style="display:inline">${esc(a.gara ?? a.anno ?? '?')}</b>: ${esc(a.motivo)}</div>`)
    .join('')}</div>`;
}

/** Assenza dichiarata. Distinta da mostraErrore(): vedi la nota in testa al file. */
export function assente(el, titolo, motivo) {
  if (!el) return;
  el.innerHTML = `<div class="stat-assente"><b>${esc(titolo)}</b>${esc(motivo)}</div>`;
}

/** La regola del calcolo, SOPRA la tabella e non in nota: e' la sola cosa che rende due
 *  tabelle di due fonti diverse confrontabili fra loro. */
export const regola = (titolo, testo) =>
  `<div class="stat-regola"><span class="k">${esc(titolo)}</span>${testo}</div>`;

/**
 * TABELLA DENSA ORDINABILE. `colonne` = [{k, testo, num?, r?, cella?}].
 * L'ordinamento e' stabile e riparte dalla colonna dichiarata in `ordina`.
 */
export function tabellaOrdinabile(el, righe, colonne, opzioni = {}) {
  if (!el) return;
  let chiave = opzioni.ordina ?? colonne[0].k;
  let giu = opzioni.discendente !== false;

  const valore = (r, c) => (c.val ? c.val(r) : r[c.k]);
  const disegna = () => {
    const col = colonne.find(c => c.k === chiave) ?? colonne[0];
    const ord = [...righe].sort((a, b) => {
      const x = valore(a, col), y = valore(b, col);
      if (x == null) return 1;
      if (y == null) return -1;
      const d = typeof x === 'number' && typeof y === 'number'
        ? x - y : String(x).localeCompare(String(y), 'it');
      return giu ? -d : d;
    });
    el.innerHTML = `<table class="dtbl"><thead><tr>${colonne
      .map(c => `<th data-k="${esc(c.k)}"${c.num ? ' style="text-align:right"' : ''}>${esc(c.testo)}${
        c.k === chiave ? `<span class="ar">${giu ? '▾' : '▴'}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${ord.map((r, i) => `<tr>${colonne
        .map(c => `<td class="${c.num ? 'num' : ''}">${c.cella ? c.cella(r, i) : esc(valore(r, c) ?? '–')}</td>`)
        .join('')}</tr>`).join('')}</tbody></table>`;
    el.querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (k === chiave) giu = !giu; else { chiave = k; giu = true; }
      disegna();
    }));
  };
  disegna();
}

/** Barra in cella: `v` sul massimo `max`, col colore dato. */
export const barra = (v, max, colore, testo) =>
  `<span class="mb"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%;background:${colore}"></i>
   <span>${esc(testo ?? v)}</span></span>`;

/**
 * L'IDENTITA' DELLE SQUADRE, da UNA tabella sola.
 *
 * Fino al 04/08/2026 qui c'era un dizionario di quattro alias scritto a mano: copriva i casi
 * che avevo visto, e un nome nuovo — una squadra che cambia ragione sociale, un motorista che
 * entra — sarebbe passato inosservato fino al primo grigio in pagina. Il difetto e' silenzioso
 * per costruzione: un nome che non risolve non da' errore, restituisce il colore di riserva.
 *
 * Adesso la tabella e' GENERATA (gen_stat_identita.py -> demo/data/stat/identita.json), si
 * rifa' a ogni gara, e il suo generatore esce 1 se una squadra non trova la livrea. Il
 * canonico e' `team_demo` delle classifiche, scelto perche' misurato che coincide gia' con le
 * chiavi dei colori: non un vocabolario nuovo, ma quello che gia' funzionava, dichiarato.
 *
 * Il ripiego su team_colori.json resta per le pagine piu' vecchie, che la tabella non la
 * caricano: meglio un colore giusto per una via vecchia che nessun colore.
 */
let _identita = null;

export async function identita() {
  if (_identita) return _identita;
  try { _identita = await (await fetch('data/stat/identita.json')).json(); }
  catch (e) { _identita = { alias: {}, squadre: [] }; }
  return _identita;
}

/** I colori squadra. Con la tabella caricata risolve QUALUNQUE alias; senza, il file grezzo. */
export async function coloriTeam() {
  const id = await identita();
  const base = {};
  try { Object.assign(base, await (await fetch('team_colori.json')).json()); } catch (e) {}
  for (const s of id.squadre ?? []) if (s.colore) base[s.canonico] = s.colore;
  // ogni alias punta allo stesso colore: cosi' chi passa «Haas» o «haas» ottiene la livrea
  for (const [a, c] of Object.entries(id.alias ?? {})) if (c && base[c]) base[a] = base[c];
  return base;
}

/** Il nome canonico di una squadra, da qualunque forma. Sincrona: usa la tabella gia' caricata. */
export function normalizzaTeam(nome) {
  return _identita?.alias?.[nome] ?? nome;
}
