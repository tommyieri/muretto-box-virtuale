#!/usr/bin/env node
// cancelli_rivali.mjs — i cancelli di PREREG_rivali_comportamentali.md.
//
//     node ai_lab/confronto/cancelli_rivali.mjs [--json]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso.
//
// TRE BRACCI, e differiscono per una cosa sola — cosa fanno i rivali:
//   FERMI          il motore di oggi: nessun rivale si ferma mai (e in produzione e' cosi')
//   ATTESI         ogni rivale si ferma quando la gomma che aveva al congelamento finisce
//   A CASO         placebo R4: stessa finestra, giro sorteggiato con seme dichiarato
//
// COSA LO FA USCIRE 1:
//   (a) il braccio FERMI non riproduce il motore di oggi (errore mediano 7, «arrivi cosi'»
//       64/167): lo strumento non e' tarato.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from './banco.mjs';
import { testSegni, mediana } from './bandiera.mjs';
import { decisioni, vitaDa, MESCOLE } from '../degrado/decisioni.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';
import { pianiComportamentali } from '../../simulatore/scenario/rivali.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie da PREREG_rivali_comportamentali.md §4. NON si toccano qui.
const R1_ERRORE_MAX = 6;
const R2_ARRIVI_MAX = 45;
const SOGLIA_P = 0.05;
const PLACEBO_SEME = 20260804;
// La taratura: il motore di OGGI, col tetto acceso e i rivali fermi.
const BASE = { errore: 7, arrivi: 64, n: 167 };

const D = decisioni();

function durataPrevista(d, contesto, sosteAtteseRivali) {
  const g = contesto.gare[garaSimDi(d.gara)];
  if (!g) return null;
  try {
    const p = pianoOttimo(
      { gara: garaSimDi(d.gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri, sosteAtteseRivali },
      { ...contesto, nGiriGara: g.nGiri },
    );
    if (!p?.migliore) return null;
    const soste = p.migliore.piano.soste;
    return soste.length
      ? { durata: soste[0].giro - d.giro_inizio, arrivi: false }
      : { durata: g.nGiri - d.giro_inizio, arrivi: true };
  } catch { return null; }
}

let seme = PLACEBO_SEME;
const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };

const righe = [];
for (const gara of gare()) {
  const mie = D.filter((d) => d.gara === gara);
  if (!mie.length) continue;
  const vitaLoo = vitaDa(D, gara);
  const base = contestoNuovo(gara);
  const ctx = { ...base, vitaMescola: { attivo: true, giri: vitaLoo, natura: 'PRIOR_COMPORTAMENTALE' } };
  const g = ctx.gare[garaSimDi(gara)];
  for (const d of mie) {
    const arg = { g, freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri };
    const attesi = pianiComportamentali(arg, ctx);
    const caso = pianiComportamentali(arg, ctx, rnd);
    const fermi = durataPrevista(d, ctx, undefined);
    const conAttesi = durataPrevista(d, ctx, attesi ?? undefined);
    const conCaso = durataPrevista(d, ctx, caso ?? undefined);
    if (!fermi || !conAttesi || !conCaso) continue;
    righe.push({
      gara, drv: d.drv, mescola: d.mescola, vera: d.durata,
      fermi: fermi.durata, attesi: conAttesi.durata, caso: conCaso.durata,
      arrivi_fermi: fermi.arrivi, arrivi_attesi: conAttesi.arrivi, arrivi_caso: conCaso.arrivi,
      e_fermi: Math.abs(fermi.durata - d.durata),
      e_attesi: Math.abs(conAttesi.durata - d.durata),
      e_caso: Math.abs(conCaso.durata - d.durata),
      rivali_con_piano: attesi ? Object.keys(attesi).length : 0,
    });
  }
}

if (!righe.length) { console.error('nessuna decisione misurabile'); process.exit(1); }

const med = (k) => mediana(righe.map((r) => r[k]));
const arrivi = (k) => righe.filter((r) => r[k]).length;

