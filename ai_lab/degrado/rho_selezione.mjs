#!/usr/bin/env node
// rho_selezione.mjs — R1 di PREREG_rho_selezione.md: il rho e' basso perche' lo misuriamo
// sui sopravvissuti?
//
//     node ai_lab/degrado/rho_selezione.mjs [--json]
//
// NON DECIDE e NON ACCENDE. Esegue la scala d'eta' e il suo placebo, e legge il risultato
// con le soglie gia' scritte nella prereg.
//
// LA SCALA. Stesso stimatore gia' in casa (degradoDi, effetti fissi gara|pilota e
// gara|giro), su finestre d'eta' annidate. Sotto selezione rho(A) DECRESCE al crescere di A:
// aggiungendo eta' alte si aggiungono sopravvissuti, cioe' gomme buone.
//
// IL PLACEBO, che e' il pezzo che conta. Una scala decrescente puo' essere selezione OPPURE
// curvatura (degrado concavo). Permutando le LUNGHEZZE degli stint fra gli stint della
// stessa gara si rompe la selezione e si lascia intatta la curvatura: se le scale finte
// decrescono quanto la vera, e' curvatura.
//
// COSA LO FA USCIRE 1:
//   (a) rho(infinito) non riproduce il sigillo 0,030776 — allora lo strumento non e' tarato
//       e nessuna scala costruita sopra vale niente.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
import { campo2026, degradoDi } from './campo.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Da PREREG_rho_selezione.md §2 e §5. NON si toccano qui.
const FINESTRE = [10, 15, 20, 25, 30, Infinity];
const ETA_MINIMA = 5;          // il rodaggio esce da TUTTE le finestre
const R1_RAPPORTO = 1.25;
const PLACEBO_RIPETIZIONI = 500;
const PLACEBO_SEME = 20260805;
// LA TARATURA, e la prima scrittura l'aveva sbagliata: confrontavo rho(∞) col sigillo del
// MOTORE (0,030776), che viene da un altro stimatore e da un altro perimetro. Il numero
// giusto contro cui tarare questo strumento e' quello che lo stimatore del CAMPO pubblica
// sul campione intero, senza pavimento d'eta': 0,04167 (ESITO_degrado_dal_campo.md, D1).
// Se non lo riproduce, la scala costruita sopra non vale niente.
const TARATURA_CAMPO = 0.04167;

// ── le osservazioni, con l'identita' dello stint ────────────────────────────
// Serve lo stint per poter permutare le LUNGHEZZE: senza, non c'e' niente da troncare.
const campo = campo2026();
const righe = [];
for (const [gara, { righe: rr }] of Object.entries(campo)) {
  for (const r of rr) {
    righe.push({
      gara,
      drv: `${gara}|${r.drv}`,
      lap: `${gara}|${r.lap}`,
      stint: `${gara}|${r.drv}|${r.stint ?? 'x'}`,
      eta: r.eta, t: r.t, mescola: r.mescola,
    });
  }
}

// la lunghezza osservata di ogni stint = la sua eta' massima nel campione
const lunghezza = new Map();
for (const r of righe) lunghezza.set(r.stint, Math.max(lunghezza.get(r.stint) ?? 0, r.eta));

/** rho su una finestra d'eta', col troncamento (cap per stint) applicato prima. */
function rhoFinestra(A, cap = null) {
  const sel = righe.filter((r) => {
    if (r.eta < ETA_MINIMA || r.eta > A) return false;
    if (cap && r.eta > (cap.get(r.stint) ?? Infinity)) return false;
    return true;
  });
  const d = degradoDi(sel, { perMescola: false });
  return { rho: d.rho, n: sel.length, identificazione: d.identificazione ?? null };
}

/** La scala: rho su ogni finestra, e il suo declino. */
function scala(cap = null) {
  const punti = FINESTRE.map((A) => ({ A, ...rhoFinestra(A, cap) }));
  const stretta = punti[0].rho; const larga = punti[punti.length - 1].rho;
  return { punti, stretta, larga, rapporto: (stretta === null || !larga) ? null : stretta / larga };
}

const vera = scala();

// (a) taratura: sul campione INTERO, senza pavimento d'eta', si deve ritrovare il numero
// pubblicato dallo stimatore del campo.
const rhoInf = vera.punti[vera.punti.length - 1].rho;
{
  const d = degradoDi(righe, { perMescola: false });
  if (d.rho === null || Math.abs(d.rho - TARATURA_CAMPO) > 5e-5) {
    console.error(`TARATURA FALLITA: sul campione intero esce ${d.rho} invece di ${TARATURA_CAMPO} (ESITO_degrado_dal_campo.md, D1).`);
    console.error('Uno strumento che non riproduce il numero pubblicato non puo\' giudicare una scala costruita sopra.');
    process.exit(1);
  }
  stampa(`   taratura: sul campione intero rho = ${d.rho.toFixed(5)}, come il pubblicato ${TARATURA_CAMPO}  ✓`);
}

stampa('');
stampa('══ IL RHO E LA SELEZIONE — PREREG_rho_selezione.md ═════════════════════════');
stampa(`   ${righe.length} osservazioni · ${Object.keys(campo).length} gare · eta' >= ${ETA_MINIMA} (il rodaggio esce da tutte le finestre)`);
stampa('');
stampa('   finestra    n      rho        identificazione');
for (const p of vera.punti) {
  stampa(`   eta' <= ${String(p.A === Infinity ? '∞' : p.A).padStart(3)}  ${String(p.n).padStart(5)}   ${p.rho === null ? '   —   ' : p.rho.toFixed(5)}      ${p.identificazione === null ? '—' : p.identificazione.toFixed(2)}`);
}
stampa('');
stampa(`   rapporto rho(≤10)/rho(∞) = ${vera.rapporto === null ? '—' : vera.rapporto.toFixed(3)}`);

