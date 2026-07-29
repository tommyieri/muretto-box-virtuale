// test_gradino.mjs — la SENTINELLA che impedisce di rifare l'errore dell'anno.
//
// Il test 3 e' il cuore: verifica che il motore SAPPIA DISTINGUERE quando ti fermi.
// Prima del 22/07/2026 quella differenza valeva zero esatto, e per un anno si e' misurata
// statisticamente una cosa che aritmeticamente non esisteva. Se un giorno qualcuno spegne il
// meccanismo o rompe l'orizzonte comune, questo test diventa rosso invece di restare muto.
//
// A differenza di test_degrado_aggancio.mjs e test_traffico_aggancio.mjs, che stampano
// FALLITO e poi escono 0, questo file ESCE 1. Un test che non ferma niente non e' una guardia.
import fs from 'fs';
import { simulate } from './engine.mjs';
import { simulaConSoste, misura, soste, MIN_SOSTE } from './gradino.mjs';
import { confrontaPit } from './pitscenario.mjs';

let fail = 0;
const ok = (cond, msg, extra = '') => {
  if (cond) console.log(`  ✓ ${msg}${extra ? '   ' + extra : ''}`);
  else { console.error(`  ✗ ${msg}${extra ? '   ' + extra : ''}`); fail++; }
};

const state = { A: { cum_time: 0 }, B: { cum_time: 2.7 }, C: { cum_time: 6.1 } };
const pace = { A: 90.0, B: 90.05, C: 90.1 };
const L = 20, H = 20, LOSS = 22.0;

console.log('\n1. INERZIA — a gradino nullo il kernel non si muove di un ulp');
{
  const uno = simulate({ state, pace, freezeLap: L, steps: H, pit: { driver: 'A', lap: 24, loss: LOSS } });
  const giroPerGiro = simulaConSoste({ state, pace, freezeLap: L, steps: H,
    pits: [{ driver: 'A', lap: 24, loss: LOSS }], gradino: null });
  let max = 0;
  for (const d of Object.keys(uno)) max = Math.max(max, Math.abs(uno[d] - giroPerGiro[d]));
  ok(max === 0, 'simulaConSoste(gradino=null) === simulate in un colpo solo',
     `max |diff| = ${max.toExponential(2)}`);

  const senzaPit = simulate({ state, pace, freezeLap: L, steps: H });
  const senzaPit2 = simulaConSoste({ state, pace, freezeLap: L, steps: H });
  let max2 = 0;
  for (const d of Object.keys(senzaPit)) max2 = Math.max(max2, Math.abs(senzaPit[d] - senzaPit2[d]));
  ok(max2 === 0, 'senza soste e senza gradino: bit-identico', `max |diff| = ${max2.toExponential(2)}`);
}

console.log('\n2. PLACEBO — due mondi identici devono dare zero esatto');
{
  const a = simulaConSoste({ state, pace, freezeLap: L, steps: H,
    pits: [{ driver: 'A', lap: 24, loss: LOSS }], gradino: -1.3 });
  const b = simulaConSoste({ state, pace, freezeLap: L, steps: H,
    pits: [{ driver: 'A', lap: 24, loss: LOSS }], gradino: -1.3 });
  ok(a.A - b.A === 0, 'stesso giro di sosta, stesso gradino -> differenza 0 esatta',
     `${(a.A - b.A).toExponential(2)} s`);
}

// Da qui in poi il meccanismo si prova IN ARIA LIBERA (ZONE=0, il cap non scatta mai).
// Non e' una scorciatoia: e' l'unico modo di misurare il pezzo nuovo senza che il cap del
// traffico — che incolla l'inseguitore a chi precede e non lascia passare nessuno — si
// mangi tutto il segnale. L'interazione col traffico e' provata a parte, al punto 4b.
const LIBERA = { ZONE: 0 };

