// s18_parita_live — replay e live producono gli STESSI numeri (il test di
// parità, rinato pulito dopo il 37% di divergenza di E12).
//
// Il percorso replay è adattatore→celle; il percorso live è feed→collettore→
// celle. Sono DUE codici diversi su DUE forme diverse degli stessi dati (il
// colonnare d'archivio contro il feed per-giro con tabelle stint/box/cancellati
// in stile OpenF1): la parità non è un confronto di un modulo con se stesso.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) su una qualunque delle 11 gare 2026, una cella del percorso live
//      differisce dal percorso replay in UNO dei 9 campi del contratto — età
//      sbagliata di uno, out-lap perso, giro cancellato ignorato, mescola
//      diversa: ognuno è il seme di una nuova divergenza replay/live;
//  (b) i conteggi verdi/neutralizzati del percorso live non coincidono con la
//      baseline golden di ricostruzione (gli "stessi numeri" della missione);
//  (c) il collettore accetta un feed col campo DEPRECATO `pit_duration`
//      invece di pretendere `lane_duration`+`stop_duration` (nota API OpenF1:
//      rimosso a fine stagione 2026 — accettarlo oggi significa rompersi in
//      silenzio domani), o accetta `segments` in gara (non esistono);
//  (d) in modalità track_wide il risultato NON porta il limite misurato
//      (84,8% accordo · 65 falsi verdi · 34,1% celle oltre 0,10 s), oppure
//      produce gli stessi conteggi del per-auto su una gara dove gli status
//      divergono — il che vorrebbe dire che il limite dichiarato non esiste
//      nel codice, solo nei commenti (E13);
//  (e) il feed d'archivio contiene informazione dal futuro: il feed troncato a
//      Lf deve essere identico al feed intero troncato dopo (E14/E15).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { verde, regimeNeutralizzato } from '../../provenienza/definizioni.mjs';
import { raccogliCelle, LIMITE_TRACK_WIDE } from '../../live/collettore.mjs';
import { feedDaGara } from '../../live/feed_archivio.mjs';

const b = banco('s18');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const golden = JSON.parse(readFileSync(path.join(radice, 'banco', 'golden', 'ricostruzione_2026.json'), 'utf8'));
const gare = caricaGare2026(radice);

const chiave = (r) => `${r.drv}@${r.lap}`;
const ordina = (righe) => [...righe].sort((x, y) => (chiave(x) < chiave(y) ? -1 : 1));

// (a) + (b) parità cella per cella, su tutte le gare
for (const [nome, gara] of Object.entries(gare)) {
  const feed = feedDaGara(gara);
  const live = raccogliCelle(feed, { fonteStatus: 'per_auto' });
  const replay = ordina(gara.righe.map(({ drv, lap, cella }) => ({ drv, lap, cella })));
  const vive = ordina(live.righe);

  b.uguale(`${nome}: stesso numero di celle`, vive.length, replay.length);
  let divergenti = 0;
  let esempio = null;
  for (let i = 0; i < Math.min(vive.length, replay.length); i += 1) {
    if (JSON.stringify(vive[i]) !== JSON.stringify(replay[i])) {
      divergenti += 1;
      if (!esempio) esempio = { live: vive[i], replay: replay[i] };
    }
  }
  b.verifica(`${nome}: ZERO celle divergenti fra live e replay${divergenti ? ` (${divergenti}; es. ${JSON.stringify(esempio)})` : ''}`, divergenti === 0);

  let verdi = 0;
  let neutre = 0;
  for (const { cella } of vive) {
    if (verde(cella)) verdi += 1;
    if (regimeNeutralizzato(cella)) neutre += 1;
  }
  b.uguale(`${nome}: verdi del percorso live = baseline golden`, verdi, golden.gare[nome].verdi);
  b.uguale(`${nome}: neutralizzate del percorso live = baseline golden`, neutre, golden.gare[nome].neutralizzate);
}

// (c) le guardie API
{
  const feed = feedDaGara(gare.Miami);
  const conPitDuration = { ...feed, box: feed.box.map((e) => ({ pilota: e.pilota, giro: e.giro, pit_duration: 21.3 })) };
  b.esplode('un feed con `pit_duration` (deprecato) è rifiutato rumorosamente', () => raccogliCelle(conPitDuration, { fonteStatus: 'per_auto' }));
  b.esplode('un feed con `segments` in gara è rifiutato', () => raccogliCelle({ ...feed, segments: [] }, { fonteStatus: 'per_auto' }));
  b.esplode('fonteStatus per_auto senza status per-auto: rifiutato', () => raccogliCelle({ ...feed, status_per_auto: undefined }, { fonteStatus: 'per_auto' }));
  b.esplode('fonteStatus sconosciuta: rifiutata', () => raccogliCelle(feed, { fonteStatus: 'telepatia' }));
}

// (d) il limite track-wide è nel risultato, e morde davvero
{
  // Miami ha status non uniformi fra i piloti (misurato al P01: 18,4% dei giri
  // di gara): proiettare lo stato di pista su tutte le auto DEVE cambiare i
  // conteggi rispetto al per-auto.
  const feed = feedDaGara(gare.Miami);
  const trackWide = raccogliCelle(feed, { fonteStatus: 'track_wide' });
  b.uguale('track_wide: il risultato porta il limite misurato', trackWide.limite, LIMITE_TRACK_WIDE);
  b.verifica('il limite dichiara accordo 84,8%', LIMITE_TRACK_WIDE.accordo === 0.848);
  b.verifica('il limite dichiara 65 falsi verdi', LIMITE_TRACK_WIDE.falsi_verdi === 65);
  b.verifica('il limite dichiara 34,1% celle oltre 0,10 s', LIMITE_TRACK_WIDE.quota_celle_passo_oltre_soglia === 0.341);
  let verdiTW = 0;
  for (const { cella } of trackWide.righe) if (verde(cella)) verdiTW += 1;
  b.verifica(`track_wide su Miami produce verdi DIVERSI dal per-auto (${verdiTW} contro ${golden.gare.Miami.verdi}): il limite esiste nel codice, non solo nei commenti`,
    verdiTW !== golden.gare.Miami.verdi);
  b.uguale('per_auto: nessun limite da dichiarare (è il dato d\'archivio)', raccogliCelle(feed, { fonteStatus: 'per_auto' }).limite, null);
}

// (e) il feed d'archivio non porta futuro: troncare prima = troncare dopo
{
  const Lf = 30;
  const feedTroncato = feedDaGara(gare.Ungheria, { finoA: Lf });
  const feedIntero = feedDaGara(gare.Ungheria);
  const taglia = (feed) => ({
    giri: feed.giri.filter((g) => g.giro <= Lf),
    stint: feed.stint.map((s) => ({ ...s, giro_fine: Math.min(s.giro_fine, Lf) })).filter((s) => s.giro_inizio <= Lf),
    box: feed.box.filter((e) => e.giro <= Lf),
    giri_cancellati: feed.giri_cancellati.filter((e) => e.giro <= Lf),
    status_per_auto: feed.status_per_auto.filter((e) => e.giro <= Lf),
    stato_pista: feed.stato_pista.filter((e) => e.giro <= Lf),
  });
  b.uguale('feed troncato a Lf = feed intero tagliato a posteriori (E14)', feedTroncato, taglia(feedIntero));
  b.verifica('...e il taglio toglie davvero qualcosa', feedTroncato.giri.length < feedIntero.giri.length);
}

b.chiudi();
