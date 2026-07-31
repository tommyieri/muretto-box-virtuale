// lente_hero_stessa_domanda.mjs — I DUE MOTORI SULLA DOMANDA ESATTA DELLA HERO.
//
// La vista pre-calcolata contiene solo giroPit = congelamento+1, quindi il caso «aspetta
// tre giri» della hero (congelamento 20, sosta 23) NON c'è dentro: per confrontare alla
// pari bisogna chiamare il motore nuovo con gli stessi argomenti del vecchio.
//
// Il vecchio lo si chiama copiando gen_hero.mjs::scelta() alla lettera (ZONE=0,
// orizzonte 5 col gradino, gradino da demo/gradino.mjs) — non si inventano parametri.
//
// LO SFASAMENTO DI UN GIRO è misurato, non assunto (verifica_M3_convenzione.mjs):
// evaluatePit applica la perdita dopo aver simulato il giro cur+1, il kernel nuovo sul
// giro dichiarato. Perciò riporto il nuovo a giroPit = P e a giroPit = P+1.
//
//   node ai_lab/confronto/lente_hero_stessa_domanda.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo');
const DATI = path.join(DEMO, 'data');
const SIM = path.join(RADICE, 'simulatore');

const { evaluatePit } = await import(path.join(DEMO, 'pitscenario.mjs'));
const { misura: misuraSoste } = await import(path.join(DEMO, 'gradino.mjs'));
const { caricaGare2026 } = await import(path.join(SIM, 'provenienza/gare_2026.mjs'));
const { caricaPrior } = await import(path.join(SIM, 'provenienza/pitloss_dati.mjs'));
const { caricaCostanti } = await import(path.join(SIM, 'scenario/director_dati.mjs'));
const { doveRientri } = await import(path.join(SIM, 'scenario/costruttore.mjs'));

const hero = JSON.parse(fs.readFileSync(path.join(DATI, 'hero.json'), 'utf8'));
const GARA = hero.gara, DRV = hero.pilota.sig, L = hero.giro;

// ---------------------------------------------------------------- il vecchio
const G = JSON.parse(fs.readFileSync(path.join(DATI, `${GARA}.json`), 'utf8'));
const PITLOSS = JSON.parse(fs.readFileSync(path.join(DATI, 'pitloss.json'), 'utf8'));
const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
const nLaps = G.n_laps, pitLoss = PITLOSS[GARA], pace = G.pace[L] || {};
const present = G.drivers.filter(d => typeof byLap[L]?.[d]?.cum_time === 'number' && pace[d] != null);
const viva = misuraSoste(byLap, nLaps, L);
const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
const vecchio = (pitLap) => evaluatePit({ byLap, nLaps, pace, driver: DRV, freezeLap: L, pitLap, pitLoss,
  present, gara: GARA, laps: G.laps, ZONE: 0, orizzonte: gradino != null ? 5 : 0, gradino });

// ------------------------------------------------------------------ il nuovo
const gare = caricaGare2026(SIM);
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const modello = JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/modello_v2.json'), 'utf8'));
const bandaRientro = JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/banda_rientro.json'), 'utf8'));
const gs = gare[GARA];
const contesto = { gare, modello, prior, costantiDirector, bandaRientro, nGiriGara: gs.nGiri };
const mescola = gs.perPilota.get(DRV)?.get(L)?.compound ?? null;
const nuovo = (giroPit) => {
  try { return doveRientri({ gara: GARA, freezeLap: L, pilota: DRV, giroPit, mescola }, contesto); }
  catch (e) { return { errore: e.message }; }
};

const mostraV = (r) => r?.ok
  ? `P${r.rientro_pos} su ${r.su_totale}` + (r.davanti_ho ? ` · dietro ${r.davanti_ho} di ${r.gap_ahead?.toFixed(2)}s` : ' · davanti a tutti')
    + (r.sotto_neutralizzazione ? ' · sotto neutralizzazione' : '') + ` · soste rivali assunte ${r.soste_rivali_assunte}`
  : `muto: ${r?.reason}`;
const mostraN = (r) => r?.errore ? `errore: ${r.errore}`
  : r?.posizione == null ? `muto (approvato=${r?.approvato})`
  : `P${r.posizione} su ${r.su_quanti}` + (r.davanti ? ` · dietro ${r.davanti.drv} di ${r.davanti.gap_s?.toFixed(2)}s` : ' · davanti a tutti')
    + ` · banda ${r.banda_posizione.da}–${r.banda_posizione.a} · perdita ${r.perdita.perdita.toFixed(2)}s (fattore ${r.perdita.fattore})`;

console.log(`=== LA DOMANDA DELLA HERO, AI DUE MOTORI (${GARA} · ${DRV} · congelamento ${L} · mescola ${mescola}) ===`);
console.log(`pit-loss: vecchio (demo/data/pitloss.json) ${pitLoss}s · nuovo (prior del simulatore) vedi riga per riga`);
console.log(`campo: il vecchio ordina ${present.length} vetture, il nuovo ${nuovo(L + 1)?.su_quanti ?? '?'}\n`);

for (const sc of hero.scelte) {
  const P = sc.giro;
  console.log(`— «${sc.etichetta}», sosta al giro ${P}`);
  console.log(`   HERO PUBBLICATA   : P${sc.pos} su ${sc.su}` + (sc.davanti ? ` · dietro ${sc.davanti} di ${sc.gap_davanti}s` : ' · davanti a tutti'));
  console.log(`   vecchio, rieseguito: ${mostraV(vecchio(P))}`);
  console.log(`   nuovo,  giroPit=${P}   : ${mostraN(nuovo(P))}`);
  console.log(`   nuovo,  giroPit=${P + 1} : ${mostraN(nuovo(P + 1))}   <- allineamento che corregge lo sfasamento misurato`);
}

console.log('\n=== IL VERDETTO CHE LA HOME STAMPA ===');
const [ora, dopo] = hero.scelte;
console.log(`  hero: da P${ora.pos} a P${dopo.pos} = ${hero.delta_posizioni} posizioni perse aspettando ${dopo.giro - ora.giro} giri`);
for (const [et, off] of [['stesso intero', 0], ['sfasamento corretto', 1]]) {
  const a = nuovo(ora.giro + off), b = nuovo(dopo.giro + off);
  if (a?.posizione != null && b?.posizione != null)
    console.log(`  nuovo (${et}): da P${a.posizione} a P${b.posizione} = ${b.posizione - a.posizione} posizioni`);
  else console.log(`  nuovo (${et}): una delle due è muta`);
}

console.log('\n=== E LA MESCOLA, SULLO STESSO CASO ===');
for (const m of ['SOFT', 'MEDIUM', 'HARD']) {
  const r = (() => { try { return doveRientri({ gara: GARA, freezeLap: L, pilota: DRV, giroPit: dopo.giro, mescola: m }, contesto); } catch (e) { return { errore: e.message }; } })();
  console.log(`  monta ${m.padEnd(6)} -> ${mostraN(r)}`);
}