console.log('\n3. IL MECCANISMO — fermarsi prima o dopo DEVE cambiare qualcosa');
{
  const p21 = simulaConSoste({ state, pace, freezeLap: L, steps: H, ...LIBERA,
    pits: [{ driver: 'A', lap: 21, loss: LOSS }], gradino: null });
  const p27 = simulaConSoste({ state, pace, freezeLap: L, steps: H, ...LIBERA,
    pits: [{ driver: 'A', lap: 27, loss: LOSS }], gradino: null });
  ok(p21.A - p27.A === 0,
     'col gradino SPENTO la differenza resta 0 — e il difetto storico, documentato',
     `${(p21.A - p27.A).toExponential(2)} s`);

  const g21 = simulaConSoste({ state, pace, freezeLap: L, steps: H, ...LIBERA,
    pits: [{ driver: 'A', lap: 21, loss: LOSS }], gradino: -1.3 });
  const g27 = simulaConSoste({ state, pace, freezeLap: L, steps: H, ...LIBERA,
    pits: [{ driver: 'A', lap: 27, loss: LOSS }], gradino: -1.3 });
  const delta = g21.A - g27.A;
  ok(delta !== 0, 'col gradino ACCESO la domanda ha finalmente una risposta',
     `giro 21 vs 27 = ${delta.toFixed(3)} s`);
  ok(delta < 0, 'verso fisico: fermarsi prima su gomma piu' + ' veloce guadagna',
     `${delta.toFixed(3)} s < 0`);
  // 6 giri di anticipo x 1,3 s/giro di gradino: la contabilita' deve chiudere esatta
  const atteso = -1.3 * 6;
  ok(Math.abs(delta - atteso) < 1e-9, 'magnitudine = gradino x giri di anticipo, esatta',
     `atteso ${atteso.toFixed(1)} s, ottenuto ${delta.toFixed(3)} s`);
}

console.log('\n4. LA RISPOSTA DEL RIVALE — l undercut e una LISTA di soste, non una sola');
{
  // B davanti (cum piu' basso = piu' avanti), A dietro di 2,70 s: e la situazione vera.
  const duello = { A: { cum_time: 2.7 }, B: { cum_time: 0 } };
  const pd = { A: 90.0, B: 90.0 };
  const GR = -1.3, H2 = 25;
  const righe = [];
  for (const K of [1, 2, 3, 4]) {
    const cum = simulaConSoste({ state: duello, pace: pd, freezeLap: L, steps: H2,
      gradino: GR, ...LIBERA,
      pits: [{ driver: 'A', lap: 23, loss: LOSS }, { driver: 'B', lap: 23 + K, loss: LOSS }] });
    righe.push([K, cum.A - cum.B]);
  }
  for (const [K, d] of righe) {
    console.log(`     B risponde dopo ${K} giri -> A-B = ${d >= 0 ? '+' : ''}${d.toFixed(2)} s`
      + `   ${d < 0 ? 'undercut RIUSCITO' : 'fallito'}`);
  }
  // gap 2,70 s, guadagno 1,30 s per giro di overlap: servono 3 giri (2 danno 2,60, non basta)
  ok(righe[0][1] > 0, 'risposta immediata (K=1): 1,30 s contro 2,70 -> FALLISCE');
  ok(righe[1][1] > 0, 'risposta dopo 2 giri: 2,60 s contro 2,70 -> fallisce per un soffio');
  ok(righe[2][1] < 0, 'risposta dopo 3 giri: 3,90 s contro 2,70 -> RIESCE');
  ok(righe.every((r, i) => i === 0 || r[1] < righe[i - 1][1]),
     'monotono: piu' + ' tardi risponde il rivale, meglio va l undercut');
  ok(Math.abs((righe[0][1] - righe[1][1]) - (-GR)) < 1e-9,
     'ogni giro di ritardo del rivale vale esattamente un gradino',
     `${(righe[0][1] - righe[1][1]).toFixed(3)} s`);
}

