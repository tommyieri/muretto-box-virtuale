#!/usr/bin/env node
// test_feedback.mjs — la sentinella della buca delle segnalazioni.
//
//     node demo/test_feedback.mjs
//
// PERCHE' NASCE INSIEME ALLA PAGINA. La lezione del What-If (17/08/2026) e' scritta in
// CLAUDE.md e vale anche qui, tradotta: «quando nasce una pagina che produce numeri, la
// sua sentinella nasce con lei». Questa pagina non produce numeri — produce due cose che
// possono marcire nello stesso identico modo silenzioso:
//
//   1. UN CONTRATTO FRA DUE FILE. I tipi e i limiti vivono sia in demo/feedback.mjs (che
//      gira nel browser) sia in demo/api/feedback.js (che gira sul server). Se divergono,
//      il modulo NON si rompe: mostra cinque pillole e ne accetta quattro, e il guasto lo
//      scopre chi ha appena scritto dieci righe e si vede rispondere 400.
//
//   2. UNA PROMESSA CHE IL LETTORE NON PUO' VERIFICARE. La pagina dichiara in chiaro
//      l'elenco dei campi che partono. Il giorno che qualcuno aggiunge un campo alla
//      fetch e dimentica l'etichetta, quella dichiarazione diventa falsa — e nessuno
//      fuori da qui puo' accorgersene. E' il difetto peggiore del lotto: non si vede,
//      e riguarda dati di una persona.
//
// COSA CONTROLLA, e la parte B non e' una lettura del sorgente: FA GIRARE l'endpoint
// contro un finto Upstash e guarda le risposte vere.
//   A. contratto  — tipi e limiti coincidono fra browser e server; l'elenco dichiarato
//                   copre ogni campo che parte davvero
//   B. condotta   — l'endpoint accetta il buono, rifiuta il cattivo, frena il robot,
//                   non apre la lettura senza chiave
//   C. promesse   — l'IP non finisce MAI in cio' che resta scritto
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const QUI = path.dirname(fileURLToPath(import.meta.url));
let rosse = 0;
const esito = (ok, testo) => {
  if (!ok) rosse += 1;
  console.log(`${ok ? 'PASSA ' : 'FALLITO'}  ${testo}`);
};

const sorgentePagina = readFileSync(path.join(QUI, 'feedback.mjs'), 'utf8');
const sorgenteBuca = readFileSync(path.join(QUI, 'api', 'feedback.js'), 'utf8');
const sorgenteHtml = readFileSync(path.join(QUI, 'feedback.html'), 'utf8');

/* ================================================================ A. contratto */

