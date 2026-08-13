// gomma.mjs — QUANTO VALE LA GOMMA NUOVA, in un posto solo (regola 1).
//
// Due domande che il muretto fa sempre, e che fino al 13/08/2026 la pagina non sapeva
// rispondere:
//   1. quanto vado PIU' FORTE al giro, se monto adesso;
//   2. per QUANTI GIRI quel vantaggio regge, con la mescola che scelgo.
//
// PERCHE' STA IN UN MODULO SUO E NON IN ponte_live.mjs. Il ponte tira dentro tutta la
// catena del simulatore (costruttore, kernel, provenienza): dodici richieste e 72 KB, che
// gara.html carica apposta con un import DINAMICO per non pagarli a chi guarda solo il
// replay. Ma queste due risposte servono al PRIMO fotogramma del pannello. Qui dipendono
// dalla sola `passo_v2.mjs`, che e' una foglia senza import: il pannello le ha subito e la
// pagina resta leggera. `ponte_live.mjs` le ri-esporta, cosi' la definizione resta una.
//
// NON E' UNA SECONDA FISICA (E17). E' la stessa `creaPasso` del kernel, valutata due volte
// con gli stessi sigilli:
//
//     passo(pilota, giro, eta, mescola) = base + deriva*(giro-1)
//                                       + rho*eta + w(eta) + q(eta) + rho*oltre(eta, mescola)
//
// `base` e `deriva*(giro-1)` dipendono da pilota e giro, che nel confronto sono gli STESSI:
// si cancellano, e restano i soli termini della gomma. Per questo il numero non richiede di
// stimare le basi — la parte cara della costruzione di uno scenario — e si puo' calcolare a
// ogni fotogramma senza far girare il motore.

import { creaRodaggio, creaCliff, creaVita } from './vendor/simulatore/motore/engine/passo_v2.mjs';

/** La vita della mescola in giri, col fattore di circuito se il sigillo ce l'ha. */
function vitaDi(contestoLive, nomeGara) {
  const vm = contestoLive?.vitaMescola ?? contestoLive?.modello?.vita_mescola;
  if (vm?.attivo !== true || !vm.giri) return null;
  const f = vm.fattore_circuito?.[nomeGara] ?? 1;
  return Object.fromEntries(Object.entries(vm.giri).map(([m, g]) => [m, g * f]));
}

/**
 * QUANTO VADO PIU' FORTE AL GIRO montando gomma nuova adesso.
 * @returns {number|null} secondi al giro guadagnati (positivo = vai piu' forte); null se il
 *          modello o l'eta' non ci sono — non si finge un guadagno (regola 6).
 */
export function guadagnoAlGiro({ contestoLive, nomeGara, etaOra, mescolaOra,
                                 mescolaNuova, etaNuova = 1 }) {
  const modello = contestoLive?.modello;
  const rho = modello?.rho?.valore;
  if (typeof rho !== 'number' || typeof etaOra !== 'number' || !mescolaNuova) return null;
  const w = creaRodaggio(modello.rodaggio?.attivo === true
    ? { c: modello.rodaggio.c, tau: modello.rodaggio.tau } : null);
  const q = creaCliff(modello.cliff?.attivo === true ? { kappa: modello.cliff.kappa } : null);
  const oltre = creaVita(vitaDi(contestoLive, nomeGara));
  const costo = (eta, mesc) => rho * eta + w(eta) + q(eta) + rho * oltre(eta, mesc);
  return costo(etaOra, mescolaOra) - costo(etaNuova, mescolaNuova);
}

/**
 * QUANTI GIRI TIENE questa mescola prima di cominciare a costare il doppio.
 *
 * Va sempre accanto al guadagno, e non e' un ornamento: nel modello il guadagno immediato
 * della gomma nuova NON dipende dalla mescola (a eta' 1 nessuna e' oltre la sua vita, quindi
 * il termine si annulla per tutte e tre). Cio' che la mescola decide e' QUANTO DURA — SOFT
 * 12, MEDIUM 19, HARD 22 giri. Mostrare tre volte lo stesso guadagno senza dire questo
 * farebbe sembrare il selettore quello che era: un comando che non cambia niente.
 *
 * Natura del numero, dichiarata dal sigillo stesso: PRIOR COMPORTAMENTALE — e' la vita che i
 * team SCELGONO, ricavata da 427 decisioni del 2026, non la durata fisica del pneumatico.
 *
 * @returns {number|null} giri, oppure null se la vita non e' accesa o la mescola non c'e'.
 */
export function vitaMescolaGiri({ contestoLive, nomeGara, mescola }) {
  const v = vitaDi(contestoLive, nomeGara);
  const g = v?.[mescola];
  return typeof g === 'number' ? g : null;
}
