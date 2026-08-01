// cancello_neutralizzazione.mjs — le quattro condizioni di PREREG_neutralizzazione.md §Il cancello.
//
//     node ai_lab/confronto/cancello_neutralizzazione.mjs [--json]
//
// Non decide niente che non sia gia' scritto:
//   C1  |bias| scende su TUTTI e tre gli orizzonti (3, 5, 10 giri)
//   C2  |bias| scende in almeno 7 gare su 8 giudicabili (blocchi = gare, E11)
//   C3  i congelamenti VERDI restano identici AL BIT
//   C4  M5, copertura della banda sui casi con regime, non cala di piu' di 2 punti
//
// La metrica primaria e' il BIAS e non l'errore assoluto, e la ragione sta nella
// prereg: la diagnosi che motiva il pacchetto E' un bias (1,964 s/giro sotto
// regime contro 0,033 in verde). Una correzione che non lo riduce non ha corretto
// il difetto che dice di correggere.
//
// COS'E' IL BIAS QUI. Per ogni congelamento L e orizzonte H si proietta SENZA
// SOSTE (proiezione pura: e' il ramo che N1 sblocca) e si confronta il distacco
// dal leader previsto col distacco vero:
//
//     bias = ( (previsto[d] - previsto[leader]) - (vero[d] - vero[leader]) ) / H
//
// Il distacco e non il tempo assoluto: al congelamento il distacco e' zero per
// costruzione, quindi la differenza e' tutta accumulata nella finestra.
//
// NON SCRIVE NIENTE su disco.

import { gare, garaNuova, garaSimDi, contestoNuovo } from './banco.mjs';
import { costruisciScenario } from '../../simulatore/scenario/costruttore.mjs';
import { simulate } from '../../simulatore/engine/kernel.mjs';
import { regimeDiCella } from '../../simulatore/provenienza/definizioni.mjs';

const ORIZZONTI = [3, 5, 10];
const PRIMO = 8;
const PASSO = 1;
const SOGLIA_C4 = 2.0;      // punti di copertura

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 4) => (x === null || x === undefined || !Number.isFinite(x) ? '   —   ' : x.toFixed(n));

/** Il contesto con il pacchetto acceso o spento, senza toccare il disco. */
function contestoCon(nomeSito, acceso) {
  const base = contestoNuovo(nomeSito);
  return {
    ...base,
    prior: {
      ...base.prior,
      pacchetto_neutralizzazione: { attivo: acceso, soste_rivali: 'nessuna' },
      // N2 e N3 sono promossi INSIEME al pacchetto: e' un pacchetto, non un menu.
      persistenza_regime_interna: { ...base.prior.persistenza_regime_interna, promosso: acceso },
      fattori_neutralizzazione_interni: { ...base.prior.fattori_neutralizzazione_interni, promosso: acceso },
      compressione_distacchi_interna: { ...base.prior.compressione_distacchi_interna, promosso: acceso },
    },
  };
}

/** Proiezione pura di tutto il campo dal congelamento L per H giri. */
function proietta(garaSim, g, L, H, contesto, pilota) {
  let sc;
  try {
    sc = costruisciScenario({ gara: garaSim, freezeLap: L, pilota, piano: [] },
      { ...contesto, nGiriGara: g.nGiri, giroFinale: Math.min(L + H, g.nGiri) });
  } catch { return null; }
  // `neutralizzazione` viaggia con lo scenario come `pits` e `pace`. Dimenticarla
  // qui e' l'errore che questo banco esiste per misurare: la prima versione di
  // questo file la ometteva, e il cancello misurava diligentemente un motore
  // senza il termine che doveva giudicare — dando "identico" e sembrando una
  // scoperta. E17 non e' un errore di chi scrisse il vecchio repo: e' una forma
  // che si ripresenta a chiunque chiami il kernel da un secondo posto.
  const r = simulate({
    state: sc.state, pace: sc.pace, freezeLap: L, steps: H, pits: sc.pits,
    neutralizzazione: sc.neutralizzazione ?? null,
  });
  return { cum: r.cum, regime: sc._interno?.regime ?? null, neutra: sc.neutralizzazione ?? null };
}

const righe = [];   // una per (gara, L, H, pilota)
let scartati = 0;

