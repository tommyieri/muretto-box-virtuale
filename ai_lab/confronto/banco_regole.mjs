#!/usr/bin/env node
// banco_regole.mjs — IL BANCO UNICO delle regole di reazione dei rivali.
//
//     node ai_lab/confronto/banco_regole.mjs                 taratura + elenco regole
//     node ai_lab/confronto/banco_regole.mjs --regola <nome> gira una regola
//     node ai_lab/confronto/banco_regole.mjs --json           artefatto con targhetta
//
// PERCHE' ESISTE, E PERCHE' PRIMA DELLE REGOLE.
//
// «I rivali non reagiscono mai» e' la prima delle sei cause dichiarate del tetto della
// fisica. Prima di provare una regola qualunque serve uno strumento che sappia dire se
// una regola migliora le cose — e uno strumento del genere si crede solo se, messo a
// zero, riproduce cio' che gia' si sa. Questo file e' quello strumento, e la sua
// TARATURA e' l'unica ragione per cui il suo verdetto varra' qualcosa.
//
// LA TARATURA. Con la regola-identita' — «il rivale non reagisce mai», cioe' la
// configurazione con cui girano oggi tutte le misure pubblicate — il banco deve
// riprodurre ESATTAMENTE i numeri gia' noti. Se non li riproduce, esce 1 e si rifiuta
// di giudicare qualsiasi regola: un banco scalibrato che dice «la regola X migliora del
// 3%» e' peggio di nessun banco, perche' quel 3% verrebbe creduto.
//
// COSA HO TROVATO COSTRUENDOLO, e va detto perche' cambia la fiducia nei numeri:
// il 36-12 a due giri e il 44-27 alla bandiera — i due numeri che questo progetto cita
// piu' spesso — NON erano prodotti da nessuno script committato. Il primo e' una misura
// fatta a mano incrociando M1a e il test dei segni di voce6; il secondo e' la somma a
// mano di due terzili che nessun programma stampa, e nessuno dei due aveva un p-value in
// un file eseguibile. Sono veri e riproducibili: questo banco li riproduce. Ma fino a
// oggi vivevano in un documento, non in un programma — e un numero che nessun programma
// rifa' e' un numero che nessuno puo' smentire.
//
// COSA FA FALLIRE QUESTO BANCO (esce 1):
//  (a) la taratura non torna: un numero atteso e' diverso da quello misurato;
//  (b) una regola dichiarata non esiste, o non espone l'interfaccia;
//  (c) il perimetro cambia sotto i piedi (n diverso da quello atteso) — che e' il modo
//      in cui un confronto smette di essere confrontabile senza che nessuno lo veda.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, casi } from './banco.mjs';
import { rispostaNuovo } from './banco.mjs';
import {
  perGara, pianiVeriDi, corri, letturaComune, vecchioConPasso, passoV2,
  testSegni, bootstrapBlocchiGare, mediana, media,
} from './bandiera.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const nomeRegola = (() => { const i = ARGV.indexOf('--regola'); return i >= 0 ? ARGV[i + 1] : null; })();

