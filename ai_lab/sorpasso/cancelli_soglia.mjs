#!/usr/bin/env node
// cancelli_soglia.mjs — i quattro cancelli di PREREG_soglia_sorpasso.md.
//
//     node ai_lab/sorpasso/cancelli_soglia.mjs [--json]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Forma, stimatore, nulli e soglie
// sono copiati da li' e non si toccano.
//
// COSA LO FA USCIRE 1:
//   (a) la logistica non converge — allora non c'e' nessuna stima da giudicare;
//   (b) un circuito valutato non ha l'indice geometrico: la legge non avrebbe ingresso.

import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
import { occasioniFondo, occasioni2026, PARAMETRI } from './attacchi.mjs';

// I tre parametri del tetto che NON si misurano qui: vengono dal prior esterno e viaggiano
// nel sigillo perche' la produzione non legge da ai_lab/ (e' lab, non un dipartimento dati).
const K = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'duello_tum_2026.json'), 'utf8')).costanti;

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie da PREREG_soglia_sorpasso.md §5. NON si toccano qui.
const SOGLIA_P_S1 = 0.01;
const PLACEBO_RIPETIZIONI = 500;
const PLACEBO_SEME = 20260804;
const INDICE_BASSO = 0.20; // il ramo «due livelli» della §6

const PISTE = ['Australia', 'Austria', 'Belgio', 'Canada', 'Cina', 'Giappone', 'GranBretagna', 'Miami', 'Monaco', 'Spagna', 'Ungheria'];
// l'indice e' sigillato e usa il nome del sito, con lo spazio
const NOME_INDICE = { GranBretagna: 'Gran Bretagna' };

const mediana = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ── algebra ─────────────────────────────────────────────────────────────────
/** Risolve A x = b (A simmetrica definita positiva) con eliminazione + inversa. */
function risolviEInverti(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)), b[i]]);
  for (let c = 0; c < n; c += 1) {
    let piv = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = c; j < 2 * n + 1; j += 1) M[c][j] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = c; j < 2 * n + 1; j += 1) M[r][j] -= f * M[c][j];
    }
  }
  return { x: M.map((r) => r[2 * n]), inv: M.map((r) => r.slice(n, 2 * n)) };
}

/**
 * Logistica per IRLS. `X` righe di regressori, `y` 0/1.
 * Restituisce { beta, se, iter } oppure null se non converge.
 */
function logistica(X, y, maxIter = 60) {
  const n = X.length; const k = X[0].length;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < maxIter; it += 1) {
    const A = Array.from({ length: k }, () => new Array(k).fill(0));
    const g = new Array(k).fill(0);
    for (let i = 0; i < n; i += 1) {
      let eta = 0;
      for (let j = 0; j < k; j += 1) eta += X[i][j] * beta[j];
      const p = 1 / (1 + Math.exp(-eta));
      const w = Math.max(p * (1 - p), 1e-9);
      const r = y[i] - p;
      for (let a = 0; a < k; a += 1) {
        g[a] += X[i][a] * r;
        for (let b = a; b < k; b += 1) A[a][b] += X[i][a] * X[i][b] * w;
      }
    }
    for (let a = 0; a < k; a += 1) for (let b = 0; b < a; b += 1) A[a][b] = A[b][a];
    const sol = risolviEInverti(A, g);
    if (!sol) return null;
    let passo = 0;
    for (let j = 0; j < k; j += 1) { beta[j] += sol.x[j]; passo = Math.max(passo, Math.abs(sol.x[j])); }
    if (passo < 1e-9) return { beta, se: sol.inv.map((r, j) => Math.sqrt(Math.max(r[j], 0))), iter: it + 1 };
  }
  return null;
}

/** Coda normale a due lati. */
const pNormale = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 2 * p;
};

/** OLS di y su [1, x]. */
function ols(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n; const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0; let sxy = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2; }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

// ── i dati ──────────────────────────────────────────────────────────────────
const { occasioni, gareLette } = occasioniFondo(RADICE, { piste: PISTE });
const indiceFile = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab/sorpasso/indice_sorpasso.json'), 'utf8')).per_circuito;
const INDICE = {};
for (const p of PISTE) {
  const v = indiceFile[NOME_INDICE[p] ?? p];
  if (!v) { console.error(`indice geometrico assente per ${p}: la legge non ha ingresso`); process.exit(1); }
  INDICE[p] = v.indice;
}