// i tipi della pagina: const TIPI = [ ['rotto', '…'], … ]
const tipiPagina = [...(sorgentePagina.match(/const TIPI = \[([\s\S]*?)\n\];/)?.[1] ?? '')
  .matchAll(/\[\s*'([^']+)'/g)].map(m => m[1]);
// i tipi della buca: const TIPI = new Set([...])
const tipiBuca = [...(sorgenteBuca.match(/const TIPI = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '')
  .matchAll(/'([^']+)'/g)].map(m => m[1]);

esito(tipiPagina.length >= 3, `la pagina dichiara i suoi tipi (${tipiPagina.length})`);
esito(tipiBuca.length >= 3, `la buca dichiara i suoi tipi (${tipiBuca.length})`);
esito(tipiPagina.join(',') === tipiBuca.join(','),
  'i tipi della pagina e quelli della buca sono gli stessi, nello stesso ordine'
  + (tipiPagina.join(',') === tipiBuca.join(',') ? ''
     : `\n           pagina: ${tipiPagina.join(', ')}\n           buca:   ${tipiBuca.join(', ')}`));

const numero = (testo, nome) => {
  const m = testo.match(new RegExp(`const ${nome}\\s*=\\s*(\\d+)`));
  return m ? parseInt(m[1], 10) : null;
};
for (const lim of ['TESTO_MIN', 'TESTO_MAX']) {
  const a = numero(sorgentePagina, lim), b = numero(sorgenteBuca, lim);
  esito(a != null && a === b,
    `${lim} vale lo stesso di qua e di la' (pagina: ${a}, buca: ${b})`);
}
// e il tetto del browser deve essere quello dichiarato, altrimenti il testo si tronca
// in silenzio a meta' di una frase — e chi scrive non lo sa.
esito(new RegExp(`maxlength="${numero(sorgentePagina, 'TESTO_MAX')}"`).test(sorgenteHtml),
  'il campo del testo in pagina porta lo stesso tetto di caratteri');

// --- l'elenco dichiarato copre tutto quello che parte ------------------------------
//
// I campi che partono si leggono dal corpo VERO della fetch; le etichette dal blocco
// della trasparenza. Fra i due c'e' UNA corrispondenza dichiarata (il campo si chiama
// `dove` per chi scrive e `pagina` per chi archivia) e UNA esenzione dichiarata (l'esca
// dei robot, che e' vuota per ogni essere umano). Tutto il resto deve combaciare.
const CORRISPONDENZE = { pagina: 'dove' };
const ESENTI = new Set(['campo_x']);

const corpoFetch = sorgentePagina.match(/body: JSON\.stringify\(\{([\s\S]*?)\n      \}\)/)?.[1] ?? '';
const inviati = [...corpoFetch.matchAll(/^\s{8}(\w+):/gm)].map(m => m[1]);
const etichettati = [...(sorgentePagina.match(/const ETICHETTE = \{([\s\S]*?)\n\};/)?.[1] ?? '')
  .matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]);

esito(inviati.length > 0 && etichettati.length > 0,
  `si leggono i campi spediti (${inviati.length}) e quelli dichiarati (${etichettati.length})`);

const dichiarato = (c) => etichettati.includes(CORRISPONDENZE[c] ?? c);
const taciuti = inviati.filter(c => !ESENTI.has(c) && !dichiarato(c));
esito(taciuti.length === 0,
  'ogni campo che parte e\' dichiarato al lettore nel blocco della trasparenza'
  + (taciuti.length ? ` — TACIUTI: ${taciuti.join(', ')}. Il blocco «che cosa parte da qui» `
     + 'sta mentendo, ed e\' l\'unica promessa che il lettore non puo\' verificare da solo.' : ''));

const inverso = Object.fromEntries(Object.entries(CORRISPONDENZE).map(([a, b]) => [b, a]));
const promessiMaiSpediti = etichettati.filter(e => !inviati.includes(inverso[e] ?? e));
esito(promessiMaiSpediti.length === 0,
  'nessuna etichetta annuncia un campo che poi non parte'
  + (promessiMaiSpediti.length ? ` — annunciati a vuoto: ${promessiMaiSpediti.join(', ')}` : ''));

// l'esca deve esistere in tutti e tre i posti, o non e' un'esca
esito(/id="campo_x"\s+name="campo_x"/.test(sorgenteHtml)
  && /\$\('#campo_x'\)\.value/.test(sorgentePagina)
  && /b\.campo_x/.test(sorgenteBuca),
  'l\'esca per i robot esiste in pagina (id E name), viene spedita e viene guardata dalla buca '
  + '— se l\'id non combaciasse, $(\'#campo_x\') sarebbe null e l\'invio esploderebbe per tutti');
esito(!/display:\s*none/.test(sorgenteHtml.match(/\.fb-esca\{[^}]*\}/)?.[0] ?? ''),
  'l\'esca e\' fuori schermo e non `display:none` (certi robot saltano proprio quelli nascosti)');

/* ================================================================= B. condotta */
//
// Da qui in poi non si legge piu' il sorgente: si fa girare l'endpoint. Il finto Upstash
// e' minuscolo ma fedele nei comandi che la buca usa davvero — se domani ne usasse uno in
// piu' senza insegnarlo qui, questo file diventa rosso invece di passare a vuoto.

const magazzino = new Map();
const liste = new Map();
let comandiVisti = 0;

