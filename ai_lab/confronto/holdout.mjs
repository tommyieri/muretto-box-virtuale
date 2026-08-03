#!/usr/bin/env node
// holdout.mjs — LA MISURA DELL'HOLDOUT, su una gara sola.
//
//     node ai_lab/confronto/holdout.mjs --gara Olanda [--json]
//     node ai_lab/confronto/holdout.mjs --gara Belgio --prova-a-secco
//
// PERCHE' ESISTE, e la ragione e' scomoda. Il 03/08/2026, venti giorni prima del primo
// fuori campione vero del progetto, questo file NON ESISTEVA: nessuno script del repo
// calcolava le metriche dell'holdout per UNA gara, e nessuno accettava un `--gara`. Il
// protocollo era scritto (PREREG_holdout_Olanda.md), i cancelli erano pre-registrati con
// le loro soglie, il lucchetto contro la ri-stima automatica era in piedi — ma lo
// strumento per eseguire la misura sarebbe stato scritto la domenica sera, sotto la
// pressione della gara appena finita, da qualcuno che non poteva piu' provarlo.
//
// Un guasto di procedura scoperto il 23 agosto non e' rimediabile: l'holdout si brucia una
// volta sola. Questo file e' il risultato della prova a secco.
//
// COSA FA, nell'ordine che la prereg impone:
//   0. REGOLA 4 — verifica i cinque hash del sigillo PRIMA di misurare. Se uno e' cambiato
//      l'esito e' NON GIUDICABILE, e si dichiara quale.
//   1. REGOLA 3 — perimetro: i casi ammessi di QUELLA gara. Sotto 15, NON GIUDICABILE:
//      non si allarga il perimetro per avere numeri.
//   2. M1 in lettura B2 (terna comune), per il motore nuovo e per il vecchio-pannello.
//   3. M5 col metro del prodotto: banda dichiarata al congelamento contro posizione vera.
//   4. I cancelli H1..H5, con le soglie copiate dalla prereg e non toccate.
//
// COSA NON FA: non decide, non promuove, non chiude il sigillo. Portare `stato` a `chiuso`
// e' una decisione del PO e si fa a mano, dopo aver letto il referto.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { RADICE, gare, casi, rispostaNuovo } from './banco.mjs';
import { letturaComune, vecchioConPasso, passoV2, mediana } from './bandiera.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const PROVA = ARGV.includes('--prova-a-secco');
const GARA = (() => { const i = ARGV.indexOf('--gara'); return i >= 0 ? ARGV[i + 1] : null; })();

if (!GARA) {
  console.error('serve --gara <nome>. Gare note: ' + gare().join(', '));
  process.exit(2);
}

const SIM = path.join(RADICE, 'simulatore');
const SIGILLO = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'SIGILLO_holdout.json'), 'utf8'));

// Le soglie sono COPIATE da PREREG_holdout_Olanda.md §«I cancelli» e non si toccano.
// H4 porta con se' il suo avvertimento: il riferimento si e' mosso, la soglia no.
const CANCELLI = {
  H1: { descrizione: 'esatti M1-B2 del nuovo', soglia: 0.400, verso: '>=' },
  H2: { descrizione: 'mediana |errore| M1-B2 del nuovo', soglia: 1.0, verso: '<=' },
  H3: { descrizione: 'il nuovo >= il vecchio sugli esatti M1-B2', soglia: 0, verso: '>=' },
  H4: { descrizione: 'copertura della banda (metro del prodotto)', soglia: 0.673, verso: '>=' },
  H5: { descrizione: 'copertura: casi con risposta', soglia: 0.900, verso: '>=' },
};
const MIN_CASI = 15;   // prereg regola 3, applicata alla popolazione della METRICA (vedi sotto)

