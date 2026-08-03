#!/usr/bin/env node
// curvatura_richiesta.mjs — QUANTO DEVE CURVARE IL DEGRADO perche' la 2-soste vinca.
//
//     node ai_lab/confronto/curvatura_richiesta.mjs [--json]
//
// COS'E' E COSA NON E'. E' un conto di FATTIBILITA', descrittivo, e non decide niente:
// non promuove nessun modello, non accende niente, non e' uno dei cancelli della
// PREREG_cliff_importato.md. Serve a sapere, PRIMA di scegliere una fonte, se la strada
// esiste: se la curvatura necessaria fosse cento volte quella che la letteratura misura,
// nessuna fonte potrebbe salvarla e la fase si chiuderebbe senza scrivere una riga di
// motore.
//
// PERCHE' SERVE ADESSO. La ricognizione delle fonti (REFERTO_fonti_cliff.md) ha trovato
// che il cliff, come parametro pubblicato, NON ESISTE: il simulatore di riferimento
// (TUMFTM) ha quattro forme e nessun termine di fine vita, e i suoi 121 file di circuito
// usano il lineare in 2.479 voci su 2.479. Quindi la domanda non e' piu' «quale fonte
// copiamo» ma «quanta curvatura servirebbe, e la letteratura ne mostra mai tanta?».
//
// IL CONTO. Con degrado t(eta) = rho*eta + kappa*eta^2 e stint uguali di lunghezza
// L = (R+a)/(k+1), il costo di un piano a k soste vale, a meno di termini che non
// dipendono dal piano:
//
//     costo(k) ~= rho*(R+a)^2 / (2(k+1))  +  kappa*(R+a)^3 / (3(k+1)^2)  +  k*P
//
// Il guadagno di passare da una a due soste e' allora
//
//     G(kappa) = rho*(R+a)^2/12  +  kappa*(R+a)^3*(1/12 - 1/27)  -  P
//
// Il primo pezzo e' quello che il motore ha oggi, e sappiamo gia' quanto non basta: e' il
// DEFICIT misurato dal censimento. Quindi la curvatura che serve e'
//
//     kappa* = deficit / [ (R+a)^3 * (1/12 - 1/27) ]
//
// APPROSSIMAZIONE DICHIARATA: stint uguali e somma sostituita da integrale. Non e' il
// piano che il motore sceglierebbe davvero (la discesa locale farebbe di meglio), quindi
// kappa* e' un LIMITE SUPERIORE grossolano: la curvatura vera necessaria e' <= questa.
// Va bene per una domanda di ordine di grandezza, che e' l'unica che sto facendo.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from './banco.mjs';

const JSON_OUT = process.argv.includes('--json');
const censimento = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_censimento_soste.json'), 'utf8'));
const attese = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'pirelli_attese_2026.json'), 'utf8'));

// Quello che la letteratura MISURA come coefficiente quadratico, per confronto.
// Fonte: TUMFTM/race-simulation, campo k_2_quad nei 121 file di circuito (presente ma mai
// usato: tire_deg_model e' 'lin' in tutte le voci). Ricognizione del 03/08/2026.
const K2_LETTERATURA = {
  fonte: 'TUMFTM/race-simulation, k_2_quad nei file pars_<Circuito>_<Anno>.ini',
  mediana: 0.0001,
  p95_basso: 0.0035,
  p95_alto: 0.0115,
  nota: 'presente nei file ma MAI usato: tire_deg_model = "lin" in 2.479 voci su 2.479',
};

const COEFF = 1 / 12 - 1 / 27;   // ~0,0463

const attesa = (gara) => (attese.gare.find((x) => x.gara === gara)?.soste_attese ?? '—');

const righe = censimento.per_gara.map((r) => {
  // (R+a) = i giri su cui il piano proietta. Si ricava dal numero di giri della gara:
  // il congelamento canonico del censimento e' l'insieme dei pannelli, quindi si usa
  // l'orizzonte tipico — meta' gara — come scala. Dichiarato: e' una scala, non una misura.
  const nGiri = r.n_giri_gara ?? null;
  return { ...r, nGiri };
});

console.log('');
console.log('══ QUANTA CURVATURA SERVIREBBE ════════════════════════════════════════════');
console.log('   Conto di fattibilita\', descrittivo. Non decide niente e non e\' un cancello.');
console.log('');
console.log(`   Per confronto, cio' che la letteratura MISURA (${K2_LETTERATURA.fonte}):`);
console.log(`     k2 mediano ${K2_LETTERATURA.mediana} s/giro²  ·  p95 fra ${K2_LETTERATURA.p95_basso} e ${K2_LETTERATURA.p95_alto} s/giro²`);
console.log(`     ${K2_LETTERATURA.nota}`);
console.log('');
console.log('   gara            attesa Pirelli    deficit    (R+a)   kappa* richiesto   quante volte il p95');

const out = [];
for (const r of righe) {
  if (!Number.isFinite(r.deficit_mediano_s)) continue;
  // l'orizzonte di proiezione: si prova su una rosa di valori plausibili, perche' il
  // censimento aggrega su tutti i congelamenti e non esiste UN (R+a). Si mostra il caso
  // piu' favorevole alla 2-soste (orizzonte lungo), che e' il limite inferiore di kappa*.
  for (const Ra of [40, 50, 60]) {
    const kappa = r.deficit_mediano_s / (Ra ** 3 * COEFF);
    out.push({ gara: r.gara, orizzonte: Ra, deficit_s: r.deficit_mediano_s, kappa_richiesto: kappa });
  }
}

for (const r of righe) {
  if (!Number.isFinite(r.deficit_mediano_s)) continue;
  const kappa60 = r.deficit_mediano_s / (60 ** 3 * COEFF);   // caso piu' favorevole
  const volte = kappa60 / K2_LETTERATURA.p95_alto;
  console.log(`   ${r.gara.padEnd(15)} ${attesa(r.gara).slice(0, 16).padEnd(17)}`
    + `${(`+${r.deficit_mediano_s.toFixed(1)} s`).padStart(8)}`
    + `${'60'.padStart(9)}`
    + `${kappa60.toFixed(5).padStart(18)}`
    + `${(`${volte.toFixed(1)}×`).padStart(20)}`);
}

console.log('');
console.log('   L\'orizzonte 60 giri e\' il caso PIU\' FAVOREVOLE alla seconda sosta: piu\' e\'');
console.log('   lungo, meno curvatura serve. Con orizzonti piu\' corti kappa* cresce come 1/(R+a)³.');

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Quanta curvatura quadratica servirebbe perche\' il piano a due soste vinca. Conto di fattibilita\', descrittivo.',
      cosa_NON_e: 'Non e\' un cancello, non promuove nessun modello, non e\' fra i cancelli di PREREG_cliff_importato.md. Non e\' una stima: e\' un\'inversione della forma chiusa sui deficit gia\' misurati.',
      approssimazione: 'stint uguali e somma sostituita da integrale: kappa* e\' un limite superiore grossolano, la curvatura davvero necessaria e\' minore o uguale.',
      fonte_deficit: 'ai_lab/confronto/ESITO_censimento_soste.json',
      fonte_confronto: K2_LETTERATURA,
      data: '2026-08-03',
      generato_da: 'ai_lab/confronto/curvatura_richiesta.mjs',
    },
    coefficiente: COEFF,
    richieste: out,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', 'ESITO_curvatura_richiesta.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
