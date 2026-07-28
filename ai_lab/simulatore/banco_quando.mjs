// banco_quando.mjs — FASE 0, passo 3: IL BANCO DELLA DOMANDA GIUSTA.
//
//     node ai_lab/simulatore/banco_quando.mjs
//     node ai_lab/simulatore/banco_quando.mjs --json ai_lab/simulatore/esito_banco.json
//     node ai_lab/simulatore/banco_quando.mjs Belgio          una gara sola, in dettaglio
//
// C'E' GIA' UN BANCO E MISURA ALTRO. gen_backtest_strategia.mjs chiede «dove rientri» a
// giro di sosta FISSO (quello vero). Questo chiede la domanda del prodotto nuovo:
//
//     «se mi fermo al giro p, dove finisco alla bandiera?»  —  per OGNI p possibile.
//
// La risposta e' una CURVA, non un numero, e il KPI e' dove cade il suo minimo.
//
// ------------------------------------------------------------------- G0, la soglia
// Pre-registrato in PREREG_fase0.md §8:
//
//   G0 = quota di casi in cui il minimo della curva e' INTERNO
//        (ne' al primo ne' all'ultimo giro disponibile).      soglia dichiarata: >= 80 %
//
// Un minimo sempre al bordo significa che il motore non ha una preferenza: ha una monotonia.
// E una monotonia non e' una risposta a «quando».
//
// ------------------------------------------------------- perche' due curve e non una
// CURVA A — IL MOTORE DI OGGI, non toccato: passo piatto + `gradino` costante dopo la sosta.
// CURVA B — ANTEPRIMA DELLA FASE 2: niente gradino, e al suo posto il termine di ETA' GOMMA
//           misurato dal grezzo in ai_lab/simulatore/degrado.py:
//
//               costo(p) = tempo_motore_senza_gradino(p) + rho * SOMMA_ETA(p)
//               SOMMA_ETA(p) = somma delle eta' gomma vissute dal congelamento alla bandiera,
//                              con la sosta al giro p che azzera l'eta'
//
//           B non e' un risultato: e' la PROVA CHE LO STRUMENTO FUNZIONA. Un banco che
//           risponde sempre 0 % potrebbe essere rotto. Se B trova minimi interni con la
//           stessa identica meccanica, allora lo 0 % di A e' del motore, non del banco.
//
// ------------------------------------------------------------- cosa si CANCELLA nel minimo
// Due ingredienti del pannello NON possono spostare l'argmin, e va detto perche' altrimenti
// sembra che siano stati dimenticati:
//   pit_loss  e' lo stesso per ogni p  -> aggiunge una costante a tutta la curva
//   deriva    dipende dal passo s, non da p -> stessa costante per ogni p
// Restano gradino (curva A) ed eta' gomma (curva B). Cioe': la forma della curva E' il modello.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulaConSoste, misura } from '../../demo/gradino.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QUI, '..', '..');
const D = path.join(ROOT, 'demo', 'data');
const j = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// ZONE 0 = cap del traffico SPENTO, come in produzione (CAP_TRAFFICO=false, decisione PO 22/07)
const ZONE = 0;
const MIN_SOSTE_GRADINO = 3;        // stessa soglia del pannello (MIN_SOSTE_UI)
const ESCLUSE = new Set(['Monaco']); // decisione PO, coerente con PREREG_fase0.md §2

// rho dal MIO esito, ricostruito dal grezzo. Non da data/modello_degrado_2026.json.
const esitoDeg = (() => {
  const p = path.join(QUI, 'esito_degrado.json');
  if (!fs.existsSync(p)) throw new Error('manca esito_degrado.json: gira prima degrado.py');
  return j(p);
})();
const RHO = esitoDeg.pooled_comune.rho_comune;

// somma delle eta' gomma dal congelamento alla bandiera, con sosta al giro p
function sommaEta(L, p, nLaps, eta0) {
  let s = 0;
  for (let k = 1; k <= p - L; k++) s += eta0 + k;      // gomma vecchia, continua a invecchiare
  for (let k = 1; k <= nLaps - p; k++) s += k;         // gomma nuova, riparte da zero
  return s;
}

