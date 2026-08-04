#!/usr/bin/env node
// cancelli_vita.mjs — i cancelli di PREREG_vita_mescola.md.
//
//     node ai_lab/degrado/cancelli_vita.mjs [--json] [--gare N]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Forma, parametro, nulli e soglie
// sono copiati da li' e non si toccano.
//
// COSA SI MISURA. Per ogni stint concluso da una sosta: dallo stato al suo inizio si chiede
// al PIANIFICATORE DEL MOTORE quale durata sceglierebbe con quella mescola, e si confronta
// con quella vera. Usare il pianificatore e non una formula scritta per l'occasione e' la
// parte che rende il cancello non circolare: si giudica la FISICA, non la statistica
// descrittiva da cui `vita` e' uscita.
//
// I DUE NULLI, e vanno battuti ENTRAMBI (prereg §4):
//   N1  il motore di OGGI, stessa procedura senza il termine di vita. Non distingue le
//       mescole: e' il metro di «la mescola non serve».
//   N2  il pavimento DESCRITTIVO: prevedere direttamente la mediana per mescola, senza
//       fisica. Impedisce la circolarita' — se il modello non batte la sua stessa mediana,
//       la fisica non sta aggiungendo niente.
//
// FUORI CAMPIONE: leave-one-race-out. `vita` si ricalcola sulle ALTRE dieci gare, la
// previsione si legge sulla gara tenuta fuori. Nessuno stint contribuisce al parametro che
// lo giudica.
//
// COSA LO FA USCIRE 1:
//  (a) il perimetro non e' quello dichiarato (427 decisioni);
//  (b) il braccio N1 non riproduce il motore di oggi — cioe' lo strumento non e' tarato.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { testSegni, mediana as medianaB } from '../confronto/bandiera.mjs';
import { decisioni, vitaDa, vitaCieca, MESCOLE } from './decisioni.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const LIMITE = (() => { const i = ARGV.indexOf('--gare'); return i >= 0 ? Number(ARGV[i + 1]) : null; })();

const D = decisioni();
const GARE = LIMITE ? gare().slice(0, LIMITE) : gare();

/**
 * La durata che il pianificatore sceglierebbe partendo dall'inizio di questo stint.
 *
 * «ARRIVI COSI'» E' UNA PREVISIONE, NON UN'ASTENSIONE. La prima scrittura di questa
 * funzione restituiva `null` quando il piano non conteneva soste, e quei casi uscivano dal
 * perimetro: undici su trentadue nella sola Australia. Era il difetto di misura peggiore
 * possibile, perche' «non fermarti mai» e' esattamente la patologia del motore di oggi —
 * scartarla significava nascondere il suo errore principale proprio nel banco costruito per
 * misurarlo. Un piano senza soste prevede che lo stint duri fino alla BANDIERA, e cosi'
 * viene contato.
 *
 * Resta `null` solo quando il piano NON ESISTE — e la causa e' strutturale, non una scelta:
 * al giro d'inizio del PRIMO stint (giro 1) il motore non ha ancora giri verdi da cui
 * ricavare un passo base, quindi non puo' pianificare niente. Quei casi si dichiarano e si
 * contano a parte, non si nascondono.
 */
function durataPrevista(d, contesto) {
  const g = contesto.gare[garaSimDi(d.gara)];
  if (!g) return { durata: null, motivo: 'gara assente' };
  const nGiri = g.nGiri;
  try {
    const p = pianoOttimo({
      gara: garaSimDi(d.gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: nGiri,
    }, { ...contesto, nGiriGara: nGiri });
    if (!p?.migliore) return { durata: null, motivo: 'nessun piano: passo base assente al giro d\'inizio' };
    const soste = p.migliore.piano.soste;
    if (!soste.length) return { durata: nGiri - d.giro_inizio, motivo: 'arrivi cosi\'' };
    return { durata: soste[0].giro - d.giro_inizio, motivo: 'sosta prevista' };
  } catch (e) { return { durata: null, motivo: `eccezione: ${e.message.slice(0, 40)}` }; }
}

const modelloCon = (contesto, vita) => ({
  ...contesto.modello,
  vita_mescola: { attivo: true, giri: vita, natura: 'PRIOR_COMPORTAMENTALE' },
});

console.log('');
console.log('══ CANCELLI DELLA VITA DELLA MESCOLA — PREREG_vita_mescola.md ═════════════');
console.log(`   ${D.length} decisioni · ${GARE.length} gare · leave-one-race-out`);
console.log(`   vita sul campione intero: ${JSON.stringify(vitaDa(D))}`);

// ── la misura, gara per gara, con la vita calcolata SULLE ALTRE ──────────────
const righe = [];
const persi = {};
for (const gara of GARE) {
  const mie = D.filter((d) => d.gara === gara);
  if (!mie.length) continue;
  const vitaLoo = vitaDa(D, gara);
  const ciecaLoo = vitaCieca(D, gara);
  const base = contestoNuovo(gara);
  const conVita = { ...base, modello: modelloCon(base, vitaLoo) };
  let n = 0;
  for (const d of mie) {
    const modello = durataPrevista(d, conVita);
    const n1 = durataPrevista(d, base);
    const n2 = vitaLoo[d.mescola] ?? ciecaLoo;
    if (modello.durata === null || n1.durata === null) {
      persi[modello.motivo] = (persi[modello.motivo] ?? 0) + 1;
      continue;
    }
    righe.push({
      ...d, prevista: modello.durata, motivo: modello.motivo, n1: n1.durata, motivo_n1: n1.motivo, n2,
      e_modello: Math.abs(modello.durata - d.durata),
      e_n1: Math.abs(n1.durata - d.durata),
      e_n2: Math.abs(n2 - d.durata),
    });
    n += 1;
  }
  console.log(`   ${gara.padEnd(14)} ${String(n).padStart(3)}/${String(mie.length).padStart(3)} decisioni`
    + `  ·  vita LOO ${MESCOLE.map((m) => `${m[0]}${vitaLoo[m]}`).join(' ')}`);
}

if (!righe.length) { console.log('\n   nessuna decisione misurabile: non giudico.'); process.exit(1); }

// ── i cancelli ──────────────────────────────────────────────────────────────
const med = (k) => medianaB(righe.map((r) => r[k]));
const v1 = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_modello, b: r.e_n1 })));
const v2 = testSegni(righe.map((r) => ({ gara: r.gara, a: r.e_modello, b: r.e_n2 })));
const V1 = med('e_modello') < med('e_n1') && v1.vinceA > v1.vinceB && v1.p < 0.05;
const V2 = med('e_modello') < med('e_n2') && v2.vinceA > v2.vinceB && v2.p < 0.05;

