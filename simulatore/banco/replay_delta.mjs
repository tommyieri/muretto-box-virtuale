#!/usr/bin/env node
// replay_delta.mjs — l'esperimento decisivo su δ, esattamente come
// pre-registrato in banco/prereg/PREREG_delta.md. Nessuna scelta presa qui:
// banco, bracci, campione, metrica e regola di decisione stanno nella prereg,
// questo file li esegue e scrive l'esito.
//
// Uso: node banco/replay_delta.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { misuraBias } from './misure/bias.mjs';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── parametri dichiarati nella prereg (letti, non cablati — E07) ────────────
const cancelli = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'cancelli_banco.json'), 'utf8')).bias;
const ORIZZONTI = cancelli.orizzonti;
const MIN_GARE_ORIZZONTE = cancelli.min_gare_orizzonte;
const SOGLIA_NON_DECISIVO = 0.02; // s/giro — PREREG_delta.md
const CANCELLO_BIAS = cancelli.soglia_bias;
const CANCELLO_PIATTEZZA = cancelli.soglia_piattezza;

const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const rho = modello.rho.valore;
const loro = modello.delta_70.leave_one_race_out;

const gare = caricaGare2026(radice);
const bracci = {
  A: { etichetta: 'δ₇₀ = 2,2 (fondo 2026)', delta: () => 2.2 },
  B: { etichetta: 'δ₇₀ = 3,0 (vecchio kernel)', delta: () => 3.0 },
  C: { etichetta: 'δ₇₀ stimato libero, leave-one-race-out', delta: (g) => loro[g] },
};

const risultati = Object.fromEntries(Object.entries(bracci).map(([n, b]) =>
  [n, misuraBias(gare, { delta70Di: b.delta, rho, cancelli })]));

const perOrizzonte = {};
for (const H of ORIZZONTI) {
  const rif = risultati.A.perOrizzonte[H];
  perOrizzonte[H] = {
    n_finestre: rif.n_finestre,
    n_gare: rif.n_gare,
    giudicabile: rif.giudicabile,
    bias: Object.fromEntries(Object.keys(bracci).map((n) => [n, risultati[n].perOrizzonte[H].bias])),
  };
}
const dettaglio = risultati.A.dettaglio.map((d, i) => ({
  gara: d.gara, Lf: d.Lf, H: d.H, n_piloti: d.n_piloti,
  bias_A: d.bias, bias_B: risultati.B.dettaglio[i].bias, bias_C: risultati.C.dettaglio[i].bias,
}));

// ── regola di decisione, come pre-registrata ────────────────────────────────
const giudicabili = ORIZZONTI.filter((H) => perOrizzonte[H].giudicabile);
const vittorie = { A: 0, B: 0, C: 0 };
for (const H of giudicabili) {
  const b = perOrizzonte[H].bias;
  const vincitore = Object.keys(bracci).sort((x, y) => Math.abs(b[x]) - Math.abs(b[y]))[0];
  vittorie[vincitore] += 1;
}
const maxAssoluto = Object.fromEntries(Object.keys(bracci).map((n) => [n, Math.max(...giudicabili.map((H) => Math.abs(perOrizzonte[H].bias[n])))]));

let vincitore = Object.keys(vittorie).find((n) => vittorie[n] >= 2) ?? null;
let regolaUsata = vincitore ? '1 — maggioranza degli orizzonti' : null;
if (!vincitore) {
  vincitore = Object.keys(maxAssoluto).sort((x, y) => maxAssoluto[x] - maxAssoluto[y])[0];
  regolaUsata = '2 — max|bias| più piccolo';
}
const coppieIndistinguibili = [];
for (const x of ['A', 'B', 'C']) {
  for (const y of ['A', 'B', 'C']) {
    if (x >= y) continue;
    if (giudicabili.every((H) => Math.abs(Math.abs(perOrizzonte[H].bias[x]) - Math.abs(perOrizzonte[H].bias[y])) <= SOGLIA_NON_DECISIVO)) {
      coppieIndistinguibili.push(`${x}~${y}`);
    }
  }
}
const nonDecisivo = coppieIndistinguibili.length > 0;

const biasVincitore = giudicabili.map((H) => Math.abs(perOrizzonte[H].bias[vincitore]));
const cancello = {
  soglia_bias: CANCELLO_BIAS,
  soglia_piattezza: CANCELLO_PIATTEZZA,
  max_bias_assoluto: Number(Math.max(...biasVincitore).toFixed(6)),
  piattezza: Number((Math.max(...biasVincitore) - Math.min(...biasVincitore)).toFixed(6)),
};
cancello.passa_bias = cancello.max_bias_assoluto <= CANCELLO_BIAS;
cancello.passa_piattezza = cancello.piattezza <= CANCELLO_PIATTEZZA;
cancello.passa = cancello.passa_bias && cancello.passa_piattezza;