// LA DISTRIBUZIONE DI RIFERIMENTO, congelata il 03/08/2026 in
// PREREG_holdout_H1primo.md §2. Nove gare in campione con >= 15 casi nella lettura B2.
// Non si ricalcola qui: e' un numero pre-registrato, e ricalcolarlo dal codice significherebbe
// lasciarlo scivolare il giorno in cui le gare in campione diventano dodici.
const RIFERIMENTO = [0.200, 0.273, 0.333, 0.350, 0.414, 0.536, 0.556, 0.571, 0.677];
const H1PRIMO = { descrizione: 'esatti M1-B2 non sotto il minimo in campione', soglia: Math.min(...RIFERIMENTO) };

const sha = (rel) => createHash('sha256').update(readFileSync(path.join(SIM, rel))).digest('hex');

console.log('');
console.log('══ MISURA DELL\'HOLDOUT ════════════════════════════════════════════════════');
console.log(`   gara: ${GARA}   ·   sigillo: ${SIGILLO.gara} (${SIGILLO.stato}), gara del ${SIGILLO.data_gara}`);

// ── 0 · REGOLA 4: il sigillo, PRIMA di misurare ─────────────────────────────
const derive = [];
for (const [rel, atteso] of Object.entries(SIGILLO.hash_sigillati)) {
  const reale = sha(rel);
  if (reale !== atteso) derive.push({ file: rel, atteso, reale });
}
if (derive.length) {
  console.log('');
  console.log('   ✗ NON GIUDICABILE — il sigillo e\' cambiato (prereg, regola 4):');
  for (const d of derive) console.log(`     ${d.file}\n       atteso ${d.atteso}\n       reale  ${d.reale}`);
  console.log('   Ri-firmare DOPO la gara sarebbe la fine dell\'holdout. Si dichiara e ci si ferma.');
  process.exit(1);
}
console.log(`   ✓ sigillo integro: ${Object.keys(SIGILLO.hash_sigillati).length} file, hash invariati`);

// LA PROVA A SECCO non e' l'holdout, e il programma lo dice invece di lasciarlo capire.
const eLaGaraSigillata = GARA === SIGILLO.gara;
if (!eLaGaraSigillata) {
  console.log('');
  console.log(`   ⚠ ${GARA} NON e' la gara sigillata (${SIGILLO.gara}).`);
  if (!PROVA) {
    console.log('     Per misurare un\'altra gara serve --prova-a-secco, e il risultato NON e\' un holdout.');
    process.exit(2);
  }
  console.log('     PROVA A SECCO: i modelli hanno GIA\' VISTO questa gara, quindi i numeri qui sotto');
  console.log('     sono IN CAMPIONE. Servono a collaudare la procedura, non a giudicare il motore.');
}

// ── 1 · REGOLA 3: il perimetro ──────────────────────────────────────────────
const elenco = casi().filter((c) => c.gara === GARA);
console.log('');
console.log(`   casi ammessi dal banco per ${GARA}: ${elenco.length}`);
// IL PAVIMENTO SI CONTROLLA DOPO, sulla popolazione che la METRICA usa davvero.
// La regola 3 lo metteva sui «casi ammessi», e la prova a secco ha mostrato che e' il
// numero sbagliato: Monaco ha 47 ammessi e 12 in lettura B2 — il 74% cade perche' uno dei
// due motori non risponde o la terna comune non contiene il pilota — quindi il protocollo
// lo dichiarava giudicabile mentre la metrica girava sotto il pavimento. Correzione
// pre-registrata il 03/08 in PREREG_holdout_H1primo.md §4, prima della gara.

// ── 2 · M1 in lettura B2, e M5 col metro del prodotto ───────────────────────
const PASSO_V2 = passoV2();
const righe = [];
let conRisposta = 0;
for (const c of elenco) {
  const vp = vecchioConPasso(c, { passo: PASSO_V2 });
  const n = rispostaNuovo(c);
  if (!n.muto) conRisposta += 1;
  if (vp.muto || n.muto) { righe.push({ id: c.id, muto: true }); continue; }
  const B = letturaComune(c, vp.ordine, n.ordine);
  righe.push({
    id: c.id, muto: false,
    errNuovo: B ? B.nuovo - B.vero : null,
    errVecchio: B ? B.vecchio - B.vero : null,
    // M5: la banda dichiarata al congelamento contro la posizione VERA al rientro.
    // La previsione si conta nel campo del motore e la verita' nel campo vero: e' il
    // metro del prodotto, quello che l'utente sperimenta (misure/rientro.mjs).
    dentroBanda: n.banda && Number.isFinite(c.posizioneVera)
      ? (c.posizioneVera >= n.banda.da && c.posizioneVera <= n.banda.a) : null,
  });
}

