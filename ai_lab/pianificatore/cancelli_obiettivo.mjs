#!/usr/bin/env node
// cancelli_obiettivo.mjs — i quattro cancelli di PREREG_obiettivo_posizione.md.
//
//     node ai_lab/pianificatore/cancelli_obiettivo.mjs [--json]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Obiettivo, nullo, metrica e soglie
// sono copiati da li' e non si toccano.
//
// I DUE BRACCI DIFFERISCONO PER UN SOLO INGRESSO: `obiettivo`.
//   N1  'tempo'      il motore di oggi: minimizza il cumulato alla bandiera
//   NUOVO 'posizione' minimizza (posizione, cumulato) in ordine lessicografico
// Stesso tetto, stessi rivali, stessa vita mescola, stesso traffico. Se una sola altra
// cosa cambiasse fra i due bracci, il confronto appaiato non sarebbe un confronto.
//
// I RIVALI RESTANO FERMI in tutti e due i bracci, e non e' una svista: il ramo
// comportamentale e' stato misurato NULL e non e' in produzione. Il braccio nullo dev'essere
// il motore VERO di oggi, non una sua versione migliorata a meta'.
//
// COSA LO FA USCIRE 1:
//   (a) il perimetro non e' quello del banco delle decisioni;
//   (b) un piano scelto viola il vincolo delle due mescole slick — allora l'obiettivo nuovo
//       sta comprando posizione con una squalifica, e non e' un compromesso, e' un difetto.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { testSegni, mediana } from '../confronto/bandiera.mjs';
import { decisioni, vitaDa } from '../degrado/decisioni.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie da PREREG_obiettivo_posizione.md §4. NON si toccano qui.
const P2_CALO_MINIMO_PUNTI = 5;
const P4_QUOTA_DIVERSI = 0.10;
const SOGLIA_P = 0.05;

const D = decisioni();

/** La durata che il pianificatore sceglierebbe, con l'obiettivo dato. */
function scelta(d, contesto, obiettivo) {
  const g = contesto.gare[garaSimDi(d.gara)];
  if (!g) return null;
  try {
    const p = pianoOttimo(
      { gara: garaSimDi(d.gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri, obiettivo },
      { ...contesto, nGiriGara: g.nGiri },
    );
    if (!p?.migliore) return null;
    const soste = p.migliore.piano.soste;
    return {
      durata: soste.length ? soste[0].giro - d.giro_inizio : g.nGiri - d.giro_inizio,
      arrivi: soste.length === 0,
      giri: soste.map((s) => s.giro).join(','),
      posizione: p.migliore.posizione ?? null,
      popolazione: p.migliore.popolazione ?? null,
      mescole: soste.map((s) => s.mescola),
      k: soste.length,
    };
  } catch { return null; }
}

const righe = [];
let violazioni = 0;
let popolazioneDiversa = 0;
for (const gara of gare()) {
  const mie = D.filter((x) => x.gara === gara);
  if (!mie.length) continue;
  const vitaLoo = vitaDa(D, gara);
  const ctx = { ...contestoNuovo(gara), vitaMescola: { attivo: true, giri: vitaLoo, natura: 'PRIOR_COMPORTAMENTALE' } };
  for (const d of mie) {
    const a = scelta(d, ctx, 'tempo');
    const b = scelta(d, ctx, 'posizione');
    if (!a || !b) continue;
    // (b) la guardia del regolamento: ogni mescola del piano dev'essere una slick valida
    for (const m of b.mescole) if (m !== null && !MESCOLE_SLICK_ATTUALI.has(m)) violazioni += 1;
    if (a.popolazione !== null && b.popolazione !== null && a.popolazione !== b.popolazione) popolazioneDiversa += 1;
    righe.push({
      gara, drv: d.drv, vera: d.durata,
      tempo: a.durata, posizione: b.durata,
      e_tempo: Math.abs(a.durata - d.durata), e_posizione: Math.abs(b.durata - d.durata),
      arrivi_tempo: a.arrivi, arrivi_posizione: b.arrivi,
      diverso: a.giri !== b.giri,
      pos_tempo: a.posizione, pos_posizione: b.posizione,
    });
  }
  stampa(`   ${gara.padEnd(14)} ${String(righe.filter((r) => r.gara === gara).length).padStart(3)}/${String(mie.length).padStart(3)} decisioni`);
}

if (!righe.length) { console.error('perimetro vuoto: non giudico.'); process.exit(1); }

const med = (k) => mediana(righe.map((r) => r[k]));
const quota = (k) => righe.filter((r) => r[k]).length / righe.length;
const diversi = righe.filter((r) => r.diverso).length;
const segni = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_posizione, b: r.e_tempo })));

const P1 = med('e_posizione') <= med('e_tempo');
const P2 = (quota('arrivi_tempo') - quota('arrivi_posizione')) * 100 >= P2_CALO_MINIMO_PUNTI;
const P3 = segni.vinceA >= segni.vinceB || segni.p >= SOGLIA_P;
const P4 = diversi / righe.length >= P4_QUOTA_DIVERSI;

