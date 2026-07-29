// SCENARIO / COSTRUTTORE — il costruttore di scenari UNICO (E17: due fisiche
// per due risposte adiacenti, mai più). Ogni risposta del prodotto — "e se mi
// fermo al giro L?", la curva del quando, la posizione di rientro — passa da
// QUESTE funzioni, che passano tutte dallo STESSO kernel.
//
// Nei percorsi a congelamento entra solo informazione ≤ Lf (E14): il regime
// per lo sconto di neutralizzazione è quello osservato AL congelamento, che
// il chiamante ricava da provenienza/contratto.mjs sulla cella di Lf — mai
// una tabella costruita a gara finita.
import { simula } from '../engine/kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

export function caricaPriors() {
  return JSON.parse(readFileSync(join(RADICE, 'data', 'priors', 'pitloss_priors.json'), 'utf8'));
}

// perdita di sosta effettiva per circuito e regime AL CONGELAMENTO.
// regime: null (verde/ignoto) | 'SC' | 'VSC'. Ogni numero esce con targhetta.
export function perditaSostaEffettiva({ cid, regime = null, priors = caricaPriors() }) {
  const verde = priors.pit_loss_verde_s[cid] ?? null;
  const valoreVerde = verde ?? priors.mediana_era_s;
  const natura = verde !== null
    ? `prior esterno misurato, circuito ${cid}`
    : `prior esterno, mediana era (nessun prior per ${cid})`;
  if (regime === null) {
    return { valore: valoreVerde, banda: null, targhetta: { natura, data: priors.targhetta.data } };
  }
  const fattore = priors.fattori_neutralizzazione[regime];
  if (!fattore) throw new Error(`regime sconosciuto: ${regime} (leciti: SC, VSC, null)`);
  return {
    valore: valoreVerde * fattore.fattore,
    banda: fattore.banda.map(f => valoreVerde * f),
    targhetta: { natura: `${natura} × fattore ${regime} (prior esterno con banda)`, data: priors.targhetta.data },
  };
}

// "e se mi fermo al giro L?" — un solo kernel, due corse: senza sosta e con.
// delta > 0: la sosta costa; delta < 0: la sosta rende.
export function confrontaSosta({ griglia, pilota, Lf, giriTotali, par, giroSosta, perditaSosta }) {
  const piano = { [pilota]: { giroSosta, perditaSosta } };
  const senza = simula({ griglia, Lf, giriTotali, par, piani: {} });
  const con = simula({ griglia, Lf, giriTotali, par, piani: piano });
  if (!senza.ok || !con.ok) throw new Error(`scenario rifiutato: ${senza.motivo ?? con.motivo}`);
  if (con.cum[pilota] === null) {
    return { delta: null, posizioneRientro: null, cumCon: con.cum, cumSenza: senza.cum };
  }
  // posizione di rientro: la classifica alla fine dell'in-lap, stessa fisica
  // (il kernel corre fino a giroSosta, perdita pagata)
  const rientro = simula({ griglia, Lf, giriTotali: giroSosta, par, piani: piano });
  return {
    delta: con.cum[pilota] - senza.cum[pilota],
    posizioneRientro: rientro.ordine.indexOf(pilota) + 1,
    cumCon: con.cum,
    cumSenza: senza.cum,
  };
}

// la curva del "quando conviene": delta per ogni giro di sosta possibile,
// COSTRUITA con confrontaSosta — la stessa fisica del singolo confronto
export function curvaQuandoConviene({ griglia, pilota, Lf, giriTotali, par, perditaSosta }) {
  const curva = [];
  for (let giroSosta = Lf + 1; giroSosta <= giriTotali; giroSosta++) {
    const esito = confrontaSosta({ griglia, pilota, Lf, giriTotali, par, giroSosta, perditaSosta });
    curva.push({ giroSosta, delta: esito.delta });
  }
  return curva;
}
