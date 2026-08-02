#!/usr/bin/env node
// censimento_soste.mjs — QUANTO MANCA ALLA SECONDA SOSTA PER VINCERE.
//
//     node ai_lab/confronto/censimento_soste.mjs [--json]
//
// COS'E' E COSA NON E'. E' un CENSIMENTO descrittivo: conta cio' che il motore propone
// oggi e misura di quanto perde l'alternativa a due soste. **Non decide niente**, non ha
// cancelli e non promuove nulla. La soglia che giudichera' il lavoro sulle mescole e' il
// KPI F4, firmato dal PO il 03/08/2026 PRIMA che questo censimento producesse un numero:
// «il piano propone due soste in almeno 1 gara su 3 fra quelle in cui la fonte esterna
// se le aspettava». Questo file misura la distanza da li'; non la ridefinisce.
//
// PERCHE' SERVE PRIMA DI IMPORTARE QUALSIASI COSA. Il piano non propone mai due soste, e
// la causa e' aritmetica, non un difetto: col degrado LINEARE e uguale per tutte le
// mescole, il guadagno della seconda sosta cresce come rho*(R+a)^2/12 e va confrontato
// con una perdita ai box di ~22 s. Con rho = 0,0308 s/giro servirebbe una gara da oltre
// novanta giri. Sapere QUANTI SECONDI mancano dice quanto grande deve essere la
// struttura importata (cliff, separazione per mescola) perche' cambi qualcosa: se
// mancassero 0,5 s il lavoro sarebbe quasi fatto, se ne mancassero 200 sarebbe un altro
// mestiere. E' la differenza fra una fase da aprire e una da non aprire.
//
// LA FONTE. `piano.alternative` e' gia' nella vista di ogni pannello: per ogni k il
// costruttore riporta il totale in secondi del piano ottimo con k soste. Non si simula
// niente di nuovo — si legge cio' che il motore ha gia' scritto.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare as gareSito, garaSimDi } from './banco.mjs';
import { mediana, perGara, arrivi } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const VISTA = path.join(RADICE, 'demo', 'data', 'vista');

// I DUE NOMI DELLA STESSA GARA, e non e' un dettaglio: la cartella della vista dice
// «GranBretagna», arrivi_2026.csv dice «Gran Bretagna». E' l'errore E24 del catalogo
// («lo spazio che spezza i glob»), e la prima scrittura di questo censimento ci e'
// cascata dentro: incrociava i nomi a mano e perdeva le soste vere di una gara su
// undici, in silenzio e senza sbagliare nessun numero — mostrava 0/0 e sembrava un dato.
// La mappa canonica esiste da sempre in banco.mjs: si usa quella, non si riscrive.
const gare = gareSito();

const perGaraDati = [];
let pannelli = 0; let conPiano = 0;
const kProposti = {};

for (const g of gare) {
  const cartella = garaSimDi(g);      // nome-vista (senza spazio); `g` e' il nome-sito
  const file = readdirSync(path.join(VISTA, cartella)).filter((f) => /^[A-Z]{3}\.json$/.test(f));
  const deficit = [];        // secondi di cui la 2-soste perde contro il piano scelto
  const deficitK1 = [];      // ...e contro la 1-sosta soltanto
  let k2Proposto = 0; let conAlt = 0;
  for (const f of file) {
    const d = JSON.parse(readFileSync(path.join(VISTA, cartella, f), 'utf8'));
    for (const giro of d.giri) {
      pannelli += 1;
      const p = giro.piano;
      if (!p) continue;
      conPiano += 1;
      kProposti[p.k] = (kProposti[p.k] ?? 0) + 1;
      if (p.k >= 2) k2Proposto += 1;
      const alt = p.alternative;
      if (!Array.isArray(alt) || !alt.length) continue;
      const due = alt.find((a) => a.k === 2);
      const uno = alt.find((a) => a.k === 1);
      const migliore = alt.reduce((m, a) => (m === null || a.totale < m.totale ? a : m), null);
      if (!due || !migliore || !Number.isFinite(due.totale) || !Number.isFinite(migliore.totale)) continue;
      conAlt += 1;
      deficit.push(due.totale - migliore.totale);
      if (uno && Number.isFinite(uno.totale)) deficitK1.push(due.totale - uno.totale);
    }
  }
  // le soste VERE di quella gara, dalla fonte d'arrivo (non dal motore)
  const righe = perGara(g).filter((r) => r.soste_piano.length);
  const reali = righe.map((r) => r.soste_piano.length);

  // QUANDO cadono quelle soste, e non e' una curiosita': se una gara mostra cinque soste
  // di mediana, prima di leggerla come un'attesa strategica bisogna sapere se quelle
  // soste sono SCELTE o CONSEGUENZE. Un grappolo negli ultimi giri e' la firma di una
  // neutralizzazione (o di una bandiera rossa) in cui tutti prendono una sosta quasi
  // gratis: e' un fatto della gara, non una strategia che un pianificatore dovrebbe
  // riprodurre. Si misura, non si suppone.
  const nGiriGara = Math.max(...righe.flatMap((r) => r.soste_piano.map((s) => s.giro)), 0);
  const tutteLeSoste = righe.flatMap((r) => r.soste_piano.map((s) => s.giro));
  const nellUltimoQuinto = tutteLeSoste.filter((x) => x > nGiriGara * 0.8).length;
  const quotaCoda = tutteLeSoste.length ? nellUltimoQuinto / tutteLeSoste.length : null;
  perGaraDati.push({
    gara: g,
    pannelli_con_alternative: conAlt,
    k2_proposto: k2Proposto,
    deficit_mediano_s: mediana(deficit),
    deficit_minimo_s: deficit.length ? Math.min(...deficit) : null,
    deficit_mediano_vs_1sosta_s: mediana(deficitK1),
    soste_reali_mediana: mediana(reali),
    soste_reali_max: reali.length ? Math.max(...reali) : null,
    piloti_con_2_o_piu_soste_vere: reali.filter((x) => x >= 2).length,
    piloti_con_soste_registrate: reali.length,
    quota_soste_ultimo_quinto: quotaCoda,
    sospetta_neutralizzazione: quotaCoda !== null && quotaCoda >= 0.4,
  });
}