console.log('');
console.log(`   misurate ${righe.length} decisioni · NON misurabili ${Object.values(persi).reduce((a, b) => a + b, 0)}:`);
for (const [m, k] of Object.entries(persi).sort((a, b) => b[1] - a[1])) console.log(`       ${String(k).padStart(3)}  ${m}`);
const arrivi = righe.filter((r) => r.motivo === 'arrivi cosi\'').length;
const arriviN1 = righe.filter((r) => r.motivo_n1 === 'arrivi cosi\'').length;
console.log(`   piani senza sosta («arrivi cosi'», contati come durata fino alla bandiera):`
  + ` modello ${arrivi} · N1 motore di oggi ${arriviN1}`);
console.log(`   errore mediano in giri:  MODELLO ${med('e_modello')}  ·  N1 motore di oggi ${med('e_n1')}  ·  N2 pavimento descrittivo ${med('e_n2')}`);
console.log('');
console.log(`   V1  batte il motore di oggi: ${v1.vinceA}-${v1.vinceB} (pari ${v1.pari}, p=${v1.p.toFixed(4)})   ${V1 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   V2  batte il pavimento descrittivo: ${v2.vinceA}-${v2.vinceB} (pari ${v2.pari}, p=${v2.p.toFixed(4)})   ${V2 ? 'PASSA' : 'NON PASSA'}`);

// ── le letture secondarie, dichiarate nella prereg §6 PRIMA dei numeri ───────
console.log('');
console.log('   per mescola (secondario, dichiarato prima):');
for (const m of MESCOLE) {
  const q = righe.filter((r) => r.mescola === m);
  if (!q.length) continue;
  const s1 = testSegni(q.map((r) => ({ gara: r.gara, a: r.e_modello, b: r.e_n1 })));
  console.log(`     ${m.padEnd(7)} n=${String(q.length).padStart(3)}`
    + `  errore mediano ${medianaB(q.map((r) => r.e_modello))} contro ${medianaB(q.map((r) => r.e_n1))} (N1)`
    + `  ·  ${s1.vinceA}-${s1.vinceB}`);
}

const esito = { V1, V2 };
console.log('');
if (V1 && V2) {
  console.log('   V1 e V2 passano: resta V3, la risposta a due giri — ed e\' il cancello che conta di piu\'.');
} else {
  console.log('   LETTURA OBBLIGATA DALLA PREREG §5: NULL. La vita della mescola, in questa forma,');
  console.log('   non riproduce le decisioni meglio dei nulli, e il selettore mescola resta un');
  console.log('   display con la ragione aggiornata.');
}

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Esito dei cancelli V1/V2 di PREREG_vita_mescola.md — la vita della mescola contro due nulli.',
      prereg: 'ai_lab/degrado/PREREG_vita_mescola.md',
      deroga: 'simulatore/DEROGA_prior_comportamentale.md (natura PRIOR_COMPORTAMENTALE)',
      metro: 'errore assoluto in giri fra durata prevista dal pianificatore e durata osservata',
      fuori_campione: 'leave-one-race-out: la vita si calcola sulle altre gare',
      data: '2026-08-04',
    },
    n_decisioni: D.length,
    n_misurate: righe.length,
    vita_campione_intero: vitaDa(D),
    errore_mediano: { modello: med('e_modello'), n1: med('e_n1'), n2: med('e_n2') },
    V1: { passa: V1, ...v1, coppie: undefined },
    V2: { passa: V2, ...v2, coppie: undefined },
    righe,
  };
  const dove = path.join(RADICE, 'ai_lab', 'degrado', 'ESITO_cancelli_vita.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}

process.exit(esito.V1 && esito.V2 ? 0 : 0);
