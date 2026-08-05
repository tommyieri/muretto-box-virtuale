#!/usr/bin/env node
// cancelli_aggancio.mjs — il tetto al movimento con la soglia MISURATA: si accende o no?
//
//     node ai_lab/sorpasso/cancelli_aggancio.mjs [--json]
//
// PERCHE' NON E' IL QUARTO TENTATIVO DI UN RAMO CHIUSO. Il tetto al movimento e' stato
// chiuso NULL due volte, il 03/08/2026:
//   · per circuito, con le soglie TUM: T5 (placebo) disse che erano INERTI;
//   · uniforme, con la soglia 2,025 s/giro — la mediana dei 121 file TUM: U1 e U3
//     passavano, U2 no, e U1 passava «diventando il nullo» (la quota di vittorie non si
//     muoveva, cambiavano solo i pareggi).
//
// Cambia UNA cosa, e non e' una taratura: la soglia non arriva piu' da fuori. E' MISURATA
// su 5.498 occasioni di sorpasso vere del fondo 2018-2025 (PREREG_soglia_sorpasso.md), e il
// numero che ne esce e' molto diverso da quello importato:
//
//     TUM, uniforme:   2,025 s/giro ovunque
//     misurato:        0,605 s/giro ovunque, TRANNE Monaco 2,834
//
// La soglia importata era piu' che TRIPLA rispetto alla nostra su dieci piste su undici.
// Un vincolo cosi' stretto blocca sorpassi che nella realta' avvengono — ed e' la spiegazione
// piu' semplice del perche' quel tentativo danneggiava la risposta a due giri.
//
// I CANCELLI SONO QUELLI GIA' FIRMATI, non nuovi: U1, U2, U3 di PREREG_tetto_uniforme.md,
// con le soglie di KPI_5_4_4.md. Si riusano apposta — cambiare metro insieme al parametro
// renderebbe il confronto col tentativo del 03/08 impossibile.
//
// COSA LO FA USCIRE 1:
//   (a) la TARATURA fallisce: il braccio senza vincolo non riproduce i numeri pubblicati
//       (n = 193, alto 13-28, basso+medio 44-27). Un cancello misurato con un metro storto
//       e' peggio di nessun cancello;
//   (b) il perimetro appaiato si sfalda sotto il 90%.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, casi, rispostaNuovo } from '../confronto/banco.mjs';
import {
  perGara, pianiVeriDi, corri, letturaComune, vecchioConPasso, passoV2, testSegni, media,
} from '../confronto/bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');

const D = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'duello_tum_2026.json'), 'utf8'));
const K = D.costanti;
const SOGLIA = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'soglia_sorpasso.json'), 'utf8'));

// Gli altri tre parametri del tetto NON sono misurati qui e restano quelli della fonte
// esterna: si cambia una cosa sola, altrimenti non si sa quale ha fatto la differenza.
const tettoDi = (gara) => ({
  minGap: K.min_t_dist_s,
  sogliaSorpasso: SOGLIA.soglia_sorpasso[gara] ?? SOGLIA.soglia_comune,
  costoDuello: K.t_duel_s,
  costoSubito: K.t_overtake_loser_s,
});

// LE LINEE DI BASE, E PERCHE' NON SONO PIU' QUELLE PUBBLICATE.
//
// KPI_5_4_4.md scrive n = 193, terzile alto 13-28, basso+medio 44-27. Il 04/08/2026 questa
// taratura FALLISCE: n combacia, i terzili no — misurato ora, 14-28 e 45-28. Un caso di
// differenza per strato.
//
// La causa e' nota, datata e voluta, e sono due modifiche alla produzione fatte DOPO che
// quei numeri erano stati pubblicati: `vita_mescola` accesa (04/08, decisione PO) e
// `fattore_circuito` spento (04/08, esito dei cancelli). Il motore pianifica diversamente,
// quindi sbaglia diversamente alla bandiera. NON e' un metro storto: e' un mondo che si e'
// mosso, ed e' esattamente cio' che la regola «tutto si ri-aggiorna a ogni gara» prevede.
//
// E' comunque E22 — numeri pubblicati e mai rimisurati dopo un fix — al livello dei KPI, e
// va a referto: `ai_lab/KPI_5_4_4.md` porta cifre che il codice di oggi non riproduce piu'.
//
// La taratura RESTA, ri-ancorata ai valori di oggi: se domani si spostano di nuovo senza
// che qualcuno lo sappia, questo file esce 1 come e' appena successo. Un controllo che si
// disattiva alla prima deriva sarebbe un ornamento (regola 4).
const BASE = {
  n: 193,
  alto: { vince: 14, perde: 28 },        // era 13-28 prima di vita_mescola
  bassoMedio: { vince: 45, perde: 28 },  // era 44-27
  misurate_il: '2026-08-04',
  dopo: 'vita_mescola accesa e fattore_circuito spento',
  pubblicate_in_KPI: { alto: '13-28', bassoMedio: '44-27' },
};