function curva(race, gara, drv, L, pitLossTab) {
  const byLap = race.byLap, nLaps = race.n_laps;
  const pace = race.pace[String(L)];
  if (!pace) return null;
  const cars = byLap[L] || {};
  const present = Object.keys(cars).filter(d =>
    typeof cars[d].cum_time === 'number' && !race.nonParten.has(d) && pace[d] != null);
  if (!present.includes(drv)) return null;

  const viva = misura(byLap, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_GRADINO) ? viva.gradino : null;
  const loss = (viva.perdita != null && viva.n_perdita >= MIN_SOSTE_GRADINO) ? viva.perdita
             : (pitLossTab ?? null);
  if (loss == null) return null;
  const eta0 = typeof cars[drv].tyre_age === 'number' ? cars[drv].tyre_age : null;
  if (eta0 == null) return null;

  const state = {};
  for (const d of present) state[d] = { cum_time: cars[d].cum_time };
  const steps = nLaps - L;
  if (steps < 3) return null;

  const A = [], B = [];
  for (let p = L + 1; p <= nLaps - 1; p++) {
    const pits = [{ driver: drv, lap: p, loss }];
    // A — il motore di oggi
    const fa = simulaConSoste({ state, pace, freezeLap: L, steps, ZONE, pits, gradino });
    // B — anteprima Fase 2: niente gradino, eta' gomma al suo posto
    const fb = simulaConSoste({ state, pace, freezeLap: L, steps, ZONE, pits, gradino: null });
    if (fa[drv] == null || fb[drv] == null) return null;
    A.push({ p, costo: fa[drv] });
    B.push({ p, costo: fb[drv] + RHO * sommaEta(L, p, nLaps, eta0) });
  }
  if (A.length < 3) return null;
  const argmin = arr => arr.reduce((b, x) => (x.costo < b.costo ? x : b), arr[0]).p;
  const interno = pm => pm !== A[0].p && pm !== A[A.length - 1].p;
  const pA = argmin(A), pB = argmin(B);
  return {
    gara, drv, freeze: L, eta0, gradino, loss,
    primo: A[0].p, ultimo: A[A.length - 1].p,
    argmin_motore: pA, interno_motore: interno(pA),
    argmin_eta: pB, interno_eta: interno(pB),
    // ampiezza della curva: se e' piatta, il minimo non significa niente
    spread_motore: Math.max(...A.map(x => x.costo)) - Math.min(...A.map(x => x.costo)),
    spread_eta: Math.max(...B.map(x => x.costo)) - Math.min(...B.map(x => x.costo)),
  };
}

