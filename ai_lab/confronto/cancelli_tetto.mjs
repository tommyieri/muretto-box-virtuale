#!/usr/bin/env node
// cancelli_tetto.mjs — i cinque cancelli di PREREG_tetto_movimento.md.
//
//     node ai_lab/confronto/cancelli_tetto.mjs [--json]           T1..T4
//     node ai_lab/confronto/cancelli_tetto.mjs --placebo [--json] anche T5 (lungo)
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Soglie e parametri sono copiati
// da PREREG_tetto_movimento.md §2 e §4 e non si toccano.
//
// L'ORDINE NON E' CASUALE. T5 (il placebo, 200 permutazioni) costa ore: si esegue solo se
// T1 passa. Se il tetto vero non riduce il movimento inventato, non c'e' niente di cui
// chiedersi se venga dalla pista o dal caso — ed e' NULL comunque.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, casi, rispostaNuovo } from './banco.mjs';
import {
  perGara, pianiVeriDi, corri, letturaComune, vecchioConPasso, passoV2, testSegni, media,
} from './bandiera.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const PLACEBO = ARGV.includes('--placebo');

const D = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'duello_tum_2026.json'), 'utf8'));
const K = D.costanti;
const SEME = 20260803;
const PERMUTAZIONI = 200;

// Le gare col parametro: Miami NON c'e' in TUM e la prereg vieta di inventarlo.
const CON_SOGLIA = Object.entries(D.per_circuito).filter(([, v]) => v).map(([g]) => g);
const SENZA = Object.entries(D.per_circuito).filter(([, v]) => !v).map(([g]) => g);

const tettoDi = (soglia) => ({
  minGap: K.min_t_dist_s, sogliaSorpasso: soglia,
  costoDuello: K.t_duel_s, costoSubito: K.t_overtake_loser_s,
});

/** La metrica alla bandiera, con una mappa gara -> soglia (o null = senza tetto). */
function bandiera(sogliaPerGara, spento = false) {
  const utili = [];
  for (const g of gare()) {
    if (sogliaPerGara && !(g in sogliaPerGara)) continue;   // fuori perimetro, dichiarato
    const tetto = spento ? null : tettoDi(sogliaPerGara[g]);
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: pianiVeriDi(g), tetto });
      if (e.saltato || e.errore_nullo === null) continue;
      utili.push({ gara: g, a: e.errore, b: e.errore_nullo, ecc: e.cambi_motore - e.cambi_reali });
    }
  }
  // i terzili sull'eccesso di movimento: la lettura che ha trovato le due popolazioni
  const ord = [...utili].sort((x, y) => x.ecc - y.ecc);
  const t = Math.ceil(ord.length / 3);
  const alto = ord.slice(2 * t);
  const bassoMedio = ord.slice(0, 2 * t);
  const sAlto = testSegni(alto);
  const sBasso = testSegni(bassoMedio);
  return {
    n: utili.length,
    alto: { n: alto.length, vince: sAlto.vinceA, perde: sAlto.vinceB, saldo: sAlto.vinceA - sAlto.vinceB, p: sAlto.p, eccesso: media(alto.map((x) => x.ecc)) },
    bassoMedio: { n: bassoMedio.length, vince: sBasso.vinceA, perde: sBasso.vinceB, saldo: sBasso.vinceA - sBasso.vinceB },
  };
}

/** T4: la metrica a due giri, col tetto acceso su tutte le gare che ce l'hanno. */
function dueGiri(sogliaPerGara, spento = false) {
  const PASSO_V2 = passoV2();
  const out = [];
  for (const c of casi()) {
    if (sogliaPerGara && !(c.gara in sogliaPerGara)) continue;
    const vp = vecchioConPasso(c, { passo: PASSO_V2 });
    const n = rispostaNuovo(c, spento ? {} : { tetto: tettoDi(sogliaPerGara[c.gara]) });
    if (vp.muto || n.muto) continue;
    const B = letturaComune(c, vp.ordine, n.ordine);
    if (!B) continue;
    out.push({ gara: c.gara, pilota: c.pilota, err: B.nuovo - B.vero });
  }
  return out;
}

const soglieVere = Object.fromEntries(CON_SOGLIA.map((g) => [g, D.per_circuito[g].t_gap_overtake]));

console.log('');
console.log('══ CANCELLI DEL TETTO AL MOVIMENTO — PREREG_tetto_movimento.md ════════════');
console.log(`   parametri costanti: minGap ${K.min_t_dist_s} s · duello ${K.t_duel_s} s · subito ${K.t_overtake_loser_s} s`);
console.log(`   soglie per circuito: ${CON_SOGLIA.length} gare${SENZA.length ? `  ·  FUORI PERIMETRO: ${SENZA.join(', ')} (nessun parametro nella fonte)` : ''}`);

// il riferimento SENZA tetto, ma sullo STESSO perimetro di gare: confrontare dieci gare
// col tetto contro undici senza sarebbe un confronto fra popolazioni diverse (E16).
const soglieZero = Object.fromEntries(CON_SOGLIA.map((g) => [g, null]));
const rif = bandiera(soglieZero, true);
console.log('');
console.log(`   SENZA tetto:  terzile alto ${rif.alto.vince}-${rif.alto.perde} (saldo ${rif.alto.saldo}, eccesso ${rif.alto.eccesso.toFixed(2)})`
  + `  ·  basso+medio ${rif.bassoMedio.vince}-${rif.bassoMedio.perde} (saldo ${rif.bassoMedio.saldo >= 0 ? '+' : ''}${rif.bassoMedio.saldo})`);

