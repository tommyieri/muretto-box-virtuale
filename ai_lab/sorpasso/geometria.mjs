// geometria.mjs — L'INDICE DI SORPASSO LETTO DALLA FORMA DELLA PISTA.
//
// Non e' uno script: non stampa e non esegue niente all'import.
//
// PERCHE' ESISTE, E PERCHE' NON E' IL QUARTO TENTATIVO DI UN RAMO CHIUSO.
//
// La sorpassabilita' e' stata chiusa NULL tre volte, e la regola di casa dice che un NULL
// onorato non si riapre nella stessa forma. Ma dice anche che si riapre con una FONTE
// NUOVA — e qui c'e': la GEOMETRIA della pista, 500 punti per circuito, mai usata prima.
// I tre tentativi precedenti poggiavano su un CSV `difficolta_sorpasso` che il progetto ha
// dichiarato ORFANO e non fidato (nessun generatore committato): questa e' la prima volta
// che l'indice viene calcolato da un dato pinnato e verificabile invece che ricevuto.
//
// E la domanda del PO era esplicita: «lo calcoli tu, non con i numeri — guarda la pista
// singola su tutte le piste che ci sono quest'anno». Questo file guarda la pista.
//
// ── COSA RENDE SORPASSABILE UN PUNTO DI PISTA, E NON E' UN'OPINIONE ──────────
//
// Un sorpasso in F1 ha bisogno di tre cose insieme, e la geometria le contiene tutte e tre:
//
//  1. UN RETTILINEO LUNGO, per accostare. Sotto i ~400 m non si esce dalla scia in tempo.
//  2. UNA FRENATA VERA in fondo, cioe' una curva STRETTA subito dopo: e' li' che si stacca
//     piu' tardi. Un rettilineo che finisce in una curva veloce non e' un punto di sorpasso,
//     e' un tratto veloce.
//  3. UNA CURVA LENTA PRIMA, per poter seguire da vicino e prendere la scia. Se il tratto
//     precedente e' veloce, l'aria sporca ti stacca prima che il rettilineo cominci.
//
// Monaco e' il controesempio che il PO ha citato: rettilinei corti, nessuna vera zona di
// frenata larga, e l'indice deve dirlo da solo — non perche' gliel'abbiamo detto noi.
//
// ── COSA QUESTO INDICE NON E' ────────────────────────────────────────────────
//
// Non e' una probabilita' di sorpasso e non e' tarato su nessun esito: e' una descrizione
// della FORMA. Se poi correli con i sorpassi osservati e' una VERIFICA, non una taratura —
// e va tenuta fuori dal calcolo dell'indice, o l'indice diventa un modello adattato che si
// spaccia per geometria.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';

// Le soglie sono DICHIARATE, non tarate: vengono da come si guarda una pista, non dai
// nostri esiti. Cambiarle dopo aver visto i risultati sarebbe E08.
export const SOGLIE = {
  raggio_rettilineo_m: 300,   // sopra questo raggio la traiettoria e' "dritta" per un'auto di F1
  raggio_curva_lenta_m: 120,  // sotto questo raggio si frena davvero (2a-3a marcia)
  rettilineo_minimo_m: 400,   // sotto, non si esce dalla scia in tempo
  passo_campionamento_m: 25,  // la curvatura si misura su un arco di questa lunghezza
};

/** Il raggio del cerchio per tre punti. Infinito se sono allineati. */
function raggio(a, b, c) {
  const A = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const B = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const C = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const s = (A + B + C) / 2;
  const area2 = s * (s - A) * (s - B) * (s - C);
  if (area2 <= 0) return Infinity;
  const area = Math.sqrt(area2);
  if (area < 1e-12) return Infinity;
  return (A * B * C) / (4 * area);
}

/**
 * La pista, ricampionata a passo costante in METRI e col raggio di curvatura in ogni punto.
 *
 * I punti arrivano in unita' di viewBox: si riscalano sulla lunghezza vera del circuito,
 * che il file dichiara. Senza questo passaggio i raggi sarebbero in unita' di disegno e
 * confrontare due piste non vorrebbe dire niente.
 */