/**
 * STADIO 1 — la soglia per circuito: una pendenza comune, un'intercetta per pista.
 * X(pista) = -a_pista / b.
 */
function stadio1(dati, piste) {
  const X = []; const y = [];
  for (const o of dati) {
    const riga = piste.map((p) => (o.pista === p ? 1 : 0));
    riga.push(o.delta);
    X.push(riga); y.push(o.passato ? 1 : 0);
  }
  const fit = logistica(X, y);
  if (!fit) return null;
  const b = fit.beta[piste.length];
  const seB = fit.se[piste.length];
  const soglia = {};
  piste.forEach((p, i) => { soglia[p] = -fit.beta[i] / b; });
  return { b, seB, z: b / seB, p: pNormale(b / seB), soglia, intercette: Object.fromEntries(piste.map((p, i) => [p, fit.beta[i]])) };
}

const S1fit = stadio1(occasioni, PISTE);
if (!S1fit) { console.error('la logistica non converge: non c\'e\' niente da giudicare'); process.exit(1); }
const S1 = S1fit.b < 0 && S1fit.p <= SOGLIA_P_S1;

stampa('');
stampa('══ CANCELLI DELLA SOGLIA DI SORPASSO — PREREG_soglia_sorpasso.md ═══════════');
stampa(`   ${occasioni.length} occasioni · ${gareLette} gare asciutte · vicino ${PARAMETRI.vicino_s}s · orizzonte ${PARAMETRI.orizzonte} giri`);
stampa('');
stampa('   pista            n   quota   indice   soglia X (s/giro)');
const perPista = {};
for (const o of occasioni) { (perPista[o.pista] ??= { n: 0, p: 0 }); perPista[o.pista].n += 1; if (o.passato) perPista[o.pista].p += 1; }
for (const p of [...PISTE].sort((a, b) => INDICE[b] - INDICE[a])) {
  stampa(`   ${p.padEnd(14)} ${String(perPista[p].n).padStart(4)}   ${(perPista[p].p / perPista[p].n).toFixed(3)}   ${INDICE[p].toFixed(3)}       ${S1fit.soglia[p].toFixed(3)}`);
}
stampa('');
stampa(`   S1  il divario di passo conta: b = ${S1fit.b.toFixed(4)} (z = ${S1fit.z.toFixed(2)}, p = ${S1fit.p < 1e-4 ? '<0,0001' : S1fit.p.toFixed(4)})`
  + `   ${S1 ? 'PASSA' : 'NON PASSA'}`);
stampa(`         lettura: ogni secondo al giro di vantaggio moltiplica per ${Math.exp(-S1fit.b).toFixed(1)} le probabilita' di passare`);

// ── S2 · l'indice predice la soglia, fuori campione ─────────────────────────
function S2su(piste) {
  const errLegge = []; const errNullo = [];
  for (const fuori of piste) {
    const altre = piste.filter((p) => p !== fuori);
    const fit = ols(altre.map((p) => 1 - INDICE[p]), altre.map((p) => S1fit.soglia[p]));
    if (!fit) continue;
    const previsto = fit.a + fit.b * (1 - INDICE[fuori]);
    const nullo = altre.reduce((a, p) => a + S1fit.soglia[p], 0) / altre.length;
    errLegge.push(Math.abs(previsto - S1fit.soglia[fuori]));
    errNullo.push(Math.abs(nullo - S1fit.soglia[fuori]));
  }
  return { legge: mediana(errLegge), nullo: mediana(errNullo), passa: mediana(errLegge) < mediana(errNullo) };
}

