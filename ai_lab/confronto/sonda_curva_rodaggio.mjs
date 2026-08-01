// sonda_curva_rodaggio.mjs — la previsione della PREREG §4, messa alla prova.
//
//     node ai_lab/confronto/sonda_curva_rodaggio.mjs [--tutti]
//
// PREREG_rodaggio.md §4 afferma che il rodaggio NON deve spostare il giro
// raccomandato dalla curva del «quando»: l'ottimo cade dove l'eta' al pit
// eguaglia l'eta' alla bandiera, e li' il termine in w si annulla per simmetria.
// Quello che il rodaggio cambia e' la POSIZIONE prevista al rientro a giro di
// sosta fisso, non il punto in cui conviene fermarsi.
//
// §7 lo mette fra le condizioni di NULL: se il giro raccomandato cambiasse in
// piu' del 10% dei casi, il codice non fa cio' che la pre-registrazione descrive
// e il termine non si accende — anche se il cancello M1 fosse passato.
//
// s12 lo prova col kernel vero su casi costruiti; qui si prova sul PRODOTTO, con
// la funzione che genera davvero le viste, su gare vere. Le due prove sono
// diverse: s12 e' la simmetria, questa e' la simmetria dopo il Director, gli
// arrotondamenti al millesimo e i candidati respinti.
//
// NON SCRIVE NIENTE su disco.

import { curvaDelQuando } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { contestoNuovo, garaNuova, gare, modelloDaDisco, garaSimDi } from './banco.mjs';

const MODELLO = modelloDaDisco();
const R = MODELLO.rodaggio;
const conRodaggio = (c, tau) => ({ ...MODELLO, rodaggio: { ...R, attivo: true, c, tau } });
const senzaRodaggio = { ...MODELLO, rodaggio: { ...R, attivo: false } };
const loro = R.leave_one_race_out ?? {};

// Campionamento dichiarato: un congelamento ogni PASSO giri, tutti i piloti con
// gomma nota. Con --tutti si fa ogni giro (lento, ma e' la stessa misura).
const PASSO = process.argv.includes('--tutti') ? 1 : 5;

let esaminate = 0, cambiate = 0, muteDiverse = 0;
const spostamenti = new Map();
const perGara = {};
const esempi = [];

for (const nomeSito of gare()) {
  const garaSim = garaSimDi(nomeSito);
  const g = garaNuova(nomeSito);
  const p = loro[garaSim];
  if (!p) throw new Error(`niente parametri leave-one-race-out per ${garaSim}`);
  const ctxSpento = contestoNuovo(nomeSito, senzaRodaggio);
  const ctxAcceso = contestoNuovo(nomeSito, conRodaggio(p.c, p.tau));
  perGara[nomeSito] = { esaminate: 0, cambiate: 0 };

  for (let Lf = 2; Lf < g.nGiri - 1; Lf += PASSO) {
    for (const pilota of g.perPilota.keys()) {
      const mescola = mescolaAlGiro(g, Lf, pilota);
      if (mescola === null) continue;
      let a, b;
      try {
        a = curvaDelQuando({ gara: garaSim, freezeLap: Lf, pilota, mescola }, ctxSpento);
        b = curvaDelQuando({ gara: garaSim, freezeLap: Lf, pilota, mescola }, ctxAcceso);
      } catch { continue; }
      if (a.approvato !== b.approvato) { muteDiverse += 1; continue; }
      if (!a.approvato || !a.minimo || !b.minimo) continue;
      esaminate += 1;
      perGara[nomeSito].esaminate += 1;
      const d = b.minimo.giroPit - a.minimo.giroPit;
      spostamenti.set(d, (spostamenti.get(d) ?? 0) + 1);
      if (d !== 0) {
        cambiate += 1;
        perGara[nomeSito].cambiate += 1;
        if (esempi.length < 8) esempi.push({ gara: nomeSito, pilota, Lf, spento: a.minimo.giroPit, acceso: b.minimo.giroPit });
      }
    }
  }
}

const quota = 100 * cambiate / esaminate;
console.log('SONDA — il rodaggio sposta il giro raccomandato? (PREREG_rodaggio.md §4, condizione di NULL in §7)');
console.log(`  campionamento: un congelamento ogni ${PASSO} giri, tutti i piloti con mescola nota, tutte le ${gare().length} gare`);
console.log(`  curve confrontate: ${esaminate}  ·  curve con approvazione diversa: ${muteDiverse}`);
console.log(`  giro raccomandato CAMBIATO in ${cambiate} curve = ${quota.toFixed(2)}%   (soglia di NULL: > 10%)`);
console.log('  distribuzione dello spostamento (acceso − spento, in giri)');
for (const d of [...spostamenti.keys()].sort((x, y) => x - y)) {
  console.log(`    ${String(d).padStart(4)} giri: ${String(spostamenti.get(d)).padStart(6)}`);
}
if (esempi.length) {
  console.log('  primi casi in cui si sposta');
  for (const e of esempi) console.log(`    ${e.gara} ${e.pilota} Lf=${e.Lf}: ${e.spento} → ${e.acceso}`);
}
console.log('  per gara (cambiate / esaminate)');
for (const [n, x] of Object.entries(perGara)) {
  console.log(`    ${n.padEnd(15)} ${String(x.cambiate).padStart(5)} / ${String(x.esaminate).padStart(5)}   ${x.esaminate ? (100 * x.cambiate / x.esaminate).toFixed(2) : '—'}%`);
}
console.log(`\n  → ${quota > 10 ? 'NULL: il giro si sposta troppo, il codice non fa cio\' che la PREREG descrive' : 'la previsione della PREREG §4 REGGE sul prodotto'}`);
process.exit(quota > 10 ? 1 : 0);