// ═══════════════════════════════════════════════════════════ LE REGOLE
//
// UNA REGOLA E' UNA FUNZIONE DA (GARA, CONGELAMENTO) A COMPORTAMENTO DEI RIVALI. Niente
// di piu': non vede il futuro del soggetto, non tocca il kernel, non cambia il passo.
// L'unica cucitura che il motore espone e' `pianiRivali` (ingresso di laboratorio del
// costruttore), quindi una regola qui e' cio' che produce quel piano.
//
// IL CONGELAMENTO E' NELLA FIRMA DAL 03/08/2026, e non e' un abbellimento. Prima la
// regola veniva interrogata UNA volta per gara, implicitamente al giro 5, mentre `corri`
// sceglie il congelamento caso per caso e lo porta oltre il 5 in 49 casi su 193 (25,4%).
// Le soste proposte per un congelamento piu' basso vengono scartate in silenzio dal
// costruttore: una regola giudicata cosi' girava come REGOLA-IDENTITA' su un quarto del
// perimetro, con l'etichetta della regola nuova addosso. Diagnosticato in
// REFERTO_mirrorplay_degenere.md §(a) prima di spendere l'esperimento.
//
// LIMITE DICHIARATO, e va letto prima di aggiungere regole: in VERDE il costruttore non
// ha alcun punto d'innesto per una reazione — la regola vive solo dentro il ramo
// `regime !== null` (N4, soste_rivali_sotto_regime). Una regola che debba agire in verde
// oggi puo' solo materializzare un piano completo, non reagire giro per giro. Aprire
// quel punto d'innesto e' lavoro di Fase 2, con la sua prereg.
const REGOLE = {
  identita: {
    nome: 'identita',
    descrizione: 'il rivale non reagisce mai — la configurazione con cui girano tutte le misure pubblicate',
    targhetta: 'REGOLA NULLA: nessun piano ai rivali, nessuna patch al prior. E\' il metro, non un candidato.',
    pianiRivali: (_gara, _freezeLap) => undefined,
  },
  // LA REGOLA-ORACOLO: non e' una regola di reazione, e' l'ingresso di laboratorio che
  // da' a ogni rivale le sue soste VERE. Serve come estremo superiore — quanto si
  // guadagnerebbe sapendo in anticipo cosa faranno tutti — non come candidata: legge il
  // futuro, e nessuna cosa che legge il futuro puo' andare in produzione (E14).
  oracolo: {
    nome: 'oracolo',
    descrizione: 'ogni rivale riceve le sue soste vere (informazione dal futuro)',
    targhetta: 'NON E\' UNA CANDIDATA: legge il futuro (E14). E\' il tetto superiore contro cui misurare una regola vera.',
    // non dipende dal congelamento: le soste vere sono quelle a qualunque giro si congeli.
    // E' anche la ragione per cui la riparazione della cucitura lascia i numeri identici.
    pianiRivali: (nomeSito, _freezeLap) => pianiVeriDi(nomeSito),
  },
};

// ═══════════════════════════════════════════════════ LE ATTESE DELLA TARATURA
//
// Le attese viaggiano COL banco (E07: mai soglie cablate dentro una condizione senza
// dichiararle). Ogni numero qui e' stato riprodotto il 03/08/2026 prima di scrivere
// questo file, e porta la fonte di dove era stato pubblicato.
// Dal 07/08 i numeri vengono dalla SORGENTE UNICA (basi_kpi.json): le fonti di
// prosa restano qui, i numeri no. Il 44-27 — che «non e' stampato da nessuno
// script» — ora e' stampato dalla sorgente, e s45 verifica la somma dei terzili.
const BASI = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'basi_kpi.json'), 'utf8'));
const ATTESE = {
  due_giri: {
    ...BASI.due_giri,
    fonte: 'PREREG_voce6_bandiera.md §M1 + M1a_errore_posizione.mjs (lettura B, V-pannello) — numeri da basi_kpi.json',
  },
  bandiera: {
    fonte: BASI.bandiera.fonte,
    n: BASI.bandiera.n,
    terzili: BASI.bandiera.terzili,
    aggregato_basso_medio: { n: BASI.bandiera.basso_medio.n, vince: BASI.bandiera.basso_medio.vince, perde: BASI.bandiera.basso_medio.perde },
  },
};

// ═════════════════════════════════════════════════════════ METRICA 1 — DUE GIRI
//
// Unita' = un caso di sosta. Verita' = rango per cum_time al giro di rientro, dal byLap
// pinnato. Confronto = motore NUOVO contro motore VECCHIO in configurazione pannello,
// sulla popolazione comune ai due piu' la verita' (lettura B).
//
// LA REGOLA NON ENTRA QUI, e non e' una svista: `evaluatePit` non ha `pianiRivali` in
// firma e `rispostaNuovo` nemmeno. Questa metrica e' oggi il TERMOMETRO DI TARATURA del
// banco, non un banco di prova per le regole. Estenderla e' Fase 2.
function metricaDueGiri() {
  const PASSO_V2 = passoV2();
  const elenco = casi();
  const coppie = [];
  for (const c of elenco) {
    const vp = vecchioConPasso(c, { passo: PASSO_V2 });
    const n = rispostaNuovo(c);
    if (vp.muto || n.muto) continue;
    const B = letturaComune(c, vp.ordine, n.ordine);
    if (!B) continue;
    coppie.push({ gara: c.gara, pilota: c.pilota, a: B.nuovo - B.vero, b: B.vecchio - B.vero });
  }
  const t = testSegni(coppie);
  const boot = bootstrapBlocchiGare(coppie,
    (camp) => 100 * (camp.filter((x) => x.a === 0).length - camp.filter((x) => x.b === 0).length) / camp.length);
  return { ...t, coppie, esatti_nuovo: coppie.filter((x) => x.a === 0).length, ic95_delta_esatti: boot.ic95 };
}

