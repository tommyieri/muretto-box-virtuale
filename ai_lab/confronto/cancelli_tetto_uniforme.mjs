#!/usr/bin/env node
// cancelli_tetto_uniforme.mjs — i cancelli di PREREG_tetto_uniforme.md.
//
//     node ai_lab/confronto/cancelli_tetto_uniforme.mjs [--json]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. I quattro parametri (§2) e le
// soglie dei cancelli (§4) sono copiati da li' e non si toccano.
//
// DUE COSE SOLE CAMBIANO rispetto a cancelli_tetto.mjs, ed e' la ragione per cui questo
// file esiste invece di una flag su quello:
//
//  (1) I PARAMETRI SONO TUTTI COSTANTI. La soglia per circuito — l'unico parametro che
//      variava, e l'unico che il placebo di ieri ha dichiarato INERTE — e' sostituita
//      dalla mediana della fonte intera (2,025 s sui 121 file). Conseguenza diretta:
//      Miami rientra, perche' non serve piu' il suo file, e il perimetro torna a essere
//      quello su cui F2 e F3 sono firmati.
//
//  (2) GLI STRATI SONO CONGELATI. Il terzile e' definito da `cambi_motore - cambi_reali`,
//      e il vincolo cambia `cambi_motore`: ricalcolare i terzili sulla configurazione
//      trattata — come facevano i cancelli di ieri — mette a confronto due POPOLAZIONI
//      diverse invece di due trattamenti. Qui i terzili si calcolano una volta sola, sul
//      braccio senza vincolo, e il braccio col vincolo si legge sugli STESSI casi.
//
// COSA LO FA USCIRE 1:
//  (a) la taratura non torna: il braccio senza vincolo deve riprodurre i numeri pubblicati
//      (n = 193, terzile alto 13-28, basso+medio 44-27). Se non li riproduce, lo strumento
//      e' rotto e non giudica niente — un cancello misurato con un metro storto e' peggio
//      di nessun cancello;
//  (b) il perimetro appaiato si sfalda: se i due bracci non condividono abbastanza casi,
//      il confronto appaiato non e' un confronto.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, casi, rispostaNuovo } from './banco.mjs';
import {
  perGara, pianiVeriDi, corri, letturaComune, vecchioConPasso, passoV2, testSegni, media,
} from './bandiera.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');

const D = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'duello_tum_2026.json'), 'utf8'));
const K = D.costanti;

// ── §2 della prereg: i quattro parametri, tutti costanti nella fonte ─────────
// 2,025 e' la mediana dei t_gap_overtake sui 121 FILE (targhetta di duello_tum_2026.json),
// non la mediana dei nostri dieci circuiti (2,16): quella condizionerebbe il parametro al
// nostro perimetro, che e' una forma leggera di stimarlo in casa.
const SOGLIA_UNIFORME = 2.025;
const TETTO = {
  minGap: K.min_t_dist_s,
  sogliaSorpasso: SOGLIA_UNIFORME,
  costoDuello: K.t_duel_s,
  costoSubito: K.t_overtake_loser_s,
};

// ── §4: le linee di base, copiate da KPI_5_4_4.md. Sono la TARATURA, non attese molli.
const BASE = {
  n: 193,
  alto: { vince: 13, perde: 28 },          // saldo -15, p = 0,027
  bassoMedio: { vince: 44, perde: 27 },    // saldo +17, p = 0,0568
};

/** Un braccio alla bandiera: tutti i casi delle undici gare, col vincolo o senza. */
function braccio(tetto) {
  const out = new Map();
  for (const g of gare()) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: pianiVeriDi(g), tetto });
      if (e.saltato || e.errore_nullo === null) continue;
      out.set(`${g}|${r.pilota}`, {
        gara: g, pilota: r.pilota, a: e.errore, b: e.errore_nullo,
        ecc: e.cambi_motore - e.cambi_reali,
      });
    }
  }
  return out;
}

const leggi = (righe) => {
  const s = testSegni(righe);
  return {
    n: righe.length, vince: s.vinceA, perde: s.vinceB, pari: s.pari,
    saldo: s.vinceA - s.vinceB, p: s.p, eccesso: media(righe.map((x) => x.ecc)),
  };
};

console.log('');
console.log('══ CANCELLI DEL TETTO UNIFORME — PREREG_tetto_uniforme.md ═════════════════');
console.log(`   parametri (tutti costanti nella fonte): minGap ${TETTO.minGap} · duello ${TETTO.costoDuello}`
  + ` · subito ${TETTO.costoSubito} · soglia ${SOGLIA_UNIFORME} (mediana sui 121 file)`);
