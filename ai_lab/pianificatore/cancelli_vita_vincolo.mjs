#!/usr/bin/env node
// cancelli_vita_vincolo.mjs — i cinque cancelli di PREREG_vita_vincolo.md.
//
//     node ai_lab/pianificatore/cancelli_vita_vincolo.mjs [--json]
//
// NON DECIDE e NON ACCENDE. I due bracci differiscono per UN solo ingresso: `vitaMassima`.
//
// COSA LO FA USCIRE 1:
//   (a) il perimetro non e' quello del banco delle decisioni;
//   (b) il braccio senza vincolo non riproduce il motore di oggi (errore mediano 7, «troppo
//       poche» 114) — cioe' lo strumento non e' tarato.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { testSegni, mediana } from '../confronto/bandiera.mjs';
import { decisioni, vitaDa, vitaCieca, MESCOLE } from '../degrado/decisioni.mjs';
import { stintConclusi } from '../degrado/durate.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie da PREREG_vita_vincolo.md §5. NON si toccano qui.
const V1_QUOTA = 0.10;
const V2_TROPPO_POCHE = 90;
const V2_TROPPE = 20;
const V3_ERRORE = 7;
const V4_PAVIMENTO = 5;
const QUANTILE = 0.90;
// La taratura: il motore di oggi sul banco delle decisioni (ESITO_scomposizione_errore.md).
const BASE = { errore: 7, troppo_poche: 114, troppe: 0, n: 167 };

const D = decisioni();

const quantile = (v, p) => {
  const s = [...v].sort((a, b) => a - b);
  const i = (s.length - 1) * p; const lo = Math.floor(i); const hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};

// IL VINCOLO: p90 delle durate osservate per mescola. Esce dalle stesse 427 decisioni del
// sigillo della vita, non da una stima nuova.
const VITA_MASSIMA = Object.fromEntries(
  MESCOLE.map((m) => [m, quantile(D.filter((d) => d.mescola === m).map((d) => d.durata), QUANTILE)]),
);
const vietati = D.filter((d) => d.durata > (VITA_MASSIMA[d.mescola] ?? Infinity)).length;

function scelta(d, contesto, vitaMassima) {
  const g = contesto.gare[garaSimDi(d.gara)];
  if (!g) return null;
  try {
    const p = pianoOttimo({
      gara: garaSimDi(d.gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri, vitaMassima,
    }, { ...contesto, nGiriGara: g.nGiri });
    if (!p?.migliore) return null;
    const soste = p.migliore.piano.soste;
    return {
      durata: soste.length ? soste[0].giro - d.giro_inizio : g.nGiri - d.giro_inizio,
      k: soste.length, giri: soste.map((s) => s.giro).join(','),
      mescole: soste.map((s) => s.mescola),
      rilassato: p.vincolo_rilassato === true,
    };
  } catch { return null; }
}

const righe = [];
let violazioni = 0; let rilassati = 0;
for (const gara of gare()) {
  const mie = D.filter((x) => x.gara === gara);
  if (!mie.length) continue;
  const vitaLoo = vitaDa(D, gara);
  const ctx = { ...contestoNuovo(gara), vitaMescola: { attivo: true, giri: vitaLoo, natura: 'PRIOR_COMPORTAMENTALE' } };
  const g = ctx.gare[garaSimDi(gara)];
  const sostePer = new Map();
  for (const s of stintConclusi(g.perPilota, { gara })) {
    if (!sostePer.has(s.drv)) sostePer.set(s.drv, []);
    sostePer.get(s.drv).push(s.giro_sosta);
  }
  for (const d of mie) {
    const a = scelta(d, ctx, null);
    const b = scelta(d, ctx, VITA_MASSIMA);
    if (!a || !b) continue;
    if (b.rilassato) rilassati += 1;
    for (const m of b.mescole) if (m !== null && !MESCOLE_SLICK_ATTUALI.has(m)) violazioni += 1;
    const kVero = (sostePer.get(d.drv) ?? []).filter((giro) => giro >= d.giro_inizio).length;
    righe.push({
      gara, drv: d.drv, vera: d.durata, k_vero: kVero,
      a: a.durata, b: b.durata, k_a: a.k, k_b: b.k,
      e_a: Math.abs(a.durata - d.durata), e_b: Math.abs(b.durata - d.durata),
      diverso: a.giri !== b.giri,
    });
  }
}

if (!righe.length) { console.error('perimetro vuoto: non giudico.'); process.exit(1); }

const med = (k) => mediana(righe.map((r) => r[k]));
const poche = (k) => righe.filter((r) => r[k] < r.k_vero).length;
const troppe = (k) => righe.filter((r) => r[k] > r.k_vero).length;
const diversi = righe.filter((r) => r.diverso).length;

// (b) taratura: il braccio SENZA vincolo dev'essere il motore di oggi
const tarato = med('e_a') === BASE.errore && poche('k_a') === BASE.troppo_poche && troppe('k_a') === BASE.troppe;
stampa('');
stampa('══ LA VITA COME VINCOLO — PREREG_vita_vincolo.md ═══════════════════════════');
stampa(`   vincolo p${QUANTILE * 100}: ${MESCOLE.map((m) => `${m} ${VITA_MASSIMA[m].toFixed(1)}`).join(' · ')}`
  + `  ·  vieta ${vietati}/${D.length} stint veri (${(100 * vietati / D.length).toFixed(1)}%)`);
stampa('');
stampa(`   TARATURA · il braccio senza vincolo deve essere il motore di oggi:`);
stampa(`     errore mediano ${med('e_a')} (atteso ${BASE.errore}) · troppo poche ${poche('k_a')} (atteso ${BASE.troppo_poche})`
  + ` · troppe ${troppe('k_a')} (atteso ${BASE.troppe})   ${tarato ? '✓' : '✗'}`);
if (!tarato) {
  console.error('\n  TARATURA FALLITA: lo strumento non riproduce il motore di oggi. NON giudico i cancelli.');
  process.exit(1);
}

const V1 = diversi / righe.length >= V1_QUOTA;
const V2 = poche('k_b') <= V2_TROPPO_POCHE && troppe('k_b') <= V2_TROPPE;
const V3 = med('e_b') <= V3_ERRORE;
const V4 = med('e_b') <= V4_PAVIMENTO;
const V5 = violazioni === 0;
const segni = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_b, b: r.e_a })));

