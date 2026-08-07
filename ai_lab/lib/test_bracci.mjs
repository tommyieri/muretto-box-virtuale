// test_bracci.mjs — il potere di fallire della guardia anti-A/A.
//
// COSA FA FALLIRE QUESTO TEST:
//  (a) contaDistinti non conta le coppie diverse (o conta le uguali);
//  (b) abGiudicabile dichiara giudicabile un confronto A/A perfetto — cioe' la
//      guardia ha perso proprio il caso per cui esiste (cancelli_vita 0-0 con
//      167 pari, il banco del tetto, C4);
//  (c) abGiudicabile dichiara giudicabile un confronto VUOTO (zero decisioni);
//  (d) abGiudicabile boccia un confronto in cui i bracci si distinguono.

import { contaDistinti, abGiudicabile } from './bracci.mjs';

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`test_bracci FALLITA — ${msg}`); };

// (a)
if (contaDistinti([[1, 1], [2, 3], [4, 4], [5, 6]]) !== 2) fallisci('contaDistinti non conta 2 coppie diverse su 4');
if (contaDistinti([]) !== 0) fallisci('contaDistinti su vuoto deve dare 0');

// (b) — il caso cancelli_vita: tutti pari
if (abGiudicabile([[7, 7], [7, 7], [7, 7]]) !== false) fallisci('un A/A perfetto (tutti pari) DEVE essere non giudicabile');

// (c)
if (abGiudicabile([]) !== false) fallisci('zero decisioni DEVE essere non giudicabile');

// (d)
if (abGiudicabile([[7, 7], [7, 8]]) !== true) fallisci('un confronto con almeno una coppia distinta DEVE essere giudicabile');

if (errori === 0) console.log('test_bracci: 5/5 verdi');
process.exit(errori === 0 ? 0 : 1);