function eseguiFinto([cmd, ...arg]) {
  comandiVisti += 1;
  const c = String(cmd).toUpperCase();
  if (c === 'INCR') {
    const n = (parseInt(magazzino.get(arg[0]) ?? '0', 10) || 0) + 1;
    magazzino.set(arg[0], String(n)); return n;
  }
  if (c === 'SET') { magazzino.set(arg[0], arg[1]); return 'OK'; }
  if (c === 'GET') { return magazzino.get(arg[0]) ?? null; }
  if (c === 'EXPIRE') return 1;
  if (c === 'LPUSH') {
    const l = liste.get(arg[0]) ?? []; l.unshift(...arg.slice(1));
    liste.set(arg[0], l); return l.length;
  }
  if (c === 'LTRIM') {
    const l = liste.get(arg[0]) ?? [];
    liste.set(arg[0], l.slice(arg[1], arg[2] + 1)); return 'OK';
  }
  if (c === 'LRANGE') {
    const l = liste.get(arg[0]) ?? [];
    return l.slice(arg[1], arg[2] < 0 ? undefined : arg[2] + 1);
  }
  throw new Error(`comando che il finto Upstash non conosce: ${c}`);
}

const CHIAVE_PROVA = 'chiave-di-prova-non-e-un-segreto';
process.env.KV_REST_API_URL = 'https://finto.upstash';
process.env.KV_REST_API_TOKEN = 'finto';
process.env.FEEDBACK_CHIAVE = CHIAVE_PROVA;

globalThis.fetch = async (url, opz) => {
  if (!String(url).startsWith('https://finto.upstash')) throw new Error(`fetch fuori rotta: ${url}`);
  const comandi = JSON.parse(opz.body);
  const out = comandi.map(c => ({ result: eseguiFinto(c) }));
  return { ok: true, status: 200, json: async () => out };
};

const buca = createRequire(import.meta.url)('./api/feedback.js');

function finteRisposte() {
  const r = { stato: null, corpo: null };
  r.status = (n) => { r.stato = n; return r; };
  r.json = (o) => { r.corpo = o; return r; };
  r.end = () => r;
  return r;
}
async function chiama({ method = 'POST', query = {}, body = {}, ip = '203.0.113.7' } = {}) {
  const res = finteRisposte();
  await buca({ method, query, body, headers: { 'x-forwarded-for': ip } }, res);
  return res;
}
const lettera = (extra = {}) => ({
  tipo: tipiBuca[0], testo: 'Sulla pagina della gara il grafico del passo resta vuoto.',
  pagina: 'gara', schermo: '1280×800', navigatore: 'Firefox · computer', ...extra,
});

// --- la strada buona ---------------------------------------------------------------
{
  const r = await chiama({ body: lettera({ contatto: 'qualcuno@esempio.it' }) });
  esito(r.stato === 201 && Boolean(r.corpo?.id),
    `una segnalazione valida viene accettata e torna col protocollo (${r.stato}, id ${r.corpo?.id ?? '—'})`);

  const scritta = JSON.parse(magazzino.get(`muretto:fb:v:${r.corpo.id}`) ?? 'null');
  esito(scritta?.testo === lettera().testo, 'il testo archiviato e\' quello spedito, intero');
  esito(scritta?.stato === 'nuova', 'la segnalazione nasce «nuova»');
  esito((liste.get('muretto:fb:coda') ?? []).includes(r.corpo.id),
    'la segnalazione entra nella coda di lettura');
}

// --- quello che va rifiutato --------------------------------------------------------
{
  const r = await chiama({ body: lettera({ tipo: 'inventato' }) });
  esito(r.stato === 400, `un tipo che non esiste viene rifiutato (${r.stato})`);
}
{
  const r = await chiama({ body: lettera({ testo: 'boh' }) });
  esito(r.stato === 400, `un testo troppo corto viene rifiutato (${r.stato})`);
}
{
  const r = await chiama({ body: lettera({ contatto: 'non-e-una-email' }) });
  esito(r.stato === 400, `un'email malformata viene rifiutata (${r.stato})`);
}
{
  const r = await chiama({ method: 'GET', body: lettera() });
  esito(r.stato === 405, `una GET non scrive niente (${r.stato})`);
}