stampa('');
stampa(`   errore mediano:   senza vincolo ${med('e_a')}   ·   col vincolo ${med('e_b')}`);
stampa(`   numero di soste:  troppo poche ${poche('k_a')} → ${poche('k_b')}   ·   troppe ${troppe('k_a')} → ${troppe('k_b')}`);
stampa(`   piani rilassati (nessun piano fattibile): ${rilassati}/${righe.length}`);
stampa('');
stampa(`   V1  cambia davvero qualcosa (≥ ${V1_QUOTA * 100}%): ${diversi}/${righe.length} = ${(100 * diversi / righe.length).toFixed(1)}%   ${V1 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   V2  riduce il bias (troppo poche ≤ ${V2_TROPPO_POCHE}, troppe ≤ ${V2_TROPPE}): ${poche('k_b')} · ${troppe('k_b')}   ${V2 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   V3  non peggiora (≤ ${V3_ERRORE}): ${med('e_b')}   ${V3 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   V4  raggiunge il pavimento (≤ ${V4_PAVIMENTO}): ${med('e_b')}   ${V4 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   V5  non fa danno (zero violazioni del regolamento): ${violazioni}   ${V5 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   segni col vincolo contro senza: ${segni.vinceA}-${segni.vinceB} (pari ${segni.pari}, p = ${segni.p.toFixed(4)})`);

let verdetto;
if (!V1) verdetto = 'IL VINCOLO NON LEGA — e la lettura e\' forte: nessun muro compatibile con cio\' che i team hanno davvero fatto e\' abbastanza stretto da spostare il piano. Si chiude l\'ultimo candidato: il sotto-fermarsi non ha una causa dentro il modello del tempo sul giro.';
else if (!V5) verdetto = `NON SI SPEDISCE — ${violazioni} piani violano il regolamento: e' un difetto, non un compromesso.`;
else if (!V2) verdetto = 'RIPORTATO, NON SPEDITO — il vincolo lega ma non cura il bias a senso unico.';
else if (!V3) verdetto = 'NON SI SPEDISCE — cura il bias e costa accuratezza. Il bias e\' una diagnosi, non il bersaglio del prodotto.';
else if (!V4) verdetto = 'SI PROPONE, e si dichiara: il vincolo migliora ma NON raggiunge il pavimento. Il motore resta peggio di una tabella di tre numeri su questa domanda.';
else verdetto = 'SI PROPONE L\'ACCENSIONE al PO: tutti i cancelli passano.';

stampa('');
stampa('   LETTURA OBBLIGATA DALLA PREREG §6:');
for (const r of verdetto.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli V1-V5 di PREREG_vita_vincolo.md — la vita della gomma come vincolo sul piano invece che come penalita sul passo.',
    prereg: 'ai_lab/pianificatore/PREREG_vita_vincolo.md',
    generato_da: 'ai_lab/pianificatore/cancelli_vita_vincolo.mjs',
    data: '2026-08-05',
    natura: 'PRIOR_COMPORTAMENTALE — deroga gia firmata; cambia COME entra un parametro che c era gia',
    i_due_bracci: 'identici salvo `vitaMassima`',
    soglie: { quantile: QUANTILE, v1: V1_QUOTA, v2: [V2_TROPPO_POCHE, V2_TROPPE], v3: V3_ERRORE, v4: V4_PAVIMENTO },
  },
  vincolo: VITA_MASSIMA, stint_veri_vietati: vietati, su: D.length,
  n: righe.length, piani_rilassati: rilassati,
  errore_mediano: { senza: med('e_a'), con: med('e_b') },
  soste: { troppo_poche: { senza: poche('k_a'), con: poche('k_b') }, troppe: { senza: troppe('k_a'), con: troppe('k_b') } },
  cancelli: { V1: { passa: V1, diversi, quota: diversi / righe.length }, V2: { passa: V2 }, V3: { passa: V3 }, V4: { passa: V4 }, V5: { passa: V5, violazioni } },
  segni,
  verdetto,
};
writeFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_vita_vincolo.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/pianificatore/ESITO_vita_vincolo.json');
