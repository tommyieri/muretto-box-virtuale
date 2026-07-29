// S08 — Il Director valida l'OUTPUT a runtime, e non è cieco.
// Distinzione costituzionale: il Banco fa la guardia al codice ai cancelli,
// il Director fa la guardia all'output prima della pagina. Qui il Banco
// verifica che il Director veda i paradossi che dichiara di vedere.
//
// FALLIREBBE SE: il Director lasciasse passare un paradosso dichiarato —
// perdita di sosta sotto il pavimento fisico dello stazionario (1,8 s), NaN
// nei cum (un null entrato in aritmetica), "fermati subito" con gomma fresca
// (il sintomo E01), piano monomescola su asciutto (regola 2026), un output
// che parla di DRS (non esiste più nel 2026) — oppure se bocciasse
// l'output sano (falso positivo: il guardiano che urla sempre non fa la guardia).
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { controllaOutput } from '../../scenario/director.mjs';

const b = nuovoBanco('s08_director');

const sano = {
  cum: { VER: 5000.1, SAI: 5003.4 },
  curva: [{ giroSosta: 31, delta: 4.2 }, { giroSosta: 32, delta: 3.1 }, { giroSosta: 33, delta: 3.9 }],
  etaAlCongelamento: 12,
  perditaSosta: 21.5,
  piano: { mescoleUsate: ['MEDIUM', 'HARD'], bagnato: false },
};
const esitoSano = controllaOutput(sano);
b.verifica(esitoSano.ok === true && esitoSano.violazioni.length === 0,
  `output sano bocciato: ${esitoSano.violazioni.map(v => v.codice).join(', ')}`);

const paradossi = [
  ['D1_stazionario', { ...sano, perditaSosta: 1.2 },
    'perdita di sosta sotto il pavimento fisico (1,8 s) passata liscia'],
  ['D2_nan', { ...sano, cum: { VER: 5000.1, SAI: NaN } },
    'NaN nel cum passato liscio: un null è entrato in aritmetica'],
  ['D3_fermati_subito', { ...sano, etaAlCongelamento: 0, curva: [{ giroSosta: 31, delta: -2 }, { giroSosta: 32, delta: -1 }, { giroSosta: 33, delta: 0 }] },
    '"fermati subito" con gomma fresca passato liscio: è il sintomo del gradino perpetuo (E01)'],
  ['D4_due_mescole', { ...sano, piano: { mescoleUsate: ['MEDIUM'], bagnato: false } },
    'piano monomescola su asciutto passato liscio: viola il regolamento 2026'],
  ['D5_drs', { ...sano, note: 'rientro in zona DRS' },
    'un output che parla di DRS è passato liscio: nel 2026 non esiste (Manual Override Mode)'],
];
for (const [codice, output, messaggio] of paradossi) {
  const esito = controllaOutput(output);
  b.verifica(esito.ok === false && esito.violazioni.some(v => v.codice === codice), messaggio);
}

// il piano monomescola sul BAGNATO invece è lecito (l'obbligo vale sull'asciutto)
const bagnato = controllaOutput({ ...sano, piano: { mescoleUsate: ['INTERMEDIATE'], bagnato: true } });
b.verifica(bagnato.ok === true, 'piano monomescola su bagnato bocciato: l\'obbligo 2 mescole vale solo sull\'asciutto');

b.fine();
