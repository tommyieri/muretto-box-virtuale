#!/usr/bin/env node
// pitloss_causa.mjs — W0 di PREREG_pitloss_causa.md: il pit-loss puo' spiegare il
// sotto-fermarsi?
//
//     node ai_lab/pianificatore/pitloss_causa.mjs [--json]
//
// NON DECIDE e NON ACCENDE. E' aritmetica: invertendo la forma chiusa si ricava il P che
// servirebbe perche' il motore volesse due soste, e lo si confronta con i P che il progetto
// ha gia' MISURATO su 26 Gran Premi.
//
//     P richiesto = rho · (R+a)² / (2·(k*+1)²)
//
// COSA LO FA USCIRE 1:
//   (a) l'inversione non torna — cioe' rimettendo il P richiesto dentro kOttimoContinuo non
//       si riottiene k* = 2. Sarebbe algebra sbagliata, e tutto il resto non varrebbe niente.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
import { kOttimoContinuo } from '../../simulatore/scenario/piano.mjs';
import { PISTA_DI } from '../degrado/durate.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Da PREREG_pitloss_causa.md §4. NON si toccano qui.
const K_BERSAGLIO = 2;
const RHO = 0.030776; // il sigillo del motore

const SIM = path.join(RADICE, 'simulatore');
const calendario = JSON.parse(readFileSync(path.join(RADICE, 'data', 'calendario_2026.json'), 'utf8'));
const interno = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'pitloss_interno.json'), 'utf8'));

// I P MISURATI dal progetto, su 26 Gran Premi: e' l'intervallo con cui si confronta.
// SOLO I PROMOSSI DAL CANCELLO A. Il file contiene 34 circuiti ma il motore usa la misura
// interna solo sui 26 che il cancello ha promosso; sugli altri resta il prior esterno con
// la sua targhetta. La prima scrittura di questo script li prendeva tutti e trentaquattro,
// e il minimo usciva 18,45 s da un circuito NON promosso — cioe' un numero che il motore
// non adopera. Con i soli promossi il minimo torna 19,20 (70th Anniversary), che e' quello
// dichiarato in CLAUDE.md, e l'esclusione diventa piu' forte, non piu' debole.
const PROMOSSI = new Set(interno.cancello_A?.promossi ?? []);
if (!PROMOSSI.size) { console.error('cancello_A.promossi assente: non so quali pit-loss il motore usi davvero'); process.exit(1); }
// I nomi qui hanno gli underscore (E24: niente spazi nei percorsi); la mappa delle piste
// li riporta al nome canonico che usa il motore.
const misurati = Object.entries(interno.circuiti ?? {})
  .filter(([gara]) => PROMOSSI.has(gara))
  .map(([gara, v]) => ({
    gara, pista: PISTA_DI[gara.replaceAll('_', ' ')] ?? null, perdita: v?.mediana_green_s ?? null,
  }))
  .filter((x) => typeof x.perdita === 'number');
if (!misurati.length) { console.error('nessun pit-loss misurato leggibile da pitloss_interno.json'); process.exit(1); }
const P_MIN = Math.min(...misurati.map((x) => x.perdita));
const P_MAX = Math.max(...misurati.map((x) => x.perdita));

/** L'inversione: il P che porta k* al bersaglio, a rho e (R+a) dati. */
const pRichiesto = (Ra, k) => RHO * (Ra ** 2) / (2 * ((k + 1) ** 2));

// (a) taratura dell'algebra: il P richiesto, rimesso dentro, deve ridare il k bersaglio
{
  for (const Ra of [30, 50, 70]) {
    const P = pRichiesto(Ra, K_BERSAGLIO);
    const k = kOttimoContinuo({ R: Ra, a: 0, rho: RHO, perdita: P });
    if (Math.abs(k - K_BERSAGLIO) > 1e-9) {
      console.error(`ALGEBRA SBAGLIATA: con R+a=${Ra} e P=${P} torna k*=${k} invece di ${K_BERSAGLIO}.`);
      process.exit(1);
    }
  }
  stampa(`   taratura dell'algebra: il P richiesto rimesso dentro ridà k* = ${K_BERSAGLIO}  ✓`);
}

