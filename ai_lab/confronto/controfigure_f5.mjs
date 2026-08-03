#!/usr/bin/env node
// controfigure_f5.mjs — i cancelli di PREREG_F5_controfigure.md.
//
//     node ai_lab/confronto/controfigure_f5.mjs [--json] [--estrazioni N]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Statistica, controfigure, numero
// di estrazioni, semi e soglie sono copiati da li' e non si toccano.
//
// LA MOSSA, in una riga: si prova il SOFFITTO, non un candidato. Fra regola-identita'
// (saldo -14) e regola-oracolo (+2) ci sono 16 punti, ed e' tutto cio' che la famiglia
// «reazione dei rivali» puo' dare. Se l'oracolo non batte una controfigura che ferma gli
// stessi rivali lo stesso numero di volte a giri a caso, allora quei 16 punti non sono
// informazione sulla strategia altrui: sono aritmetica delle soste — e la famiglia e'
// chiusa QUALUNQUE regola le si metta dentro, senza doverne costruire nessuna.
//
// COSA LO FA USCIRE 1:
//  (a) la taratura non torna: identita' e oracolo devono riprodurre 48-62 e 57-55, cioe'
//      i numeri che il banco stampa dal 03/08 mattina. Se non tornano, lo strumento e'
//      rotto e non giudica niente;
//  (b) il perimetro appaiato si sfalda (meno del 90% dei casi in comune fra i bracci).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare } from './banco.mjs';
import { perGara, corri, testSegni, pianiVeriDi, media } from './bandiera.mjs';
import { REGOLE, controfiguraLivello, controfiguraPosizione, giriDiGara, generatore } from './regole.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const ESTRAZIONI = (() => { const i = ARGV.indexOf('--estrazioni'); return i >= 0 ? Number(ARGV[i + 1]) : 500; })();
const SEME_LIVELLO = 20260803;
const SEME_POSIZIONE = 20260804;

// le attese della taratura, dalla prereg §1 — sono i numeri gia' pubblicati dal banco
const ATTESE = { identita: { vince: 48, perde: 62 }, oracolo: { vince: 57, perde: 55 } };

const GARE = gare();
const GIRI = Object.fromEntries(GARE.map((g) => [g, giriDiGara(g)]));

/**
 * UNA PASSATA. `fabbrica(gara, freezeLap)` produce i piani dei rivali; torna una Map
 * caso -> {a, b, ecc} piu' la sonda della cucitura.
 */
function passata(fabbrica) {
  const m = new Map();
  let proposti = 0; let arrivati = 0;
  for (const g of GARE) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: fabbrica ? (lf, ctx) => fabbrica(g, lf, ctx) : undefined });
      if (e.saltato || e.errore_nullo === null) continue;
      proposti += e.rivali_con_piano_proposto ?? 0;
      arrivati += e.rivali_con_sosta_nel_motore ?? 0;
      m.set(`${g}|${r.pilota}`, { a: e.errore, b: e.errore_nullo, ecc: e.cambi_motore - e.cambi_reali });
    }
  }
  return { m, sonda: { proposti, arrivati } };
}

const saldoDi = (righe) => { const s = testSegni(righe); return s.vinceA - s.vinceB; };

console.log('');
console.log('══ CONTROFIGURE (F5) — PREREG_F5_controfigure.md ══════════════════════════');
console.log(`   ${ESTRAZIONI} estrazioni per controfigura · semi ${SEME_LIVELLO} / ${SEME_POSIZIONE}`);
console.log('   si prova il SOFFITTO (l\'oracolo), non un candidato: nessuna regola candidata esiste.');

// ── i due estremi: sono insieme la linea di base E la taratura ───────────────
const ident = passata(null);
const orac = passata((g, _lf) => pianiVeriDi(g));

const comuni = [...ident.m.keys()].filter((k) => orac.m.has(k));
if (comuni.length < 0.9 * ident.m.size) {
  console.log(`\n  PERIMETRO APPAIATO SFALDATO: ${comuni.length}/${ident.m.size}. Non giudico.`);
  process.exit(1);
}
const righeDi = (M) => comuni.map((k) => M.get(k));
const sIdent = testSegni(righeDi(ident.m));
const sOrac = testSegni(righeDi(orac.m));

console.log('');
console.log('══ TARATURA — i due estremi devono essere quelli gia\' pubblicati ══════════');
const tara = [];
const controlla = (t, ok, mis, att) => {
  tara.push({ testo: t, ok, misurato: mis, atteso: att });
  console.log(`  ${ok ? '✓' : '✗'} ${t}` + (ok ? '' : `\n      atteso ${JSON.stringify(att)} · misurato ${JSON.stringify(mis)}`));
};
controlla(`identita' ${ATTESE.identita.vince}-${ATTESE.identita.perde}`,
  sIdent.vinceA === ATTESE.identita.vince && sIdent.vinceB === ATTESE.identita.perde,
  { vince: sIdent.vinceA, perde: sIdent.vinceB }, ATTESE.identita);
