// s15_banco_2026 — il banco è verde sulle gare 2026, e i cancelli sono quelli
// pre-registrati (E07, E08, regola 3).
//
// In questo file non c'è un solo numero di soglia: tutti arrivano da
// banco/prereg/cancelli_banco.json, e la linea di base arriva da
// banco/golden/banco_2026.json. Le uniche costanti qui sono le CORRISPONDENZE
// fra i cancelli macchina e le parole della prereg — che è precisamente ciò che
// questa sentinella deve sorvegliare.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un cancello pre-registrato non passa sulle 11 gare 2026;
//  (b) una soglia è stata cambiata nel JSON senza cambiare la prereg in parole:
//      è riscrivere un cancello dopo aver visto il risultato (regola 3), e il
//      JSON da solo non lo direbbe a nessuno;
//  (c) una misura del banco peggiora oltre la tolleranza di non-regressione
//      rispetto alla linea di base registrata;
//  (d) G0′ perde lo stato di metrica RITIRATA o il suo numero a referto: una
//      metrica sbagliata si mette a referto, non si cancella (E08, E21);
//  (e) il golden non descrive più ciò che il banco misura oggi (secchi
//      spariti, campione cambiato senza rigenerare la linea).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { misuraTutto, verificaCancelli, leggiCancelli, PERCORSO_GOLDEN_BANCO } from '../misura_tutto.mjs';

const b = banco('s15');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cancelli = leggiCancelli(radice);
const golden = JSON.parse(readFileSync(path.join(radice, PERCORSO_GOLDEN_BANCO), 'utf8'));

// (b) ogni soglia della macchina è dichiarata in parole in una prereg
const prose = ['PREREG_banco.md', 'PREREG_G0_secondo.md', 'PREREG_multistint.md', 'PREREG_difesa.md']
  .map((f) => readFileSync(path.join(radice, 'banco', 'prereg', f), 'utf8')).join('\n');
const CORRISPONDENZE = [
  ['rientro.non_regressione_mediana_errore', cancelli.rientro.non_regressione_mediana_errore, 0.25, /0,25 posizioni/],
  ['rientro.non_regressione_quota_entro_1_pp', cancelli.rientro.non_regressione_quota_entro_1_pp, 5, /5 punti percentuali/],
  ['rientro.min_casi_secco', cancelli.rientro.min_casi_secco, 10, /10 casi/],
  ['rientro.min_piloti_confrontabili', cancelli.rientro.min_piloti_confrontabili, 5, /≥ 5 piloti confrontabili/],
  ['bias.soglia_bias', cancelli.bias.soglia_bias, 0.17, /0,17/],
  ['bias.soglia_piattezza', cancelli.bias.soglia_piattezza, 0.1, /0,10/],
  ['bias.min_gare_orizzonte', cancelli.bias.min_gare_orizzonte, 5, /≥ 5 gare/],
  ['g0_secondo.tolleranza_bordo_giri', cancelli.g0_secondo.tolleranza_bordo_giri, 3, /k\* ≤ 1 \+ 3/],
  ['g0_secondo.quota_passaggio_richiesta', cancelli.g0_secondo.quota_passaggio_richiesta, 1.0, /100% dei casi ammessi/],
  ['multistint.k_massimo', cancelli.multistint.k_massimo, 3, /soste `k` da 0 a \*\*3\*\*/],
  ['multistint.quota_passaggio_richiesta', cancelli.multistint.quota_passaggio_richiesta, 1.0, /100% dei casi ammessi/],
  ['multistint.min_casi_obbligati', cancelli.multistint.min_casi_obbligati, 1, /almeno \*\*1 caso\*\*/],
  ['multistint.min_giri_rimanenti', cancelli.multistint.min_giri_rimanenti, 8, /almeno \*\*8\*\* giri rimanenti/],
  ['multistint.piloti_per_gara', cancelli.multistint.piloti_per_gara, 3, /primi \*\*3\*\* piloti/],
  ['multistint.congelamenti', cancelli.multistint.congelamenti, [15, 30], /congelamenti \*\*15 e 30\*\*/],
  ['difesa.livello_banda', cancelli.difesa.livello_banda, 0.80, /`q = 0,80`/],
  ['difesa.soglia_vicinanza_s', cancelli.difesa.soglia_vicinanza_s, 2, /entro \*\*2 secondi\*\*/],
  ['difesa.permutazioni', cancelli.difesa.permutazioni, 10000, /10\.000\s*\n?ripetizioni/],
  ['difesa.alpha', cancelli.difesa.alpha, 0.05, /`p < 0,05`/],
  ['difesa.min_gare', cancelli.difesa.min_gare, 8, /≥ 8 gare/],
  ['difesa.bias_massimo_simmetrico_posizioni', cancelli.difesa.bias_massimo_simmetrico_posizioni, 1, /bias mediano `≥ 1` posizione/],
];
for (const [nome, valore, atteso, nelTesto] of CORRISPONDENZE) {
  b.uguale(`${nome} vale ciò che la prereg dichiara`, valore, atteso);
  b.verifica(`${nome} è scritto in parole nella prereg (${nelTesto.source})`, nelTesto.test(prose));
}

// (d) G0′ resta ritirata e a referto
b.uguale('G0′ è marcata RITIRATA nei cancelli', cancelli.g0_primo.stato, 'RITIRATA');
b.verifica('G0′ punta alla prereg che la ritira', cancelli.g0_primo.ritirata_da === 'banco/prereg/PREREG_G0_secondo.md');
b.verifica('il ritiro di G0′ è motivato', typeof cancelli.g0_primo.motivo_ritiro === 'string' && cancelli.g0_primo.motivo_ritiro.length > 20);

// misura viva sulle 11 gare
const r = misuraTutto(radice);

// (e) il golden descrive ciò che si misura oggi
b.uguale('i secchi del rientro sono quelli della linea di base', Object.keys(r.rientro.secchi).sort(), Object.keys(golden.rientro.secchi).sort());
b.uguale('gli orizzonti del bias sono quelli della linea di base', Object.keys(r.bias).sort(), Object.keys(golden.bias).sort());
b.verifica('il banco misura delle soste vere', r.rientro.n_soste > 0);
b.verifica('il banco misura dei casi G0', r.g0.n_casi > 0);
b.verifica('G0 vede sia casi interni sia casi al bordo', r.g0.n_interni > 0 && r.g0.n_al_bordo > 0);

// (d bis) il numero di G0′ resta a referto ed è quello diagnosticato
b.verifica('G0′ resta calcolata e a referto', typeof r.g0.g0_primo_ritirata.quota_passaggio === 'number');
b.verifica('G0′ porta la sua targhetta di metrica ritirata', /RITIRATA/.test(r.g0.g0_primo_ritirata.targhetta));

// (a) + (c) i cancelli pre-registrati
for (const esito of verificaCancelli(r, cancelli, golden)) {
  b.verifica(`cancello — ${esito.nome} · ${esito.dettaglio}`, esito.passa);
}

b.chiudi();
