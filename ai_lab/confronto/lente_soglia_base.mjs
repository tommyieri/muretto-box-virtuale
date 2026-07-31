// lente_soglia_base.mjs — QUANTO DEL SILENZIO È LA SOGLIA DEGLI 8 GIRI.
//
// simulatore/scenario/costruttore.mjs:31 `const MIN_GIRI_BASE = 8` è una costante di
// modulo: il passo base esiste solo per chi ha almeno 8 osservazioni VERDI dall'inizio
// gara fino al congelamento. Sotto quella soglia il motore non risponde (regola 6), ed è
// il silenzio che il visitatore incontra nei primi giri.
//
// QUI SI MISURA SOLO LA COPERTURA, chiamando stimaBasi con soglie diverse. NON si misura
// l'accuratezza di una base stimata su meno giri: quella richiede un cancello suo, e non
// è misurabile senza toccare il motore. Il numero che segue dice quanto silenzio è
// SOGLIA, non che abbassarla sia giusto.
//
//   node ai_lab/confronto/lente_soglia_base.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');

const { caricaGare2026 } = await import(path.join(SIM, 'provenienza/gare_2026.mjs'));
const { osservazioniVerdi } = await import(path.join(SIM, 'provenienza/gare_indice.mjs'));
const { stimaBasi } = await import(path.join(SIM, 'engine/passo_v2.mjs'));

const gare = caricaGare2026(SIM);
const modello = JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/modello_v2.json'), 'utf8'));
// stessa lettura di scenario/costruttore.mjs:85-86 — non una variante
const delta70 = modello.delta_70.scelto;
const rho = modello.rho.valore;
console.log(`modello: delta70 = ${delta70} · rho = ${rho} (letti come li legge costruttore.mjs)`);

const SOGLIE = [8, 6, 5, 4, 3];
const PRIMO = 5, DOPO = 3;

// per ogni soglia: quante coppie (pilota, congelamento) hanno un passo base
const conta = {};
for (const s of SOGLIE) conta[s] = { tot: 0, ok: 0, perL: {} };

for (const [nome, gara] of Object.entries(gare)) {
  const oss = osservazioniVerdi(gara.righe);
  const ultimo = gara.nGiri - DOPO;
  const piloti = [...gara.perPilota.keys()];
  for (let L = PRIMO; L <= ultimo; L += 1) {
    for (const s of SOGLIE) {
      const basi = stimaBasi(oss, { delta70, rho, nGiri: gara.nGiri, finoA: L, minGiri: s });
      for (const p of piloti) {
        // conta solo chi è in pista a quel giro: chiedere di un ritirato non è un buco
        if (!gara.perPilota.get(p)?.has(L)) continue;
        conta[s].tot++;
        const ha = basi[p] != null;
        if (ha) conta[s].ok++;
        (conta[s].perL[L] ??= { tot: 0, ok: 0 });
        conta[s].perL[L].tot++; if (ha) conta[s].perL[L].ok++;
      }
    }
  }
}

console.log('\n=== COPERTURA DEL PASSO BASE per soglia (tutte le gare, ogni pilota in pista, ogni congelamento 5..n-3) ===');
for (const s of SOGLIE) {
  const c = conta[s];
  console.log(`  minGiri = ${s}: ${c.ok}/${c.tot} = ${(100 * c.ok / c.tot).toFixed(1)}%`
    + (s === 8 ? '   <- quella in produzione' : ''));
}

console.log('\n=== DOVE CAMBIA: copertura per giro di congelamento ===');
console.log('   L    minGiri=8   =6    =5    =4    =3');
for (let L = 5; L <= 20; L++) {
  const riga = SOGLIE.map(s => {
    const p = conta[s].perL[L];
    return p ? (100 * p.ok / p.tot).toFixed(0).padStart(5) + '%' : '     -';
  }).join('');
  console.log(`  ${String(L).padStart(2)}  ${riga}`);
}

console.log('\nNOTA DI ONESTÀ: qui c\'è solo la copertura. Un passo base su 3 giri verdi invece di 8');
console.log('è una stima più rumorosa, e QUANTO più rumorosa non è misurato in questo script.');
console.log('M4 ha il solo confronto vicino: nella fascia di sosta 9-13 il nuovo fa 23,5% di esatti');
console.log('(n=34) contro 22,0% del vecchio (n=41) — cioè la zona subito sopra la soglia è già la');
console.log('peggiore per entrambi i motori. Non è una prova che abbassare la soglia sia gratis.');