controlla(`oracolo ${ATTESE.oracolo.vince}-${ATTESE.oracolo.perde}`,
  sOrac.vinceA === ATTESE.oracolo.vince && sOrac.vinceB === ATTESE.oracolo.perde,
  { vince: sOrac.vinceA, perde: sOrac.vinceB }, ATTESE.oracolo);
if (tara.some((x) => !x.ok)) {
  console.log('\n  TARATURA FALLITA: non giudico. Un placebo misurato con un metro storto');
  console.log('  assolverebbe o condannerebbe a caso, ed e\' peggio di nessun placebo.');
  process.exit(1);
}

const SALDO_IDENT = sIdent.vinceA - sIdent.vinceB;
const SALDO_ORAC = sOrac.vinceA - sOrac.vinceB;
const DIVARIO = SALDO_ORAC - SALDO_IDENT;
console.log(`  taratura verde. identita' ${SALDO_IDENT}  ·  oracolo ${SALDO_ORAC >= 0 ? '+' : ''}${SALDO_ORAC}  ·  divario ${DIVARIO}`);
console.log(`  cucitura: oracolo — proposte ${orac.sonda.proposti}, arrivate al motore ${orac.sonda.arrivati}`);

// ── gli strati CONGELATI su identita' (nessuna regola puo' muoverli) ─────────
const ordId = comuni.map((k) => ({ k, ecc: ident.m.get(k).ecc })).sort((x, y) => x.ecc - y.ecc);
const t3 = Math.ceil(ordId.length / 3);
const STRATO = new Map();
ordId.forEach((x, i) => STRATO.set(x.k, i < t3 ? 'basso' : (i < 2 * t3 ? 'medio' : 'alto')));
const perStrato = (M, s) => comuni.filter((k) => STRATO.get(k) === s).map((k) => M.get(k));

// ── le due controfigure ─────────────────────────────────────────────────────
function giraControfigura(nome, seme, costruisci) {
  console.log('');
  console.log(`   ${nome}: ${ESTRAZIONI} estrazioni, seme ${seme}`);
  const rnd = generatore(seme);
  const saldi = []; const perTerzile = { basso: [], medio: [], alto: [] };
  let propTot = 0; let arrTot = 0;
  for (let i = 0; i < ESTRAZIONI; i += 1) {
    const p = passata((g, lf) => costruisci(g, lf, rnd, i));
    const cm = comuni.filter((k) => p.m.has(k));
    saldi.push(saldoDi(cm.map((k) => p.m.get(k))));
    for (const s of ['basso', 'medio', 'alto']) {
      perTerzile[s].push(saldoDi(cm.filter((k) => STRATO.get(k) === s).map((k) => p.m.get(k))));
    }
    propTot += p.sonda.proposti; arrTot += p.sonda.arrivati;
    if ((i + 1) % 100 === 0) console.log(`       ${i + 1}/${ESTRAZIONI}`);
  }
  const ord = [...saldi].sort((a, b) => a - b);
  const q = (f) => ord[Math.min(ord.length - 1, Math.floor(f * ord.length))];
  return {
    nome, seme, estrazioni: ESTRAZIONI,
    mediana: q(0.5), p95: q(0.95), min: ord[0], max: ord[ord.length - 1],
    per_terzile: Object.fromEntries(Object.entries(perTerzile).map(([s, v]) => {
      const o = [...v].sort((a, b) => a - b);
      return [s, { mediana: o[Math.floor(0.5 * o.length)], p95: o[Math.floor(0.95 * o.length)] }];
    })),
    sonda: { proposte_medie: propTot / ESTRAZIONI, arrivate_medie: arrTot / ESTRAZIONI },
  };
}

const CL = giraControfigura('C-LIVELLO   (giri a caso)', SEME_LIVELLO,
  (g, lf, rnd) => controfiguraLivello(pianiVeriDi(g), { freezeLap: lf, giroFinale: GIRI[g], rnd }));

const CP = giraControfigura('C-POSIZIONE (giri di un\'altra gara)', SEME_POSIZIONE,
  (g, lf, rnd, i) => {
    // scorrimento ciclico del calendario, diverso a ogni estrazione: la gara che presta
    // non e' mai la stessa e non e' mai se stessa.
    const idx = GARE.indexOf(g);
    const salto = 1 + Math.floor(rnd() * (GARE.length - 1));
    let j = (idx + salto + i) % GARE.length;
    // LA GARA CHE PRESTA NON PUO' ESSERE SE STESSA. La prima scrittura, quando lo
    // scorrimento ricadeva sull'indice di partenza, restituiva i piani VERI — cioe' in
    // circa un decimo dei casi il finto era il vero. Sbagliava dalla parte prudente
    // (gonfiava il placebo, rendendo il cancello piu' duro) ma restava una misura che non
    // eseguiva la prereg: li' c'e' scritto «i giri che la regola produrrebbe in UN'ALTRA
    // gara». Corretto prima di produrre un numero.
    if (j === idx) j = (idx + 1) % GARE.length;
    const altra = GARE[j];
    return controfiguraPosizione(pianiVeriDi(g), pianiVeriDi(altra),
      { freezeLap: lf, giroFinale: GIRI[g], giroFinaleAltra: GIRI[altra] });
  });

