// test_sosta.mjs — banco di demo/sosta.mjs, la definizione UNICA di sosta.
//
// PERCHE' ESISTE ANCHE QUESTO, oltre a test_sosta.py. La definizione e' stata promossa in
// Python (data/SOSTA_PREREG3.md) ma in produzione gira in JavaScript: due implementazioni
// della stessa regola sono due definizioni che aspettano di divergere (E12: il vecchio repo
// ha pagato il 37% di divergenza replay/live per questo). Questo banco ancora la versione
// JS allo STESSO arbitro indipendente — data/soste_fastf1_2026.json — cosi' le due non
// possono separarsi in silenzio.
//
// Cosa lo fa fallire (regola 4):
//   T1  sostaFra() sui casi limite scritti a mano, compresi quelli che hanno bocciato le
//       definizioni precedenti (set usato piu' vecchio, set nuovo della stessa eta').
//   T2  l'assenza e' null, mai `false`: una cella senza mescola non e' «nessuna sosta».
//   T3  sosteDi() riproduce l'arbitro FastF1 ESATTAMENTE su tutte le gare (0 disaccordi).
//   T4  stintDi() e' coerente con sosteDi(): tanti stint quante soste + 1, tratti
//       contigui che coprono tutti i giri senza buchi e senza sovrapposizioni.
//   T5  il contatore `stint` grezzo NON e' la sosta: su Monaco deve esserci divergenza —
//       se un giorno coincidessero, o qualcuno ha ricablato la definizione sul contatore,
//       o i dati sono cambiati sotto, e in entrambi i casi va guardato.

import { readFileSync } from 'node:fs';
import { sostaFra, sosteDi, stintDi } from './sosta.mjs';

let falliti = 0;
const ok = (nome, cond, extra = '') => {
  if (cond) console.log(`   [OK  ] ${nome}${extra ? ' — ' + extra : ''}`);
  else { console.log(`   [FALLITO] ${nome}${extra ? ' — ' + extra : ''}`); falliti++; }
};
const leggi = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));

// ── T1 casi limite
const C = (compound, tyre_age) => ({ compound, tyre_age });
ok('T1a mescola diversa = sosta', sostaFra(C('MEDIUM', 17), C('HARD', 1)) === true);
ok('T1b set nuovo della stessa eta (Belgio/BEA g1)', sostaFra(C('MEDIUM', 1), C('HARD', 1)) === true);
ok('T1c set USATO piu vecchio (Canada/SAI g2)', sostaFra(C('INTERMEDIATE', 2), C('MEDIUM', 9)) === true);
ok('T1d stessa mescola, eta che riparte', sostaFra(C('SOFT', 8), C('SOFT', 1)) === true);
ok('T1e transito senza cambio gomma (Monaco/LIN g59)', sostaFra(C('MEDIUM', 59), C('MEDIUM', 60)) === false);
ok('T1f giro normale', sostaFra(C('HARD', 5), C('HARD', 6)) === false);

// ── T2 l'assenza e' null
ok('T2a mescola assente -> null', sostaFra(C(null, 5), C('HARD', 1)) === null);
ok('T2b cella successiva assente -> null', sostaFra(C('HARD', 5), null) === null);
ok('T2c stessa mescola ed eta assente -> null', sostaFra(C('HARD', null), C('HARD', null)) === null);
ok('T2d nessun false mascherato da null', sostaFra(C('HARD', 5), C('HARD', null)) === null);

// ── T3/T4/T5 sui dati veri
const manifest = leggi('./data/manifest.json');
const arbitro = leggi('../data/soste_fastf1_2026.json').gare;

let disaccordi = [], nCambi = 0, incoerenti = [], divergenzaMonaco = 0;
for (const { gara } of manifest) {
  const dati = leggi(`./data/${gara}.json`);
  const perPilota = {};
  for (const L of dati.laps) {
    for (const [sig, c] of Object.entries(L.cars)) {
      (perPilota[sig] ||= {})[L.lap] = c;
    }
  }
  const loro = arbitro[gara];
  if (!loro) continue;
  for (const sig of new Set([...Object.keys(perPilota), ...Object.keys(loro)])) {
    const nostre = new Set(sosteDi(perPilota[sig] || {}));
    const sue = new Set(loro[sig]?.cambi || []);
    nCambi += sue.size;
    for (const L of nostre) if (!sue.has(L)) disaccordi.push(`${gara}/${sig} g${L}: solo noi`);
    for (const L of sue) if (!nostre.has(L)) disaccordi.push(`${gara}/${sig} g${L}: solo FastF1`);

    // T4: gli stint devono coprire i giri esattamente una volta
    const giri = Object.keys(perPilota[sig] || {}).map(Number).sort((a, b) => a - b);
    if (giri.length) {
      const st = stintDi(perPilota[sig]);
      if (st.length !== nostre.size + 1) {
        incoerenti.push(`${gara}/${sig}: ${st.length} stint per ${nostre.size} soste`);
      }
      const coperti = st.reduce((s, x) => s + x.giri, 0);
      if (coperti !== giri[giri.length - 1] - giri[0] + 1) {
        incoerenti.push(`${gara}/${sig}: gli stint coprono ${coperti} giri su ${giri.length}`);
      }
      for (let i = 1; i < st.length; i++) {
        if (st[i].da !== st[i - 1].a + 1) incoerenti.push(`${gara}/${sig}: buco fra gli stint ${i}`);
      }
    }
    // T5: a Monaco il contatore grezzo deve dire una cosa diversa dalla sosta vera
    if (gara === 'Monaco') {
      let contatore = 0;
      for (const L of giri) {
        const a = perPilota[sig][L], b = perPilota[sig][L + 1];
        if (a && b && b.stint > a.stint) contatore++;
      }
      if (contatore !== nostre.size) divergenzaMonaco++;
    }
  }
}

ok('T3 sosteDi() riproduce l\'arbitro FastF1', disaccordi.length === 0,
   `${nCambi} cambi gomma, ${disaccordi.length} disaccordi${disaccordi.length ? ': ' + disaccordi.slice(0, 4).join(' · ') : ''}`);
ok('T4 stintDi() copre i giri senza buchi ne sovrapposizioni', incoerenti.length === 0,
   incoerenti.length ? incoerenti.slice(0, 4).join(' · ') : 'tutti i piloti coerenti');
ok('T5 a Monaco il contatore stint NON e la sosta', divergenzaMonaco > 0,
   `${divergenzaMonaco} piloti in cui il contatore conta piu' soste del vero`);

console.log(falliti ? `\nESITO: ROSSO (${falliti} falliti)` : '\nESITO: verde');
process.exit(falliti ? 1 : 0);