stampa('');
stampa('══ CANCELLI DEI RIVALI COMPORTAMENTALI — PREREG_rivali_comportamentali.md ══');
stampa(`   ${righe.length} decisioni misurate · rivali con un piano: mediana ${mediana(righe.map((r) => r.rivali_con_piano))}`);
stampa('');
stampa('══ TARATURA — il braccio FERMI deve riprodurre il motore di oggi ═══════════');
const taraturaOk = med('e_fermi') === BASE.errore && arrivi('arrivi_fermi') === BASE.arrivi && righe.length === BASE.n;
stampa(`   errore mediano ${med('e_fermi')} (atteso ${BASE.errore}) · «arrivi cosi'» ${arrivi('arrivi_fermi')} (atteso ${BASE.arrivi}) · n ${righe.length} (atteso ${BASE.n})`);
if (!taraturaOk) {
  stampa('   TARATURA FALLITA: non giudico. Un cancello con un metro storto e\' peggio di nessun cancello.');
  process.exit(1);
}
stampa('   taratura verde.');

stampa('');
stampa('                        errore mediano   «arrivi cosi\'»');
stampa(`   rivali FERMI (oggi)         ${med('e_fermi')}              ${arrivi('arrivi_fermi')}/${righe.length}`);
stampa(`   rivali ATTESI               ${med('e_attesi')}              ${arrivi('arrivi_attesi')}/${righe.length}`);
stampa(`   rivali A CASO (placebo)     ${med('e_caso')}              ${arrivi('arrivi_caso')}/${righe.length}`);

const s1 = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_attesi, b: r.e_fermi })));
const R1 = med('e_attesi') <= R1_ERRORE_MAX && s1.vinceA > s1.vinceB && s1.p <= SOGLIA_P;
const R2 = arrivi('arrivi_attesi') < R2_ARRIVI_MAX;
const sP = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_caso, b: r.e_fermi })));
// R4: il guadagno NON deve sopravvivere al placebo, cioe' i rivali a caso non devono fare
// altrettanto bene. Se lo fanno, il guadagno e' dell'ESISTERE delle soste, non del quando.
const R4 = !(med('e_caso') <= med('e_attesi') && sP.vinceA >= s1.vinceA);

stampa('');
stampa(`   R1  errore mediano <= ${R1_ERRORE_MAX} e segni p <= ${SOGLIA_P}:`);
stampa(`         ${med('e_attesi')} · ${s1.vinceA}-${s1.vinceB} (pari ${s1.pari}, p=${s1.p.toFixed(4)})   ${R1 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   R2  «arrivi cosi'» sotto ${R2_ARRIVI_MAX}/${righe.length}:`);
stampa(`         ${arrivi('arrivi_attesi')}   ${R2 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   R4  placebo (rivali a caso, seme ${PLACEBO_SEME}):`);
stampa(`         a caso ${med('e_caso')} · ${sP.vinceA}-${sP.vinceB} contro i fermi   ${R4 ? 'PASSA (il quando conta)' : 'NON PASSA (conta solo che si fermino)'}`);
stampa('');
stampa('   R3 (risposta a due giri) si misura a parte: e\' un altro banco.');

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli R1/R2/R4 di PREREG_rivali_comportamentali.md — i rivali che si fermano quando la loro gomma finisce.',
    prereg: 'ai_lab/confronto/PREREG_rivali_comportamentali.md',
    generato_da: 'ai_lab/confronto/cancelli_rivali.mjs',
    data: '2026-08-04',
    taratura: BASE,
  },
  n: righe.length,
  errore_mediano: { fermi: med('e_fermi'), attesi: med('e_attesi'), a_caso: med('e_caso') },
  arrivi_cosi: { fermi: arrivi('arrivi_fermi'), attesi: arrivi('arrivi_attesi'), a_caso: arrivi('arrivi_caso') },
  cancelli: { R1: { passa: R1, segni: s1 }, R2: { passa: R2 }, R4: { passa: R4, segni_placebo: sP } },
};
writeFileSync(path.join(RADICE, 'ai_lab/confronto/ESITO_cancelli_rivali.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/confronto/ESITO_cancelli_rivali.json');
