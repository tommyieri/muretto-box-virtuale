#!/usr/bin/env node
// test_lingua.mjs — la sentinella delle DUE LINGUE.
//
//     node demo/test_lingua.mjs
//
// PERCHE' NASCE OGGI, insieme alla lingua. La regola di casa e' scritta in CLAUDE.md:
// «quando nasce una pagina che produce numeri, la sua sentinella nasce con lei». Qui non
// nascono numeri, nasce qualcosa che sbaglia nello stesso modo — in silenzio. Una chiave
// scritta a mano in un modulo e mai messa nel dizionario non fa cadere niente: `t()`
// restituisce la chiave e la pagina mostra `strat.quando_fermarsi` a un lettore vero.
// Una riga tradotta a meta' non fa cadere niente. Un testo inglese cambiato nell'HTML e
// non nel dizionario non fa cadere niente: semplicemente, da quel giorno, il sito dice
// due cose diverse a due lettori diversi. Sono tutti difetti che nessun test esistente
// puo' vedere, perche' nessuno di essi e' un errore di programma.
//
// COSA CONTROLLA
//   A. la FORMA del dizionario: ogni voce e' [inglese, italiano], due stringhe piene
//   B. ogni chiave USATA esiste — in `t()`, in `tn()`, e nei `data-i18n*` delle pagine
//   C. ogni chiave DICHIARATA e' usata da qualcuno (le chiavi morte sono debito)
//   D. l'inglese scritto nelle pagine e' LO STESSO che sta nel dizionario
//   E. il guscio monta il selettore in barra e nel piede, e la lingua principale e' 'en'
//   F. nessun testo italiano e' rimasto nei sorgenti vivi, fuori da quelli DICHIARATI
//
// COSA NON CONTROLLA, E VA DETTO: non apre un browser e non legge una traduzione. Sa che
// le due colonne ci sono e che nessuno le contraddice; se l'italiano di una riga fosse
// sbagliato, questo test resterebbe verde. Quella e' una lettura, non una verifica.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUI = path.dirname(fileURLToPath(import.meta.url));
let rosse = 0;
const esito = (ok, testo) => { if (!ok) rosse += 1; console.log(`${ok ? 'PASSA ' : 'FALLITO'}  ${testo}`); };

/* ------------------------------------------------------------------ i sorgenti */
const pagine = readdirSync(QUI).filter(f => f.endsWith('.html')).sort();
const articoli = existsSync(path.join(QUI, 'articolo'))
  ? readdirSync(path.join(QUI, 'articolo')).filter(f => f.endsWith('.html')).map(f => path.join('articolo', f))
  : [];
const moduli = readdirSync(QUI).filter(f => f.endsWith('.mjs') && !f.startsWith('test_'));
const leggi = (f) => readFileSync(path.join(QUI, f), 'utf8');