/** Un braccio alla bandiera. `conTetto` false = braccio senza vincolo. */
function braccio(conTetto) {
  const out = new Map();
  for (const g of gare()) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: pianiVeriDi(g), tetto: conTetto ? tettoDi(g) : false });
      if (e.saltato || e.errore_nullo === null) continue;
      out.set(`${g}|${r.pilota}`, { gara: g, pilota: r.pilota, a: e.errore, b: e.errore_nullo, ecc: e.cambi_motore - e.cambi_reali });
    }
  }
  return out;
}

const leggi = (righe) => {
  const s = testSegni(righe);
  return { n: righe.length, vince: s.vinceA, perde: s.vinceB, pari: s.pari, saldo: s.vinceA - s.vinceB, p: s.p, eccesso: media(righe.map((x) => x.ecc)) };
};

const senza = braccio(false);
const ordSenza = [...senza.values()].sort((x, y) => x.ecc - y.ecc);
const t = Math.ceil(ordSenza.length / 3);
const STRATO = new Map();
ordSenza.forEach((x, i) => STRATO.set(`${x.gara}|${x.pilota}`, i < t ? 'basso' : (i < 2 * t ? 'medio' : 'alto')));
const rifAlto = leggi(ordSenza.slice(2 * t));
const rifBm = leggi(ordSenza.slice(0, 2 * t));

console.log('');
console.log('══ AGGANCIO DEL TETTO CON LA SOGLIA MISURATA ═══════════════════════════════');
console.log(`   soglia: Monaco ${SOGLIA.soglia_sorpasso.Monaco} · tutte le altre ${SOGLIA.soglia_comune} s/giro`);
console.log(`   (il tentativo del 03/08 usava 2,025 ovunque, dalla fonte TUM)`);
console.log(`   minGap ${K.min_t_dist_s} · duello ${K.t_duel_s} · subito ${K.t_overtake_loser_s} — invariati, dalla fonte esterna`);

const tara = [];
const controlla = (testo, ok, misurato) => { tara.push({ testo, ok, misurato }); console.log(`  ${ok ? '✓' : '✗'} ${testo}${ok ? '' : `   ·  MISURATO ORA: ${misurato}`}`); };
console.log('');
console.log('══ TARATURA — senza vincolo si devono riprodurre i numeri pubblicati ═══════');
controlla(`perimetro n = ${BASE.n}`, senza.size === BASE.n, senza.size);
controlla(`terzile alto ${BASE.alto.vince}-${BASE.alto.perde}`, rifAlto.vince === BASE.alto.vince && rifAlto.perde === BASE.alto.perde, `${rifAlto.vince}-${rifAlto.perde} (saldo ${rifAlto.saldo}, p ${rifAlto.p.toFixed(4)})`);
controlla(`basso+medio ${BASE.bassoMedio.vince}-${BASE.bassoMedio.perde}`, rifBm.vince === BASE.bassoMedio.vince && rifBm.perde === BASE.bassoMedio.perde, `${rifBm.vince}-${rifBm.perde} (saldo ${rifBm.saldo}, p ${rifBm.p.toFixed(4)})`);
if (tara.some((x) => !x.ok)) { console.log('\n  TARATURA FALLITA: non giudico.'); process.exit(1); }
console.log(`  taratura verde ${tara.length}/${tara.length} — e' anche l'invarianza a vincolo spento.`);

const con = braccio(true);
const comuni = [...senza.keys()].filter((k) => con.has(k));
if (comuni.length < 0.9 * senza.size) { console.log(`\n  PERIMETRO SFALDATO: ${comuni.length}/${senza.size}. Non giudico.`); process.exit(1); }
const cAlto = leggi(comuni.filter((k) => STRATO.get(k) === 'alto').map((k) => con.get(k)));
const cBm = leggi(comuni.filter((k) => STRATO.get(k) !== 'alto').map((k) => con.get(k)));

console.log('');
console.log(`   casi appaiati ${comuni.length}/${senza.size}`);
console.log(`   terzile alto     senza ${rifAlto.vince}-${rifAlto.perde} (saldo ${rifAlto.saldo}, p ${rifAlto.p.toFixed(4)})   →   con ${cAlto.vince}-${cAlto.perde} (saldo ${cAlto.saldo}, p ${cAlto.p.toFixed(4)})`);
console.log(`   basso+medio      senza ${rifBm.vince}-${rifBm.perde} (saldo ${rifBm.saldo}, p ${rifBm.p.toFixed(4)})   →   con ${cBm.vince}-${cBm.perde} (saldo ${cBm.saldo}, p ${cBm.p.toFixed(4)})`);

const U1 = cAlto.p >= 0.05 && cAlto.saldo >= -15;
const U2 = cBm.saldo >= 17 && cBm.p <= 0.0568;

