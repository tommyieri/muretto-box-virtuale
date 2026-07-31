// s26_motore_nel_browser — il motore che il pannello LIVE esegue in pagina deve
// essere CARICABILE in pagina.
//
// PERCHE' ESISTE. gara.html non calcola: legge risposte pre-calcolate (regola 8).
// In diretta quella strada non c'e' — la gara sta succedendo, una risposta
// pre-calcolata non esiste per definizione — quindi il pannello live esegue il
// motore vero nel browser. Non una seconda implementazione: LO STESSO codice,
// trasportato come artefatto con manifest di hash (E12/E17 restano chiusi).
//
// Ma "lo stesso codice" e' una promessa vuota se quel codice non parte. Un solo
// `import ... from 'node:fs'` in un punto qualsiasi della chiusura degli import
// rende l'intero motore non caricabile in pagina, e il modo in cui te ne accorgi
// e' il pannello vuoto durante una gara vera. Questa sentinella cammina il grafo
// e lo scopre qui.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un modulo raggiungibile dai punti d'ingresso del browser importa da
//      `node:` (fs, path, url, crypto...) — direttamente o per transitivita';
//  (b) un modulo raggiungibile importa da `banco/` o `web/` (il motore non
//      dipende dai suoi verificatori ne' dai suoi formattatori);
//  (c) il camminatore non morde: su un grafo costruito apposta con node:fs
//      dentro, deve trovarlo. Senza questo, (a) e (b) sarebbero teatro (E09).
//
// COSA NON VERIFICA. Che le COSTANTI siano trasportate: quello e' il compito di
// `web/trasporta_motore.mjs --verifica`, che la CI esegue a parte.

import { banco } from '../asserzioni.mjs';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
// LO STESSO camminatore che usa il trasporto: due camminatori diversi
// potrebbero far passare un file che l'altro non guarda.
import { chiusura } from '../../web/grafo_import.mjs';

const b = banco('s26');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// I punti d'ingresso che il ponte live chiama. Se domani il ponte ne chiamasse
// un altro, va aggiunto QUI: e' l'elenco che definisce cosa deve stare in piedi
// nel browser.
const INGRESSI = [
  'scenario/risposta.mjs',        // monta il record: tira dentro costruttore, piano, allarmi, director
  'provenienza/gare_indice.mjs',  // indicizza: il ponte ne ha bisogno per la gara sintetica
  'provenienza/contratto.mjs',    // creaCella: il ponte traduce le celle live nel contratto
  'provenienza/vocabolario.mjs',  // il ponte legge le mescole valide
];

const leggiDalRepo = (rel) => {
  const abs = path.join(radice, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

// ── (c) PRIMA il camminatore, poi il verdetto ──────────────────────────────
// Un grafo finto con node:fs nascosto in transitiva: se non lo trovassimo, ogni
// riga sotto sarebbe un timbro senza controllo.
{
  const tmp = mkdtempSync(path.join(tmpdir(), 's26-'));
  try {
    writeFileSync(path.join(tmp, 'a.mjs'), "import { b } from './b.mjs';\nexport const a = b;\n");
    writeFileSync(path.join(tmp, 'b.mjs'), "import { readFileSync } from 'node:fs';\nexport const b = readFileSync;\n");
    const finto = chiusura(['a.mjs'], (rel) => {
      const abs = path.join(tmp, rel);
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    });
    b.uguale('il camminatore attraversa gli import relativi', finto.moduli.size, 2);
    b.verifica('il camminatore TROVA un node:fs in transitiva (se non mordesse, il resto sarebbe teatro)',
      finto.esterni.some((e) => e.specificatore === 'node:fs' && e.da === 'b.mjs'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── (a) + (b) il grafo vero ────────────────────────────────────────────────
const { moduli, esterni } = chiusura(INGRESSI, leggiDalRepo);

b.verifica(`il grafo del motore e' stato davvero camminato (${moduli.size} moduli)`, moduli.size >= 8);
for (const rel of INGRESSI) {
  b.verifica(`l'ingresso ${rel} esiste`, leggiDalRepo(rel) !== null);
}

// (a) niente `node:` — ne' diretto ne' per transitivita'
{
  const daNode = esterni.filter((e) => e.specificatore.startsWith('node:'));
  b.verifica(
    `nessun modulo del motore importa da node:${daNode.length ? ` — ${daNode.map((e) => `${e.da} → ${e.specificatore}`).join(', ')}` : ''}`,
    daNode.length === 0,
  );
  // e nessun altro import "nudo": in pagina non c'e' risolutore di pacchetti
  const altri = esterni.filter((e) => !e.specificatore.startsWith('node:'));
  b.verifica(
    `nessun modulo del motore importa un pacchetto${altri.length ? ` — ${altri.map((e) => `${e.da} → ${e.specificatore}`).join(', ')}` : ''}`,
    altri.length === 0,
  );
}

// (b) il motore non dipende dai suoi verificatori ne' dai suoi formattatori
{
  const sbagliati = [...moduli].filter((m) => m.startsWith('banco/') || m.startsWith('web/'));
  b.verifica(
    `il motore non importa da banco/ ne' da web/${sbagliati.length ? ` — ${sbagliati.join(', ')}` : ''}`,
    sbagliati.length === 0,
  );
}

// I caricatori, che il disco lo toccano, devono restare FUORI dal grafo: sono
// loro il motivo per cui questa separazione esiste.
for (const dato of ['scenario/director_dati.mjs', 'provenienza/pitloss_dati.mjs',
                    'scenario/allarmi_dati.mjs', 'provenienza/gare_2026.mjs']) {
  b.verifica(`${dato} (che legge dal disco) resta fuori dal motore del browser`, !moduli.has(dato));
  b.verifica(`...e ${dato} esiste davvero (altrimenti il controllo sopra passerebbe per un refuso)`,
    leggiDalRepo(dato) !== null);
}

b.chiudi();
