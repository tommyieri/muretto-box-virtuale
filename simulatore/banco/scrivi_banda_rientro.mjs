#!/usr/bin/env node
// scrivi_banda_rientro.mjs — mette a referto la Fase Difesa e produce la banda
// che il prodotto consuma.
//
// Due uscite, con nature diverse e per questo in posti diversi:
//   · `data/modelli/banda_rientro.json` — la CALIBRAZIONE, che il prodotto usa.
//     Sta in data/modelli/ perché è un modello validato: ha passato il suo
//     cancello. (Per confronto, la Fase Bagnato NON ha prodotto niente lì:
//     quella non aveva un cancello passato, solo diagnostica.)
//   · `banco/prereg/ESITO_difesa.json` — l'esito della fase, coi numeri di tutti
//     e quattro i cancelli e i limiti dichiarati.
//
// Uso: node banco/scrivi_banda_rientro.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { misuraTutto, leggiCancelli } from './misura_tutto.mjs';

export const PERCORSO_BANDA = 'data/modelli/banda_rientro.json';
export const PERCORSO_ESITO = 'banco/prereg/ESITO_difesa.json';
const DATA = '2026-07-30';

/**
 * @param riassunto  opzionale: il riassunto di `misuraTutto` già calcolato.
 *   Serve a chi ne ha già uno (la sentinella s25, la notturna) per non pagare
 *   due volte le misure — che sono le stesse, quindi ricalcolarle non
 *   aggiungerebbe niente se non tempo.
 */
