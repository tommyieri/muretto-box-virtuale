#!/usr/bin/env node
// s46_codice_fresco — LA MACCHINA CHE PUBBLICA PUO' AVERE IL CODICE DI IERI, E DIRLO PIANO.
//
// IL GUASTO CHE LA FA NASCERE, per intero, perche' non si ripeta a memoria corta. Il
// 15/08/2026 il Mac pubblicava telemetria con un checkout fermo a 33 commit prima. Non
// perche' il cron fosse spento: girava ogni 30 minuti, correttamente, e a ogni giro il suo
// `git merge --ff-only origin/main` falliva. Sotto `.agents/` c'erano 28 file NON tracciati,
// scritti li' da un installatore di skill; a monte quegli stessi 28 percorsi erano nel
// frattempo diventati tracciati. Git rifiuta un fast-forward che sovrascriverebbe file non
// tracciati — anche quando il contenuto e' identico byte per byte, come qui — e i wrapper
// cadevano nel ramo `else`, che stampava «fast-forward non possibile: giro col codice
// attuale» e proseguiva. Per giorni. Nessuno lo ha visto perche' quella riga sembrava una
// nota informativa, e perche' NIENTE, in un progetto con 44 sentinelle, guardava se la
// macchina avesse il codice giusto.
//
// L'ASIMMETRIA E' IL PUNTO. Il banco sorveglia il modello con prereg sigillate e NULL
// onorati; l'esercizio non era sorvegliato da nulla. Fra i due, e' l'esercizio quello che
// puo' rompersi in silenzio, perche' il modello lo si interroga e la macchina no.
//
// QUESTA SENTINELLA HA DUE META', e la seconda non e' sempre eseguibile.
//
//  (A) GUARDA LA GUARDIA — vale ovunque, CI compresa. Ogni wrapper che si aggiorna da solo
//      (`git merge --ff-only`) DEVE urlare quando il fast-forward fallisce: si pretende il
//      marcatore `CODICE VECCHIO` nel ramo di fallimento. E' una proprieta' del CODICE,
//      quindi si verifica su qualunque checkout, e sorveglia esattamente cio' che e' andato
//      storto: non il fallimento, ma il suo TONO. Se qualcuno un giorno riscrive quel ramo
//      in forma discreta, questa meta' diventa rossa prima che una macchina ne soffra.
//
//  (B) GUARDA QUESTO CHECKOUT — solo se `origin/main` e' risolvibile. Nella CI di GitHub il
//      clone e' superficiale e il riferimento spesso NON esiste: li' questa meta' non viene
//      emessa, e la riga «(B) non eseguibile» lo dichiara invece di tacere. Dove invece il
//      riferimento c'e' — il Mac, il VPS, il portatile di chi sviluppa — si pretende che il
//      checkout non stia indietro di piu' di ORE_MAX.
//
// LA SOGLIA E' 24 ORE, non un numero di commit. Un conteggio di commit non distingue una
// giornata di lavoro fitto da una settimana di abbandono: dieci commit in un'ora sono
// normali, uno solo vecchio di tre giorni e' un guasto. Ventiquattro ore lasciano dormire
// un Mac spento per una notte — che e' lecito, ed e' il motivo per cui la redazione e'
// traslocata sul VPS — e fanno rumore appena il ritardo diventa strutturale.
//
// DOVE CONVIENE ESEGUIRLA. In CI vale la meta' (A). La meta' (B) diventa utile quando la
// sentinella gira SULLA MACCHINA che pubblica: `node banco/sentinelle/s46_codice_fresco.mjs`
// dentro simulatore/, sul Mac o sul VPS, dice in un secondo se quel checkout e' fresco.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { banco } from '../asserzioni.mjs';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = path.join(radice, '..');
const SCHEDULING = path.join(REPO, 'scheduling');
const MARCATORE = 'CODICE VECCHIO';
const ORE_MAX = 24;

const b = banco('s46');

// git che non esplode: qualunque inciampo (non e' un repo, manca il riferimento, git assente)
// torna null, e chi chiama decide se e' una rossa o una meta' non eseguibile.
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
};

// ---- (A) i wrapper che si aggiornano da soli devono urlare ----------------------------
const wrapper = existsSync(SCHEDULING)
  ? readdirSync(SCHEDULING)
      .filter((f) => f.endsWith('.sh'))
      .map((f) => ({ nome: f, testo: readFileSync(path.join(SCHEDULING, f), 'utf8') }))
      .filter((w) => w.testo.includes('merge --ff-only'))
  : [];

b.verifica(
  'scheduling/ contiene almeno un wrapper che si aggiorna da solo (`merge --ff-only`)'
  + ' — se sono spariti tutti, questa sentinella sorveglia il vuoto e va riscritta, non tolta',
  wrapper.length > 0,
);

for (const w of wrapper) {
  b.verifica(
    `scheduling/${w.nome}: il fast-forward fallito urla («${MARCATORE}») invece di passare per`
    + ' una nota — e\' il tono di quella riga che ha nascosto 33 commit di ritardo per giorni',
    w.testo.includes(MARCATORE),
  );
}

// ---- (B) questo checkout e' fresco? ---------------------------------------------------
const haRiferimento = git('rev-parse', '--verify', '--quiet', 'origin/main') !== null;

if (!haRiferimento) {
  console.log(
    "s46  (B) non eseguibile: `origin/main` non e' risolvibile in questo checkout"
    + ' (tipico del clone superficiale della CI). La meta\' (A) e\' stata verificata.',
  );
} else {
  const indietro = Number(git('rev-list', '--count', 'HEAD..origin/main') ?? 'NaN');
  b.verifica(
    'so contare di quanti commit questo checkout e\' indietro rispetto a origin/main',
    Number.isFinite(indietro),
  );

  if (Number.isFinite(indietro) && indietro > 0) {
    // Il piu' VECCHIO dei commit che ci mancano: e' lui a dire da quanto dura il ritardo.
    // `--reverse` mette per primo il piu' antico, `-1` lo isola.
    const ts = Number(git('log', '--reverse', '--format=%ct', 'HEAD..origin/main') ?.split('\n')[0] ?? 'NaN');
    const ore = Number.isFinite(ts) ? Math.floor((Date.now() / 1000 - ts) / 3600) : NaN;
    b.verifica(
      `il checkout non porta un ritardo piu' vecchio di ${ORE_MAX} ore (indietro di ${indietro}`
      + ` commit, il piu' antico da ${Number.isFinite(ore) ? ore : '?'} ore) — se e' rossa,`
      + ' il fast-forward non passa: cerca file non tracciati che collidono, o un commit locale'
      + ' mai pushato, e leggi il ramo CODICE VECCHIO nel log della macchina',
      Number.isFinite(ore) && ore <= ORE_MAX,
    );
  } else if (indietro === 0) {
    console.log('s46  (B) checkout allineato a origin/main.');
  }
}

b.chiudi();
