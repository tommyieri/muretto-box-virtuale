// s04_contratto_cella — la cella è UNA shape e porta i campi grezzi (E04, E05).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) la cella non ha esattamente i 9 campi del contratto
//      { lap_time, cum_time, stint, compound, tyre_age, in_lap, out_lap, status, del }:
//      un campo in meno (E04: il contratto che non portava status/del rendeva
//      il fix impossibile a valle) o uno in più;
//  (b) una cella accetta di portare dentro di sé una definizione DERIVATA
//      (`verde`, `neutralized`, ...): lo stato derivato non si congela mai nel
//      dato, si ricalcola dalle definizioni (E12);
//  (c) il letterale `"None"` sopravvive all'adapter e diventa una mescola, un
//      tempo o un'età gomma (E05);
//  (d) l'assenza non diventa null ma un numero plausibile (regola 6);
//  (e) l'adapter accetta un grezzo SENZA colonna `status`/`del`, o con colonne
//      di lunghezza diversa, invece di fallire rumorosamente.

import { banco } from '../asserzioni.mjs';
import { CAMPI_CELLA, creaCella, validaCella } from '../../provenienza/contratto.mjs';
import { adattaColonnare } from '../../provenienza/adattatore.mjs';

const b = banco('s04');

// (a) i 9 campi, esattamente
b.uguale('i campi del contratto sono i 9 di CLAUDE.md, in ordine', [...CAMPI_CELLA],
  ['lap_time', 'cum_time', 'stint', 'compound', 'tyre_age', 'in_lap', 'out_lap', 'status', 'del']);

const base = {
  lap_time: 95.4, cum_time: 3642.38, stint: 1, compound: 'MEDIUM', tyre_age: 2,
  in_lap: false, out_lap: false, status: '1', del: false,
};
b.uguale('la cella creata ha esattamente i campi del contratto', Object.keys(creaCella(base)), [...CAMPI_CELLA]);
b.esplode('una cella senza `status` è rifiutata (E04)', () => creaCella({ ...base, status: undefined }));
b.esplode('una cella senza `del` è rifiutata (E04)', () => creaCella({ ...base, del: undefined }));
b.esplode('un campo estraneo è rifiutato', () => creaCella({ ...base, pos: 3 }));

// (b) niente stato derivato congelato nel dato
for (const derivato of ['verde', 'neutralized', 'neutralizzato', 'green']) {
  b.esplode(`una cella che porta "${derivato}" è rifiutata (E12)`, () => validaCella({ ...base, [derivato]: true }));
}

// (c) + (d) lavaggio dei letterali e assenza esplicita
const grezzo = {
  time: [95.4, 'None'], sesT: [3642.38, 3737.3], stint: [1, 1],
  compound: ['MEDIUM', 'None'], life: [2, 'None'],
  pin: ['None', 3475.6], pout: [3519.9, 'None'],
  status: ['1', '12'], del: [false, true], drv: ['ALB', 'ALB'], lap: [2, 3],
};
const { righe } = adattaColonnare(grezzo, { fonte: 'fixture' });
b.uguale('"None" in compound diventa null, mai la stringa (E05)', righe[1].cella.compound, null);
b.uguale('"None" in time diventa null, non uno zero plausibile (regola 6)', righe[1].cella.lap_time, null);
b.uguale('"None" in life diventa null', righe[1].cella.tyre_age, null);
b.uguale('pin valorizzato ⇒ in_lap true', righe[1].cella.in_lap, true);
b.uguale('pout valorizzato ⇒ out_lap true', righe[0].cella.out_lap, true);
b.uguale('pin "None" ⇒ in_lap false', righe[0].cella.in_lap, false);
b.uguale('lo status GREZZO viaggia intatto fino in fondo (E04)', righe[1].cella.status, '12');
b.uguale('il del GREZZO viaggia intatto fino in fondo (E04)', righe[1].cella.del, true);
b.uguale('l\'identità resta FUORI dalla cella', Object.keys(righe[0].cella), [...CAMPI_CELLA]);

// (e) fallimento rumoroso sul grezzo malformato
const senza = (col) => { const g = { ...grezzo }; delete g[col]; return g; };
b.esplode('grezzo senza colonna status: rifiutato (E04)', () => adattaColonnare(senza('status'), {}));
b.esplode('grezzo senza colonna del: rifiutato (E04)', () => adattaColonnare(senza('del'), {}));
b.esplode('grezzo senza colonna drv: rifiutato', () => adattaColonnare(senza('drv'), {}));
b.esplode('colonne di lunghezza diversa: rifiutate', () => adattaColonnare({ ...grezzo, lap: [2] }, {}));
b.esplode('del non booleano: rifiutato', () => adattaColonnare({ ...grezzo, del: [false, 'forse'] }, {}));
// La mescola della fixture deve essere DAVVERO inesistente: usare una sigla
// storica (ULTRASOFT & co. esistono nel fondo 2018) renderebbe il test verde per
// il motivo sbagliato.
b.esplode('mescola sconosciuta: rifiutata rumorosamente, mai "non verde" in silenzio',
  () => adattaColonnare({ ...grezzo, compound: ['MEDIUM', 'MESCOLA_CHE_NON_ESISTE'] }, {}));

b.chiudi();
