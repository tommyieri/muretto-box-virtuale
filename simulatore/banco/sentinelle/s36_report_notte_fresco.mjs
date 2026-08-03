#!/usr/bin/env node
// s36_report_notte — IL DOCUMENTO CHE DICE «TUTTO BENE» PUO' AVERLO DETTO UN MESE FA.
//
// `banco/REPORT_NOTTE.md` e' il documento-verita' della corsa notturna: dice se le
// sentinelle passano, se i cancelli pre-registrati tengono, se le misure sono peggiorate.
// Lo scrive `notte.mjs`, che esce 1 su regressione — quindi finche' gira, e' affidabile.
//
// IL BUCO. Un report non ha modo di dire quando e' vecchio. Se `notte.mjs` smette di
// girare — nessuno lo ha schedulato, un errore lo ferma, qualcuno lo commenta — il file
// resta li' con le sue righe verdi e continua a rassicurare chi lo apre. E' esattamente il
// difetto che il 02/08 e' stato trovato su altri due documenti-verita', che divergevano dai
// sigilli senza che nessuno potesse accorgersene: un documento che non puo' invecchiare in
// modo visibile e' un documento che prima o poi mente.
//
// KPI I2 di ai_lab/KPI_5_4_4.md: «nessun documento-verita' puo' divergere dai sigilli —
// CLAUDE.md fatto; REPORT_NOTTE.md con sentinella di freschezza».
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il report NON ESISTE: la corsa notturna non e' mai stata eseguita, o il suo esito
//      non e' committato. Un documento-verita' assente non e' neutro — e' l'unico stato in
//      cui nessuno puo' accorgersi che manca;
//  (b) il report non porta una data leggibile: non si puo' dire se sia fresco;
//  (c) la data e' piu' vecchia di GIORNI_MAX: il documento c'e' e non e' piu' vero.
//
// LA SOGLIA E' 8 GIORNI, e la ragione e' il calendario di questo progetto, non un numero
// tondo: fra due Gran Premi passano di norma una o due settimane, e la corsa notturna ha
// senso almeno una volta per fine settimana di gara. Otto giorni lasciano passare una
// notte saltata e fanno rumore alla seconda.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { banco } from '../asserzioni.mjs';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = path.join(radice, 'banco', 'REPORT_NOTTE.md');
const GIORNI_MAX = 8;

const b = banco('s36');

const esiste = existsSync(REPORT);
b.verifica(
  'banco/REPORT_NOTTE.md esiste — se manca, la corsa notturna non gira e nessun documento'
  + ' lo dice: `npm run notte` dentro simulatore/, e il suo esito si committa',
  esiste,
);

if (esiste) {
  const testo = readFileSync(REPORT, 'utf8');
  // notte.mjs scrive «Corsa del **<ISO>**» come prima riga di corpo (notte.mjs:93)
  const m = testo.match(/Corsa del \*\*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z)\*\*/);
  b.verifica(
    'il report porta la sua data in una forma leggibile («Corsa del **<ISO>**»)'
    + ' — un documento senza data non puo\' essere dichiarato fresco ne\' vecchio',
    Boolean(m),
  );
  if (m) {
    const giorni = Math.floor((Date.now() - Date.parse(m[1])) / 86400000);
    b.verifica(
      `la corsa notturna non e' piu' vecchia di ${GIORNI_MAX} giorni (ultima: ${m[1].slice(0, 10)},`
      + ` ${giorni} giorni fa) — se e' rossa, o si rilancia la notturna, o si scrive perche' no`,
      giorni <= GIORNI_MAX,
    );
  }
}

b.chiudi();
