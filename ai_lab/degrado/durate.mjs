// durate.mjs — LO STINT CONCLUSO DA UNA SOSTA, e quanto e' durato: una regola sola,
// applicata al 2026 e al fondo 2018-2025.
//
// Non e' uno script: non stampa e non esegue niente all'import.
//
// PERCHE' ESISTE. La regola «uno stint concluso da una sosta e' una decisione sulla gomma,
// l'ultimo stint no perche' e' la gara che finisce» viveva dentro decisioni.mjs, scritta per
// il 2026. Il lavoro n. 1 del PO (PREREG_vita_per_circuito.md) chiede la stessa cosa su otto
// stagioni di fondo: o la regola sale in un posto solo, o nascono due perimetri che si
// somigliano abbastanza da non accorgersene. E' la forma esatta di E12, e il progetto l'ha
// gia' pagata una volta al 37%.
//
// Prereg: ai_lab/degrado/PREREG_vita_per_circuito.md — perimetro §3, esclusioni §3.1,
// mappa delle piste §3.2.

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { garaAsciutta } from '../../simulatore/provenienza/definizioni.mjs';
import { MESCOLE_SLICK, simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

/**
 * OGNI STINT CONCLUSO DA UNA SOSTA, con la gomma che portava e quanto e' durato.
 *
 * PURA: prende l'indice per pilota che qualcun altro ha gia' costruito, non tocca il disco.
 *
 * SI ESCLUDE L'ULTIMO STINT DI OGNI PILOTA, e non e' un dettaglio: quello non e' una
 * decisione sulla gomma — e' la gara che e' finita. Tenerlo significherebbe chiedere al
 * modello di prevedere la lunghezza della gara, non la vita del pneumatico.
 *
 * LA DURATA E' IL MASSIMO DELL'ETA' GOMMA sullo stint, non il numero di giri percorsi: e'
 * la stessa grandezza che il motore confronta con `vita`, e comprende i giri che il set
 * aveva gia' addosso (una soft usata in qualifica non nasce a zero). Definirla come conta
 * dei giri darebbe un numero diverso da quello che il modello usa, che e' il modo piu'
 * silenzioso di sbagliare.
 *
 * Restituisce anche lo `status` GREZZO del giro della sosta e di quello prima: il perimetro
 * si decide altrove (`nelPerimetro`), qui si raccoglie la materia prima. Chi raccoglie non
 * filtra.
 */
export function stintConclusi(perPilota, meta = {}) {
  const fuori = [];
  for (const [drv, celle] of perPilota) {
    const ord = [...celle].sort((a, b) => a[0] - b[0]);
    let stint = null; let eta = null; let mescola = null; let giroInizio = null;
    let statusUltimo = null; let statusPenultimo = null;
    for (const [lap, c] of ord) {
      if (c.stint !== stint) {
        if (stint !== null) {
          fuori.push({
            ...meta,
            drv,
            mescola,
            durata: eta,
            giro_inizio: giroInizio,
            giro_sosta: lap - 1,
            status_sosta: statusUltimo,
            status_prima: statusPenultimo,
          });
        }
        stint = c.stint; eta = null; mescola = c.compound; giroInizio = lap;
        statusUltimo = null; statusPenultimo = null;
      }
      if (Number.isFinite(c.tyre_age)) eta = Math.max(eta ?? 0, c.tyre_age);
      statusPenultimo = statusUltimo;
      statusUltimo = c.status;
    }
    // l'ultimo stint NON entra: finisce con la bandiera, non con una decisione
  }
  return fuori;
}

// ── il perimetro, e i suoi motivi di scarto ─────────────────────────────────

/** Lo status contiene Safety Car (4) o bandiera rossa (5)? `null` se non si sa. */
function scOrRossa(status) {
  if (status === null) return null;
  const s = simboliStatus(status);
  return s.has('4') || s.has('5');
}

/**
 * IL PERIMETRO DI PREREG_vita_per_circuito.md §3, e le sue esclusioni §3.1.
 *
 * Restituisce `null` se lo stint e' dentro, altrimenti la STRINGA del motivo per cui e'
 * fuori — cosi' chi chiama puo' contarli tutti. Un'esclusione silenziosa e un dato pulito
 * si somigliano troppo (E24).
 *
 * IL VSC NON C'E', ed e' la parte decisa prima e scomoda: `R_lap` del regime VSC vale 1,055
 * pooled, il progetto ha una direttiva scritta che vieta di costruirci sopra, e costruirci
 * un'esclusione sarebbe costruirci sopra — si butterebbero stint buoni sulla parola di un
 * sensore che sappiamo mentire. Restano dentro le soste opportunistiche sotto VSC:
 * contaminazione residua e DICHIARATA, non rimossa.
 *
 * `finestra`: 1 = solo il giro della sosta (il cancello); 2 = anche quello prima (la
 * robustezza §9.3). Nient'altro: una finestra scelta dopo aver visto i numeri sarebbe la
 * scelta del perimetro che la prereg esiste per impedire.
 */
export function nelPerimetro(d, { finestra = 1 } = {}) {
  if (d.mescola === null) return 'mescola assente';
  if (!MESCOLE_SLICK.has(d.mescola)) return 'mescola da bagnato';
  if (d.durata === null) return 'eta gomma assente su tutto lo stint';
  if (d.durata <= 0) return 'durata nulla';
  const sosta = scOrRossa(d.status_sosta);
  if (sosta === null) return 'status assente sul giro della sosta';
  if (sosta) return 'sosta sotto SC o bandiera rossa';
  if (finestra >= 2) {
    const prima = scOrRossa(d.status_prima);
    if (prima === null) return 'status assente sul giro prima della sosta';
    if (prima) return 'giro prima della sosta sotto SC o bandiera rossa';
  }
  return null;
}

// ── la mappa delle piste (prereg §3.2) ──────────────────────────────────────

/**
 * NOME DELLA GARA NEL FONDO → IDENTITA' DELLA PISTA.
 *
 * Si mappa LA PISTA, non il nome. Otto anni di calendari hanno nomi che cambiano mentre
 * l'asfalto resta (Styrian e' il Red Bull Ring, 70th Anniversary e' Silverstone, Brazilian
 * e Sao Paulo sono Interlagos) e un nome che cambia mentre cambia anche l'asfalto: Sakhir
 * 2020 e' il layout OUTER del Bahrain, cioe' un'altra pista, e resta un'identita' a se'.
 *
 * Le undici piste del 2026 portano il nome canonico italiano (quello che il motore usa);
 * Zandvoort porta `Olanda`, che e' il nome del round 12. Le altre restano com'erano: al
 * livello di stagione servono tutte, perche' e' su tutte che si misura quanto e' lunga una
 * gomma quell'anno.
 *
 * Una gara NON in questa mappa fa fallire la costruzione: niente mappe parziali silenziose.
 */
export const PISTA_DI = Object.freeze({
  'Australian Grand Prix': 'Australia',
  'Chinese Grand Prix': 'Cina',
  'Japanese Grand Prix': 'Giappone',
  'Miami Grand Prix': 'Miami',
  'Canadian Grand Prix': 'Canada',
  'Monaco Grand Prix': 'Monaco',
  'Spanish Grand Prix': 'Spagna',
  'Austrian Grand Prix': 'Austria',
  'Styrian Grand Prix': 'Austria',
  'British Grand Prix': 'GranBretagna',
  '70th Anniversary Grand Prix': 'GranBretagna',
  'Belgian Grand Prix': 'Belgio',
  'Hungarian Grand Prix': 'Ungheria',
  'Dutch Grand Prix': 'Olanda',
  // fuori dal perimetro 2026, ma dentro il livello di stagione
  'Abu Dhabi Grand Prix': 'AbuDhabi',
  'Azerbaijan Grand Prix': 'Baku',
  'Bahrain Grand Prix': 'Bahrain',
  'Sakhir Grand Prix': 'BahrainOuter',
  'Brazilian Grand Prix': 'Interlagos',
  'São Paulo Grand Prix': 'Interlagos',
  'Eifel Grand Prix': 'Nurburgring',
  'Emilia Romagna Grand Prix': 'Imola',
  'French Grand Prix': 'PaulRicard',
  'German Grand Prix': 'Hockenheim',
  'Italian Grand Prix': 'Monza',
  'Las Vegas Grand Prix': 'LasVegas',
  'Mexican Grand Prix': 'CittaDelMessico',
  'Mexico City Grand Prix': 'CittaDelMessico',
  'Portuguese Grand Prix': 'Portimao',
  'Qatar Grand Prix': 'Lusail',
  'Russian Grand Prix': 'Sochi',
  'Saudi Arabian Grand Prix': 'Gedda',
  'Singapore Grand Prix': 'Singapore',
  'Turkish Grand Prix': 'Istanbul',
  'Tuscan Grand Prix': 'Mugello',
  'United States Grand Prix': 'Austin',
});

/** Le undici piste del 2026 in demo, piu' Zandvoort: quelle a cui serve un fattore. */
export const PISTE_2026 = Object.freeze([
  'Australia', 'Cina', 'Giappone', 'Miami', 'Canada', 'Monaco',
  'Spagna', 'Austria', 'GranBretagna', 'Belgio', 'Ungheria',
]);
export const PISTA_ZANDVOORT = 'Olanda';

// ── il fondo ────────────────────────────────────────────────────────────────

// Sei gare del 2019 non hanno le colonne dell'identita', dello stint, dell'eta' e dello
// status: senza quelle non esiste uno stint da misurare. Si escludono DICHIARANDOLE, e se
// il conto salisse oltre il noto la funzione fallisce — un'esclusione che cresce in
// silenzio e' un inventario parziale (E24). Il numero e' quello gia' misurato da
// esporta_stint_fondo.mjs, non una soglia nuova.
const MAX_GARE_ESCLUSE = 6;

/**
 * Tutti gli stint conclusi da una sosta del fondo 2018-2025, GREZZI: il perimetro non e'
 * ancora applicato (lo applica `nelPerimetro`). Le gare bagnate invece escono qui, perche'
 * sono un fatto della gara e non dello stint.
 */
export function durateFondo(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const righe = [];
  const gareEscluse = [];
  const gareBagnate = [];
  let gareLette = 0;

  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      const pista = PISTA_DI[gara];
      if (!pista) throw new Error(`gara del fondo non mappata a una pista: ${anno}/${gara} — niente mappe parziali (E24)`);
      let adattate;
      try {
        adattate = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` });
      } catch (e) {
        gareEscluse.push({ anno, gara, motivo: e.message });
        continue;
      }
      gareLette += 1;
      if (!garaAsciutta(adattate.righe)) { gareBagnate.push(`${anno}/${gara}`); continue; }

      const perPilota = new Map();
      for (const { drv, lap, cella } of adattate.righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
      }
      righe.push(...stintConclusi(perPilota, { anno: Number(anno), gara, pista }));
    }
  }

  if (gareEscluse.length > MAX_GARE_ESCLUSE) {
    throw new Error(`gare escluse ${gareEscluse.length} > ${MAX_GARE_ESCLUSE} noto: e' sistemico, non il solito buco del 2019\n`
      + gareEscluse.map((g) => `${g.anno}/${g.gara}: ${g.motivo}`).join('\n'));
  }
  return { righe, gareLette, gareEscluse, gareBagnate };
}

export const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