// I MODULI VIVI SONO QUELLI CHE UNA PAGINA RAGGIUNGE, e si calcolano invece di
// elencarli: un elenco a mano sarebbe una seconda verita' da tenere in pari, e questo
// repo ha gia' pagato sei volte il prezzo dei file orfani. Si parte dalle pagine e si
// segue ogni import — statico, dinamico, e il Worker, che e' un import travestito.
const RIF = /(?:from|import\(|Worker\()\s*[`'"]\.\/([A-Za-z0-9_]+)\.mjs|src="([A-Za-z0-9_]+)\.mjs/g;
function raggiungibili() {
  const visti = new Set(), coda = [...pagine];
  while (coda.length) {
    const f = coda.pop();
    let s;
    try { s = leggi(f); } catch { continue; }
    s = s.replace(/^\s*\/\/.*$/gm, '');
    for (const m of s.matchAll(RIF)) {
      const nome = (m[1] || m[2]) + '.mjs';
      if (!visti.has(nome) && moduli.includes(nome)) { visti.add(nome); coda.push(nome); }
    }
  }
  return [...visti].sort();
}
const vivi = raggiungibili();
const orfani = moduli.filter(m => !vivi.includes(m)).sort();

/* ================================================== A. la forma del dizionario */
const { D } = await import(path.join(QUI, 'dizionario.mjs'));
const chiavi = Object.keys(D);
esito(chiavi.length > 200, `il dizionario ha ${chiavi.length} voci`);

const storte = chiavi.filter((k) => {
  const v = D[k];
  return !Array.isArray(v) || v.length !== 2
    || typeof v[0] !== 'string' || typeof v[1] !== 'string'
    || !v[0].trim() || !v[1].trim();
});
esito(storte.length === 0,
  'ogni voce e\' [inglese, italiano], due stringhe piene'
  + (storte.length ? ` — storte: ${storte.slice(0, 8).join(', ')}` : ''));

// I BUCHI DA RIEMPIRE devono essere gli STESSI nelle due lingue. `{n}` di qua e `{num}`
// di la' non e' un refuso che si vede: e' una frase italiana con dentro `{num}` scritto
// per esteso, in pagina, davanti a chi legge.
const buchiDi = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const sbilanciate = chiavi.filter(k => Array.isArray(D[k]) && D[k].length === 2
  && buchiDi(String(D[k][0])) !== buchiDi(String(D[k][1])));
esito(sbilanciate.length === 0,
  'le due lingue di una voce hanno gli stessi buchi da riempire'
  + (sbilanciate.length ? ` — diverse: ${sbilanciate.slice(0, 8).join(', ')}` : ''));

/* ============================================== B/C. chiavi usate e chiavi morte */
//
// Alcune chiavi si compongono mentre il programma gira: `'mescola.' + sigla`,
// `'gp.' + nome`, `'sess.' + sigla`, `'nav.' + etichetta`. Non compaiono mai per
// intero in un sorgente, e cercarle come letterali le direbbe tutte morte. Si
// dichiarano qui per PREFISSO — ed e' una dichiarazione, non un condono: se un giorno
// il prefisso non lo usasse piu' nessuno, il controllo qui sotto sul CHIAMANTE se ne
// accorge lo stesso.
const PREFISSI_A_RUNTIME = [
  ['mescola.', "muro.mjs::mescola() la compone dalla sigla della gomma"],
  ['gp.',      "muro.mjs::gpNome() la compone dal nome del Gran Premio"],
  ['gpt.',     "muro.mjs::gpTitolo() la compone dal nome del Gran Premio"],
  ['sess.',    "telemetria.html e live.html la compongono dalla sigla di sessione"],
  ['nav.',     "muro.mjs::voce() la compone dall'etichetta di VOCI"],
  ['forza.n_', 'forza.html::nomeMetrica() la compone dal nome della metrica'],
];
const CHIAMANTI = {
  'mescola.': ["'mescola.' + String(sigla)", 'muro.mjs'],
  'gp.':      ["'gp.' + nome", 'muro.mjs'],
  'gpt.':     ["'gpt.' + (nome", 'muro.mjs'],
  'sess.':    ["t('sess.' + k)", null],
  'nav.':     ["t('nav.' + etichetta", 'muro.mjs'],
  'forza.n_': ["t('forza.n_' + k)", 'forza.html'],
};

// I COMMENTI NON CONTANO, e imparare a saltarli e' costato una rossa finta: in testa al
// dizionario c'era un ESEMPIO scritto come una chiave vera, e la sentinella lo ha letto
// come una chiave usata e mai dichiarata. Un test che legge anche cio' che non gira
// trova difetti che non esistono, e chi lo guarda impara a non fidarsi.
const senzaCommenti = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const sorgenti = [...pagine, ...articoli, ...vivi].filter(f => f !== 'dizionario.mjs');
const testoTutto = sorgenti.map(f => senzaCommenti(leggi(f))).join('\n');

// LE CHIAVI DICHIARATE SI CERCANO PER INTERO, non con una regex sulle virgolette.
// La regex c'e' stata, ed e' durata un'ora: l'italiano e' pieno di apostrofi — «dell'»,
// «un'», «l'unico» — e una scansione che apre una stringa al primo apostrofo che incontra
// si mangia tutto fino al successivo, chiavi comprese. Dichiarava morte undici voci che
// il sito usa a ogni caricamento. Cercare la chiave intera, fra virgolette, non puo'
// sbagliare: o quel testo c'e', o non c'e'.
const marcate = new Set();
for (const m of testoTutto.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) marcate.add(m[1]);
for (const m of testoTutto.matchAll(/data-i18n-attr="([^"]+)"/g)) {
  for (const coppia of m[1].split(';')) {
    const i = coppia.indexOf(':');
    if (i >= 0) marcate.add(coppia.slice(i + 1).trim());
  }
}
const usata = (k) => marcate.has(k)
  || testoTutto.includes(`'${k}'`) || testoTutto.includes(`"${k}"`);

// LE CHIAVI USATE MA NON DICHIARATE si cercano al contrario, e questa volta la regex ci
// vuole: una chiave che non esiste nel dizionario non si puo' cercare per nome. Il
// pettine e' ancorato a `t(` e a `tn(`, cosi' un apostrofo di passaggio non puo'
// inventare una corrispondenza — al massimo puo' farne perdere una, che e' l'errore
// dalla parte giusta.
const usate = new Set(marcate);
for (const m of testoTutto.matchAll(/(?<![\w$])tn?\(\s*'([^'\n]{2,80})'/g)) usate.add(m[1]);
for (const m of testoTutto.matchAll(/(?<![\w$])tn\(\s*'[^'\n]{2,80}'\s*,\s*'([^'\n]{2,80})'/g)) usate.add(m[1]);

const mancanti = [...usate].filter(k => !(k in D)
  && !PREFISSI_A_RUNTIME.some(([p]) => k === p || k === p.slice(0, -1)));
esito(mancanti.length === 0,
  `ogni chiave usata sta nel dizionario (${usate.size} usate)`
  + (mancanti.length ? `\n           assenti: ${mancanti.join(', ')}` : ''));

for (const [pre, perche] of PREFISSI_A_RUNTIME) {
  const [ago, dove] = CHIAMANTI[pre];
  const trovato = dove ? leggi(dove).includes(ago) : testoTutto.includes(ago);
  esito(trovato, `[runtime] il prefisso «${pre}» ha ancora il suo chiamante — ${perche}`);
}

const morte = chiavi.filter(k => !usata(k)
  && !PREFISSI_A_RUNTIME.some(([p]) => k.startsWith(p)));
esito(morte.length === 0,
  'nessuna voce del dizionario e\' morta'
  + (morte.length ? `\n           mai usate: ${morte.join(', ')}` : ''));

/* ====================================== D. l'inglese della pagina e' quello del dizionario */
//
// E' l'invariante che tiene in piedi tutto il resto. L'inglese vive in DUE posti — nel
// file HTML (dove lo legge chi non ha JavaScript, e i motori di ricerca) e nella prima
// colonna del dizionario (da dove lo rilegge `applica()` quando si torna dall'italiano).
// Se i due divergono, il sito dice una cosa a chi arriva e un'altra a chi cambia lingua
// due volte, e nessuno se ne accorge mai.
const spazi = (s) => s.replace(/\s+/g, ' ').trim();
const divergenti = [];
for (const f of [...pagine, ...articoli]) {
  const s = leggi(f);
  for (const m of s.matchAll(/<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const [, , chiave, dentro] = m;
    if (!(chiave in D)) continue;                     // gia' segnalato dal controllo B
    if (/<[a-z]/i.test(dentro)) continue;             // ha markup dentro: e' un caso da data-i18n-html
    if (spazi(dentro) !== spazi(D[chiave][0])) divergenti.push(`${f} · ${chiave}`);
  }
}
esito(divergenti.length === 0,
  "l'inglese scritto nelle pagine e' lo stesso del dizionario"
  + (divergenti.length ? `\n           divergono: ${divergenti.slice(0, 10).join('\n           ')}` : ''));

/* ==================================================== E. il guscio e la principale */
const muro = leggi('muro.mjs');
esito(/selettoreLingua\('barra'\)/.test(muro), 'il guscio monta il selettore nella barra');
esito(/selettoreLingua\('piede'\)/.test(muro), 'il guscio monta il selettore nel piede');
esito(/applica\(\);/.test(muro), 'il guscio applica la lingua al testo gia\' scritto nelle pagine');

const lingua = leggi('lingua.mjs');
esito(/export const PREDEFINITA = 'en';/.test(lingua),
  "la lingua principale del sito e' l'inglese");
esito(!/navigator\.language/.test(senzaCommenti(lingua)),
  'la lingua non si indovina dal browser (altrimenti «principale» non vorrebbe dire niente)');

for (const f of pagine) {
  esito(/<html lang="en">/.test(leggi(f)), `${f} nasce in inglese (<html lang="en">)`);
}
// gli articoli sono pagine inglesi con dentro un corpo italiano, e lo dichiarano
for (const f of articoli) {
  const s = leggi(f);
  esito(/<html lang="en">/.test(s) && /<article[^>]*\blang="it"/.test(s)
        && /class="avviso-lingua"/.test(s),
    `${f} e' una pagina inglese con corpo italiano dichiarato`);
}

/* ============================================== F. l'italiano rimasto, dichiarato */
//
// UN ELENCO CHE FA ROSSO NEI DUE VERSI, come demo/REGISTRO_SEZIONE.json e come
// simulatore/banco/ROSSE_DICHIARATE.json: se un file dichiarato guarisce, questo test
// esce 1 esattamente come se un file nuovo si sporcasse. Un registro che puo'
// invecchiare in silenzio smette di valere il giorno dopo che l'hai scritto.
//
// I MODULI ORFANI NON SONO QUI DENTRO. Non li raggiunge nessuna pagina, quindi il loro
// italiano non lo legge nessuno: tradurli sarebbe lavoro su codice morto, e — peggio —
// darebbe l'impressione di una copertura che non c'e'. Se uno di loro tornasse vivo, il
// calcolo di `raggiungibili()` lo farebbe entrare in questo controllo da solo, e da rosso.
const ITALIANO_DICHIARATO = {
  'ponte_live.mjs': "le targhette di LIMITI_LIVE: sono provenienza, come quelle del kernel, e nessuna pagina le stampa",
  'mappa.mjs': "il testo di un'eccezione interna (pista non disponibile), che finisce in console",
  'muretto_worker.mjs': "il messaggio d'errore del worker verso il thread principale",
  'hero.mjs': "i due errori del caricatore di GSAP: la hero li prende e li scrive in console (`[hero] animazione non disponibile`), non in pagina",
};
const IT = /[àèéìòù]|\b(il|lo|la|le|gli|un'|una|del|della|delle|dei|che|non|per|con|dal|dalla|sul|sulla|nel|nella|questo|questa|ogni|solo|anche|quando|dove|più|già|giro|giri|gara|gare|sosta|soste|gomma|gomme|pilota|piloti|squadra)\b/i;

/** LE STRINGHE DI UN SORGENTE, contate a mano invece che con una regex.
 *
 *  La regex qui e' pericolosa per la stessa ragione di prima, al contrario: l'italiano
 *  ha apostrofi dappertutto, e un pettine sulle virgolette apre una stringa dove non ce
 *  n'e' nessuna e ne segnala il contenuto come testo. Camminando sui caratteri, invece,
 *  una virgoletta dentro una stringa aperta con l'altro segno resta quello che e' —
 *  un carattere.
 *
 *  LE GRAFFE DENTRO `${...}` SI CONTANO, e questa riga e' costata una rossa finta:
 *  `${sosp ? ` · ${t('x', { n: sosp })}` : ''}` ha un oggetto letterale dentro
 *  l'interpolazione, e chiudere al primo `}` faceva credere allo scanner di essere
 *  tornato dentro la stringa a meta' del codice. Ne usciva un pezzo di sorgente
 *  segnalato come testo italiano.
 *
 *  Torna, per ogni stringa, anche i caratteri che la precedono: servono a capire dove
 *  finisce — in pagina, in console, o dentro un confronto. */
function stringheDi(src) {
  const out = [];
  let i = 0;
  const salta = (apre) => {            // salta una stringa annidata, torna l'indice dopo
    let j = i + 1;
    while (j < src.length) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === apre) return j + 1;
      if (src[j] === '\n' && apre !== '`') return j;
      j += 1;
    }
    return j;
  };
  while (i < src.length) {
    const c = src[i], p = src[i - 1] ?? '';
    if ((c === "'" || c === '"' || c === '`') && !/[\w$]/.test(p)) {
      const pre = src.slice(Math.max(0, i - 28), i);
      let j = i + 1, buf = '', graffe = 0;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (graffe > 0) {                                   // dentro ${ … }
          if (d === '{') graffe += 1;
          else if (d === '}') graffe -= 1;
          else if (d === "'" || d === '"' || d === '`') { const k = i; i = j; j = salta(d); i = k; continue; }
          j += 1; continue;
        }
        if (c === '`' && d === '$' && src[j + 1] === '{') { graffe = 1; buf += '\u0001'; j += 2; continue; }
        if (d === c) { j += 1; break; }
        if (d === '\n' && c !== '`') break;
        buf += d; j += 1;
      }
      out.push({ v: buf, pre });
      i = j; continue;
    }
    i += 1;
  }
  return out;
}

// Cosa NON e' testo per un lettore, anche quando somiglia all'italiano:
//   · una parola sola          -> quasi sempre una chiave, un id, un campo, una sigla
//   · `attr:chiave`            -> la sintassi di data-i18n-attr
//   · un indirizzo, un selettore, un nome di file
//   · un elenco di tag separati da virgola (i temi degli articoli)
//   · del markup: `class="tw-gomma"` e `data-giro` contengono «gomma» e «giro» ma sono
//     nomi di classi e di attributi. I tag si tolgono PRIMA di cercare l'italiano —
//     senza, il test segnalava due righe di HTML e nessuna delle due era testo.
// Un PERCORSO non e' una frase, anche quando ha dentro «giri»: `data/giri/…json` e'
// l'indirizzo di un artefatto, e il segno del buco lo faceva sembrare testo. La regola
// guarda l'estensione ovunque si trovi, non solo in testa.
const NONTESTO = /^(?:https?:|[.#/-])|[\w/-]+\.(?:mjs|json|css|png|svg|html|xml)\b/;
const SINTASSI = /^[a-z-]+:[a-z0-9_.]+$/i;
const senzaTag = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
// IL BUCO DI UN'INTERPOLAZIONE LASCIA UN SEGNO, e non e' un dettaglio: `giro ${L}` senza
// il segno diventa «giro», una parola sola, e la regola «una parola sola non e' una
// frase» lo lasciava passare. Era una riga vera — l'intestazione della torre nella
// pagina-gara, che ha continuato a dire GIRO in un sito inglese finche' non l'ho vista
// a schermo. Col segno diventa «giro ¤», che di parole ne ha due.
const SEGNO_BUCO = /\u0001/g;

// DOVE FINISCE LA STRINGA. `console.warn('il motore e caduto')` non lo legge nessun
// visitatore: lo legge chi apre la consolle, che siamo noi. E `err.message.includes('non
// ha una cella')` non e' un testo da mostrare — e' un CONFRONTO con il testo che il
// kernel produce, e tradurlo lo spezzerebbe. Le due cose si riconoscono da cosa hanno
// davanti, ed e' l'unico modo di distinguerle senza chiedere a chi scrive di ricordarsene.
const NON_IN_PAGINA = /(?:console\.\w+|\.includes|\.startsWith|\.endsWith|\.indexOf|\.match|\.test|\.warn|\.error)\(\s*$/;

function testoVeroIt(x) {
  const s = senzaTag(String(x.v)).replace(SEGNO_BUCO, ' ¤ ').replace(/\s+/g, ' ').trim();
  // il percorso si riconosce SENZA il segno del buco: `data/giri/¤__¤.json` non e' piu'
  // un percorso a guardarlo, ma `data/giri/__.json` si'
  const grezzo = String(x.v).replace(SEGNO_BUCO, '');
  if (!s.includes(' ')) return false;              // una parola sola non e' una frase
  if (NONTESTO.test(s) || NONTESTO.test(grezzo) || SINTASSI.test(s)) return false;
  if (s.split(',').length > 2 && !/[.!?;:]/.test(s)) return false;   // elenco di tag
  if (x.v in D || s in D) return false;
  if (PREFISSI_A_RUNTIME.some(([p]) => s.startsWith(p))) return false;
  if (NON_IN_PAGINA.test(x.pre)) return false;
  return IT.test(s);
}

/** Il testo che si legge in pagina e che NON porta una chiave.
 *  E' l'altra meta' del problema: un modulo puo' avere zero stringhe italiane e la
 *  pagina averne una scritta a mano nell'HTML, senza `data-i18n`, che nessuno tradurra'
 *  mai perche' nessuno sa che c'e'. */
function testoScopertoIn(f) {
  let s = leggi(f);
  // IL BLOCCO DEGLI ARTICOLI SI TOGLIE PER PRIMO, prima dei commenti: e' delimitato da
  // due commenti (ELENCO:INIZIO/FINE), e togliendo i commenti si perdono i confini
  // insieme a loro — il blocco restava, e dodici titoli d'articolo finivano segnalati
  // come testo non tradotto. E' CONTENUTO italiano, scritto da
  // ai_lab/redazione/statico.py, e la pagina lo dichiara con .avviso-lingua.
  s = s.replace(/<!-- ELENCO:INIZIO[\s\S]*?ELENCO:FINE -->/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '')
       .replace(/<script[\s\S]*?<\/script>/g, '')
       .replace(/<style[\s\S]*?<\/style>/g, '');
  // via i nodi che una chiave ce l'hanno: quelli sono a posto per costruzione
  s = s.replace(/<([a-z0-9]+)\b[^>]*\bdata-i18n(?:-html)?="[^"]*"[^>]*>[\s\S]*?<\/\1>/g, '');
  const fuori = [];
  for (const m of s.matchAll(/>([^<>]{4,300})</g)) {
    const v = m[1].replace(/\s+/g, ' ').trim();
    if (v.includes(' ') && IT.test(v) && !NONTESTO.test(v)) fuori.push(v.slice(0, 70));
  }
  return fuori;
}

function italianoIn(f) {
  const src = senzaCommenti(leggi(f));
  // nelle pagine si guardano solo gli script: il markup lo guarda testoScopertoIn()
  const js = f.endsWith('.html')
    ? [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n')
    : src;
  const fuori = stringheDi(js).filter(testoVeroIt).map(x => x.v.slice(0, 70));
  if (f.endsWith('.html')) fuori.push(...testoScopertoIn(f));
  return [...new Set(fuori)];
}

for (const f of [...pagine, ...vivi]) {
  if (f === 'dizionario.mjs') continue;               // e' il posto dell'italiano
  const fuori = italianoIn(f);
  const dichiarato = f in ITALIANO_DICHIARATO;
  if (dichiarato) {
    esito(fuori.length > 0,
      `[dichiarato] ${f} ha ancora italiano — ${ITALIANO_DICHIARATO[f]}`
      + (fuori.length ? '' : "\n           NON NE HA PIU': la voce va tolta da ITALIANO_DICHIARATO"));
  } else {
    esito(fuori.length === 0,
      `${f} non ha testo italiano fuori dal dizionario`
      + (fuori.length ? `\n           trovato: ${fuori.slice(0, 6).map(x => JSON.stringify(x)).join('\n           ')}` : ''));
  }
}
for (const f of Object.keys(ITALIANO_DICHIARATO)) {
  esito(vivi.includes(f) || pagine.includes(f),
    `[dichiarato] ${f} e' ancora un file vivo — se e' diventato orfano, la voce va tolta`);
}

console.log(`\nmoduli vivi: ${vivi.length} · orfani (non tradotti, e non li legge nessuno): ${orfani.length}`);
console.log(rosse === 0
  ? 'sentinella lingua: tutto verde — due colonne, nessuna chiave orfana, nessun italiano di contrabbando.'
  : `sentinella lingua: ${rosse} ROSSE`);
process.exit(rosse === 0 ? 0 : 1);