function main() {
  // il VALORE di --json non e' un nome di gara: si consuma insieme alla sua opzione,
  // altrimenti finisce nel filtro delle gare e il banco gira su zero casi.
  const argv = process.argv.slice(2);
  const iJson = argv.indexOf('--json');
  const outJson = iJson >= 0 ? argv[iJson + 1] : null;
  const args = argv.filter((a, i) => !a.startsWith('--') && i !== iJson + 1);

  const manifest = j(path.join(D, 'manifest.json'));
  const pitloss = j(path.join(D, 'pitloss.json'));
  const gare = manifest.map(r => r.gara)
    .filter(g => !ESCLUSE.has(g))
    .filter(g => !args.length || args.includes(g));

  const casi = [];
  for (const gara of gare) {
    const race = j(path.join(D, `${gara}.json`));
    race.byLap = {};
    for (const lp of race.laps) race.byLap[lp.lap] = lp.cars;
    race.nonParten = new Set(race.nonParten || []);
    // ogni sosta VERAMENTE avvenuta: l'in-lap e' il fatto grezzo
    for (let L = 2; L <= race.n_laps; L++) {
      for (const [drv, c] of Object.entries(race.byLap[L] || {})) {
        if (!c.in_lap) continue;
        const r = curva(race, gara, drv, L - 1, pitloss[gara]);
        if (r) { r.sosta_vera = L; casi.push(r); }
      }
    }
  }

  const n = casi.length;
  // UNA CURVA PIATTA NON HA UN MINIMO, HA UN PAREGGIO. Se fra il meglio e il peggio non c'e'
  // un millisecondo, l'argmin lo decide l'errore in virgola mobile, e contarlo come "ottimo
  // interno" sarebbe regalare al motore una preferenza che non ha. Si contano a parte.
  const PIATTA = 1e-3;
  const piattaA = casi.filter(c => c.spread_motore < PIATTA).length;
  const conPref = casi.filter(c => c.spread_motore >= PIATTA);
  const intA = conPref.filter(c => c.interno_motore).length;
  const intB = casi.filter(c => c.interno_eta).length;
  const alPrimo = conPref.filter(c => c.argmin_motore === c.primo).length;
  const allUltimo = conPref.filter(c => c.argmin_motore === c.ultimo).length;

  console.log('='.repeat(100));
  console.log('BANCO DEL «QUANDO» — dove cade il minimo della curva costo/giro-di-sosta');
  console.log(`pre-registrato in ai_lab/simulatore/PREREG_fase0.md §8   ·   rho = ${RHO.toFixed(4)} (dal grezzo)`);
  console.log('='.repeat(100));
  console.log(`soste rigiocate: ${n}   (Monaco escluso)`);
  console.log();
  const m = conPref.length;
  console.log('CURVA A — IL MOTORE DI OGGI (passo piatto + gradino costante)');
  console.log(`  curva PIATTA (nessuna preferenza) : ${piattaA}  (${(piattaA / n * 100).toFixed(1)}%)`);
  console.log(`     -> gradino non ancora misurabile: il motore non distingue i giri di sosta`);
  console.log(`  casi con una preferenza vera      : ${m}`);
  console.log(`     minimo al PRIMO giro utile : ${alPrimo}  (${(alPrimo / m * 100).toFixed(1)}% dei ${m})`);
  console.log(`     minimo all ULTIMO          : ${allUltimo}  (${(allUltimo / m * 100).toFixed(1)}%)`);
  console.log(`     minimo INTERNO             : ${intA}  (${(intA / m * 100).toFixed(1)}%)`);
  console.log();
  console.log('CURVA B — ANTEPRIMA FASE 2 (eta gomma al posto del gradino) — prova dello strumento');
  console.log(`  minimo INTERNO             : ${intB}  (${(intB / n * 100).toFixed(1)}%)`);
  console.log(`  minimo al PRIMO giro       : ${casi.filter(c => c.argmin_eta === c.primo).length}`
    + `   (la gomma e gia troppo vecchia: fermarsi subito e la risposta GIUSTA)`);
  console.log();
  // G0 conta gli ottimi interni su TUTTE le soste: una curva piatta non e' un ottimo interno.
  const g0 = intA / n;
  console.log(`G0 = ${(g0 * 100).toFixed(1)}%   soglia dichiarata >= 80%   ->  ${g0 >= 0.8 ? 'PASSA' : 'NON PASSA'}`);
  if (g0 < 0.8 && intB / n > g0) {
    console.log('  Lo strumento vede i minimi interni quando ci sono (curva B, stessa identica');
    console.log('  meccanica): il risultato della curva A e una proprieta DEL MOTORE, non del banco.');
  }

  // quanto e' distante il minimo del motore dal giro scelto DAVVERO dalla squadra (descrittivo)
  const dist = casi.map(c => c.argmin_eta - c.sosta_vera).sort((a, b) => a - b);
  const q = p => dist[Math.min(dist.length - 1, Math.floor(dist.length * p))];
  console.log();
  console.log('DESCRITTIVO — minimo della curva B meno il giro scelto davvero dalla squadra (giri)');
  console.log(`  p10 ${q(.10)}   p25 ${q(.25)}   mediana ${q(.50)}   p75 ${q(.75)}   p90 ${q(.90)}`);
  console.log('  (negativo = il modello si sarebbe fermato PRIMA della squadra)');

  const piatte = casi.filter(c => c.spread_eta < 1.0).length;
  console.log();
  console.log(`AMPIEZZA DELLA CURVA B: ${piatte} casi su ${n} (${(piatte / n * 100).toFixed(1)}%) hanno`);
  console.log('  meno di 1 s fra il meglio e il peggio: li il minimo esiste ma non vale una decisione.');

  if (args.length === 1 && casi.length) {
    console.log();
    console.log(`DETTAGLIO ${args[0]} — primi 15 casi`);
    console.log('  drv  freeze  eta0  sosta_vera   min_motore  min_eta   spread_eta');
    for (const c of casi.slice(0, 15))
      console.log(`  ${c.drv.padEnd(4)} ${String(c.freeze).padStart(6)} ${String(c.eta0).padStart(5)} `
        + `${String(c.sosta_vera).padStart(11)} ${String(c.argmin_motore).padStart(12)} `
        + `${String(c.argmin_eta).padStart(8)} ${c.spread_eta.toFixed(1).padStart(12)}`);
  }

  if (outJson) {
    fs.writeFileSync(outJson, JSON.stringify({
      targhetta: {
        prereg: 'ai_lab/simulatore/PREREG_fase0.md',
        rho_usato: RHO, rho_fonte: 'ai_lab/simulatore/esito_degrado.json (dal grezzo)',
        gare: gare, escluse: [...ESCLUSE], n_casi: n, ZONE,
        motore: 'demo/gradino.mjs::simulaConSoste — NON toccato',
      },
      G0: { interno: intA, n, quota: g0, soglia: 0.80, passa: g0 >= 0.8,
            curve_piatte: piattaA, con_preferenza: m },
      curva_B_anteprima: { interno: intB, quota: intB / n,
                           al_primo: casi.filter(c => c.argmin_eta === c.primo).length },
      bordi: { al_primo: alPrimo, all_ultimo: allUltimo },
      casi,
    }, null, 1));
    console.log(`\nscritto ${outJson}`);
  }
}

main();