console.log(`   perimetro: ${gare().length} gare — Miami RIENTRA (nessun parametro per circuito da cercare)`);

// ── il braccio senza vincolo: e' insieme la linea di base E la taratura ──────
const senza = braccio(null);
const ordSenza = [...senza.values()].sort((x, y) => x.ecc - y.ecc);
const t = Math.ceil(ordSenza.length / 3);
const STRATO = new Map();                       // gli strati CONGELATI (§3)
ordSenza.forEach((x, i) => STRATO.set(`${x.gara}|${x.pilota}`, i < t ? 'basso' : (i < 2 * t ? 'medio' : 'alto')));

const altoSenza = ordSenza.slice(2 * t);
const bmSenza = ordSenza.slice(0, 2 * t);
const rifAlto = leggi(altoSenza);
const rifBm = leggi(bmSenza);

console.log('');
console.log('══ TARATURA — il braccio senza vincolo deve riprodurre i numeri pubblicati ═');
const tara = [];
const controlla = (testo, ok, misurato, atteso) => {
  tara.push({ testo, ok, misurato, atteso });
  console.log(`  ${ok ? '✓' : '✗'} ${testo}`
    + (ok ? '' : `\n      atteso ${JSON.stringify(atteso)}  ·  misurato ${JSON.stringify(misurato)}`));
};
controlla(`perimetro n = ${BASE.n}`, senza.size === BASE.n, senza.size, BASE.n);
controlla(`terzile alto ${BASE.alto.vince}-${BASE.alto.perde}`,
  rifAlto.vince === BASE.alto.vince && rifAlto.perde === BASE.alto.perde,
  { vince: rifAlto.vince, perde: rifAlto.perde }, BASE.alto);
controlla(`basso+medio ${BASE.bassoMedio.vince}-${BASE.bassoMedio.perde}`,
  rifBm.vince === BASE.bassoMedio.vince && rifBm.perde === BASE.bassoMedio.perde,
  { vince: rifBm.vince, perde: rifBm.perde }, BASE.bassoMedio);

const rosse = tara.filter((x) => !x.ok).length;
if (rosse) {
  console.log('');
  console.log(`  TARATURA FALLITA (${rosse}/${tara.length}): NON giudico i cancelli.`);
  console.log('  Un cancello misurato con un metro storto e\' peggio di nessun cancello.');
  process.exit(1);
}
console.log(`  taratura verde: ${tara.length}/${tara.length}. U5 (invarianza a vincolo spento) e\' questa riga.`);

// ── il braccio col vincolo, letto sugli STESSI strati ────────────────────────
const con = braccio(TETTO);
const comuni = [...senza.keys()].filter((k) => con.has(k));
if (comuni.length < 0.9 * senza.size) {
  console.log(`\n  PERIMETRO APPAIATO SFALDATO: ${comuni.length}/${senza.size} casi in comune. Non giudico.`);
  process.exit(1);
}
const persi = senza.size - comuni.length;

const conAlto = comuni.filter((k) => STRATO.get(k) === 'alto').map((k) => con.get(k));
const conBm = comuni.filter((k) => STRATO.get(k) !== 'alto').map((k) => con.get(k));
const cAlto = leggi(conAlto);
const cBm = leggi(conBm);

console.log('');
console.log(`   strati CONGELATI sul braccio senza vincolo · casi appaiati ${comuni.length}/${senza.size}`
  + (persi ? ` (${persi} persi col vincolo, dichiarati)` : ''));
console.log(`   terzile alto     senza ${rifAlto.vince}-${rifAlto.perde} (saldo ${rifAlto.saldo}, p ${rifAlto.p.toFixed(4)})`
  + `   →   con ${cAlto.vince}-${cAlto.perde} (saldo ${cAlto.saldo}, p ${cAlto.p.toFixed(4)})`);
console.log(`   basso+medio      senza ${rifBm.vince}-${rifBm.perde} (saldo ${rifBm.saldo}, p ${rifBm.p.toFixed(4)})`
  + `   →   con ${cBm.vince}-${cBm.perde} (saldo ${cBm.saldo}, p ${cBm.p.toFixed(4)})`);

// ── U1, U2: le soglie sono quelle FIRMATE in KPI_5_4_4.md ───────────────────
const U1 = cAlto.p >= 0.05 && cAlto.saldo >= -15;
const U2 = cBm.saldo >= 17 && cBm.p <= 0.0568;

