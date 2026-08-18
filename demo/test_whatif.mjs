// test_whatif.mjs — la sentinella della pagina What-If.
//
// COSA SORVEGLIA, e perché proprio questo. La pagina è nata il 17/08/2026 e nello stesso
// giorno è stata spenta e riscritta: la prima versione leggeva l'archivio nella forma
// sbagliata e pubblicava numeri fabbricati (passo base 85,0 s di ripiego, «posizione di
// rientro» sempre P1) sotto una targhetta che diceva «misurato». Nessuna delle nove
// sentinelle del repo poteva accorgersene: demo/test_stat.mjs guarda che la pagina esista,
// sia linkata e legga solo demo/data/ — dice di sé, per iscritto, che «non apre un browser».
// Questo file guarda l'unica cosa che restava scoperta: i NUMERI che la pagina produce.
//
// L'INVARIANTE CENTRALE È LO ZERO. Se sposto la sosta esattamente dove già era, e con la
// mescola che il pilota montò davvero, i due bracci del motore devono dare lo stesso
// risultato: delta 0,00 s. È una verifica forte perché fallisce sia se si rompe la
// costruzione del piano, sia se i due bracci smettono di condividere assunzioni — che sono
// i due modi in cui questo confronto può tornare a mentire senza dare errore.
//
// COSA NON CONTROLLA, E VA DETTO: non apre la pagina. Non sa se un KPI è cablato all'ID
// giusto o se il grafico si disegna. Sa che la catena dati->kernel->delta è quella vera e
// che risponde con lo zero dove deve.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { preparaGara, congelamentoPer } from './ese.mjs';
import { eseguiRigioca } from './ese_vista.mjs';
import { sosteEditabili, pianoWhatIf } from './whatif_piano.mjs';

const qui = path.dirname(fileURLToPath(import.meta.url));
let rosse = 0;
const esito = (ok, testo) => {
  if (!ok) rosse += 1;
  console.log(`${ok ? 'PASSA ' : 'FALLITO'}  ${testo}`);
};
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(qui, decodeURIComponent(u.split('?')[0]))), 'utf8');

/* ───────────────────────────────────── A. il piano, senza motore */
console.log('A. il piano what-if conserva la strategia e muove una sosta sola');
{
  const vere = [{ giro: 17, mescola: 'HARD' }, { giro: 39, mescola: 'MEDIUM' }, { giro: 56, mescola: 'HARD' }];

  const fermo = pianoWhatIf(vere, 16, 17, 'HARD');
  esito(JSON.stringify(fermo) === JSON.stringify(vere),
    'cursore sul giro vero: il piano coincide con la strategia vera');

  const mosso = pianoWhatIf(vere, 16, 26, 'HARD');
  esito(mosso.length === 3 && mosso[0].giro === 26 && mosso[1].giro === 39 && mosso[2].giro === 56,
    'sosta spostata 17->26: le altre due restano (era il difetto: diventavano una sola)');

  const tardi = pianoWhatIf(vere, 16, 45, 'SOFT');
  esito(tardi.every((s, i, a) => i === 0 || a[i - 1].giro < s.giro),
    'sosta spostata oltre la successiva: il piano resta crescente');

  esito(pianoWhatIf(vere, 40, 45, 'HARD').every((s) => s.giro > 40),
    'congelamento tardivo: nel piano non rientrano soste gia\' avvenute');

  const nonSlick = [{ giro: 12, mescola: 'INTERMEDIATE' }, { giro: 30, mescola: 'HARD' }];
  esito(sosteEditabili(nonSlick).length === 1,
    'le soste non-slick restano fuori: stesso filtro del braccio «vero»');
}

/* ───────────────────────── B. lo zero, col kernel vero, su piu' gare */
console.log('\nB. sposto la sosta dove gia\' era: i due bracci devono coincidere');
{
  const CASI = [
    ['Ungheria', 'NOR'], ['Ungheria', 'LEC'],
    ['Australia', 'NOR'], ['Belgio', 'NOR'],
    ['Monaco', 'ALB'], ['Monaco', 'LEC'],
  ];
  for (const [gara, drv] of CASI) {
    const prep = await preparaGara(gara, { fetchJson });
    const soste = sosteEditabili(prep.sosteVere[drv]);
    if (!soste.length) { esito(false, `${gara}/${drv}: nessuna sosta rappresentabile (caso mal scelto)`); continue; }
    const vera = soste[0];
    const { freezeLap } = congelamentoPer({ nome: prep.nome, contesto: prep.contesto, pilota: drv, giroSosta: vera.giro });
    if (freezeLap == null) { esito(false, `${gara}/${drv}: nessun congelamento al giro ${vera.giro}`); continue; }

    const { mio, vero } = eseguiRigioca({
      prep, pilota: drv, freeze: freezeLap,
      soste: pianoWhatIf(prep.sosteVere[drv], freezeLap, vera.giro, vera.mescola),
    });
    if (!vero) { esito(false, `${gara}/${drv}: il braccio «strategia vera» non e' simulabile`); continue; }
    const d = mio.risultato.cum[drv] - vero.risultato.cum[drv];
    esito(Math.abs(d) < 1e-9,
      `${gara}/${drv}: sosta vera al giro ${vera.giro} (${vera.mescola}) -> delta ${d.toFixed(9)} s`);
    esito(mio.direttore.approved === vero.direttore.approved,
      `${gara}/${drv}: il Director giudica i due bracci allo stesso modo`);
  }
}

/* ───────────────────── C. spostare la sosta DEVE cambiare qualcosa */
console.log('\nC. spostare la sosta muove il delta (altrimenti il cursore e\' teatro)');
{
  const prep = await preparaGara('Ungheria', { fetchJson });
  const drv = 'NOR';
  const vera = sosteEditabili(prep.sosteVere[drv])[0];
  const deltaA = (giro) => {
    const { freezeLap } = congelamentoPer({ nome: prep.nome, contesto: prep.contesto, pilota: drv, giroSosta: giro });
    if (freezeLap == null) return null;
    const { mio, vero } = eseguiRigioca({
      prep, pilota: drv, freeze: freezeLap,
      soste: pianoWhatIf(prep.sosteVere[drv], freezeLap, giro, vera.mescola),
    });
    return vero ? mio.risultato.cum[drv] - vero.risultato.cum[drv] : null;
  };
  const spostati = [vera.giro - 8, vera.giro + 8].map(deltaA).filter((x) => x != null);
  esito(spostati.length === 2, 'i due spostamenti di prova sono simulabili');
  esito(spostati.every((d) => Math.abs(d) > 1e-6),
    `spostare di ±8 giri cambia il tempo finale (${spostati.map((d) => d.toFixed(2)).join(' / ')} s)`);
}

console.log(`\n${rosse ? `${rosse} SENTINELLE ROSSE` : 'sentinella what-if: tutto verde'}`);
process.exit(rosse ? 1 : 0);