// ── S3 · placebo: l'indice mescolato fra i circuiti ─────────────────────────
function S3su(piste) {
  const vero = ols(piste.map((p) => 1 - INDICE[p]), piste.map((p) => S1fit.soglia[p]));
  let seme = PLACEBO_SEME;
  const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
  const valori = piste.map((p) => 1 - INDICE[p]);
  let battuti = 0;
  for (let k = 0; k < PLACEBO_RIPETIZIONI; k += 1) {
    const m = [...valori];
    for (let i = m.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    const f = ols(m, piste.map((p) => S1fit.soglia[p]));
    if (f && f.r2 >= vero.r2) battuti += 1;
  }
  const p = (battuti + 1) / (PLACEBO_RIPETIZIONI + 1);
  return { r2: vero.r2, a: vero.a, b: vero.b, battuti, p, passa: p <= 0.05 };
}

const s2 = S2su(PISTE); const s3 = S3su(PISTE);
const SENZA_MONACO = PISTE.filter((p) => p !== 'Monaco');
const s2m = S2su(SENZA_MONACO); const s3m = S3su(SENZA_MONACO);
const S2 = s2.passa; const S3 = s3.passa; const S4 = s2m.passa && s3m.passa;

stampa(`   S2  l'indice predice la soglia fuori campione (leave-one-circuit-out):`);
stampa(`         errore mediano  legge ${s2.legge.toFixed(3)}  contro nullo «X uguale per tutti» ${s2.nullo.toFixed(3)}   ${S2 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   S3  placebo su ${PLACEBO_RIPETIZIONI} rimescolamenti dell'indice:`);
stampa(`         R2 vero ${s3.r2.toFixed(3)} · finti >= vero ${s3.battuti}/${PLACEBO_RIPETIZIONI} · p = ${s3.p.toFixed(4)}   ${S3 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   S4  senza Monaco:`);
stampa(`         S2 legge ${s2m.legge.toFixed(3)} contro nullo ${s2m.nullo.toFixed(3)} · S3 R2 ${s3m.r2.toFixed(3)} p = ${s3m.p.toFixed(4)}   ${S4 ? 'PASSA' : 'NON PASSA'}`);

// ── la lettura obbligata (prereg §6): cosa si spedisce ──────────────────────
let ramo; let consegna;
if (!S1) {
  ramo = 'NIENTE';
  consegna = 'S1 fallisce: il divario di passo non predice il sorpasso. Il tetto al movimento resta spento.';
} else if (!S2 || !S3) {
  ramo = 'SOGLIA UNICA';
  consegna = 'S1 passa ma l\'indice non predice la soglia: si spedisce UNA soglia sola, uguale per tutte le piste. E\' il «pavimento uniforme» che il placebo del tetto al movimento aveva gia\' indicato come il pezzo che funziona.';
} else if (!S4) {
  ramo = 'DUE LIVELLI';
  consegna = `S1, S2 e S3 passano ma senza Monaco la legge non regge: si spedisce a DUE LIVELLI — le piste con indice sotto ${INDICE_BASSO} prendono la loro soglia, tutte le altre la soglia comune.`;
} else {
  ramo = 'LEGGE CONTINUA';
  consegna = 'tutti i cancelli passano: si spedisce la legge continua a due parametri, e vale anche per Zandvoort e per ogni pista futura di cui si abbia la forma.';
}

// il numero che si spedisce, per ogni ramo
const sogliaComune = mediana(PISTE.map((p) => S1fit.soglia[p]));
const sogliaDaLegge = Object.fromEntries(PISTE.map((p) => [p, s3.a + s3.b * (1 - INDICE[p])]));
const sogliaDueLivelli = Object.fromEntries(PISTE.map((p) => [p, INDICE[p] < INDICE_BASSO ? S1fit.soglia[p] : sogliaComune]));

stampa('');
stampa(`   RAMO: ${ramo}`);
for (const r of consegna.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

// ── L'ANCORAGGIO DEL LIVELLO AL 2026 (prereg §7) ────────────────────────────
//
// Il fondo ha il DRS, il 2026 no. La FORMA (quanto conta il divario, e quanto Monaco e'
// diverso da tutti) viene dalla storia; il LIVELLO si sposta di UNA costante, scelta
// perche' la quota di sorpassi prevista sulle gare 2026 uguagli quella osservata.
// Una costante e non undici: undici sarebbero undici soglie libere, cioe' il fattore per
// circuito da capo.
const occ26 = occasioni2026(path.join(RADICE, 'simulatore'));
const quota26 = occ26.filter((o) => o.passato).length / occ26.length;
const sogliaRamo = ramo === 'LEGGE CONTINUA' ? sogliaDaLegge
  : ramo === 'SOGLIA UNICA' ? Object.fromEntries(PISTE.map((p) => [p, sogliaComune]))
    : sogliaDueLivelli;
const quotaPrevista = (c) => {
  let s = 0;
  for (const o of occ26) s += 1 / (1 + Math.exp(-S1fit.b * (o.delta - ((sogliaRamo[o.pista] ?? sogliaComune) + c))));
  return s / occ26.length;
};
// `quotaPrevista` CRESCE con c: alzare la soglia (renderla meno negativa) rende il
// sorpasso piu' facile, perche' la pendenza b e' negativa. La prima scrittura di questa
// bisezione aveva il verso invertito e restituiva sempre l'estremo -3: un numero che
// sembrava una stima ed era un bordo. Se un giorno tornasse a incollarsi a un estremo,
// la riga qui sotto lo dichiara invece di spedirlo.
let lo = -3; let hi = 3;
for (let i = 0; i < 80; i += 1) { const mid = (lo + hi) / 2; if (quotaPrevista(mid) > quota26) hi = mid; else lo = mid; }
const C_2026 = (lo + hi) / 2;
if (Math.abs(C_2026) > 2.9) {
  console.error(`ANCORAGGIO AL BORDO: costante ${C_2026.toFixed(4)} contro un intervallo [-3, 3] — non e' una stima, e' un estremo.`);
  process.exit(1);
}
const sogliaFinale = Object.fromEntries(PISTE.map((p) => [p, Number(((sogliaRamo[p] ?? sogliaComune) + C_2026).toFixed(4))]));

stampa('');
stampa(`   ANCORAGGIO AL 2026: ${occ26.length} occasioni, quota osservata ${quota26.toFixed(4)}`);
stampa(`         costante unica ${C_2026 >= 0 ? '+' : ''}${C_2026.toFixed(4)} s/giro (previsto con c=0: ${quotaPrevista(0).toFixed(4)})`);
stampa(`         soglia spedita: Monaco ${sogliaFinale.Monaco.toFixed(3)} · tutte le altre ${sogliaFinale.Spagna.toFixed(3)} s/giro`);

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli S1-S4 di PREREG_soglia_sorpasso.md — la soglia di vantaggio di passo per sorpassare, e se la geometria la predice.',
    prereg: 'ai_lab/sorpasso/PREREG_soglia_sorpasso.md',
    generato_da: 'ai_lab/sorpasso/cancelli_soglia.mjs',
    data: '2026-08-04',
    natura: 'MISURATO_FONDO',
    perimetro: `occasioni: F dietro L di <= ${PARAMETRI.vicino_s}s, nessun box e verde di status per [g, g+${PARAMETRI.orizzonte}], passo su ${PARAMETRI.finestra_passo} giri precedenti`,
    limite_DRS: 'Il fondo 2018-2025 ha il DRS, il 2026 no (Manual Override Mode). Il LIVELLO di X qui e di un era con un aiuto al sorpasso che non esiste piu: la soglia vera del 2026 e PIU ALTA. La forma viene dalla storia, il livello si ancora al 2026 con UNA costante (prereg §7).',
  },
  perimetro: { occasioni: occasioni.length, gare: gareLette, per_pista: perPista },
  stadio1: { pendenza: S1fit.b, se: S1fit.seB, z: S1fit.z, p: S1fit.p, soglia_per_pista: S1fit.soglia },
  indice: INDICE,
  cancelli: { S1: { passa: S1, b: S1fit.b, p: S1fit.p }, S2: { passa: S2, ...s2 }, S3: { passa: S3, ...s3 }, S4: { passa: S4, senza_monaco: { S2: s2m, S3: s3m } } },
  ramo,
  consegna,
  soglie_candidate: { comune: sogliaComune, da_legge: sogliaDaLegge, due_livelli: sogliaDueLivelli },
  ancoraggio_2026: { occasioni: occ26.length, quota_osservata: quota26, quota_prevista_senza_costante: quotaPrevista(0), costante: C_2026 },
  soglia_spedita: sogliaFinale,
};
writeFileSync(path.join(RADICE, 'ai_lab/sorpasso/ESITO_cancelli_soglia.json'), JSON.stringify(doc, null, 1) + '\n');