const con = bandiera(soglieVere);
console.log(`   CON tetto:    terzile alto ${con.alto.vince}-${con.alto.perde} (saldo ${con.alto.saldo}, eccesso ${con.alto.eccesso.toFixed(2)})`
  + `  ·  basso+medio ${con.bassoMedio.vince}-${con.bassoMedio.perde} (saldo ${con.bassoMedio.saldo >= 0 ? '+' : ''}${con.bassoMedio.saldo})`);

// ── i cancelli, con le soglie della prereg ──────────────────────────────────
const T1 = con.alto.saldo >= rif.alto.saldo + 6;
const T2 = con.bassoMedio.saldo >= 13;
const T3 = Math.abs(con.alto.eccesso) < Math.abs(rif.alto.eccesso);

const dgRif = dueGiri(soglieZero, true);
const dgCon = dueGiri(soglieVere);
const perId = new Map(dgRif.map((x) => [`${x.gara}|${x.pilota}`, x.err]));
const appaiate = dgCon.map((x) => ({ gara: x.gara, a: x.err, b: perId.get(`${x.gara}|${x.pilota}`) })).filter((x) => x.b !== undefined);
const t4 = testSegni(appaiate);
const T4 = !(t4.vinceB > t4.vinceA && t4.p < 0.05);

console.log('');
console.log(`   T1  saldo terzile alto ${rif.alto.saldo} -> ${con.alto.saldo} (serve +6, cioe' >= ${rif.alto.saldo + 6})   ${T1 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   T2  saldo basso+medio ${con.bassoMedio.saldo} (serve >= +13)   ${T2 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   T3  eccesso di movimento |${rif.alto.eccesso.toFixed(2)}| -> |${con.alto.eccesso.toFixed(2)}|   ${T3 ? 'si riduce' : 'NON si riduce'}  (diagnostico)`);
console.log(`   T4  due giri appaiato: ${t4.vinceA}-${t4.vinceB} (n=${t4.n}, p=${t4.p.toFixed(4)})   ${T4 ? 'PASSA' : 'NON PASSA'}`);

let t5 = null;
if (!T1) {
  console.log('');
  console.log('   T5  NON ESEGUITO: T1 non passa, quindi non c\'e\' nessun guadagno di cui');
  console.log('       chiedersi se venga dalla pista. E\' NULL comunque, e le 200 permutazioni');
  console.log('       costerebbero ore per confermare un vuoto.');
} else if (!PLACEBO) {
  console.log('');
  console.log('   T5  da eseguire: rilancia con --placebo (200 permutazioni, lungo)');
} else {
  console.log('');
  console.log(`   T5  placebo: ${PERMUTAZIONI} permutazioni delle soglie fra i circuiti, seme ${SEME}`);
  let s = SEME;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const valori = CON_SOGLIA.map((g) => D.per_circuito[g].t_gap_overtake);
  const saldi = [];
  for (let i = 0; i < PERMUTAZIONI; i += 1) {
    const mescolate = [...valori];
    for (let j = mescolate.length - 1; j > 0; j -= 1) { const k = Math.floor(rnd() * (j + 1)); [mescolate[j], mescolate[k]] = [mescolate[k], mescolate[j]]; }
    const finto = Object.fromEntries(CON_SOGLIA.map((g, idx) => [g, mescolate[idx]]));
    saldi.push(bandiera(finto).alto.saldo);
    if ((i + 1) % 20 === 0) console.log(`       ${i + 1}/${PERMUTAZIONI} permutazioni`);
  }
  saldi.sort((a, b) => a - b);
  const p95 = saldi[Math.floor(0.95 * saldi.length)];
  t5 = { p95, mediana: saldi[Math.floor(0.5 * saldi.length)], saldo_vero: con.alto.saldo, passa: con.alto.saldo > p95, saldi };
  console.log(`       saldo vero ${con.alto.saldo}  ·  finti: mediana ${t5.mediana}, 95° percentile ${p95}   ${t5.passa ? 'PASSA' : 'NON PASSA'}`);
}

const tutti = T1 && T2 && T4 && (t5 ? t5.passa : false);
console.log('');
console.log(`   ESITO: ${tutti ? 'TUTTI I CANCELLI PASSANO' : 'NON PASSA'}`);

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Esito dei cancelli di PREREG_tetto_movimento.md.',
      prereg: 'ai_lab/confronto/PREREG_tetto_movimento.md',
      parametri: 'ai_lab/confronto/duello_tum_2026.json',
      fuori_perimetro: SENZA,
      data: '2026-08-03',
    },
    senza_tetto: rif, con_tetto: con,
    T1: { passa: T1, da: rif.alto.saldo, a: con.alto.saldo, serve: rif.alto.saldo + 6 },
    T2: { passa: T2, saldo: con.bassoMedio.saldo, serve: 13 },
    T3: { si_riduce: T3, da: rif.alto.eccesso, a: con.alto.eccesso },
    T4: { passa: T4, ...t4 },
    T5: t5,
    tutti,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_cancelli_tetto.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