const conB = righe.filter((r) => !r.muto && r.errNuovo !== null);
if (conB.length < MIN_CASI) {
  console.log('');
  console.log(`   ✗ NON GIUDICABILE — la lettura M1-B2 ha ${conB.length} casi, meno di ${MIN_CASI}`);
  console.log(`     (i casi ammessi erano ${elenco.length}: ${elenco.length - conB.length} cadono perche' un motore`);
  console.log('     non risponde o la terna comune non contiene il pilota). Prereg regola 3, come');
  console.log('     corretta il 03/08: il pavimento sta sulla popolazione della metrica.');
  process.exit(1);
}
const esatti = (k) => conB.filter((r) => r[k] === 0).length / conB.length;
const M1 = {
  n: conB.length,
  esatti_nuovo: esatti('errNuovo'),
  esatti_vecchio: esatti('errVecchio'),
  mediana_abs_nuovo: mediana(conB.map((r) => Math.abs(r.errNuovo))),
  mediana_abs_vecchio: mediana(conB.map((r) => Math.abs(r.errVecchio))),
};
const conBanda = righe.filter((r) => r.dentroBanda !== null && r.dentroBanda !== undefined);
const M5 = { n: conBanda.length, copertura: conBanda.length ? conBanda.filter((r) => r.dentroBanda).length / conBanda.length : null };
const coperturaRisposta = conRisposta / elenco.length;

// ── 3 · I cancelli ──────────────────────────────────────────────────────────
const esiti = [
  { id: 'H1', valore: M1.esatti_nuovo, ...CANCELLI.H1, passa: M1.esatti_nuovo >= CANCELLI.H1.soglia },
  { id: 'H2', valore: M1.mediana_abs_nuovo, ...CANCELLI.H2, passa: M1.mediana_abs_nuovo <= CANCELLI.H2.soglia },
  { id: 'H3', valore: M1.esatti_nuovo - M1.esatti_vecchio, ...CANCELLI.H3, passa: M1.esatti_nuovo >= M1.esatti_vecchio },
  { id: 'H4', valore: M5.copertura, ...CANCELLI.H4, passa: M5.copertura !== null && M5.copertura >= CANCELLI.H4.soglia },
  { id: 'H5', valore: coperturaRisposta, ...CANCELLI.H5, passa: coperturaRisposta >= CANCELLI.H5.soglia },
  { id: "H1'", valore: M1.esatti_nuovo, ...H1PRIMO, verso: '>=', passa: M1.esatti_nuovo >= H1PRIMO.soglia },
];

// IL PERCENTILE SI RIPORTA SEMPRE, anche quando H1' passa: e' li' che sta l'informazione.
// Un valore che supera il minimo ma cade al 10 percentile significa che il motore fuori
// campione e' peggiore di nove gare su dieci viste in casa (PREREG_holdout_H1primo.md §2).
const sotto = RIFERIMENTO.filter((x) => x < M1.esatti_nuovo).length;
const percentile = 100 * sotto / RIFERIMENTO.length;