// ── i cancelli ──────────────────────────────────────────────────────────────
const P1 = SALDO_ORAC > CL.p95;
const P2 = SALDO_ORAC > CP.p95;
const quota = (c) => (DIVARIO === 0 ? null : (SALDO_ORAC - c.mediana) / DIVARIO);

console.log('');
console.log(`   saldo VERO dell'oracolo: ${SALDO_ORAC >= 0 ? '+' : ''}${SALDO_ORAC}   (identita' ${SALDO_IDENT}, divario ${DIVARIO})`);
for (const [c, esito] of [[CL, P1], [CP, P2]]) {
  console.log(`   ${c.nome.padEnd(38)} mediana ${c.mediana >= 0 ? '+' : ''}${c.mediana}  ·  p95 ${c.p95 >= 0 ? '+' : ''}${c.p95}`
    + `  ·  [${c.min}, ${c.max}]   ${esito ? 'IL VERO BATTE IL FINTO' : 'IL VERO NON BATTE IL FINTO'}`);
  console.log(`   ${''.padEnd(38)} soste arrivate al motore: finto ${c.sonda.arrivate_medie.toFixed(0)} vs vero ${orac.sonda.arrivati}`
    + (Math.abs(c.sonda.arrivate_medie - orac.sonda.arrivati) > 0.05 * orac.sonda.arrivati ? '   ⚠ PREREG §6(a): il confronto e\' sbilanciato' : ''));
}
console.log('');
console.log(`   P1 (C-LIVELLO)    ${P1 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   P2 (C-POSIZIONE)  ${P2 ? 'PASSA' : 'NON PASSA'}`);
console.log(`   P3 quota del divario che sopravvive al placebo:  livello ${quota(CL) === null ? '—' : (100 * quota(CL)).toFixed(0) + '%'}`
  + `  ·  posizione ${quota(CP) === null ? '—' : (100 * quota(CP)).toFixed(0) + '%'}   (diagnostico)`);

console.log('');
if (P1 && P2) {
  console.log('   LETTURA OBBLIGATA DALLA PREREG §4: esiste informazione strategica catturabile.');
  console.log('   Si dichiara la quota residua e SOLO ALLORA si apre la prereg di un candidato.');
} else {
  console.log('   LETTURA OBBLIGATA DALLA PREREG §4: il divario identita\'→oracolo e\', in tutto o');
  console.log('   in parte, ARITMETICA DELLE SOSTE e non reazione. La famiglia si chiude con questo');
  console.log('   numero e NESSUNA regola candidata viene costruita: cercarne una adesso sarebbe');
  console.log('   cercare un vincitore in una gara gia\' dichiarata nulla.');
  console.log('   E vale il §6(b): l\'oracolo da\' le soste VERE, non quelle che massimizzano la');
  console.log('   metrica. La lettura corretta e\' «la strategia vera degli altri non porta');
  console.log('   informazione utile a QUESTA metrica», non «nessuna regola batterebbe il caso».');
}

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Esito di PREREG_F5_controfigure.md — il placebo di F5 applicato al SOFFITTO della famiglia.',
      prereg: 'ai_lab/confronto/PREREG_F5_controfigure.md',
      statistica: 'saldo (vince − perde) alla bandiera contro il nullo, 193 casi, perimetro appaiato',
      strati: 'CONGELATI sulla configurazione identita\' (nessuna regola puo\' muoverli)',
      limite: 'l\'oracolo non e\' un ottimizzatore: da\' le soste VERE, non quelle che massimizzano la metrica',
      data: '2026-08-03',
    },
    taratura: { verde: true, esiti: tara },
    estremi: { identita: { ...sIdent, saldo: SALDO_IDENT }, oracolo: { ...sOrac, saldo: SALDO_ORAC }, divario: DIVARIO },
    per_terzile_congelato: Object.fromEntries(['basso', 'medio', 'alto'].map((s) => [s, {
      identita: saldoDi(perStrato(ident.m, s)), oracolo: saldoDi(perStrato(orac.m, s)),
    }])),
    controfigure: { livello: CL, posizione: CP },
    P1: { passa: P1, vero: SALDO_ORAC, p95: CL.p95 },
    P2: { passa: P2, vero: SALDO_ORAC, p95: CP.p95 },
    P3: { quota_livello: quota(CL), quota_posizione: quota(CP) },
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_controfigure_f5.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}

process.exit(0);