// --- il testo lungo si taglia al tetto, non oltre ------------------------------------
{
  const lungo = 'a'.repeat(5000);
  const r = await chiama({ body: lettera({ testo: lungo }), ip: '203.0.113.9' });
  const scritta = JSON.parse(magazzino.get(`muretto:fb:v:${r.corpo.id}`) ?? 'null');
  esito(scritta?.testo.length === numero(sorgenteBuca, 'TESTO_MAX'),
    `un testo oltre il tetto viene tagliato al tetto (${scritta?.testo.length} caratteri)`);
}

// --- l'esca: si risponde 201, e del messaggio del robot non resta niente ---------------
//
// L'INVARIANTE E' PIU' STRETTO DI «non scrive»: l'esca ADESSO scrive, ma una cosa sola —
// il contatore degli scatti, che e' l'unico strumento con cui possiamo accorgerci se
// l'esca sta prendendo persone vere invece di robot (un falso positivo li' e' muto: chi
// scrive vede una ricevuta e il messaggio non arriva). Quello che non deve restare da
// nessuna parte e' il MESSAGGIO: niente voce in coda, niente record, niente testo.
{
  const testoSpia = 'compra le mie pillole a poco prezzo, clicca qui subito';
  const quante = (liste.get('muretto:fb:coda') ?? []).length;
  const scattiPrima = parseInt(magazzino.get('muretto:fb:esca') ?? '0', 10) || 0;

  const r = await chiama({
    body: lettera({ testo: testoSpia, campo_x: 'https://spam.esempio' }), ip: '198.51.100.4' });
  esito(r.stato === 201, `al robot si risponde come a tutti (${r.stato})`);
  esito(/^[a-z0-9]{12,}$/.test(r.corpo?.id ?? ''),
    `e col protocollo nella forma di tutti gli altri (${r.corpo?.id}) — un id diverso `
    + 'insegnerebbe a chi scrive il robot come riconoscere di essere stato riconosciuto');

  esito((liste.get('muretto:fb:coda') ?? []).length === quante,
    'del messaggio del robot non resta una voce in coda');
  const tutto = [...magazzino.values()].join('\n') + [...liste.values()].flat().join('\n');
  esito(!tutto.includes(testoSpia), "e il suo testo non e' finito da nessuna parte");
  esito(!magazzino.has(`muretto:fb:v:${r.corpo.id}`),
    "il protocollo che gli e' stato dato non corrisponde a nessun record");

  const scattiDopo = parseInt(magazzino.get('muretto:fb:esca') ?? '0', 10) || 0;
  esito(scattiDopo === scattiPrima + 1,
    `lo scatto pero' viene contato (${scattiPrima} -> ${scattiDopo}): senza questo numero `
    + "un'esca che prende le persone sbagliate non la scoprirebbe nessuno");
}

// --- il freno: la settima in un'ora si ferma -------------------------------------------
{
  const ip = '192.0.2.55';
  const tetto = numero(sorgenteBuca, 'TETTO_ORA');
  let ultima = null;
  for (let i = 0; i < tetto + 1; i += 1) ultima = await chiama({ body: lettera(), ip });
  esito(ultima.stato === 429,
    `oltre il tetto di ${tetto} all'ora dallo stesso indirizzo si frena (${ultima.stato})`);
  // e un altro lettore non paga il freno di quello prima
  const altro = await chiama({ body: lettera(), ip: '192.0.2.56' });
  esito(altro.stato === 201, 'il freno e\' per indirizzo, non per tutti');
}