const tuttiDeficit = perGaraDati.map((x) => x.deficit_mediano_s).filter(Number.isFinite);
const minimoAssoluto = Math.min(...perGaraDati.map((x) => x.deficit_minimo_s).filter(Number.isFinite));

console.log('');
console.log('══ CENSIMENTO DELLE SOSTE — quanto manca alla seconda per vincere ══════════');
console.log('   Descrittivo: non decide niente. La soglia e\' il KPI F4, firmato prima.');
console.log('');
console.log(`   ${pannelli} pannelli, ${conPiano} con un piano.`);
console.log(`   k proposto dal motore: ${Object.entries(kProposti).sort((a, b) => a[0] - b[0]).map(([k, n]) => `k=${k}: ${n}`).join('  ·  ')}`);
console.log('');
console.log('   gara            2-soste proposta   deficit mediano   il piu\' vicino   soste vere (mediana/max)   piloti con ≥2 soste vere');
for (const r of perGaraDati) {
  console.log(`   ${r.gara.padEnd(15)} ${String(r.k2_proposto).padStart(6)}`
    + `${String(r.deficit_mediano_s === null ? '—' : `+${r.deficit_mediano_s.toFixed(1)} s`).padStart(20)}`
    + `${String(r.deficit_minimo_s === null ? '—' : `+${r.deficit_minimo_s.toFixed(1)} s`).padStart(17)}`
    + `${String(`${r.soste_reali_mediana ?? '—'} / ${r.soste_reali_max ?? '—'}`).padStart(23)}`
    + `${String(`${r.piloti_con_2_o_piu_soste_vere}/${r.piloti_con_soste_registrate}`).padStart(24)}`
    + (r.sospetta_neutralizzazione ? `   ⚠ ${(100 * r.quota_soste_ultimo_quinto).toFixed(0)}% delle soste nell'ultimo quinto` : ''));
}

console.log('');
console.log(`   deficit mediano fra le gare: +${mediana(tuttiDeficit).toFixed(1)} s`);
console.log(`   il caso piu' vicino in assoluto: +${minimoAssoluto.toFixed(1)} s`);
console.log('');
const sospette = perGaraDati.filter((x) => x.sospetta_neutralizzazione);
if (sospette.length) {
  console.log('');
  console.log('   ⚠ SOSTE CHE NON SONO STRATEGIA. In queste gare una quota grande delle soste');
  console.log('     cade nell\'ultimo quinto: e\' la firma di una neutralizzazione, dove tutti');
  console.log('     prendono una sosta quasi gratis. Il loro conteggio NON e\' un\'attesa che un');
  console.log('     pianificatore debba riprodurre, e non va usato come bersaglio:');
  for (const s of sospette) {
    console.log(`       ${s.gara}: mediana ${s.soste_reali_mediana} soste, di cui il ${(100 * s.quota_soste_ultimo_quinto).toFixed(0)}% nell'ultimo quinto`);
  }
}
console.log('');
console.log('   COME SI LEGGE. Il deficit e\' quanto la 2-soste perde contro il piano che il');
console.log('   motore sceglie. E\' il conto che una struttura importata (cliff di fine vita,');
console.log('   degrado separato per mescola) deve ribaltare per far comparire una seconda');
console.log('   sosta. Il numero non dice se ci riuscira\': dice quanto deve pesare.');

if (JSON_OUT) {
  const out = {
    _targhetta: {
      cosa_e: 'Censimento descrittivo: quante soste propone il motore e di quanto perde la 2-soste.',
      cosa_NON_e: 'Non e\' un cancello e non decide niente. La soglia e\' il KPI F4 (ai_lab/KPI_5_4_4.md), firmato dal PO il 03/08/2026 PRIMA di questo censimento.',
      fonte: 'demo/data/vista/<gara>/<pilota>.json campo piano.alternative (scritto dal costruttore) + data/arrivi_2026.csv per le soste vere',
      generato_da: 'ai_lab/confronto/censimento_soste.mjs',
    },
    pannelli, con_piano: conPiano, k_proposti: kProposti,
    per_gara: perGaraDati,
    deficit_mediano_fra_gare_s: mediana(tuttiDeficit),
    deficit_minimo_assoluto_s: minimoAssoluto,
    coppie_pilota_gara_in_arrivi: arrivi().length,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_censimento_soste.json');
  writeFileSync(dove, JSON.stringify(out, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