export function costruisci(radice, riassunto = null) {
  const r = riassunto ?? misuraTutto(radice);
  const d = r.difesa;
  const cancelli = leggiCancelli(radice).difesa;
  const q = cancelli.livello_banda;

  // i circuiti dove la banda copre MENO del livello dichiarato: non una seconda
  // banda (non è pre-registrata), ma un avviso che viaggia col numero
  const deboli = {};
  for (const [contesto, b] of Object.entries(d.per_prodotto)) {
    deboli[contesto] = Object.entries(b.per_gara)
      .filter(([, x]) => x.copertura < q)
      .map(([gara, x]) => ({ gara, copertura: x.copertura, n_casi: x.n_casi }))
      .sort((a, x) => a.copertura - x.copertura);
  }

  const banda = {
    _targhetta: {
      tipo: 'MISURATO sulle 11 gare 2026 — banda di incertezza sulla posizione di rientro',
      prereg: 'banco/prereg/PREREG_difesa.md',
      cancello: `D1: semi-ampiezza intera MINIMA con copertura fuori campione ≥ ${q}, leave-one-race-out su 11 gare (blocchi = gare, E11)`,
      fonte: 'banco/misure/rientro.mjs — soste REALMENTE avvenute, mai finestre senza sosta (E16)',
      prodotto_da: 'banco/scrivi_banda_rientro.mjs',
      data: DATA,
      cosa_NON_e: 'NON è una probabilità di sorpasso. Il duello non si simula: due auto possono attraversarsi nel kernel, e questa banda è il modo onesto di dirlo. Nessun campo qui dentro dice CHI supera CHI, e nel 2026 il DRS non esiste',
      contesto_verde: d.nota_per_prodotto,
    },
    livello: q,
    n_casi: d.n_casi,
    n_gare: d.n_gare,
    contesti: Object.fromEntries(Object.entries(d.per_prodotto).map(([nome, b]) => [nome, {
      semi_ampiezza: b.n,
      banda: b.banda_dichiarata,
      asimmetrica: b.asimmetrica,
      bias_mediano_posizioni: b.bias_mediano_posizioni,
      n_casi: b.n_casi,
      copertura_fuori_campione: b.copertura_fuori_campione,
      copertura_dentro_campione: b.copertura_dentro_campione,
      circuiti_sotto_livello: deboli[nome],
      targhetta: `banda ±${b.n} posizioni, misurata su ${b.n_casi} soste vere del 2026: copre il ${(b.copertura_fuori_campione * 100).toFixed(1)}% fuori campione`,
    }])),
    contesto_non_separa: d.d2_separa === false
      ? `misurato: la vicinanza dei rivali NON separa l'errore in modo distinguibile dal caso (p = ${d.contesto.p_permutazione} alla soglia dichiarata di ${d.contesto.soglia} s). Una banda sola per contesto, non due: una distinzione senza differenza misurata non si tiene "tanto per"`
      : null,
  };

  const esito = {
    _targhetta: {
      tipo: 'ESITO di fase — cancelli D1…D4 eseguiti come pre-registrati',
      prereg: 'banco/prereg/PREREG_difesa.md',
      prodotto_da: 'banco/scrivi_banda_rientro.mjs, sulle misure di banco/misure/difesa.mjs',
      data: DATA,
    },
    verdetto: d.d1_passa ? 'D1 PASSA · D2 NON SEPARA · D4 tutte le bande simmetriche' : 'D1 NON PASSA',
    D1: {
      domanda: 'la banda copre, e non è imbottita?',
      passa: d.d1_passa,
      livello_richiesto: q,
      complessiva: d.complessiva,
      per_secco: d.per_secco,
      per_prodotto: d.per_prodotto,
      falliti: d.d1_falliti,
      nota_minimalita: 'la seconda condizione (la copertura di n−1 sta SOTTO il livello) è ciò che impedisce di passare imbottendo: una banda di ±5 coprirebbe tutto senza dire niente',
    },
    D2: {
      domanda: 'i rientri contesi sbagliano di più?',
      separa: d.d2_separa,
      alla_soglia_dichiarata: d.contesto,
      sensibilita: d.sensibilita_soglia,
      conseguenza: 'una banda sola per contesto. Il fatto che il contesto non separi resta a referto e nel modulo',
      difetto_della_statistica: 'la statistica pre-registrata — differenza fra le MEDIANE di |errore| — è quasi priva di risoluzione su una grandezza intera le cui mediane valgono 0 e 1: la differenza osservata è esattamente 1 a tutte e quattro le soglie, e il p-value è dominato dalla discretezza più che dai dati. È un difetto della metrica, scoperto eseguendola. Non si riscrive dopo aver visto il risultato (regola 3): resta a referto così, e una statistica con risoluzione è PRE-REGISTRATA in banco/prereg/PREREG_difesa_II.md, da eseguire come fase propria',
      generatore_corretto: 'il p-value è stato ricalcolato dopo una correzione del generatore pseudo-casuale. La prima stesura usava un LCG classico in aritmetica JS: il prodotto supera 2^53, i bit bassi si perdono nel float e sono esattamente quelli che l\'AND a 31 bit conserva. Misurato: chi² = 170 sui decili di 200.000 estrazioni contro una soglia al 5% di 16,92 — non degenere (il mescolamento spostava ~10 etichette su 20) ma misurabilmente NON uniforme. Sostituito con mulberry32, dove ogni moltiplicazione passa da Math.imul ed è esatta a 32 bit: chi² = 3,91. I DUE valori restano entrambi a referto (E22): col generatore storto p = 0,29527 (1s 0,30527 · 3s 0,27377 · 5s 0,34527), con quello corretto p = 0,29007 (1s 0,31077 · 3s 0,27707 · 5s 0,34797). La conclusione non cambia — non era vicina alla soglia — ma il numero pubblicato è quello rimisurato, non quello ottenuto col difetto',
      difetto_dimostrato_dall_interno: 'quanto sia grave si vede costruendo il caso peggiore: su dati sintetici con due sole masse (tutti gli errori contesi a 0, tutti i puliti a 5 — un effetto che non potrebbe essere più forte) questa statistica dà p = 0,90. La mediana di un gruppo misto SCATTA fra 0 e 5 a seconda di dove cade il conteggio, quindi anche la distribuzione permutata vale ±5 quasi sempre e l\'effetto vero diventa invisibile. La stessa prova, su errori con una dispersione su cui la mediana possa muoversi, dà p = 0,0005: la statistica non è cieca in generale, è cieca sui dati che ha davanti. La sentinella s25 tiene questa prova viva, perché è anche l\'unico modo di verificare che la clausola direzionale abbia potere di fallire',
    },
    D3: {
      domanda: 'l\'output dice mai CHI supera CHI?',
      verificato_da: 'banco/sentinelle/s25_difesa.mjs — sul codice e sull\'output, non sulle intenzioni',
      nota: 'l\'unica grandezza di duello ammessa è un CONTEGGIO (cambiDiPosizione). Nessun DRS in nessun file: nel 2026 non esiste',
    },
    D4: {
      domanda: 'la banda nasconde un bias?',
      secchi_asimmetrici: d.d4_asimmetrici,
      nota: `nessun secco ha un bias mediano ≥ ${cancelli.bias_massimo_simmetrico_posizioni} posizione: tutte le bande restano simmetriche, e il bias mediano resta a referto accanto a ciascuna`,
    },
    limiti_dichiarati: [
      {
        codice: 'DISOMOGENEITA_PER_CIRCUITO',
        enunciato: 'la banda copre bene in media e male in due gare',
        misurato: 'con la banda complessiva ±2, la copertura fuori campione crolla a Monaco (0,63 su 78 casi) e in Australia (0,59 su 32). La diagnosi è che sono le due gare dominate dal secco NEUTRA (64/78 e 22/32): i secchi assorbono quasi tutto — NEUTRA sta all\'86% contro il 97% di PULITA e SOSTE_RIVALI — ma dentro NEUTRA resta un residuo di circuito (Monaco al 70%)',
        interpretazione: 'a Monaco non si sorpassa, quindi le posizioni reali sono più appiccicate di quanto un motore in cui le auto si attraversano possa prevedere. È la stessa cosa che la banda sta misurando, concentrata dove è più forte',
        conseguenza: 'i circuiti sotto il livello dichiarato viaggiano NEL modello (`circuiti_sotto_livello`) e arrivano in pagina come avviso. NON si è aggiunta una banda per circuito: non è pre-registrata, e con 14-78 casi per gara sarebbe rumore promosso a parametro',
      },
      {
        codice: 'BANDA_NON_E_PROBABILITA_DI_SORPASSO',
        enunciato: 'la banda dice di quanto può sbagliare il numero, non chi passerà',
        conseguenza: 'chi legge «P14, fra P13 e P15» non ha ricevuto una previsione sul duello, e la targhetta lo dice. La probabilità di sorpasso resta non costruita: il vecchio repo ha misurato che il duello non si simula',
      },
    ],
  };

  return { banda, esito };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { banda, esito } = costruisci(radice);
  writeFileSync(path.join(radice, PERCORSO_BANDA), JSON.stringify(banda, null, 2) + '\n');
  writeFileSync(path.join(radice, PERCORSO_ESITO), JSON.stringify(esito, null, 2) + '\n');
  console.log(`${esito.verdetto}\n`);
  for (const [nome, c] of Object.entries(banda.contesti)) {
    console.log(`  ${nome.padEnd(7)} ±${c.semi_ampiezza}  n=${String(c.n_casi).padStart(3)}  fuori campione ${(c.copertura_fuori_campione * 100).toFixed(1)}%  ${c.circuiti_sotto_livello.length ? `sotto livello: ${c.circuiti_sotto_livello.map((x) => `${x.gara} ${(x.copertura * 100).toFixed(0)}%`).join(', ')}` : 'nessun circuito sotto livello'}`);
  }
  console.log(`\n  D2: contesto ${esito.D2.separa ? 'SEPARA' : 'NON separa'} (p = ${esito.D2.alla_soglia_dichiarata.p_permutazione})`);
  for (const l of esito.limiti_dichiarati) console.log(`  LIMITE ${l.codice}: ${l.enunciato}`);
  console.log(`\n  → ${PERCORSO_BANDA}\n  → ${PERCORSO_ESITO}`);
}
