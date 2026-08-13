// muretto_worker.mjs — IL MOTORE FUORI DAL THREAD CHE DISEGNA.
//
// PERCHE'. `rispostaLive` costa 244 ms mediani (misurati, 216-267 su sei chiamate): e' il
// costo di costruire uno scenario e cercare il piano ottimo, ed e' onesto. Ma sul thread
// principale sono 244 ms in cui non si disegna niente — a 20x un giro passa ogni 4,25 s,
// quindi il 6% del tempo la mappa sta ferma, e a 60x il 17%. Era una delle cause vere degli
// «scatti», e per questo il ramo che lo chiamava a ogni giro e' stato tolto il 13/08.
//
// Toglierlo pero' lasciava il pannello con le sole risposte PRE-CALCOLATE, cioe' quelle
// della gara VERA: dal primo BOX ORA in poi il pannello rispondeva su una gara che il
// giocatore aveva appena cancellato. Il motore non era troppo lento — era nel posto
// sbagliato.
//
// Qui gira in un Worker: il thread principale chiede e continua a disegnare, la risposta
// arriva quando arriva. Il motore non tocca il DOM (gira in Node da sempre), quindi si
// trasporta cosi' com'e'.
//
// IL PROTOCOLLO, tenuto volutamente stupido:
//   -> {id, tipo:'contesto', contesto}                        una volta, all'apertura
//   -> {id, tipo:'risposta', byLap, nGiri, gara, pilota, freezeLap, mescola}
//   <- {id, ok:true, risposta} | {id, ok:false, errore}
// L'`id` serve a buttare via le risposte vecchie: se nel frattempo la barra e' andata
// avanti, quella risposta e' di un'altra domanda (stessa ragione della chiave in
// aggiornaStrategia). Chi chiede tiene l'ultimo id e ignora il resto.

import { rispostaLive } from './ponte_live.mjs?v=130826a';

let CTX = null;

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.tipo === 'contesto') { CTX = m.contesto; self.postMessage({ id: m.id, ok: true }); return; }
  if (m.tipo !== 'risposta') return;
  if (!CTX) { self.postMessage({ id: m.id, ok: false, errore: 'contesto non ancora ricevuto' }); return; }
  try {
    const r = rispostaLive({
      byLap: m.byLap, nGiriGara: m.nGiri, nomeGara: m.gara,
      pilota: m.pilota, freezeLap: m.freezeLap,
      contestoLive: CTX, mescolaScelta: m.mescola ?? null,
    });
    self.postMessage({ id: m.id, ok: true, risposta: r });
  } catch (e) {
    // un rifiuto e' una risposta (regola 6): non si finge un pannello
    self.postMessage({ id: m.id, ok: false, errore: String(e && e.message ? e.message : e) });
  }
};