// ── il placebo: le lunghezze permutate DENTRO la gara (E11) ─────────────────
let seme = PLACEBO_SEME;
const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const stintPerGara = new Map();
for (const [s] of lunghezza) {
  const g = s.split('|')[0];
  if (!stintPerGara.has(g)) stintPerGara.set(g, []);
  stintPerGara.get(g).push(s);
}

const rapportiFinti = [];
let intattiTot = 0;
for (let k = 0; k < PLACEBO_RIPETIZIONI; k += 1) {
  const cap = new Map();
  let intatti = 0;
  for (const [, elenco] of stintPerGara) {
    const L = elenco.map((s) => lunghezza.get(s));
    for (let i = L.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    elenco.forEach((s, i) => {
      // si puo' solo ACCORCIARE: una L piu' lunga della sua lascia lo stint intatto.
      // E' il limite dichiarato nella prereg §3, ed e' conservativo.
      const mio = lunghezza.get(s);
      if (L[i] >= mio) intatti += 1;
      cap.set(s, Math.min(L[i], mio));
    });
  }
  intattiTot += intatti;
  const s = scala(cap);
  if (s.rapporto !== null) rapportiFinti.push(s.rapporto);
}
const battuti = rapportiFinti.filter((r) => r >= vera.rapporto).length;
const pPlacebo = (battuti + 1) / (rapportiFinti.length + 1);
const medianaFinti = [...rapportiFinti].sort((a, b) => a - b)[Math.floor(rapportiFinti.length / 2)];

const R1 = vera.rapporto !== null && vera.rapporto >= R1_RAPPORTO && pPlacebo <= 0.05;

stampa('');
stampa(`   PLACEBO · ${rapportiFinti.length} permutazioni delle lunghezze dentro la gara (seme ${PLACEBO_SEME})`);
stampa(`     rapporto finto mediano ${medianaFinti.toFixed(3)} · finti >= vero ${battuti}/${rapportiFinti.length} · p = ${pPlacebo.toFixed(4)}`);
stampa(`     stint lasciati intatti (la L pescata era piu' lunga della loro): ${(intattiTot / PLACEBO_RIPETIZIONI).toFixed(0)} su ${lunghezza.size} in media`);
stampa('');
stampa(`   R1  la selezione esiste (rapporto >= ${R1_RAPPORTO} E placebo p <= 0,05):`
  + `  ${vera.rapporto === null ? '—' : vera.rapporto.toFixed(3)} · p ${pPlacebo.toFixed(4)}   ${R1 ? 'PASSA' : 'NON PASSA'}`);

let lettura;
if (!R1 && vera.rapporto !== null && vera.rapporto >= R1_RAPPORTO) {
  lettura = 'La scala decresce, ma le scale FINTE decrescono uguale: e\' CURVATURA, non selezione. '
    + 'Il degrado e\' genuinamente concavo, e il rho basso non e\' colpa dei sopravvissuti. '
    + 'Toglie di mezzo l\'unica spiegazione che il progetto aveva per il sotto-fermarsi.';
} else if (!R1) {
  lettura = 'La scala non decresce abbastanza: il rho non dipende dalla finestra d\'eta\'. '
    + 'Il rho basso e\' reale, e il sotto-fermarsi del motore ha un\'altra causa.';
} else {
  const fattore = vera.rapporto;
  lettura = `La selezione ESISTE: il rho misurato sulle eta' basse e' ${fattore.toFixed(2)} volte quello `
    + 'misurato su tutte, e il placebo esclude la curvatura. Resta da vedere (R2) se basta a spostare il '
    + 'piano: per volere due soste servirebbe un fattore fra 2,6 e 8.';
}
stampa('');
for (const r of lettura.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'R1 di PREREG_rho_selezione.md — il rho su finestre d eta annidate, e il placebo che separa la selezione dalla curvatura.',
    prereg: 'ai_lab/degrado/PREREG_rho_selezione.md',
    generato_da: 'ai_lab/degrado/rho_selezione.mjs',
    data: '2026-08-05',
    natura: 'DIAGNOSI — non accende e non spedisce niente',
    perimetro: `11 gare 2026, giri verdi utilizzabili, slick, eta >= ${ETA_MINIMA} (il rodaggio esce da tutte le finestre)`,
    placebo: 'lunghezze degli stint permutate DENTRO la gara (E11): rompe la selezione, lascia intatta la curvatura. Si puo solo accorciare, mai allungare: conservativo.',
    taratura: `rho sul campione intero, senza pavimento d eta, contro il pubblicato ${TARATURA_CAMPO}`,
  },
  n: righe.length, n_stint: lunghezza.size,
  scala: vera.punti.map((p) => ({ finestra: p.A === Infinity ? null : p.A, n: p.n, rho: p.rho, identificazione: p.identificazione })),
  rapporto: vera.rapporto,
  rho_infinito: rhoInf, taratura_campo: TARATURA_CAMPO,
  placebo: { ripetizioni: rapportiFinti.length, rapporto_mediano: medianaFinti, battuti, p: pPlacebo, stint_intatti_medi: intattiTot / PLACEBO_RIPETIZIONI },
  R1: { passa: R1, soglia_rapporto: R1_RAPPORTO },
  lettura,
};
writeFileSync(path.join(RADICE, 'ai_lab/degrado/ESITO_rho_selezione.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/degrado/ESITO_rho_selezione.json');
