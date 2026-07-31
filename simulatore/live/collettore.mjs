// collettore.mjs — 📡 dal feed al contratto cella di Provenienza.
//
// Il vivo NON ha una propria definizione di niente: il collettore mappa i
// record del feed nella cella unica (`creaCella`) e chi vuole sapere se un
// giro è verde IMPORTA la definizione da provenienza/ (E12: il 37% di
// divergenza replay/live del vecchio repo nacque esattamente qui). Questo file
// non contiene la parola "verde" se non in questo commento.
//
// ── NOTE API (verificate 29/07/2026 su openf1.org/docs) ─────────────────────
//  · `pit_duration` è DEPRECATO (rimosso a fine stagione 2026): il feed deve
//    portare `lane_duration` (tempo in corsia) e `stop_duration` (stazionario).
//    Un feed che porta ancora `pit_duration` viene RIFIUTATO rumorosamente:
//    accettarlo oggi significa rompersi in silenzio domani (E18).
//  · `segments` di settore NON esistono durante le gare: nessuna scorciatoia
//    per le bandiere per-auto da lì. Un feed che li porta in gara è malformato.
//  · lo storico 2023+ è gratuito; il realtime è A PAGAMENTO (token OAuth2,
//    scadenza 3600 s): l'harness di replay usa il feed d'archivio, e questo
//    modulo non sa né deve sapere da quale dei due arriva.
//
// ── IL LIMITE, scritto nel modulo e nel risultato (E13) ─────────────────────
// In gara lo stato pista live è TRACK-WIDE: non esistono bandiere per-auto.
// La ricostruzione del verde da stato track-wide è stata MISURATA nel vecchio
// repo, non dichiarata: 84,8% di accordo, 65 falsi verdi, 34,1% delle celle di
// passo oltre 0,10 s. Chi consuma celle in modalità `track_wide` riceve questo
// limite nel risultato e DEVE allargare le proprie bande di conseguenza (il
// calibratore lo fa; la sentinella s19 lo pretende).

import { creaCella } from '../provenienza/contratto.mjs';
import { lava, validaMescola } from '../provenienza/vocabolario.mjs';

export const LIMITE_TRACK_WIDE = Object.freeze({
  targhetta: 'misurato (vecchio repo, live 2026): ricostruzione del verde da stato pista track-wide, finché non esistono bandiere per-auto',
  accordo: 0.848,
  falsi_verdi: 65,
  quota_celle_passo_oltre_soglia: 0.341,
  soglia_scarto_s: 0.10,
  conseguenza: 'ogni numero derivato da celle track_wide porta banda allargata del fattore (1 + quota_celle_passo_oltre_soglia)',
});

const FONTI_STATUS = new Set(['per_auto', 'track_wide']);

/**
 * Dal feed alle celle del contratto.
 *
 * Forma del feed (per-giro + tabelle, in stile OpenF1):
 *   giri:            [{ pilota, giro, durata_s, sessione_s, e_out_lap }]
 *   stint:           [{ pilota, numero, mescola, eta_iniziale, giro_inizio, giro_fine }]
 *   box:             [{ pilota, giro, lane_duration_s, stop_duration_s }]
 *   giri_cancellati: [{ pilota, giro }]
 *   status_per_auto: [{ pilota, giro, status }]   (solo archivio: live non esiste)
 *   stato_pista:     [{ giro, status }]           (track-wide, ciò che il live ha davvero)
 *
 * @returns `{ righe, fonte_status, limite }` — `limite` è null in `per_auto`
 *          (è il dato d'archivio) e LIMITE_TRACK_WIDE in `track_wide`.
 */
export function raccogliCelle(feed, { fonteStatus }) {
  if (!FONTI_STATUS.has(fonteStatus)) {
    throw new Error(`fonteStatus sconosciuta: ${JSON.stringify(fonteStatus)} — ammesse: ${[...FONTI_STATUS].join(', ')}`);
  }
  if (feed === null || typeof feed !== 'object') throw new Error('feed non è un oggetto');
  if (Object.hasOwn(feed, 'segments')) {
    throw new Error('il feed porta `segments`: i segments di settore NON sono disponibili durante le gare (nota API 29/07/2026) — feed malformato');
  }
  for (const nome of ['giri', 'stint', 'box', 'giri_cancellati']) {
    if (!Array.isArray(feed[nome])) throw new Error(`feed senza tabella ${nome}`);
  }
  for (const evento of feed.box) {
    if (Object.hasOwn(evento, 'pit_duration')) {
      throw new Error('il feed porta `pit_duration`, DEPRECATO e rimosso a fine stagione 2026: pretendere `lane_duration` + `stop_duration` (regola 7: rompersi rumorosamente oggi, non in silenzio domani)');
    }
  }
  if (fonteStatus === 'per_auto' && !Array.isArray(feed.status_per_auto)) {
    throw new Error('fonteStatus per_auto ma il feed non porta status_per_auto (in gara live NON esiste: usare track_wide col suo limite)');
  }
  if (fonteStatus === 'track_wide' && !Array.isArray(feed.stato_pista)) {
    throw new Error('fonteStatus track_wide ma il feed non porta stato_pista');
  }

  // indici
  const stintDi = new Map(); // pilota → [stint...]
  for (const s of feed.stint) {
    if (!stintDi.has(s.pilota)) stintDi.set(s.pilota, []);
    stintDi.get(s.pilota).push(s);
  }
  const inLap = new Set(feed.box.map((e) => `${e.pilota}@${e.giro}`));
  const cancellati = new Set(feed.giri_cancellati.map((e) => `${e.pilota}@${e.giro}`));
  const statusPerAuto = fonteStatus === 'per_auto'
    ? new Map(feed.status_per_auto.map((e) => [`${e.pilota}@${e.giro}`, e.status]))
    : null;
  const statoPista = fonteStatus === 'track_wide'
    ? new Map(feed.stato_pista.map((e) => [e.giro, e.status]))
    : null;

  const righe = [];
  for (const record of feed.giri) {
    const { pilota, giro } = record;
    if (typeof pilota !== 'string' || !Number.isInteger(giro)) {
      throw new Error(`record giro malformato: ${JSON.stringify(record)}`);
    }
    const stint = (stintDi.get(pilota) ?? []).find((s) => giro >= s.giro_inizio && giro <= s.giro_fine);
    if (!stint) throw new Error(`${pilota} giro ${giro}: nessuno stint lo copre — il feed stint è incompleto, non si inventa (regola 6)`);
    const etaIniziale = lava(stint.eta_iniziale);
    const chiaveGiro = `${pilota}@${giro}`;
    const status = fonteStatus === 'per_auto'
      ? lava(statusPerAuto.get(chiaveGiro))
      : lava(statoPista.get(giro));

    righe.push({
      drv: pilota,
      lap: giro,
      cella: creaCella({
        lap_time: lava(record.durata_s),
        cum_time: lava(record.sessione_s),
        stint: stint.numero,
        compound: validaMescola(lava(stint.mescola)),
        tyre_age: etaIniziale === null ? null : etaIniziale + (giro - stint.giro_inizio),
        in_lap: inLap.has(chiaveGiro),
        out_lap: record.e_out_lap === true,
        status: status === null ? null : String(status),
        del: cancellati.has(chiaveGiro),
      }),
    });
  }

  return {
    righe,
    fonte_status: fonteStatus,
    limite: fonteStatus === 'track_wide' ? LIMITE_TRACK_WIDE : null,
  };
}
