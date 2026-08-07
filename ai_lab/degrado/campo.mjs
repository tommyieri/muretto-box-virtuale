// campo.mjs — IL DEGRADO LETTO DAL CAMPO, con due effetti fissi.
//
// Non e' uno script: non stampa e non esegue niente all'import.
// Prereg: ai_lab/degrado/PREREG_degrado_dal_campo.md.
//
// L'IDEA IN UNA RIGA. A un giro fissato venti auto condividono lo stesso stato pista, lo
// stesso carburante bruciato e lo stesso meteo: cio' che le distingue e' l'eta' della gomma.
// Quindi l'evoluzione non si modella — si TOGLIE, insieme a tutto il resto di cio' che e'
// comune a quel giro.
//
//     t(pilota, giro) = alpha(pilota) + gamma(giro) + rho(mescola)*eta + errore
//
// `alpha` assorbe auto e guida; `gamma` assorbe carburante, evoluzione, temperatura,
// neutralizzazioni e qualunque altra cosa comune a quel momento — ed e' NON PARAMETRICO:
// non si assume nessuna forma per l'evoluzione, la si elimina. E' il pezzo che il tentativo
// LONGITUDINALE (primi-15-giri, chiuso NULL) non poteva avere, perche' seguendo la stessa
// auto nel tempo degrado ed evoluzione si sommano e non si separano.
//
// COME SI STIMA, senza librerie e senza dipendenze nuove: proiezioni alternate. Si tolgono
// a turno le medie per pilota e per giro da tutte le colonne (il tempo e le colonne
// dell'eta' per mescola) finche' non si muovono piu'; su cio' che resta si risolve un
// sistema piccolo — tre incognite, una per mescola — coi minimi quadrati normali. E'
// esattamente cio' che farebbe una regressione con due insiemi di variabili indicatrici.

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';

const SIM = path.join(RADICE, 'simulatore');
export const MESCOLE = ['SOFT', 'MEDIUM', 'HARD'];
const SLICK = new Set(MESCOLE);

/** Le osservazioni utilizzabili di una gara: un giro verde, con eta' e mescola slick. */
export function osservazioni(g) {
  const out = [];
  for (const [drv, celle] of g.perPilota) {
    for (const [lap, c] of celle) {
      if (!passoUtilizzabile(c)) continue;
      if (c.tyre_age === null || !Number.isFinite(c.tyre_age)) continue;
      if (!SLICK.has(c.compound)) continue;
      // `stint` viaggia con l'osservazione dal 05/08/2026: serve a PREREG_rho_selezione.md,
      // che permuta le LUNGHEZZE degli stint per rompere la selezione senza toccare la
      // curvatura. Senza, tutti i giri di un pilota sarebbero un blocco solo e il placebo
      // non avrebbe niente da permutare. Nessuno stimatore lo legge: `degradoDi` usa
      // eta/t/mescola/drv/lap e ignora il resto, quindi i numeri gia' pubblicati non si
      // muovono — verificato rilanciando cancelli_campo.mjs.
      out.push({ drv, lap, eta: c.tyre_age, mescola: c.compound, t: c.lap_time, stint: c.stint });
    }
  }
  return out;
}

/**
 * DOPPIA SOTTRAZIONE. Toglie a turno la media per pilota e la media per giro, finche' non
 * si muovono piu'. `colonne` e' un elenco di funzioni che estraggono il valore da togliere.
 *
 * Il criterio di arresto e' dichiarato e non generoso: si ferma quando lo spostamento
 * massimo scende sotto 1e-10 o dopo 200 passate. Se servissero piu' di 200 passate su
 * questi dati, qualcosa non sarebbe la doppia sottrazione.
 */
export function sottraiDueVolte(righe, valori) {
  const X = righe.map((r) => valori.map((f) => f(r)));
  const drv = righe.map((r) => r.drv);
  const lap = righe.map((r) => r.lap);
  const k = valori.length;
  for (let passata = 0; passata < 200; passata += 1) {
    let mosso = 0;
    for (const chiave of [drv, lap]) {
      const somma = new Map(); const conto = new Map();
      for (let i = 0; i < X.length; i += 1) {
        const c = chiave[i];
        if (!somma.has(c)) { somma.set(c, new Array(k).fill(0)); conto.set(c, 0); }
        const s = somma.get(c);
        for (let j = 0; j < k; j += 1) s[j] += X[i][j];
        conto.set(c, conto.get(c) + 1);
      }
      for (let i = 0; i < X.length; i += 1) {
        const c = chiave[i]; const s = somma.get(c); const n = conto.get(c);
        for (let j = 0; j < k; j += 1) { const d = s[j] / n; X[i][j] -= d; mosso = Math.max(mosso, Math.abs(d)); }
      }
    }
    if (mosso < 1e-10) break;
  }
  return X;
}

/** Minimi quadrati su una matrice piccola (k <= 4), per eliminazione di Gauss. */
function minimiQuadrati(X, y) {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i += 1) {
    for (let a = 0; a < k; a += 1) {
      for (let b = 0; b < k; b += 1) A[a][b] += X[i][a] * X[i][b];
      A[a][k] += X[i][a] * y[i];
    }
  }
  for (let c = 0; c < k; c += 1) {
    let piv = c;
    for (let r = c + 1; r < k; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;       // rango non pieno: regola 6, niente pinv silenziosa (E10)
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < k; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let b = c; b <= k; b += 1) A[r][b] -= f * A[c][b];
    }
  }
  return A.map((riga, c) => riga[k] / riga[c]);
}

const devStd = (v) => {
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1));
};

/**
 * Il degrado di UNA gara: rho per mescola, e la forza dell'identificazione.
 *
 * `perMescola = false` stima un solo rho comune (serve a D1 e come metro in D2).
 * Torna anche `identificazione`: la deviazione standard dell'eta' DOPO la doppia
 * sottrazione — se e' piccola, `gamma(giro)` ha gia' assorbito l'eta' e rho non esiste.
 * E' il cancello D0, e viene prima di leggere qualunque altra cosa.
 */
export function degradoDi(righe, { perMescola = true } = {}) {
  if (righe.length < 50) return { n: righe.length, motivo: 'meno di 50 osservazioni', rho: null };
  const colonne = perMescola
    ? MESCOLE.map((m) => (r) => (r.mescola === m ? r.eta : 0))
    : [(r) => r.eta];
  const X = sottraiDueVolte(righe, [...colonne, (r) => r.t]);
  const k = colonne.length;
  const A = X.map((riga) => riga.slice(0, k));
  const y = X.map((riga) => riga[k]);
  // D0: quanta eta' resta dopo aver tolto pilota e giro
  const etaSola = sottraiDueVolte(righe, [(r) => r.eta]).map((x) => x[0]);
  const identificazione = devStd(etaSola);
  const beta = minimiQuadrati(A, y);
  if (beta === null) return { n: righe.length, motivo: 'rango non pieno', rho: null, identificazione };
  const rho = perMescola
    ? Object.fromEntries(MESCOLE.map((m, i) => [m, beta[i]]))
    : beta[0];
  return { n: righe.length, rho, identificazione, per_mescola: perMescola };
}

/** Le osservazioni di ogni gara 2026, gia' filtrate. */
export function campo2026() {
  const gare = caricaGare2026(SIM);
  const out = {};
  for (const [nome, g] of Object.entries(gare)) out[nome] = { righe: osservazioni(g), nGiri: g.nGiri };
  return out;
}