export function profilo(nomeGara) {
  const f = path.join(RADICE, 'demo', 'data', `pista_${nomeGara}.json`);
  if (!existsSync(f)) return null;
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const punti = d.punti;
  if (!Array.isArray(punti) || punti.length < 20 || !d.lunghezza_m) return null;

  // lunghezza della spezzata in unita' di disegno → fattore di scala verso i metri
  let disegno = 0;
  for (let i = 1; i < punti.length; i += 1) disegno += Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]);
  disegno += Math.hypot(punti[0][0] - punti[punti.length - 1][0], punti[0][1] - punti[punti.length - 1][1]);
  const scala = d.lunghezza_m / disegno;   // metri per unita' di disegno

  // ricampionamento a passo costante, in metri
  const passo = SOGLIE.passo_campionamento_m;
  const chiusa = [...punti, punti[0]];
  const cum = [0];
  for (let i = 1; i < chiusa.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(chiusa[i][0] - chiusa[i - 1][0], chiusa[i][1] - chiusa[i - 1][1]) * scala);
  }
  const totale = cum[cum.length - 1];
  const n = Math.max(24, Math.round(totale / passo));
  const camp = [];
  let j = 0;
  for (let k = 0; k < n; k += 1) {
    const s = (k * totale) / n;
    while (j < cum.length - 2 && cum[j + 1] < s) j += 1;
    const t = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    camp.push([
      (chiusa[j][0] + t * (chiusa[j + 1][0] - chiusa[j][0])) * scala,
      (chiusa[j][1] + t * (chiusa[j + 1][1] - chiusa[j][1])) * scala,
      s,
    ]);
  }
  // il raggio in ogni punto, su un arco di `passo` per lato
  const raggi = camp.map((_, i) => raggio(
    camp[(i - 1 + camp.length) % camp.length],
    camp[i],
    camp[(i + 1) % camp.length],
  ));
  return { gara: nomeGara, lunghezza_m: d.lunghezza_m, passo, camp, raggi };
}

/**
 * I RETTILINEI e, per ciascuno, che cosa c'e' prima e dopo.
 *
 * Un rettilineo e' una sequenza di punti col raggio sopra soglia. Ne interessano tre cose:
 * quanto e' lungo, quanto e' stretta la curva che lo CHIUDE (la frenata) e quanto e'
 * stretta quella che lo APRE (la scia).
 */
export function rettilinei(p) {
  const { raggi, passo } = p;
  const N = raggi.length;
  const dritto = raggi.map((r) => r >= SOGLIE.raggio_rettilineo_m);
  const out = [];
  let i = 0;
  // si parte dal primo punto NON dritto, per non spezzare un rettilineo a cavallo dell'indice 0
  while (i < N && dritto[i]) i += 1;
  if (i === N) return [{ lunghezza_m: p.lunghezza_m, raggio_dopo: Infinity, raggio_prima: Infinity }];
  const inizio = i;
  let k = 0;
  while (k < N) {
    const a = (inizio + k) % N;
    if (!dritto[a]) { k += 1; continue; }
    let len = 0; let b = a;
    while (dritto[b] && len < p.lunghezza_m) { len += passo; b = (b + 1) % N; k += 1; }
    // IL RAGGIO DELLA CURVA, NON DEL SUO INGRESSO. La prima scrittura leggeva il raggio nel
    // primo punto non-dritto — cioe' l'ingresso, che e' sempre piu' aperto dell'apice — e
    // il risultato era che Spa non aveva zone di sorpasso: falso, il Kemmel finisce nella
    // chicane delle Combes. Si guarda il punto PIU' STRETTO nei 250 m successivi, che e'
    // dove si frena davvero. Stessa cosa all'indietro per la curva che apre il rettilineo.
    const finestra = Math.max(2, Math.round(250 / passo));
    let dopo = Infinity;
    for (let q = 0; q < finestra; q += 1) dopo = Math.min(dopo, raggi[(b + q) % N]);
    let prima = Infinity;
    for (let q = 1; q <= finestra; q += 1) prima = Math.min(prima, raggi[(a - q + N * 2) % N]);
    out.push({ lunghezza_m: len, raggio_dopo: dopo, raggio_prima: prima });
  }
  return out;
}

/**
 * L'INDICE DI SORPASSO di un circuito. Zero parametri tarati: solo le soglie dichiarate.
 *
 * Si contano le ZONE DI SORPASSO — rettilinei abbastanza lunghi che finiscono in una curva
 * abbastanza stretta — e si pesa ciascuna per quanto e' lunga la rincorsa e per quanto e'
 * lenta la curva che la precede (che decide se puoi seguire da vicino).
 *
 * L'indice grezzo e' una somma di metri: si normalizza sulla mediana dei circuiti per
 * leggerlo come «quante volte piu' sorpassabile della pista tipica».
 */
export function indiceGrezzo(nomeGara) {
  const p = profilo(nomeGara);
  if (!p) return null;
  const R = rettilinei(p);
  const zone = R.filter((r) => r.lunghezza_m >= SOGLIE.rettilineo_minimo_m
    && r.raggio_dopo <= SOGLIE.raggio_curva_lenta_m);
  // il peso della scia: una curva lenta PRIMA vale 1, una veloce vale meno. Non e' tarato:
  // e' il rapporto fra la soglia di curva lenta e il raggio che c'e' davvero, tagliato a 1.
  const peso = (r) => Math.min(1, SOGLIE.raggio_curva_lenta_m / Math.max(1, r.raggio_prima));
  const punteggio = zone.reduce((a, r) => a + r.lunghezza_m * (0.5 + 0.5 * peso(r)), 0);
  return {
    gara: nomeGara,
    lunghezza_m: p.lunghezza_m,
    n_rettilinei: R.length,
    rettilineo_max_m: Math.round(Math.max(0, ...R.map((r) => r.lunghezza_m))),
    n_zone_sorpasso: zone.length,
    metri_utili: Math.round(zone.reduce((a, r) => a + r.lunghezza_m, 0)),
    punteggio: Math.round(punteggio),
  };
}