// ── IL SIGILLO CHE VA IN PRODUZIONE ─────────────────────────────────────────
//
// Il kernel chiama `sogliaSorpasso` il vantaggio di passo che serve per passare, e lo vuole
// POSITIVO: qui X e' negativo per costruzione (delta = passo(F) - passo(L), negativo =
// l'inseguitore e' piu' veloce), quindi si spedisce -X.
//
// SPENTO ALLA NASCITA. `attivo: false`: questo file esiste perche' il numero sia
// riproducibile e verificabile, non perche' sia acceso. L'accensione passa dal cancello
// dell'aggancio (cancelli_tetto_misurato.mjs), che e' un'altra cosa e ha un'altra prereg.
const sigillo = {
  _targhetta: {
    cosa_e: 'La soglia di vantaggio di passo per sorpassare, per circuito: quanti secondi al giro devi essere piu veloce perche il sorpasso da vicino diventi piu probabile che no.',
    natura: 'MISURATO_FONDO',
    prereg: 'ai_lab/sorpasso/PREREG_soglia_sorpasso.md',
    esito: 'ai_lab/sorpasso/ESITO_soglia_sorpasso.md',
    generato_da: 'ai_lab/sorpasso/cancelli_soglia.mjs',
    data: '2026-08-04',
    da_quante_occasioni: occasioni.length,
    ramo: `${ramo} — S4 (senza Monaco) decide la forma: ${S4 ? 'la legge geometrica regge' : 'la legge geometrica NON regge senza Monaco, quindi due livelli e non una legge continua'}`,
    cosa_significa: `La pendenza misurata e ${S1fit.b.toFixed(4)}: ogni secondo al giro di vantaggio moltiplica per ${Math.exp(-S1fit.b).toFixed(1)} le probabilita di passare entro cinque giri. La soglia e il vantaggio a cui quella probabilita arriva al 50%.`,
    cosa_NON_e: 'NON e una probabilita di sorpasso per coppia di auto. Il progetto ha gia misurato che QUALI auto si scambiano non si riproduce: si riproduce QUANTI scambi. Questo e un vincolo sul movimento.',
    il_DRS_e_il_limite: `Il fondo 2018-2025 ha il DRS, che nel 2026 non esiste (Manual Override Mode). Il livello e ancorato al 2026 con UNA costante (${C_2026 >= 0 ? '+' : ''}${C_2026.toFixed(4)} s/giro), scelta perche la quota di sorpassi prevista sulle 767 occasioni del 2026 uguagli quella osservata (${quota26.toFixed(4)}). MISURATO E CONTRO L ATTESA: la costante e praticamente zero, cioe togliere il DRS NON ha cambiato quanto vantaggio serve per passare. La prereg si aspettava una soglia piu alta.`,
    gli_altri_parametri_del_tetto: 'minGap, costoDuello e costoSubito NON sono misurati qui: sono COPIATI da ai_lab/confronto/duello_tum_2026.json (prior esterno, 121 file) e viaggiano in questo file perche la produzione non legge da ai_lab/. La loro natura resta PRIOR_ESTERNO, diversa da quella della soglia: chi legge deve poterle distinguere.',
    accensione: 'ACCESO il 04/08/2026 dopo ai_lab/sorpasso/ESITO_aggancio_tetto.json: U1 passa, U3 (la risposta a due giri, la sola validata) NON peggiora, e il movimento inventato nel terzile alto scende da 2,14 a 0,24 cambi per caso. Il costo dichiarato: il saldo dello strato sano scende da +17 a +11, cioe sei casi diventano pareggi.',
  },
  attivo: true,
  parametri: {
    _natura: 'PRIOR_ESTERNO — da duello_tum_2026.json, NON misurati qui',
    minGap: K.min_t_dist_s,
    costoDuello: K.t_duel_s,
    costoSubito: K.t_overtake_loser_s,
  },
  pendenza: Number(S1fit.b.toFixed(6)),
  // il kernel vuole il vantaggio come numero positivo
  soglia_sorpasso: Object.fromEntries(PISTE.map((p) => [p, Number((-sogliaFinale[p]).toFixed(4))])),
  _circuito_ignoto: `Un circuito che non compare qui usa la soglia comune (${(-sogliaFinale.Spagna).toFixed(4)} s/giro), non 1 e non zero: la misura dice che dieci piste su undici condividono la stessa soglia, quindi la comune E la stima per una pista nuova. Monaco e l unica eccezione misurata.`,
  soglia_comune: Number((-sogliaFinale.Spagna).toFixed(4)),
};
writeFileSync(path.join(RADICE, 'simulatore/data/modelli/soglia_sorpasso.json'), JSON.stringify(sigillo, null, 1) + '\n');

if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else {
  stampa('\n   → ai_lab/sorpasso/ESITO_cancelli_soglia.json');
  stampa('   → simulatore/data/modelli/soglia_sorpasso.json  (attivo: false — l\'accensione ha il suo cancello)');
}