console.log('\n4b. IL CAP DEL TRAFFICO STROZZA IL GUADAGNO — e va detto al cliente');
{
  // Stesso duello, ma A rientra addosso a C, piu' lento di 0,4 s/giro. Il cap lo incolla:
  // il guadagno da gomma nuova NON si realizza finche' non si libera.
  // ORIZZONTE DEL PRODOTTO: fino a 5 giri dopo la sosta del rivale, non oltre. Il cap del
  // kernel non lascia passare MAI nessuno entro 1,5 s (limite dichiarato, demo/engine.mjs:4),
  // quindi su orizzonti lunghi la strozzatura cresce senza limite e il numero perde senso.
  const B_PIT = 26, ORIZZONTE = (B_PIT + 5) - L;
  // C sta 22,3 s dietro a B al congelamento: e' esattamente dove A si ritrova dopo aver
  // pagato il pit-loss, cioe' incollato dietro C a ~0,8 s. (cum piu' BASSO = piu' avanti)
  const conTraffico = { A: { cum_time: 2.7 }, B: { cum_time: 0 }, C: { cum_time: 22.3 } };
  const pt = { A: 90.0, B: 90.0, C: 90.4 };
  const pits = [{ driver: 'A', lap: 23, loss: LOSS }, { driver: 'B', lap: B_PIT, loss: LOSS }];
  const libero = simulaConSoste({ state: conTraffico, pace: pt, freezeLap: L,
    steps: ORIZZONTE, gradino: -1.3, pits, ...LIBERA });
  const reale = simulaConSoste({ state: conTraffico, pace: pt, freezeLap: L,
    steps: ORIZZONTE, gradino: -1.3, pits });                 // ZONE = 1,5 di default
  const dl = libero.A - libero.B, dr = reale.A - reale.B;
  console.log(`     aria libera   A-B = ${dl >= 0 ? '+' : ''}${dl.toFixed(2)} s`);
  console.log(`     col traffico  A-B = ${dr >= 0 ? '+' : ''}${dr.toFixed(2)} s`
    + `   -> strozzatura ${(dr - dl).toFixed(2)} s a ${ORIZZONTE - (B_PIT - L)} giri dal rientro`);
  ok(dr >= dl, 'il traffico non puo' + ' MAI far guadagnare piu' + ' dell aria libera');
  // Il cap e' un incollaggio PIENO (STRENGTH=1,0): chi e' bloccato paga OGNI giro l'intero
  // differenziale di passo, e nel modello non sorpassa mai. Qui A, che con gomma nuova
  // andrebbe 88,7, viene tenuto a 90,4 per i 7 giri fra il suo rientro e la fine orizzonte.
  const bloccati = ORIZZONTE - ((23 - L) + 1);
  const atteso = (pt.C - (pt.A - 1.3)) * bloccati;
  ok(Math.abs((dr - dl) - atteso) < 1e-9,
     `la strozzatura e' il differenziale pieno per ogni giro bloccato (${bloccati} giri)`,
     `atteso ${atteso.toFixed(2)} s, ottenuto ${(dr - dl).toFixed(2)} s`);
  ok(dr > 0 && dl < 0, 'ATTENZIONE PRODOTTO: lo stesso undercut riesce in aria libera'
     + ' e fallisce se rientri in coda');
}

console.log('\n5. SUI DATI VERI — i due numeri vivi delle dieci gare 2026');
{
  const GARE = ['Australia', 'Cina', 'Giappone', 'Miami', 'Canada', 'Monaco',
                'Spagna', 'Austria', 'Gran Bretagna', 'Belgio'];
  const noto = { Australia: 24.10, Cina: 34.51, Giappone: 22.79, Miami: 20.11, Canada: 24.24,
                 Monaco: 22.61, Spagna: 24.59, Austria: 21.98, 'Gran Bretagna': 20.43, Belgio: 22.50 };
  let vicini = 0, negativi = 0, tot = 0;
  console.log('     gara              n   perdita (repo)     gradino');
  for (const g of GARE) {
    const r = JSON.parse(fs.readFileSync(`./data/${g}.json`, 'utf8'));
    const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
    const m = misura(byLap, r.n_laps);
    if (m.perdita == null || m.gradino == null) { console.log(`     ${g.padEnd(16)} — materiale insufficiente`); continue; }
    tot++;
    const d = Math.abs(m.perdita - noto[g]);
    if (d <= 1.5) vicini++;
    if (m.gradino < 0) negativi++;
    console.log(`     ${g.padEnd(16)} ${String(m.n_gradino).padStart(3)}   `
      + `${m.perdita.toFixed(2).padStart(6)} (${noto[g].toFixed(2)})   ${m.gradino >= 0 ? '+' : ''}${m.gradino.toFixed(3)}`);
  }
  ok(tot === 10, 'tutte e dieci le gare producono i due numeri', `${tot}/10`);
  ok(vicini >= 8, 'la perdita misurata dai soli tempi combacia col realizzato del repo (±1,5 s)',
     `${vicini}/10 gare`);
  ok(negativi >= 9, 'il gradino e negativo (dopo la sosta si va piu' + ' forte) quasi ovunque',
     `${negativi}/10 gare`);
}

