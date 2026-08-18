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
//      (`git merge --ff-only`) deve fare DUE cose: urlare quando il fast-forward fallisce
//      (marcatore `CODICE VECCHIO` nel ramo di fallimento) e CHIAMARE questa sentinella
//      subito dopo l'aggiornamento. Il marcatore serve a chi il log lo apre; l'aggancio
//      serve a chi non lo apre. Sono entrambe proprieta' del CODICE, quindi si verificano su
//      qualunque checkout, e insieme sorvegliano esattamente cio' che e' andato storto: non
//      il fallimento — quello e' voluto, si prosegue lo stesso — ma il suo TONO, e il fatto
//      che qualcuno lo stia ascoltando. Se un giorno quel ramo torna discreto, o l'aggancio
//      sparisce in un riordino, questa meta' diventa rossa prima che una macchina ne soffra.
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
// COME SI RICONOSCE UN AGGANCIO VERO. La prima stesura cercava il nome del file,
// 's46_codice_fresco.mjs', ed era un ORNAMENTO: quel nome compare gia' dentro il commento del
// ramo CODICE VECCHIO («marcatore cercato da banco/sentinelle/s46_codice_fresco.mjs»), quindi
// l'asserzione passava anche su un wrapper da cui l'aggancio era stato tolto per intero.
// L'ho scoperto solo perche' la prova di fallimento non falliva — che e' il motivo per cui
// quella prova si fa. Adesso si cerca la riga di LOG che solo il blocco d'aggancio stampa:
// una stringa che un commento non puo' produrre, perche' descrive un comportamento.
const MARCATORE_AGGANCIO = 'freschezza del codice (s46)';
const ORE_MAX = 24;
// IL SECONDO MODO DI NON AGGIORNARSI, trovato il 17/08/2026 — e questa sentinella non lo
// vedeva. Sorvegliavo il ramo del fast-forward FALLITO e non quello che non ci arriva
// nemmeno: `git status --porcelain` NUDO conta i file non tracciati, quindi UN solo file
// non tracciato (sul VPS: `data/auto_articoli.log`, comparso il 10/08 col trasloco della
// redazione) manda il wrapper nel ramo «albero sporco» a ogni giro, per sempre. Sette
// giorni, 343 giri, zero aggiornamenti — e nessun rosso, perche' il checkout restava
// fresco per merito di un ALTRO wrapper che usa la forma giusta. La meta' (B) misura la
// freschezza, e quella era verde: e' la CAPACITA' di aggiornarsi che era morta, e si vede
// solo nel codice. Da qui la regola: chi si aggiorna da solo deve escludere i non
// tracciati, perche' in un checkout di lavoro ce ne sono sempre.
// La forma NUDA e' `git status --porcelain` non seguito da `--untracked-files=no`: nel
// wrapper compare come `$(git status --porcelain)`, quindi il lookahead deve guardare
// l'opzione che manca, non un carattere qualunque (la parentesi di chiusura ingannerebbe).
const STATUS_NUDO = /git\s+status\s+--porcelain(?!\s+--untracked-files=no)/;
const STATUS_SICURO = 'git status --porcelain --untracked-files=no';
// IL TERZO MODO DI NON AGGIORNARSI — e questo l'ha mostrato il log, non un ragionamento.
// Il 17/08/2026 alle 14:30:01, nove minuti dopo il merge di #176, il VPS ha stampato
// «albero sporco: NON aggiorno» e subito sotto «codice fresco». Entrambe vere alla lettera:
// il `git fetch` stava dentro l'`elif`, quindi l'albero sporco lo saltava, e la meta' (B)
// confrontava HEAD con un `origin/main` LOCALE VECCHIO — trovandoli uguali. La guardia non
// aveva guardato: aveva ricordato. Il fetch e' in sola lettura (non tocca albero ne' HEAD),
// quindi non ha ragione di stare dietro una condizione sull'albero, e ora sta prima.
// Qui si sorveglia l'ORDINE, perche' e' l'ordine il fatto che conta: se un domani il fetch
// tornasse dentro il ramo condizionale, la meta' (B) ricomincerebbe a mentire in silenzio.
const FETCH = /git\s+fetch\s+origin/;
const GUARDIA = /git\s+status\s+--porcelain/;