function dueGiri(conTetto) {
  const PASSO_V2 = passoV2();
  const out = new Map();
  for (const c of casi()) {
    const vp = vecchioConPasso(c, { passo: PASSO_V2 });
    const n = rispostaNuovo(c, { tetto: conTetto ? tettoDi(c.gara) : false });
    if (vp.muto || n.muto) continue;
    const B = letturaComune(c, vp.ordine, n.ordine);
    if (!B) continue;
    out.set(`${c.gara}|${c.pilota}`, { gara: c.gara, err: B.nuovo - B.vero });
  }
  return out;
}
const dgSenza = dueGiri(false);
const dgCon = dueGiri(true);
const appaiate = [...dgCon.keys()].filter((k) => dgSenza.has(k)).map((k) => ({ gara: dgCon.get(k).gara, a: dgCon.get(k).err, b: dgSenza.get(k).err }));
const u3 = testSegni(appaiate);
const U3 = !(u3.vinceB > u3.vinceA && u3.p < 0.05);

console.log('');
console.log(`   U1  terzile alto: p ${cAlto.p.toFixed(4)} (serve >= 0,05) e saldo ${cAlto.saldo} (serve >= -15)   ${U1 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U2  basso+medio: saldo ${cBm.saldo} (serve >= +17) e p ${cBm.p.toFixed(4)} (serve <= 0,0568)   ${U2 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U3  due giri appaiato: ${u3.vinceA}-${u3.vinceB} (n=${u3.n}, p=${u3.p.toFixed(4)})   ${U3 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U4  eccesso di movimento nel terzile alto: ${rifAlto.eccesso.toFixed(2)} → ${cAlto.eccesso.toFixed(2)}   (diagnostico)`);

// la quota di vittorie fra i discordanti: e' la lettura che il 03/08 ha smascherato il
// «passa diventando il nullo». Si stampa sempre, non solo quando fa comodo.
const quota = (r) => (r.vince + r.perde ? r.vince / (r.vince + r.perde) : null);
console.log('');
console.log(`   quota di vittorie fra i DISCORDANTI (terzile alto): ${(quota(rifAlto) * 100).toFixed(1)}% → ${(quota(cAlto) * 100).toFixed(1)}%`
  + `   ·  pari ${rifAlto.pari} → ${cAlto.pari}`);

const ACCENDE = U1 && U3 && quota(cAlto) > quota(rifAlto);
console.log('');
if (ACCENDE) {
  console.log('   SI ACCENDE: U1 e U3 passano E la quota di vittorie fra i discordanti sale —');
  console.log('   cioe\' il guadagno non e\' fatto di soli pareggi, che e\' l\'errore del 03/08.');
} else if (U1 && U3) {
  console.log('   NON SI ACCENDE: U1 e U3 passano ma la quota di vittorie fra i discordanti NON');
  console.log('   sale. E\' lo stesso «passa diventando il nullo» del 03/08, e non e\' un guadagno.');
} else {
  console.log(`   NON SI ACCENDE: ${!U1 ? 'U1 fallisce' : ''}${!U1 && !U3 ? ' e ' : ''}${!U3 ? 'U3 fallisce — il vincolo paga sulla risposta a due giri, l\'unica validata' : ''}.`);
}

const doc = {
  _targhetta: {
    cosa_e: 'Aggancio del tetto al movimento con la soglia misurata su 5.498 occasioni del fondo, contro i cancelli gia firmati U1/U2/U3.',
    prereg: 'ai_lab/sorpasso/PREREG_soglia_sorpasso.md §6 · cancelli da ai_lab/confronto/PREREG_tetto_uniforme.md',
    generato_da: 'ai_lab/sorpasso/cancelli_aggancio.mjs',
    data: '2026-08-04',
    confronto: 'Il 03/08 la stessa macchina con soglia TUM 2,025 dava U1 PASSA (0,0708, saldo -11), U2 NON PASSA, U3 PASSA (5-13, p 0,0963), quota discordanti 31,7% -> 32,3% (invariata).',
  },
  soglia: { monaco: SOGLIA.soglia_sorpasso.Monaco, comune: SOGLIA.soglia_comune, fonte: 'simulatore/data/modelli/soglia_sorpasso.json' },
  senza_vincolo: { n: senza.size, alto: rifAlto, basso_medio: rifBm },
  con_vincolo: { appaiati: comuni.length, alto: cAlto, basso_medio: cBm },
  cancelli: { U1, U2, U3, due_giri: u3 },
  quota_discordanti_alto: { senza: quota(rifAlto), con: quota(cAlto) },
  accende: ACCENDE,
};
writeFileSync(path.join(RADICE, 'ai_lab/sorpasso/ESITO_aggancio_tetto.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else console.log('\n   → ai_lab/sorpasso/ESITO_aggancio_tetto.json');