console.log('\n6. SICURO PER ASSENZA — senza materiale non si inventa niente');
{
  const r = JSON.parse(fs.readFileSync('./data/Belgio.json', 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  const presto = misura(byLap, r.n_laps, 5);              // giro 5: nessuno si e ancora fermato
  ok(presto.gradino === null && presto.perdita === null,
     `prima della ${MIN_SOSTE}a sosta i due numeri sono null, non zero`,
     `n=${presto.n_gradino}`);
  const tardi = misura(byLap, r.n_laps, 40);
  ok(tardi.gradino !== null, 'a gara avanzata i numeri ci sono', `n=${tardi.n_gradino}`);
  const tutte = soste(byLap, r.n_laps);
  ok(tutte.every(s => s.giro >= 2), 'nessuna sosta al giro 1 (out-lap della partenza)');
}

console.log('\n7. ORIZZONTE COMUNE SU DATI VERI — due risposte del pannello, finalmente sottraibili');
{
  const r = JSON.parse(fs.readFileSync('./data/Belgio.json', 'utf8'));
  const byLap = {}; for (const lp of r.laps) byLap[lp.lap] = lp.cars;
  const Lf = 18;
  const present = Object.keys(byLap[Lf]).filter(d => typeof byLap[Lf][d].cum_time === 'number');
  const m = misura(byLap, r.n_laps, Lf);            // SOLO le soste gia' avvenute: nessuno sbircia
  console.log(`     Belgio, congelamento al giro ${Lf}: ${m.n_gradino} soste gia' viste`
    + `  ->  perdita ${m.perdita.toFixed(2)} s, gradino ${m.gradino.toFixed(3)} s/giro`);
  const comuni = { byLap, nLaps: r.n_laps, pace: r.pace[String(Lf)], driver: 'LEC',
    freezeLap: Lf, pitLapA: Lf + 1, pitLapB: Lf + 6, pitLoss: m.perdita, present, orizzonte: 5 };

  const spento = confrontaPit({ ...comuni, gradino: null });
  ok(spento.ok && spento.identici_per_costruzione && spento.delta_secondi === null,
     'a gradino spento il confronto DICHIARA di essere vuoto invece di restituire zero');

  const acceso = confrontaPit({ ...comuni, gradino: m.gradino });
  console.log(`     fermarsi al ${acceso.giro_a} invece che al ${acceso.giro_b}`
    + `  ->  ${acceso.delta_secondi.toFixed(2)} s al giro ${acceso.orizzonte_giro}`);
  ok(acceso.ok && acceso.delta_secondi !== null, 'col gradino il confronto ha un valore');
  ok(acceso.delta_secondi < 0, 'anticipare di 5 giri guadagna, su dati veri');
  const atteso = m.gradino * 5;
  ok(Math.abs(acceso.delta_secondi - atteso) < 0.5,
     'e il guadagno vale ~ gradino x giri di anticipo',
     `atteso ~${atteso.toFixed(2)} s, ottenuto ${acceso.delta_secondi.toFixed(2)} s`);
  ok(acceso.orizzonte_giro === Math.max(comuni.pitLapA, comuni.pitLapB) + 5,
     'i due mondi finiscono allo STESSO giro', `giro ${acceso.orizzonte_giro}`);
}

if (fail) { console.error(`\n✗ test_gradino: ${fail} controlli falliti\n`); process.exit(1); }
console.log('\n✓ test_gradino: tutti i controlli passati\n');