// ═══════════════════════════════════════════════════════ METRICA 2 — BANDIERA
//
// Unita' = un pilota-gara. Verita' = pos_finale da data/arrivi_2026.csv, fonte diversa
// dal byLap. Confronto = motore contro NULLO (l'ordine al congelamento), sulla terna
// comune. Qui la regola entra davvero: e' `pianiRivali`.
function metricaBandiera(regola) {
  const tutti = [];
  const scarti = {};
  for (const g of gare()) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: (lf, ctx) => regola.pianiRivali(g, lf, ctx) });
      if (e.saltato) { const k = e.saltato.replace(/\d+/g, 'N'); scarti[k] = (scarti[k] ?? 0) + 1; continue; }
      tutti.push({ gara: g, pilota: r.pilota, ...e });
    }
  }
  // LA SONDA DELLA CUCITURA: quanto della regola e' davvero arrivato al motore. Il
  // costruttore scarta le soste con giro <= freezeLap in silenzio, quindi «proposti» e
  // «arrivati» possono divergere — ed e' esattamente il modo in cui una regola gira come
  // identita' senza che nessuno lo veda. Si stampa sempre, anche quando tornano.
  const sonda = {
    casi: tutti.length,
    proposti: tutti.reduce((a, x) => a + (x.rivali_con_piano_proposto ?? 0), 0),
    arrivati: tutti.reduce((a, x) => a + (x.rivali_con_sosta_nel_motore ?? 0), 0),
    casi_senza_nessuna_reazione: tutti.filter((x) => !(x.rivali_con_sosta_nel_motore > 0)).length,
  };

  const utili = tutti.filter((x) => x.errore_nullo !== null);
  const coppie = utili.map((x) => ({ gara: x.gara, a: x.errore, b: x.errore_nullo }));
  const globale = testSegni(coppie);

  // I TERZILI sull'eccesso di movimento: e' la lettura che ha trovato le due popolazioni
  // opposte, e senza di essa il pareggio globale col nullo sembra un pareggio vero.
  const ord = [...utili].sort((a, b) => (a.cambi_motore - a.cambi_reali) - (b.cambi_motore - b.cambi_reali));
  const t = Math.ceil(ord.length / 3);
  const fasce = [
    ['ne inventa MENO del vero', ord.slice(0, t)],
    ['circa il giusto', ord.slice(t, 2 * t)],
    ['ne inventa PIU\' del vero', ord.slice(2 * t)],
  ].map(([nome, q]) => {
    const cp = q.map((x) => ({ gara: x.gara, a: x.errore, b: x.errore_nullo }));
    const s = testSegni(cp);
    return {
      nome, n: q.length, vince: s.vinceA, perde: s.vinceB, pari: s.pari, p: s.p,
      eccesso_medio: media(q.map((x) => x.cambi_motore - x.cambi_reali)),
      err_motore: media(q.map((x) => Math.abs(x.errore))),
      err_nullo: media(q.map((x) => Math.abs(x.errore_nullo))),
    };
  });
  const bassoMedio = testSegni(ord.slice(0, 2 * t).map((x) => ({ gara: x.gara, a: x.errore, b: x.errore_nullo })));

  return {
    n: utili.length, scarti, sonda, globale, fasce,
    aggregato_basso_medio: { n: bassoMedio.n, vince: bassoMedio.vinceA, perde: bassoMedio.vinceB, p: bassoMedio.p },
    err_motore_mediana: mediana(utili.map((x) => Math.abs(x.errore))),
    err_nullo_mediana: mediana(utili.map((x) => Math.abs(x.errore_nullo))),
  };
}

// ═════════════════════════════════════════════════════════════════ TARATURA
const vicino = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

