// s05_definizione_verde — UNA definizione, due livelli, sui casi limite (E03, E12).
//
// È la sentinella più importante del repo: il vecchio motore ha pagato il 37%
// di divergenza replay/live per due definizioni di "verde" (E12) e l'11,4% di
// celle spostate per un `_neut` cieco a rossa e gialla (E03).
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il regime neutralizzato smette di contenere ESATTAMENTE {4, 6}: se
//      diventasse cieco a 4 (SC) o 6 (VSC) — o se inghiottisse 2/5/7 senza una
//      prereg — i conteggi del golden cambierebbero sotto silenzio;
//  (b) il filtro verde ammette anche uno solo fra gialla (2), SC (4), rossa (5),
//      VSC (6) — il caso E03 esatto;
//  (c) il filtro verde ammette un giro cancellato (`del`), una gomma da
//      bagnato, una mescola assente/`"None"` (E05), un in-lap o un out-lap;
//  (d) uno status COMPOSTO viene letto come un solo simbolo: "45" deve valere
//      SC+rossa, "671" VSC+7+verde-di-pista, "126" gialla+VSC. Leggere solo il
//      primo carattere di "45" darebbe "SC" e perderebbe la rossa;
//  (e) l'asimmetria dichiarata di CLAUDE.md si perde: il 7 NON esclude il verde
//      e NON fa regime (ipotesi non committata). Se qualcuno la "sistema" senza
//      prereg (regola 3), qui si accorge;
//  (f) uno status malformato o assente viene interpretato come verde invece di
//      far fallire rumorosamente: è la porta da cui è entrato E13 (una
//      ricostruzione dichiarata "conservativa" e mai misurata);
//  (g) `passoUtilizzabile` smette di essere "verde E il dato esiste": un giro
//      verde con lap_time null non è passo misurabile (regola 6).

import { banco } from '../asserzioni.mjs';
import { creaCella } from '../../provenienza/contratto.mjs';
import { regimeNeutralizzato, verde, passoUtilizzabile } from '../../provenienza/definizioni.mjs';

const b = banco('s05');

// cella di riferimento: verde a tutti gli effetti
const pulita = {
  lap_time: 95.4, cum_time: 3642.38, stint: 1, compound: 'MEDIUM', tyre_age: 2,
  in_lap: false, out_lap: false, status: '1', del: false,
};
const cella = (patch = {}) => creaCella({ ...pulita, ...patch });

b.uguale('la cella pulita è verde', verde(cella()), true);
b.uguale('la cella pulita non è regime neutralizzato', regimeNeutralizzato(cella()), false);

// (a) + (b) + (d) il vocabolario status
const casiStatus = [
  // status, verde atteso, regime atteso, perché
  ['1', true, false, 'pista libera'],
  ['2', false, false, 'gialla: fuori dal verde, ma non è regime (ipotesi non committata)'],
  ['4', false, true, 'Safety Car: fuori dal verde ED è regime'],
  ['5', false, false, 'bandiera rossa: fuori dal verde; non è regime di gara'],
  ['6', false, true, 'VSC: fuori dal verde ED è regime'],
  ['7', true, false, '7 non committato: non esclude il verde e non fa regime'],
  ['12', false, false, 'composto: contiene la gialla'],
  ['45', false, true, 'composto: SC + rossa — leggere solo il primo simbolo perderebbe la rossa'],
  ['54', false, true, 'composto: rossa + SC — l\'ordine non conta'],
  ['41', false, true, 'composto: SC + pista libera'],
  ['671', false, true, 'composto: contiene il 6 (VSC) — il simbolo non è il primo carattere'],
  ['126', false, true, 'composto: gialla + VSC'],
  ['71', true, false, 'composto: 7 + pista libera ⇒ verde, nessun regime'],
  ['2671', false, true, 'composto: gialla + VSC + 7'],
];
for (const [s, verdeAtteso, regimeAtteso, perche] of casiStatus) {
  b.uguale(`status "${s}" → verde=${verdeAtteso} (${perche})`, verde(cella({ status: s })), verdeAtteso);
  b.uguale(`status "${s}" → regime=${regimeAtteso} (${perche})`, regimeNeutralizzato(cella({ status: s })), regimeAtteso);
}

// (c) le altre esclusioni del filtro passo
b.uguale('giro cancellato (del) → non verde', verde(cella({ del: true })), false);
b.uguale('giro cancellato → ma il regime non dipende dal del', regimeNeutralizzato(cella({ del: true })), false);
b.uguale('gomma INTERMEDIATE → non verde (mescola non slick)', verde(cella({ compound: 'INTERMEDIATE' })), false);
b.uguale('gomma WET → non verde', verde(cella({ compound: 'WET' })), false);
b.uguale('mescola assente (null, ex "None") → non verde (E05)', verde(cella({ compound: null })), false);
b.uguale('in-lap → non verde', verde(cella({ in_lap: true })), false);
b.uguale('out-lap → non verde', verde(cella({ out_lap: true })), false);
b.uguale('SOFT è slick valida', verde(cella({ compound: 'SOFT' })), true);
b.uguale('HARD è slick valida', verde(cella({ compound: 'HARD' })), true);

// il regime NON dipende dalla mescola né dal pit: è l'altro livello (E03)
b.uguale('un out-lap sotto SC resta regime neutralizzato',
  regimeNeutralizzato(cella({ out_lap: true, status: '4' })), true);
b.uguale('una gomma da bagnato sotto VSC resta regime neutralizzato',
  regimeNeutralizzato(cella({ compound: 'INTERMEDIATE', status: '6' })), true);

// (f) fallimento rumoroso su status inutilizzabile
b.esplode('status null → non si decide, si fallisce (E13)', () => verde(cella({ status: null })));
b.esplode('status null → anche per il regime', () => regimeNeutralizzato(cella({ status: null })));
b.esplode('status "3" (fuori alfabeto) → fallimento rumoroso', () => verde(cella({ status: '3' })));
b.esplode('status "" (vuoto) → fallimento rumoroso', () => verde(cella({ status: '' })));
b.esplode('status numerico invece che stringa → fallimento rumoroso', () => verde(cella({ status: 1 })));
// `del` assente (fondo 2018): non si deduce "non cancellato" da "non lo so"
b.esplode('del null → non si decide, si fallisce (E03)', () => verde(cella({ del: null })));
b.uguale('del null NON impedisce di leggere il regime (sono due livelli distinti)',
  regimeNeutralizzato(cella({ del: null, status: '4' })), true);

// (g) verde ≠ passo misurabile
b.uguale('verde con lap_time null: verde sì...', verde(cella({ lap_time: null })), true);
b.uguale('...ma NON passo utilizzabile (regola 6)', passoUtilizzabile(cella({ lap_time: null })), false);
b.uguale('verde con lap_time presente → passo utilizzabile', passoUtilizzabile(cella()), true);
b.uguale('non verde con lap_time presente → non passo utilizzabile', passoUtilizzabile(cella({ del: true })), false);

b.chiudi();