// --- la lettura e' chiusa a chiave -----------------------------------------------------
{
  const senza = await chiama({ method: 'GET', query: { leggi: '1' } });
  esito(senza.stato === 401, `leggere senza chiave non si puo' (${senza.stato})`);

  const sbagliata = await chiama({ method: 'GET', query: { leggi: '1', chiave: 'quasi-giusta' } });
  esito(sbagliata.stato === 401, `leggere con la chiave sbagliata non si puo' (${sbagliata.stato})`);

  const giusta = await chiama({ method: 'GET', query: { leggi: '1', chiave: CHIAVE_PROVA } });
  esito(giusta.stato === 200 && Array.isArray(giusta.corpo?.voci) && giusta.corpo.voci.length > 0,
    `con la chiave giusta si legge (${giusta.corpo?.voci?.length ?? 0} voci)`);

  // e segnare lavorato cambia lo stato, non cancella niente
  const id = giusta.corpo.voci[0].id;
  const segna = await chiama({ query: { fatto: id, chiave: CHIAVE_PROVA } });
  esito(segna.stato === 200, `si puo' segnare una segnalazione come lavorata (${segna.stato})`);
  const dopo = JSON.parse(magazzino.get(`muretto:fb:v:${id}`));
  esito(dopo.stato === 'fatto' && dopo.testo, 'segnata lavorata, e il testo e\' ancora li\'');

  const senzaChiave = await chiama({ query: { fatto: id } });
  esito(senzaChiave.stato === 401, `segnare lavorato senza chiave non si puo' (${senzaChiave.stato})`);
}

// --- lo stato si puo' chiedere senza chiave, ma non dice niente -------------------------
{
  const s = await chiama({ method: 'GET', query: { stato: '1' } });
  esito(s.stato === 200 && s.corpo?.attivo === true, 'la pagina puo' + '\' chiedere se la buca e\' aperta');
  esito(Object.keys(s.corpo).join(',') === 'attivo',
    'e la risposta sullo stato non contiene nient\'altro che «attivo»');
}

/* ================================================================= C. promesse */
//
// La promessa scritta in pagina e' che l'IP non resti da nessuna parte. Non si controlla
// leggendo il commento che lo promette: si guarda TUTTO quello che e' finito nel
// magazzino dopo le prove qui sopra, e ci si cerca dentro gli indirizzi usati.
{
  const tutto = [...magazzino.entries()].map(([k, v]) => `${k} ${v}`).join('\n')
    + '\n' + [...liste.entries()].map(([k, v]) => `${k} ${v.join(',')}`).join('\n');
  const usati = ['203.0.113.7', '203.0.113.9', '198.51.100.4', '192.0.2.55', '192.0.2.56'];
  const trapelati = usati.filter(ip => tutto.includes(ip));
  esito(trapelati.length === 0,
    'nessun indirizzo IP e\' finito in cio\' che resta scritto'
    + (trapelati.length ? ` — TRAPELATI: ${trapelati.join(', ')}` : ''));

  // e le chiavi del freno devono essere impronte, cioe' esadecimale e basta
  const freni = [...magazzino.keys()].filter(k => k.startsWith('muretto:fb:rl:'));
  esito(freni.length > 0 && freni.every(k => /^muretto:fb:rl:[0-9a-f]{16}$/.test(k)),
    `il freno lavora su impronte cifrate, non su indirizzi (${freni.length} impronte)`);

  // il record archiviato: nessun campo oltre a quelli previsti
  const AMMESSI = new Set(['id', 'tipo', 'testo', 'pagina', 'contatto', 'schermo',
    'navigatore', 'ricevuta_il', 'stato', 'chiusa_il']);
  const voci = [...magazzino.entries()].filter(([k]) => k.startsWith('muretto:fb:v:'))
    .map(([, v]) => JSON.parse(v));
  const intrusi = [...new Set(voci.flatMap(v => Object.keys(v)))].filter(k => !AMMESSI.has(k));
  esito(intrusi.length === 0,
    `il record archiviato non porta campi imprevisti (${voci.length} record controllati)`
    + (intrusi.length ? ` — intrusi: ${intrusi.join(', ')}` : ''));
}

console.log(rosse === 0
  ? '\nsentinella feedback: tutto verde — contratto, condotta e promesse.'
  : `\nsentinella feedback: ${rosse} asserzioni rosse.`);
process.exit(rosse === 0 ? 0 : 1);