const pct = (x) => (x === null ? '—' : `${(100 * x).toFixed(1)}%`);
console.log('');
console.log(`   M1-B2 (terna comune, n = ${M1.n}):  esatti nuovo ${pct(M1.esatti_nuovo)} · vecchio ${pct(M1.esatti_vecchio)}`);
console.log(`                                       mediana |errore| nuovo ${M1.mediana_abs_nuovo} · vecchio ${M1.mediana_abs_vecchio}`);
console.log(`   M5 (metro del prodotto, n = ${M5.n}):  copertura banda ${pct(M5.copertura)}`);
console.log(`   copertura risposta: ${conRisposta}/${elenco.length} = ${pct(coperturaRisposta)}`);
console.log('');
for (const e of esiti) {
  const v = e.id === 'H2' ? String(e.valore) : (e.id === 'H3' ? `${e.valore >= 0 ? '+' : ''}${(100 * e.valore).toFixed(1)} punti` : pct(e.valore));
  const s = e.id === 'H2' ? String(e.soglia) : (e.id === 'H3' ? 'nuovo >= vecchio' : pct(e.soglia));
  console.log(`   ${e.id}  ${e.descrizione.padEnd(42)} ${String(v).padStart(12)}  (serve ${e.verso} ${s})   ${e.passa ? 'PASSA' : 'NON PASSA'}`);
}

console.log('');
console.log(`   H1' · percentile nella distribuzione in campione: ${percentile.toFixed(0)}°`
  + ` (batte ${sotto} gare su ${RIFERIMENTO.length})`);
console.log("     H1' e' un cancello INDULGENTE: le gare di riferimento sono quelle su cui i modelli");
console.log('     sono stati tarati, quindi un fuori campione onesto tende a stare piu\' in basso.');
console.log('     Superarlo e\' un\'affermazione debole: l\'informazione sta nel percentile.');

// L'AVVERTIMENTO DI H4 non e' opzionale: la prereg impone che sia scritto nel referto,
// non dedotto. La soglia e' pre-registrata a 67,3%, ma il riferimento in campione e'
// salito a 83,1%: superare 67,3% oggi e' un'affermazione piu' debole di quella che H4
// voleva fare.
console.log('');
console.log('   ⚠ H4, avvertimento imposto dalla prereg: la soglia 67,3% e\' pre-registrata e NON si');
console.log('     tocca, ma il riferimento in campione e\' salito a 83,1% (rimisurato il 02/08).');
console.log('     Se H4 passa fra il 67,3% e l\'83,1%, il motore fuori campione e\' PEGGIO di come si');
console.log('     misura in casa pur avendo superato il cancello: va scritto, non dedotto.');

const tutti = esiti.every((e) => e.passa);
console.log('');
console.log(`   ESITO: ${tutti ? 'tutti i cancelli passano' : `${esiti.filter((e) => !e.passa).length} cancelli non passano`}`
  + (eLaGaraSigillata ? '' : '  — MA E\' UNA PROVA A SECCO, in campione: non giudica il motore'));
console.log('');
console.log('   Il sigillo NON viene chiuso da questo programma: portare `stato` a «chiuso» e\' una');
console.log('   decisione del PO, e si fa dopo aver letto il referto.');

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: `Misura dell'holdout su ${GARA}, protocollo PREREG_holdout_Olanda.md.`,
      prova_a_secco: !eLaGaraSigillata,
      avvertenza: eLaGaraSigillata ? null
        : 'PROVA A SECCO: i modelli hanno gia\' visto questa gara. I numeri sono IN CAMPIONE e collaudano la procedura, non giudicano il motore.',
      soglie: 'copiate da PREREG_holdout_Olanda.md, non toccate',
      avvertimento_H4: 'soglia 67,3% pre-registrata; riferimento in campione salito a 83,1% il 02/08. Superarla fra i due valori significa essere peggio che in casa.',
      data: new Date().toISOString().slice(0, 10),
    },
    gara: GARA, sigillo: { gara: SIGILLO.gara, stato: SIGILLO.stato, integro: true },
    perimetro: { casi_ammessi: elenco.length, min_richiesto: MIN_CASI, con_risposta: conRisposta },
    M1, M5, copertura_risposta: coperturaRisposta,
    cancelli: esiti, tutti,
    H1primo: { riferimento: RIFERIMENTO, soglia: H1PRIMO.soglia, percentile, batte_gare: sotto, su: RIFERIMENTO.length },
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', `ESITO_holdout_${GARA.replace(/\s+/g, '')}.json`);
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