// ── U3: la risposta a due giri, appaiata caso per caso ───────────────────────
function dueGiri(tetto) {
  const PASSO_V2 = passoV2();
  const out = new Map();
  for (const c of casi()) {
    const vp = vecchioConPasso(c, { passo: PASSO_V2 });
    const n = rispostaNuovo(c, tetto ? { tetto } : {});
    if (vp.muto || n.muto) continue;
    const B = letturaComune(c, vp.ordine, n.ordine);
    if (!B) continue;
    out.set(`${c.gara}|${c.pilota}`, { gara: c.gara, err: B.nuovo - B.vero });
  }
  return out;
}
const dgSenza = dueGiri(null);
const dgCon = dueGiri(TETTO);
const appaiate = [...dgCon.keys()].filter((k) => dgSenza.has(k))
  .map((k) => ({ gara: dgCon.get(k).gara, a: dgCon.get(k).err, b: dgSenza.get(k).err }));
const u3 = testSegni(appaiate);
const U3 = !(u3.vinceB > u3.vinceA && u3.p < 0.05);

console.log('');
console.log(`   U1  terzile alto: p ${cAlto.p.toFixed(4)} (serve ≥ 0,05) e saldo ${cAlto.saldo} (serve ≥ −15)`
  + `   ${U1 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U2  basso+medio: saldo ${cBm.saldo} (serve ≥ +17) e p ${cBm.p.toFixed(4)} (serve ≤ 0,0568)`
  + `   ${U2 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U3  due giri appaiato: ${u3.vinceA}-${u3.vinceB} (n=${u3.n}, p=${u3.p.toFixed(4)})`
  + `   ${U3 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   U4  eccesso di movimento nel terzile alto: ${rifAlto.eccesso.toFixed(2)} → ${cAlto.eccesso.toFixed(2)}   (diagnostico)`);

// ── la regola di decisione, scritta nella prereg PRIMA di questi numeri ──────
console.log('');
console.log(`   F2 (terzile alto)  ${U1 && U3 ? 'RAGGIUNTO' : 'NON raggiunto'}`
  + `   — serve U1 E U3: ${U1 ? 'U1 sì' : 'U1 no'}, ${U3 ? 'U3 sì' : 'U3 no'}`);
console.log(`   F3 (basso+medio)   ${U2 ? 'RAGGIUNTO' : 'NON raggiunto'}   — serve U2`);
if (U1 && !U3) {
  console.log('');
  console.log('   LETTURA OBBLIGATA DALLA PREREG §4: il guadagno sulla bandiera si paga sulla');
  console.log('   risposta a due giri, l\'unica che il prodotto pubblica e l\'unica validata');
  console.log('   fuori campione. E\' uno scambio in perdita, non un miglioramento.');
}

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Esito dei cancelli di PREREG_tetto_uniforme.md — il tetto a parametri tutti costanti.',
      prereg: 'ai_lab/confronto/PREREG_tetto_uniforme.md',
      parametri: { ...TETTO, fonte: 'duello_tum_2026.json — costanti sui 121 file; soglia = mediana della fonte intera' },
      strati: 'CONGELATI sul braccio senza vincolo: i due bracci si leggono sugli stessi casi',
      perimetro: `${gare().length} gare, configurazione oracolo (la stessa in cui F2 e F3 sono firmati)`,
      limite: 'nessun placebo nuovo (prereg §5): puo\' concludere NON DANNEGGIA, mai IL MECCANISMO E\' REALE',
      data: '2026-08-03',
    },
    taratura: { verde: rosse === 0, esiti: tara },
    appaiamento: { comuni: comuni.length, totale: senza.size, persi },
    senza_vincolo: { alto: rifAlto, basso_medio: rifBm },
    con_vincolo: { alto: cAlto, basso_medio: cBm },
    U1: { passa: U1, p: cAlto.p, saldo: cAlto.saldo, serve: 'p ≥ 0,05 e saldo ≥ −15' },
    U2: { passa: U2, p: cBm.p, saldo: cBm.saldo, serve: 'saldo ≥ +17 e p ≤ 0,0568' },
    U3: { passa: U3, ...u3 },
    U4: { da: rifAlto.eccesso, a: cAlto.eccesso },
    F2: { raggiunto: U1 && U3, regola: 'U1 E U3' },
    F3: { raggiunto: U2, regola: 'U2' },
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_cancelli_tetto_uniforme.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