const b = banco('s46');

// git che non esplode: qualunque inciampo (non e' un repo, manca il riferimento, git assente)
// torna null, e chi chiama decide se e' una rossa o una meta' non eseguibile.
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
};

// ---- (A) i wrapper che si aggiornano da soli devono urlare ----------------------------
// SOLO IL CODICE, NON LA PROSA — e me lo sono ricordato sbagliando di nuovo. L'asserzione
// sullo status nudo e' nata rossa sul wrapper GIA' RIPARATO, perche' la stringa
// `git status --porcelain` compare nel commento che spiega il guasto («fino al 17/08 qui
// c'era ... NUDO»). E' lo stesso inciampo che questo file racconta poche righe sopra: la
// prima versione dell'aggancio cercava un nome che viveva in un commento. Le asserzioni su
// una PROPRIETA' DEL CODICE devono leggere il codice; i commenti sono liberi di citare il
// difetto che descrivono, ed e' giusto che lo facciano.
// Si tolgono le righe interamente di commento (primo carattere non bianco = `#`), che e'
// tutto cio' che serve qui: nessun wrapper mette codice e commento sulla stessa riga.
const soloCodice = (testo) => testo
  .split('\n')
  .filter((riga) => !/^\s*#/.test(riga))
  .join('\n');

const wrapper = existsSync(SCHEDULING)
  ? readdirSync(SCHEDULING)
      .filter((f) => f.endsWith('.sh'))
      .map((f) => {
        const testo = readFileSync(path.join(SCHEDULING, f), 'utf8');
        return { nome: f, testo, codice: soloCodice(testo) };
      })
      .filter((w) => w.codice.includes('merge --ff-only'))
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
  // E DEVE ANCHE CHIAMARMI. Un marcatore nel log serve a chi il log lo apre; l'aggancio serve
  // a chi non lo apre. Senza questa seconda asserzione l'aggancio potrebbe sparire in un
  // riordino e la meta' (B) tornerebbe a girare solo dove qualcuno la lancia a mano — cioe'
  // quasi mai, che e' lo stato in cui il guasto del 15/08 e' vissuto per giorni.
  b.verifica(
    `scheduling/${w.nome}: chiama s46 dopo l'aggiornamento (riga «${MARCATORE_AGGANCIO}») — il`
    + ' wrapper deve misurare la freschezza del codice che sta per eseguire, non lasciarla a un'
    + ' lancio manuale che non fa nessuno',
    w.testo.includes(MARCATORE_AGGANCIO),
  );
  // E DEVE POTER ARRIVARE al fast-forward. Un `git status --porcelain` nudo conta i file
  // non tracciati: in un checkout di lavoro ce ne sono sempre, quindi il wrapper si
  // ferma prima di provare, a ogni giro, e la meta' (B) resta verde mentendo (v. il
  // commento su STATUS_NUDO). Si pretende la forma esplicita.
  b.verifica(
    `scheduling/${w.nome}: la guardia dell'albero sporco esclude i file non tracciati`
    + ` («${STATUS_SICURO}») — con lo status nudo UN file non tracciato spegne`
    + " l'auto-aggiornamento per sempre, e il checkout puo' restare fresco per merito di un"
    + ' altro wrapper: nessun sintomo, e la meta\' (B) resta verde mentendo',
    w.codice.includes(STATUS_SICURO) && !STATUS_NUDO.test(w.codice),
  );
  // L'ORDINE: il fetch PRIMA della guardia sull'albero.
  const iFetch = w.codice.search(FETCH);
  const iGuardia = w.codice.search(GUARDIA);
  b.verifica(
    `scheduling/${w.nome}: \`git fetch origin\` viene PRIMA della guardia sull'albero sporco`
    + " — dentro il ramo condizionale un albero sporco lo salta, e la meta' (B) confronta HEAD"
    + " con un origin/main vecchio: e' cosi' che il 17/08 s46 ha detto «codice fresco» nove"
    + ' minuti dopo un merge. Il fetch e\' in sola lettura: non ha ragione di stare dietro'
    + " una condizione sull'albero",
    iFetch >= 0 && iGuardia >= 0 && iFetch < iGuardia,
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
