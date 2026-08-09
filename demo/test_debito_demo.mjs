#!/usr/bin/env node
// test_debito_demo.mjs — il registro del debito pubblicato e' uno SPECCHIO, non un desiderio.
//
//     node demo/test_debito_demo.mjs
//
// PERCHE'. demo/DEBITO_DEMO.json elenca cose che nel sito sono in uno stato diverso da
// quello che qualcuno aveva deciso. Un elenco del genere, se nessuno lo verifica, marcisce
// in due direzioni opposte e sono entrambe silenziose: (a) il debito viene saldato e la
// voce resta, e allora il registro racconta un guasto che non c'e' piu'; (b) il debito
// cambia forma e la voce non lo descrive piu'. In tutti e due i casi si smette di potersi
// fidare del registro — che e' precisamente il modo in cui e' nato il debito n.1: gli
// scenari della PR #64 hanno smesso di essere renderizzati e NESSUN documento lo diceva.
//
// COSA LO FA USCIRE 1:
//  (a) il file dell'accensione non contiene piu' la riga dichiarata (l'accensione e' stata
//      tolta o riscritta: la voce va aggiornata o rimossa, con una decisione);
//  (b) una pagina che il registro dichiara «non lo importa» ha ricominciato a importarlo
//      (il debito e' saldato: la voce va rimossa, e la cosa merita di essere vista);
//  (c) un file dichiarato nella guardia non esiste;
//  (c-bis) una cosa dichiarata SPENTA e' tornata accesa: `non_deve_contenere` sorveglia il
//      verso opposto — non «l'accensione c'e' ancora» ma «lo spegnimento regge». Serve
//      quando il PO decide di togliere qualcosa: senza, la decisione vale finche' nessuno
//      la rimette per sbaglio, e nessuno se ne accorge;
//  (d) una voce senza `referto` o senza `guardia` — come in ROSSE_DICHIARATE, una voce che
//      nessun documento spiega non e' una decisione, e' un difetto smesso di guardare.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..');
const REGISTRO = path.join(QUI, 'DEBITO_DEMO.json');

let rosse = 0;
const esito = (ok, testo) => {
  if (!ok) rosse += 1;
  console.log(`${ok ? 'PASSA ' : 'FALLITO'}  ${testo}`);
};

const reg = JSON.parse(readFileSync(REGISTRO, 'utf8'));
esito(Array.isArray(reg.voci), 'il registro ha un elenco di voci');

for (const v of reg.voci ?? []) {
  const eti = `[${v.id}]`;
  esito(Boolean(v.referto), `${eti} porta un referto`);
  esito(Boolean(v.guardia), `${eti} porta una guardia verificabile`);
  if (!v.guardia) continue;
  const g = v.guardia;

  // GUARDIA DELEGATA. Alcune voci non si verificano leggendo una stringa in un file: i
  // campi orfani della vista si verificano RENDENDO la pagina, e quel lavoro lo fa
  // `simulatore/web/censimento_vista.mjs --verifica` (KPI P1), che esce 1 in entrambi i
  // versi. Qui si controlla che la delega sia esplicita e che il verificatore esista
  // davvero — una delega a uno strumento che non c'e' sarebbe una voce senza guardia con
  // l'aria di averne una.
  // GUARDIA SUI DUPLICATI. «Ogni duplicato in demo/ e' a registro con referto» (KPI I3)
  // non basta come frase: se il registro nomina due file che devono restare uguali, questo
  // test li confronta BYTE PER BYTE. Cosi' una gara nuova che aggiorni una copia sola
  // diventa rossa qui, invece di diventare due verita' diverse mesi dopo.
  if (Array.isArray(g.duplicati_byte_identici)) {
    for (const [a, bb] of g.duplicati_byte_identici) {
      const pa = path.join(RADICE, a); const pb = path.join(RADICE, bb);
      if (!existsSync(pa) || !existsSync(pb)) {
        esito(false, `${eti} un lato del duplicato non esiste: ${a} / ${bb}`);
        continue;
      }
      esito(readFileSync(pa).equals(readFileSync(pb)),
        `${eti} ${a} e ${bb} sono ancora byte-identici `
        + '— se divergono, il motore e il sito leggono due tabelle diverse (E12)');
    }
    continue;
  }

  // GUARDIA A ROVESCIO: una cosa SPENTA per decisione deve restare spenta.
  if (Array.isArray(g.non_deve_contenere)) {
    const f = path.join(RADICE, g.file_spento);
    if (!existsSync(f)) {
      esito(false, `${eti} il file dichiarato spento non esiste: ${g.file_spento}`);
      continue;
    }
    const testo = readFileSync(f, 'utf8');
    for (const ago of g.non_deve_contenere) {
      esito(!testo.includes(ago),
        `${eti} ${g.file_spento} NON contiene piu' «${ago}» `
        + '— se lo contenesse, qualcuno avrebbe riacceso cio\' che il PO ha spento');
    }
    continue;
  }

  if (g.verificata_da) {
    for (const chiave of ['verificata_da', 'verificata_anche_da']) {
      if (!g[chiave]) continue;
      const file = g[chiave].split(' ')[0];
      esito(existsSync(path.join(RADICE, file)),
        `${eti} il verificatore delegato esiste: ${file}`);
    }
    esito(Array.isArray(g.campi) && g.campi.length > 0,
      `${eti} la delega elenca i campi che sorveglia (${g.campi?.length ?? 0})`);
    continue;
  }

  // (a) l'accensione dichiarata esiste ancora nel codice
  const acc = path.join(RADICE, g.file_accensione);
  if (!existsSync(acc)) {
    esito(false, `${eti} il file dell'accensione non esiste: ${g.file_accensione}`);
    continue;
  }
  const testo = readFileSync(acc, 'utf8');
  esito(testo.includes(g.deve_contenere),
    `${eti} ${g.file_accensione} contiene ancora «${g.deve_contenere}» `
    + '— se non lo contiene, l\'accensione e\' cambiata e la voce va decisa di nuovo');

  // (b) le pagine dichiarate continuano a NON importarlo
  for (const rel of g.pagine_che_non_devono_importarlo ?? []) {
    const p = path.join(RADICE, rel);
    if (!existsSync(p)) { esito(false, `${eti} pagina dichiarata assente: ${rel}`); continue; }
    const importa = readFileSync(p, 'utf8').includes(g.import_atteso);
    esito(!importa,
      `${eti} ${rel} NON importa ${g.import_atteso} `
      + '— se lo importasse, il debito sarebbe saldato e questa voce andrebbe tolta');
  }
}

console.log(rosse === 0
  ? `\ndebito demo: ${reg.voci.length} voce/i, tutte ancora vere.`
  : `\ndebito demo: ${rosse} asserzioni rosse — il registro non descrive piu' la realta'.`);
process.exit(rosse === 0 ? 0 : 1);