const esito = {
  _targhetta: {
    tipo: 'esito dell\'esperimento pre-registrato su δ',
    prereg: 'banco/prereg/PREREG_delta.md',
    eseguito_da: 'banco/replay_delta.mjs',
    data: '2026-07-29',
    rho_usato: rho,
    nota: 'ρ identico nei tre bracci: l\'unica cosa che cambia è δ₇₀',
  },
  bracci: Object.fromEntries(Object.entries(bracci).map(([n, b]) => [n, b.etichetta])),
  per_orizzonte: perOrizzonte,
  vittorie_per_orizzonte: vittorie,
  max_bias_assoluto_per_braccio: Object.fromEntries(Object.entries(maxAssoluto).map(([n, v]) => [n, Number(v.toFixed(6))])),
  coppie_entro_soglia_non_decisivo: coppieIndistinguibili,
  non_decisivo: nonDecisivo,
  vincitore,
  regola_usata: regolaUsata,
  cancello_sanita: cancello,
  dettaglio_per_finestra: dettaglio,
};

const dest = path.join(radice, 'banco', 'prereg', 'ESITO_delta.json');
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(esito, null, 2) + '\n');

// Il δ scelto lo scrive l'ESPERIMENTO, non lo stimatore: è questa la differenza
// fra decidere e lasciar convivere due misure (E21). Ri-eseguire la stima
// rimette `scelto` a null, e il modello torna non cablabile finché
// l'esperimento non gira di nuovo sui coefficienti nuovi (E20: i pezzi vecchi
// si spengono insieme).
const percorsoModello = path.join(radice, 'data', 'modelli', 'modello_v2.json');
const deltaScelto = vincitore === 'C' ? modello.delta_70.stimato_libero : (vincitore === 'A' ? 2.2 : 3.0);
modello.delta_70.scelto = nonDecisivo || !cancello.passa ? null : deltaScelto;
modello.delta_70.decisione = {
  esperimento: 'banco/prereg/PREREG_delta.md',
  esito: 'banco/prereg/ESITO_delta.json',
  braccio_vincente: vincitore,
  regola_usata: regolaUsata,
  motivo: nonDecisivo
    ? 'bracci indistinguibili entro la soglia pre-registrata: nessun δ cablato'
    : (!cancello.passa
      ? 'il vincitore non passa il cancello di sanità pre-registrato: nessun δ cablato'
      : `|bias| mediano più piccolo su ${vittorie[vincitore]} orizzonti giudicabili su ${giudicabili.length}`),
  perdenti_a_referto: Object.entries(bracci)
    .filter(([n]) => n !== vincitore)
    .map(([n, b]) => ({
      braccio: n,
      valore: b.etichetta,
      max_bias_assoluto: Number(maxAssoluto[n].toFixed(6)),
      targhetta: 'misurato su questo banco 2026 — perdente dell\'esperimento pre-registrato, resta a referto (E21: non si cancella una misura perché ha perso)',
    })),
  avvertenza_stima_libera: 'la stima entro-blocco e il replay NON concordano: la regressione sul giro di gara non separa carburante ed evoluzione della pista, il replay misura la deriva che serve davvero a proiettare. Il valore cablato è quello che vince sul bersaglio del prodotto (E16).',
  limiti_dichiarati: ORIZZONTI.filter((H) => !perOrizzonte[H].giudicabile).map((H) => ({
    orizzonte: H,
    stato: 'NON giudicabile',
    gare_disponibili: perOrizzonte[H].n_gare,
    gare_richieste: MIN_GARE_ORIZZONTE,
    bias_vincitore: perOrizzonte[H].bias[vincitore],
    avvertenza: `il modello NON è validato a ${H} giri: su questo campione ridotto il bias del vincitore supera il cancello ${CANCELLO_BIAS}. Una finestra di ${H} giri tutta verde è rara (mediane stint 2026: SOFT 14 · MEDIUM 19 · HARD 22), quindi il campione seleziona stint lunghi ed è poco rappresentativo. Non usare il modello oltre l'orizzonte validato senza un nuovo banco.`,
  })),
  orizzonti_validati: giudicabili,
};
writeFileSync(percorsoModello, JSON.stringify(modello, null, 2) + '\n');
console.log(`δ₇₀ scelto: ${modello.delta_70.scelto ?? 'NESSUNO (vedi motivo)'} → data/modelli/modello_v2.json`);

console.log(`ρ = ${rho} (identico nei tre bracci)\n`);
console.log('orizzonte  gare  finestre |   bias A      bias B      bias C');
for (const H of ORIZZONTI) {
  const o = perOrizzonte[H];
  const f = (v) => (v === null ? '     —    ' : (v >= 0 ? '+' : '') + v.toFixed(4).padStart(9));
  console.log(`   H=${String(H).padEnd(2)}      ${String(o.n_gare).padStart(2)}     ${String(o.n_finestre).padStart(3)}    | ${f(o.bias.A)}  ${f(o.bias.B)}  ${f(o.bias.C)}${o.giudicabile ? '' : '   (INSUFFICIENTE)'}`);
}
console.log(`\nvittorie: ${JSON.stringify(vittorie)}  →  vincitore ${vincitore} (regola ${regolaUsata})`);
console.log(`coppie entro ${SOGLIA_NON_DECISIVO} s/giro su tutti gli orizzonti: ${coppieIndistinguibili.length ? coppieIndistinguibili.join(', ') : 'nessuna'}`);
console.log(`cancello di sanità: max|bias| ${cancello.max_bias_assoluto} (≤ ${CANCELLO_BIAS}? ${cancello.passa_bias}) · piattezza ${cancello.piattezza} (≤ ${CANCELLO_PIATTEZZA}? ${cancello.passa_piattezza})`);
console.log(`\nesito scritto: banco/prereg/ESITO_delta.json`);