function taratura() {
  const esiti = [];
  const controlla = (testo, ok, misurato, atteso) => {
    esiti.push({ testo, ok, misurato, atteso });
    console.log(`  ${ok ? '✓' : '✗'} ${testo}`
      + (ok ? '' : `\n      atteso ${JSON.stringify(atteso)}  ·  misurato ${JSON.stringify(misurato)}`));
  };

  console.log('');
  console.log('══ TARATURA — la regola-identita\' deve riprodurre i numeri gia\' noti ═══════');
  console.log('   Se una sola riga qui e\' rossa, il banco non giudica niente: esce 1.');
  console.log('');

  // — metrica a due giri
  const A = ATTESE.due_giri;
  const m1 = metricaDueGiri();
  console.log(`  DUE GIRI  (${A.fonte})`);
  controlla(`perimetro n = ${A.n}`, m1.n === A.n, m1.n, A.n);
  controlla(`nuovo ${A.vinceA} · vecchio ${A.vinceB} · pari ${A.pari}`,
    m1.vinceA === A.vinceA && m1.vinceB === A.vinceB && m1.pari === A.pari,
    { nuovo: m1.vinceA, vecchio: m1.vinceB, pari: m1.pari }, A);
  controlla(`p = ${A.p} (test dei segni bilaterale)`, vicino(m1.p, A.p, 0.00005), Number(m1.p.toFixed(5)), A.p);

  // — metrica alla bandiera, con la regola-oracolo (e' la configurazione --rivali con
  //   cui i terzili pubblicati sono stati misurati)
  const B = ATTESE.bandiera;
  const m2 = metricaBandiera(REGOLE.oracolo);
  console.log('');
  console.log(`  BANDIERA  (${B.fonte})`);
  controlla(`perimetro n = ${B.n}`, m2.n === B.n, m2.n, B.n);
  for (const att of B.terzili) {
    const f = m2.fasce.find((x) => x.nome === att.nome);
    controlla(`terzile «${att.nome}»  n=${att.n}  appaiato ${att.vince}-${att.perde}`,
      Boolean(f) && f.n === att.n && f.vince === att.vince && f.perde === att.perde,
      f ? { n: f.n, vince: f.vince, perde: f.perde } : null, att);
  }
  const ag = B.aggregato_basso_medio;
  controlla(`aggregato basso+medio  n=${ag.n}  ${ag.vince}-${ag.perde}  (mai stampato da nessuno script prima d'ora)`,
    m2.aggregato_basso_medio.n === ag.n && m2.aggregato_basso_medio.vince === ag.vince
      && m2.aggregato_basso_medio.perde === ag.perde,
    m2.aggregato_basso_medio, ag);

  const rosse = esiti.filter((e) => !e.ok);
  console.log('');
  if (rosse.length) {
    console.log(`  TARATURA FALLITA: ${rosse.length} attese su ${esiti.length} non tornano.`);
    console.log('  Il banco NON giudica regole finche\' non torna. Se il cambiamento e\' voluto,');
    console.log('  le ATTESE si aggiornano con una decisione scritta, non correggendo il numero.');
  } else {
    console.log(`  taratura verde: ${esiti.length}/${esiti.length} attese riprodotte.`);
    console.log(`  Il terzile alto resta la ferita: ${m2.fasce[2].vince}-${m2.fasce[2].perde} `
      + `(p = ${m2.fasce[2].p.toFixed(4)}) — dove il motore inventa movimento, perde dal nullo.`);
  }
  return { esiti, rosse: rosse.length, m1, m2 };
}

// ═══════════════════════════════════════════════════════════════ ESECUZIONE
const t = taratura();

// I DUE ESTREMI, misurati una volta sola e riusati: l'identita' (nessun rivale reagisce)
// e l'oracolo (tutti si fermano quando si sono fermati davvero). Ogni regola si legge
// FRA questi due, mai in assoluto.
const REGOLE_RIFERIMENTO = { identita: metricaBandiera(REGOLE.identita), oracolo: t.m2 };

