// S02 — Il filtro verde è UNO ed è testato sui casi limite (Regola 1, contro
// E03 ed E12: due definizioni di verde = 37% di divergenza replay/live; un
// filtro cieco a rossa e gialla = 11,4% di celle spostate).
//
// FALLIREBBE SE: `verdePasso` ammettesse anche UNA cella non-verde (gialla,
// SC, rossa, VSC, cancellata, mescola non slick o 'None', in-lap, out-lap,
// status assente) o rifiutasse la cella verde pulita; oppure se
// `regimeNeutralizzato` divergesse dal vocabolario (neutralizzato = contiene
// 4 o 6; la rossa NON è regime SC/VSC; l'assenza è null, non false).
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { verdePasso, regimeNeutralizzato, MESCOLE_SLICK, ALFABETO_STATUS } from '../../provenienza/contratto.mjs';

const b = nuovoBanco('s02_filtro_verde');

const pulita = {
  lap_time: 94.7, cum_time: 3832.0, stint: 1, compound: 'MEDIUM', tyre_age: 4,
  in_lap: false, out_lap: false, status: '1', del: false,
};
b.verifica(verdePasso(pulita) === true, 'la cella verde pulita è stata rifiutata');

// ogni variazione, presa da sola, deve bastare a escludere la cella
const nonVerdi = [
  ['status "12" (gialla di settore)',        { status: '12' }],
  ['status "2"',                             { status: '2' }],
  ['status "24" (gialla poi SC)',            { status: '24' }],
  ['status "4" (SC)',                        { status: '4' }],
  ['status "14" (deployment SC)',            { status: '14' }],
  ['status "5" (bandiera rossa)',            { status: '5' }],
  ['status "6" (VSC)',                       { status: '6' }],
  ['status "671" (VSC risolta nel giro)',    { status: '671' }],
  ['status assente',                         { status: null }],
  ['giro cancellato',                        { del: true }],
  ['del assente (non certificabile)',        { del: null }],
  ['mescola null (lavata alla frontiera)',   { compound: null }],
  ['mescola INTERMEDIATE',                   { compound: 'INTERMEDIATE' }],
  ['mescola WET',                            { compound: 'WET' }],
  ['in-lap',                                 { in_lap: true }],
  ['out-lap',                                { out_lap: true }],
  ['lap_time assente',                       { lap_time: null }],
];
for (const [nome, patch] of nonVerdi) {
  b.verifica(verdePasso({ ...pulita, ...patch }) === false, `ammessa una cella non-verde: ${nome}`);
}

// il letterale 'None' NON deve mai essere trattato come mescola valida:
// se arriva fin qui è un bug della frontiera, ma il filtro non deve coprirlo
b.verifica(verdePasso({ ...pulita, compound: 'None' }) === false, "il letterale 'None' è passato per mescola valida");

// regime neutralizzato: contiene 4 o 6 — due livelli DISTINTI dal filtro verde
const attese = [['1', false], ['12', false], ['2', false], ['5', false],
                ['4', true], ['14', true], ['41', true], ['6', true], ['671', true], ['1264', true]];
for (const [st, atteso] of attese) {
  b.verifica(regimeNeutralizzato(st) === atteso, `regimeNeutralizzato('${st}') ≠ ${atteso}`);
}
b.verifica(regimeNeutralizzato(null) === null, "regimeNeutralizzato(null) deve essere null: l'assenza non è un regime");

// il vocabolario è legge: alfabeto {1,2,4,5,6,7}, slick = SOFT/MEDIUM/HARD
b.verifica(stessiInsiemi(ALFABETO_STATUS, ['1', '2', '4', '5', '6', '7']), 'alfabeto status divergente dal vocabolario');
b.verifica(stessiInsiemi(MESCOLE_SLICK, ['SOFT', 'MEDIUM', 'HARD']), 'insieme slick divergente dal contratto');

function stessiInsiemi(s, arr) {
  return s instanceof Set && s.size === arr.length && arr.every(x => s.has(x));
}

b.fine();