stampa('');
stampa('══ CANCELLI DELL\'OBIETTIVO — PREREG_obiettivo_posizione.md ════════════════');
stampa(`   ${righe.length} decisioni · tetto acceso · rivali fermi (come in produzione)`);
stampa('');
stampa(`   errore mediano in giri:   TEMPO ${med('e_tempo')}   ·   POSIZIONE ${med('e_posizione')}`);
stampa(`   «arrivi cosi'»:           TEMPO ${(100 * quota('arrivi_tempo')).toFixed(1)}%   ·   POSIZIONE ${(100 * quota('arrivi_posizione')).toFixed(1)}%`);
stampa('');
stampa(`   P1  non peggiora la durata prevista: ${med('e_posizione')} <= ${med('e_tempo')}   ${P1 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   P2  «arrivi cosi'» cala di almeno ${P2_CALO_MINIMO_PUNTI} punti:`
  + ` ${((quota('arrivi_tempo') - quota('arrivi_posizione')) * 100).toFixed(1)}   ${P2 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   P3  non perde in modo significativo: ${segni.vinceA}-${segni.vinceB} (pari ${segni.pari}, p = ${segni.p.toFixed(4)})   ${P3 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   P4  i due obiettivi scelgono diverso in almeno il ${(100 * P4_QUOTA_DIVERSI).toFixed(0)}%:`
  + ` ${diversi}/${righe.length} = ${(100 * diversi / righe.length).toFixed(1)}%   ${P4 ? 'PASSA' : 'NON PASSA'}`);
stampa('');
stampa(`   guardie: violazioni del regolamento ${violazioni} · popolazione diversa fra i bracci ${popolazioneDiversa}/${righe.length}`);

let verdetto;
if (!P4) verdetto = 'NON SI SPEDISCE — P4 fallisce: l\'obiettivo e\' inerte. Con questo tetto e questi rivali la posizione non distingue i piani, e il difetto era gia\' chiuso dalle altre due voci.';
else if (!P1 || !P3) verdetto = 'NON SI SPEDISCE — la posizione costa piu\' di quanto rende.';
else if (violazioni > 0) verdetto = `NON SI SPEDISCE — ${violazioni} piani scelti violano il vincolo delle due mescole slick: e' un difetto, non un compromesso.`;
else if (!P2) verdetto = 'SI SPEDISCE, e si dichiara: l\'obiettivo nuovo NON e\' quello che cura «arrivi cosi\'», ma non fa danno e sceglie meglio.';
else verdetto = 'SI ACCENDE: tutti i cancelli passano, e la posizione diventa l\'obiettivo del prodotto.';

stampa('');
stampa('   LETTURA OBBLIGATA DALLA PREREG §5:');
for (const r of verdetto.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli P1-P4 di PREREG_obiettivo_posizione.md — la posizione alla bandiera come obiettivo del pianificatore, contro il tempo.',
    prereg: 'ai_lab/pianificatore/PREREG_obiettivo_posizione.md',
    generato_da: 'ai_lab/pianificatore/cancelli_obiettivo.mjs',
    data: '2026-08-04',
    i_due_bracci: 'identici salvo `obiettivo`: stesso tetto, stessi rivali (fermi, come in produzione), stessa vita mescola leave-one-race-out',
    soglie: { p2_calo_punti: P2_CALO_MINIMO_PUNTI, p4_quota_diversi: P4_QUOTA_DIVERSI, p: SOGLIA_P },
  },
  n: righe.length,
  errore_mediano: { tempo: med('e_tempo'), posizione: med('e_posizione') },
  arrivi_cosi: { tempo: quota('arrivi_tempo'), posizione: quota('arrivi_posizione') },
  cancelli: {
    P1: { passa: P1 }, P2: { passa: P2 }, P3: { passa: P3, ...segni },
    P4: { passa: P4, diversi, quota: diversi / righe.length },
  },
  guardie: { violazioni_regolamento: violazioni, popolazione_diversa: popolazioneDiversa },
  // DOVE i due obiettivi si distinguono: in un NULL da inerzia e' la sola parte informativa.
  per_gara: Object.fromEntries([...new Set(righe.map((r) => r.gara))].map((g) => {
    const q = righe.filter((r) => r.gara === g);
    return [g, { n: q.length, diversi: q.filter((r) => r.diverso).length }];
  })),
  differenti: righe.filter((r) => r.diverso).map((r) => ({
    gara: r.gara, drv: r.drv, vera: r.vera, tempo: r.tempo, posizione: r.posizione,
    pos_tempo: r.pos_tempo, pos_posizione: r.pos_posizione,
  })),
  verdetto,
};
writeFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_cancelli_obiettivo.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/pianificatore/ESITO_cancelli_obiettivo.json');