// Le gare del 2026 in demo, coi loro giri veri. `a` = 0: si guarda una gara intera, che è
// il caso PIÙ FAVOREVOLE al pit-loss — più giri restano, più k* cresce, quindi più alto è
// il P che basterebbe. Se non basta nemmeno così, non basta mai.
const gare = calendario.gare.filter((g) => g.gara_demo).map((g) => ({ nome: g.gara_demo, giri: g.giri }));

const righe = gare.map((g) => {
  const P = pRichiesto(g.giri, K_BERSAGLIO);
  const inUso = misurati.find((m) => m.pista === g.nome.replaceAll(' ', ''))?.perdita ?? null;
  return { gara: g.nome, giri: g.giri, p_richiesto: P, p_in_uso: inUso, dentro: P >= P_MIN };
});

const W0 = righe.some((r) => r.dentro);

stampa('');
stampa('══ IL PIT-LOSS PUO\' SPIEGARE IL SOTTO-FERMARSI? — PREREG_pitloss_causa.md ══');
stampa(`   ρ sigillato ${RHO} · bersaglio k* = ${K_BERSAGLIO} · a = 0 (gara intera: il caso più favorevole al pit-loss)`);
stampa(`   pit-loss MISURATI su ${misurati.length} Gran Premi: da ${P_MIN.toFixed(2)} s a ${P_MAX.toFixed(2)} s`);
stampa('');
stampa('   gara            giri   P richiesto   P in uso   dentro l\'intervallo misurato?');
for (const r of righe.sort((a, b) => b.giri - a.giri)) {
  stampa(`   ${r.gara.padEnd(14)} ${String(r.giri).padStart(4)}   ${r.p_richiesto.toFixed(2).padStart(9)} s   ${(r.p_in_uso === null ? '   —  ' : r.p_in_uso.toFixed(2) + ' s').padStart(8)}   ${r.dentro ? 'SI' : 'no'}`);
}

const massimo = Math.max(...righe.map((r) => r.p_richiesto));
const rapporto = P_MIN / massimo;
stampa('');
stampa(`   il P richiesto più GENEROSO fra le undici gare è ${massimo.toFixed(2)} s`);
stampa(`   il pit-loss più BASSO mai misurato su qualunque circuito è ${P_MIN.toFixed(2)} s`);
stampa(`   → servirebbe un pit-loss ${rapporto.toFixed(1)} volte più piccolo del minimo osservato`);
stampa('');
stampa(`   W0  il pit-loss può essere la causa (P richiesto ≥ ${P_MIN.toFixed(2)} s in almeno una gara):`
  + `   ${W0 ? 'PASSA' : 'NON PASSA'}`);

const lettura = W0
  ? 'W0 passa: in almeno una gara un P dentro l\'intervallo misurato porterebbe k* a 2. Si esegue W1, il doppio conteggio.'
  : `W0 NON passa: il P che servirebbe e' ${rapporto.toFixed(1)} volte piu' piccolo del pit-loss piu' basso mai `
    + 'misurato su qualunque circuito. '
    + 'IL PIT-LOSS E\' ESCLUSO come causa del sotto-fermarsi: non e\' improbabile, e\' escluso dall\'aritmetica. '
    + 'W1 NON si esegue, per la ragione scritta nella prereg §5.';

stampa('');
for (const r of lettura.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'W0 di PREREG_pitloss_causa.md — il P che servirebbe perche il motore volesse due soste, contro i P misurati.',
    prereg: 'ai_lab/pianificatore/PREREG_pitloss_causa.md',
    generato_da: 'ai_lab/pianificatore/pitloss_causa.mjs',
    data: '2026-08-05',
    natura: 'ARITMETICA — nessuna stima, nessuna accensione',
    inversione: 'P = rho·(R+a)²/(2·(k*+1)²), tarata rimettendola dentro kOttimoContinuo',
    scelta_favorevole: 'a = 0 e gara intera: e il caso PIU FAVOREVOLE al pit-loss, perche piu giri restano piu k* cresce.',
  },
  rho: RHO, k_bersaglio: K_BERSAGLIO,
  pitloss_misurati: { n: misurati.length, min: P_MIN, max: P_MAX },
  per_gara: righe,
  p_richiesto_massimo: massimo,
  quante_volte_piu_piccolo_del_minimo_misurato: rapporto,
  W0: { passa: W0 },
  lettura,
};
writeFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_pitloss_causa.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/pianificatore/ESITO_pitloss_causa.json');