let provata = null;
if (nomeRegola) {
  const R = REGOLE[nomeRegola];
  if (!R) {
    console.error(`\nregola sconosciuta: ${nomeRegola}. Disponibili: ${Object.keys(REGOLE).join(', ')}`);
    process.exit(1);
  }
  if (t.rosse) {
    console.error('\nil banco e\' scalibrato: non giudico la regola.');
    process.exit(1);
  }
  console.log('');
  console.log(`══ REGOLA «${R.nome}» ═══════════════════════════════════════════════════════`);
  console.log(`   ${R.descrizione}`);
  console.log(`   ${R.targhetta}`);
  const m = nomeRegola === 'oracolo' ? t.m2 : metricaBandiera(R);
  console.log('');
  console.log(`   alla bandiera, contro il nullo:  n=${m.n}  ${m.globale.vinceA}-${m.globale.vinceB} `
    + `(pari ${m.globale.pari})  p=${m.globale.p.toFixed(4)}`);
  console.log(`   |errore| mediano:  motore ${m.err_motore_mediana}   nullo ${m.err_nullo_mediana}`);
  console.log(`   cucitura:  soste proposte ai rivali ${m.sonda.proposti}  ·  ARRIVATE AL MOTORE ${m.sonda.arrivati}`
    + `  ·  casi in cui nessun rivale reagisce ${m.sonda.casi_senza_nessuna_reazione}/${m.sonda.casi}`
    + (m.sonda.proposti !== m.sonda.arrivati ? '   ⚠ il costruttore ne ha scartate' : ''));
  for (const f of m.fasce) {
    console.log(`     ${f.nome.padEnd(26)} n=${String(f.n).padStart(3)}  appaiato ${f.vince}-${f.perde}  p=${f.p.toFixed(4)}`);
  }
  console.log(`     ${'aggregato basso+medio'.padEnd(26)} n=${String(m.aggregato_basso_medio.n).padStart(3)}`
    + `  appaiato ${m.aggregato_basso_medio.vince}-${m.aggregato_basso_medio.perde}`);

  // DOVE CADE LA REGOLA FRA I DUE ESTREMI. Una regola qualunque che faccia fermare i
  // rivali recupera da sola una fetta del divario identita'→oracolo, e non perche' abbia
  // indovinato la reazione: perche' anche i rivali pagano il pit-loss. Senza questo
  // posizionamento, «la regola X migliora di N» e' un titolo che si prende il merito
  // della fisica delle soste altrui.
  const rifIdent = REGOLE_RIFERIMENTO.identita;
  const rifOracolo = REGOLE_RIFERIMENTO.oracolo;
  const sc = (x) => x.globale.vinceA - x.globale.vinceB;
  const base = sc(rifIdent);
  const tetto = sc(rifOracolo);
  const qui = sc(m);
  const quota = tetto === base ? null : (qui - base) / (tetto - base);
  console.log('');
  console.log(`   posizionamento (saldo vince−perde alla bandiera):`);
  console.log(`     identita' ${base >= 0 ? '+' : ''}${base}   ·   QUESTA REGOLA ${qui >= 0 ? '+' : ''}${qui}   ·   oracolo ${tetto >= 0 ? '+' : ''}${tetto}`);
  if (quota !== null) {
    console.log(`     copre il ${(100 * quota).toFixed(0)}% del divario fra il non-far-reagire-nessuno e il sapere tutto`);
    console.log('     ATTENZIONE: parte di quel divario e\' solo il pit-loss che pagano i rivali,');
    console.log('     non la reazione indovinata. Una regola vale se batte una regola FINTA che');
    console.log('     faccia fermare gli stessi rivali agli stessi giri, ma scelti a caso.');
  }
  provata = { regola: R.nome, ...m, posizionamento: { identita: base, regola: qui, oracolo: tetto, quota } };
}

console.log('');
console.log('  regole disponibili: ' + Object.keys(REGOLE).map((k) => (k === nomeRegola ? `[${k}]` : k)).join(' · '));
console.log('  (una regola nuova entra qui SOLO con la sua prereg: il banco misura, non decide)');

if (JSON_OUT) {
  const out = {
    _targhetta: {
      cosa_e: 'Il banco unico delle regole di reazione dei rivali, con la sua taratura.',
      metro: 'DUE GIRI: caso di sosta, nuovo vs vecchio-pannello, verita\' = cum_time al rientro. '
           + 'BANDIERA: pilota-gara, motore vs nullo, verita\' = pos_finale da arrivi_2026.csv. '
           + 'Le due verita\' restano DISTINTE di proposito.',
      taratura: 'con la regola-identita\' il banco riproduce i numeri pubblicati; se non li riproduce esce 1',
      limite: 'la regola entra solo nella metrica alla bandiera: evaluatePit e rispostaNuovo non hanno '
            + 'pianiRivali in firma, e in verde il costruttore non ha punto d\'innesto per una reazione',
      generato_da: 'ai_lab/confronto/banco_regole.mjs',
    },
    taratura: { verde: t.rosse === 0, esiti: t.esiti },
    identita: { due_giri: { n: t.m1.n, vinceA: t.m1.vinceA, vinceB: t.m1.vinceB, pari: t.m1.pari, p: t.m1.p } },
    oracolo: { bandiera: { n: t.m2.n, fasce: t.m2.fasce, aggregato_basso_medio: t.m2.aggregato_basso_medio } },
    regola_provata: provata,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_banco_regole.json');
  writeFileSync(dove, JSON.stringify(out, null, 1) + '\n');
  console.log(`\n  scritto ${path.relative(RADICE, dove)}`);
}

process.exit(t.rosse ? 1 : 0);