for (const nomeSito of gare()) {
  const garaSim = garaSimDi(nomeSito);
  const g = garaNuova(nomeSito);
  const ctxOff = contestoCon(nomeSito, false);
  const ctxOn = contestoCon(nomeSito, true);

  for (let L = PRIMO; L + Math.max(...ORIZZONTI) <= g.nGiri; L += PASSO) {
    // regime al CONGELAMENTO: informazione ≤ L, mai il regime futuro (E14).
    // Si legge sulla cella del leader, che e' il riferimento di tutti i distacchi.
    const alGiro = [];
    for (const [drv, celle] of g.perPilota) {
      const c = celle.get(L);
      if (c && typeof c.cum_time === 'number') alGiro.push({ drv, c });
    }
    if (alGiro.length < 6) { scartati += 1; continue; }
    alGiro.sort((a, b) => a.c.cum_time - b.c.cum_time);
    const leader = alGiro[0].drv;
    let regimeCong = null;
    try { regimeCong = regimeDiCella(alGiro[0].c); } catch { regimeCong = null; }

    for (const H of ORIZZONTI) {
      const off = proietta(garaSim, g, L, H, ctxOff, leader);
      const on = proietta(garaSim, g, L, H, ctxOn, leader);
      if (!off || !on) { scartati += 1; continue; }
      const veroDi = (drv) => g.perPilota.get(drv)?.get(L + H)?.cum_time ?? null;
      const vLeader = veroDi(leader);
      if (typeof vLeader !== 'number' || typeof off.cum[leader] !== 'number' || typeof on.cum[leader] !== 'number') { scartati += 1; continue; }

      for (const { drv } of alGiro) {
        if (drv === leader) continue;
        const vero = veroDi(drv);
        if (typeof vero !== 'number') continue;
        const pOff = off.cum[drv]; const pOn = on.cum[drv];
        if (typeof pOff !== 'number' || typeof pOn !== 'number') continue;
        // FINESTRA PULITA: chi entra ai box fra L e L+H ha un distacco vero che
        // salta, e non misura il PASSO. Il pilota e il leader devono essere puliti.
        let pulita = true;
        for (let k = L; k <= L + H; k += 1) {
          for (const d of [drv, leader]) {
            const c = g.perPilota.get(d)?.get(k);
            if (!c || c.in_lap === true || c.out_lap === true) { pulita = false; break; }
          }
          if (!pulita) break;
        }
        if (!pulita) continue;
        const veroGap = vero - vLeader;
        righe.push({
          gara: nomeSito, L, H, drv, regime: regimeCong,
          biasOff: ((pOff - off.cum[leader]) - veroGap) / H,
          biasOn: ((pOn - on.cum[leader]) - veroGap) / H,
          identici: pOff === pOn,
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════ le condizioni
const conRegime = righe.filter((r) => r.regime !== null);
const inVerde = righe.filter((r) => r.regime === null);

const perOrizzonte = {};
for (const H of ORIZZONTI) {
  const v = conRegime.filter((r) => r.H === H);
  perOrizzonte[H] = {
    n: v.length,
    bias_off: media(v.map((r) => r.biasOff)),
    bias_on: media(v.map((r) => r.biasOn)),
    mediana_off: mediana(v.map((r) => r.biasOff)),
    mediana_on: mediana(v.map((r) => r.biasOn)),
  };
}
const C1 = ORIZZONTI.every((H) => {
  const x = perOrizzonte[H];
  return x.n > 0 && Math.abs(x.bias_on) < Math.abs(x.bias_off);
});

// C2 — per gara, blocchi = gare. Una gara e' giudicabile se ha almeno 20 righe
// con regime; si conta su quante il |bias| scende (pool sui tre orizzonti).
const perGara = {};
for (const nome of [...new Set(conRegime.map((r) => r.gara))].sort()) {
  const v = conRegime.filter((r) => r.gara === nome);
  if (v.length < 20) { perGara[nome] = { n: v.length, giudicabile: false }; continue; }
  const off = Math.abs(media(v.map((r) => r.biasOff)));
  const on = Math.abs(media(v.map((r) => r.biasOn)));
  perGara[nome] = { n: v.length, giudicabile: true, bias_off: off, bias_on: on, scende: on < off };
}
const giudicabili = Object.values(perGara).filter((x) => x.giudicabile);
const scendono = giudicabili.filter((x) => x.scende).length;
const C2 = giudicabili.length > 0 && scendono >= Math.max(1, Math.ceil(giudicabili.length * 7 / 8));

// C3 — i congelamenti VERDI identici AL BIT
const verdiDiversi = inVerde.filter((r) => !r.identici).length;
const C3 = inVerde.length > 0 && verdiDiversi === 0;

const esito = {
  targhetta: {
    protocollo: 'ai_lab/confronto/PREREG_neutralizzazione.md — cancello scritto prima del codice',
    metrica: 'M2 (bias del distacco dal leader, s/giro) ristretto ai congelamenti con regime osservato ≤ L',
    decide: 'il BIAS, non l\'errore assoluto — dichiarato nella prereg',
    orizzonti: ORIZZONTI,
    data: '2026-08-01',
  },
  perimetro: { righe: righe.length, con_regime: conRegime.length, in_verde: inVerde.length, scartati },
  per_orizzonte: perOrizzonte,
  per_gara: perGara,
  condizioni: {
    C1_bias_scende_su_tutti_gli_orizzonti: C1,
    C2_scende_in_almeno_7_su_8_gare: C2,
    C3_verdi_identici_al_bit: C3,
    C4_M5_non_cala: null,   // misurata a parte: vedi nota
  },
  verdetto_parziale: C1 && C2 && C3,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(esito, null, 2));
} else {
  console.log('CANCELLO DEL PACCHETTO NEUTRALIZZAZIONE — PREREG_neutralizzazione.md');
  console.log(`  righe (gara,L,H,pilota): ${righe.length}  ·  con regime ${conRegime.length}  ·  in verde ${inVerde.length}  ·  scartati ${scartati}`);
  console.log('');
  console.log('  C1 — BIAS sui congelamenti CON REGIME (media, s/giro)');
  console.log('     H      n      spento      acceso     scende?');
  for (const H of ORIZZONTI) {
    const x = perOrizzonte[H];
    console.log(`    ${String(H).padStart(2)}  ${String(x.n).padStart(6)}   ${f(x.bias_off).padStart(9)}   ${f(x.bias_on).padStart(9)}     `
      + `${x.n > 0 && Math.abs(x.bias_on) < Math.abs(x.bias_off) ? 'sì' : 'NO'}`);
  }
  console.log(`    → C1 ${C1 ? 'PASSA' : 'FALLISCE'}`);
  console.log('');
  console.log('  C2 — per gara (blocchi = gare)');
  for (const [n, x] of Object.entries(perGara)) {
    if (!x.giudicabile) { console.log(`    ${n.padEnd(15)} n=${String(x.n).padStart(4)}  (non giudicabile, < 20 righe)`); continue; }
    console.log(`    ${n.padEnd(15)} n=${String(x.n).padStart(4)}  |bias| ${f(x.bias_off)} → ${f(x.bias_on)}   ${x.scende ? 'scende' : 'SALE'}`);
  }
  console.log(`    → scende in ${scendono}/${giudicabili.length} gare giudicabili · C2 ${C2 ? 'PASSA' : 'FALLISCE'}`);
  console.log('');
  console.log(`  C3 — congelamenti VERDI identici al bit: ${inVerde.length - verdiDiversi}/${inVerde.length} · C3 ${C3 ? 'PASSA' : `FALLISCE (${verdiDiversi} diversi)`}`);
  console.log('');
  console.log(`  VERDETTO PARZIALE (C1·C2·C3): ${esito.verdetto_parziale ? 'PASSA' : 'NON PASSA'}`);
  console.log('  C4 (M5 sui casi con regime) si misura a parte: non e\' su questo percorso.');
  // ── LA DIAGNOSI, quando acceso e spento danno lo STESSO numero ──────────────
  const identiciConRegime = conRegime.filter((r) => r.biasOn === r.biasOff).length;
  if (conRegime.length > 0 && identiciConRegime === conRegime.length) {
    console.log('');
    console.log('  ⚠ ACCESO E SPENTO DANNO LO STESSO NUMERO SU TUTTE E ' + conRegime.length + ' LE RIGHE CON REGIME.');
    console.log('    Non e\' un bug del banco: e\' che in PROIEZIONE PURA il regime non ha nessun consumatore.');
    console.log('    Nel costruttore `regime` alimenta solo `perditaBox` (la perdita ai box) e le soste');
    console.log('    assunte ai rivali — entrambe legate alle SOSTE, che qui non ci sono. E il passo non');
    console.log('    sa cosa sia un regime: zero occorrenze in engine/passo_v2.mjs e engine/kernel.mjs.');
    console.log('    Quindi N1 «slegare il regime dalle soste» rende il regime DISPONIBILE e nient\'altro.');
    console.log('    Il controfattuale del referto (bias 1,068 -> 0,699 a 3 giri) non veniva da questo:');
    console.log('    veniva dal CONGELARE I DISTACCHI per P giri, cioe\' da una fisica che non esiste in');
    console.log('    nessun modulo. Quella e\' la voce da costruire, e ha bisogno della sua misura');
    console.log('    (di quanto si comprimono davvero i distacchi sotto SC/VSC) e del suo cancello.');
  }
}
