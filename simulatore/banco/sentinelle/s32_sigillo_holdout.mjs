// s32_sigillo_holdout — il sigillo dell'holdout non deve marcire in silenzio.
//
// PERCHE' ESISTE, ed e' costata quasi il primo fuori campione del progetto.
//
// `ai_lab/confronto/PREREG_holdout_Olanda.md` impone alla regola 4: «Prima di misurare
// si verifica che i due sha256 siano ancora quelli. Se sono cambiati, l'esito e' NON
// GIUDICABILE e si dichiara perche'». E' la regola giusta — ma la verifica era prevista
// il giorno della gara, quando ormai non si puo' piu' fare niente.
//
// Il 02/08/2026, ventuno giorni prima di Zandvoort, il controllo e' stato fatto a mano
// per la prima volta: `modello_v2.json` era gia' cambiato due volte dopo la ri-firma
// (voce 4 del piano, e la chiusura di E21). Entrambe le modifiche sono legittime e del
// 01/08 — l'Olanda resta una gara che nessuno di quei numeri ha mai visto — ma la
// lettera della prereg avrebbe reso l'esito NON GIUDICABILE: il primo fuori campione
// vero del progetto annullato per contabilita' invece che per scienza.
//
// Questa sentinella sposta quel controllo dal giorno della gara a OGNI giro della suite.
// Un file sigillato che cambia diventa rosso lo stesso giorno, quando ri-firmare e'
// ancora legittimo — non la domenica, quando non lo e' piu'.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un file sigillato ha un contenuto diverso da quello firmato;
//  (b) un file sigillato non esiste piu';
//  (c) il sigillo non porta gli hash in forma leggibile da un programma (se stanno solo
//      nella prosa di un .md, nessuno li verifica e questa sentinella non serve a niente);
//  (d) l'elenco dei file sigillati e vuoto, o non copre i modelli che decidono la misura
//      (E09: un controllo che non guarda niente passa sempre);
//  (e) il sigillo e' `chiuso` ma senza data, oppure `aperto` con la gara gia' passata —
//      due modi diversi di avere un lucchetto che non chiude piu' niente.
//
// COSA QUESTA SENTINELLA NON PUO' FARE, e va saputo: non distingue una ri-firma
// legittima (prima della gara, con la ragione scritta) da una illegittima (dopo). Quella
// distinzione e' umana e sta nella targhetta del sigillo. Qui si garantisce solo che
// nessuno possa cambiare un modello sigillato SENZA ACCORGERSENE.

import { banco } from '../asserzioni.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s32');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dovSigillo = path.join(radice, '..', 'ai_lab', 'confronto', 'SIGILLO_holdout.json');

b.verifica('il sigillo dell\'holdout esiste', existsSync(dovSigillo));
if (!existsSync(dovSigillo)) { b.chiudi(); process.exit(1); }

const sigillo = JSON.parse(readFileSync(dovSigillo, 'utf8'));

// (e) il lucchetto e' in uno stato sensato
b.verifica('il sigillo dichiara uno stato', sigillo.stato === 'aperto' || sigillo.stato === 'chiuso');
b.verifica('il sigillo dichiara quale gara protegge', typeof sigillo.gara === 'string' && sigillo.gara.length > 0);
b.verifica('il sigillo dichiara la data della gara', /^\d{4}-\d{2}-\d{2}$/.test(sigillo.data_gara ?? ''));

// IL NOME DELLA GARA DEVE ESISTERE DAVVERO, e questa asserzione nasce da un collaudo.
//
// Il lucchetto in auto_gara.py (`_holdout_aperto`) confronta `sigillo.gara` con il nome che
// il ciclo post-gara riceve — che viene da `data/mappa_gare.json`, campo `nome`. Il
// confronto tollera maiuscole e spazi ma NON sinonimi: verificato a caldo il 03/08/2026,
// 'Olanda' -> True mentre 'Dutch Grand Prix', 'Dutch_Grand_Prix' e 'Paesi Bassi' -> False.
//
// Finora qui si chiedeva solo che `gara` fosse «una stringa non vuota»: un REFUSO sarebbe
// passato VERDE, e la domenica della gara il lucchetto avrebbe fallito APERTO — la
// ri-stima sarebbe partita e l'holdout si sarebbe bruciato da solo, in silenzio. Un
// guardiano che non confronta il nome col mondo reale non sta guardando niente.
{
  const mappa = JSON.parse(readFileSync(path.join(radice, '..', 'data', 'mappa_gare.json'), 'utf8'));
  const nomiNoti = new Set(Object.values(mappa).map((m) => m?.nome).filter(Boolean));
  b.verifica(
    `la gara del sigillo (${JSON.stringify(sigillo.gara)}) e' un nome che data/mappa_gare.json conosce`
    + ` — altrimenti il lucchetto fallisce APERTO il giorno della gara`,
    nomiNoti.has(sigillo.gara),
  );
}

// (e) IL SIGILLO APERTO CON LA GARA GIA' PASSATA. Il commento in testa a questo file
// prometteva questo controllo dal 02/08; nel codice non c'era — `data_gara` veniva
// validata solo come formato. Un sigillo che resta `aperto` dopo la gara significa che
// nessuno ha misurato l'holdout e che la ri-stima e' ferma: silenzioso e costoso.
// Tolleranza di due giorni: la misura si fa il giorno dopo, non la sera stessa.
{
  const oggi = new Date();
  const gara = new Date(`${sigillo.data_gara}T00:00:00Z`);
  const giorniDopo = Math.floor((oggi - gara) / 86400000);
  b.verifica(
    `il sigillo non e' rimasto APERTO con la gara gia' passata (gara ${sigillo.data_gara}, ${giorniDopo} giorni fa)`
    + ' — se e\' rosso: o si misura l\'holdout e si chiude, o si dichiara perche\' no',
    sigillo.stato !== 'aperto' || giorniDopo <= 2,
  );
}
if (sigillo.stato === 'chiuso') {
  b.verifica('un sigillo chiuso porta la data di chiusura', /^\d{4}-\d{2}-\d{2}$/.test(sigillo.chiuso_il ?? ''));
}

// (c)+(d) gli hash esistono, in forma leggibile da un programma, e coprono qualcosa
const hash = sigillo.hash_sigillati;
b.verifica('il sigillo porta gli hash in forma leggibile da un programma (non solo nella prosa)',
  hash !== null && typeof hash === 'object' && !Array.isArray(hash));
const voci = hash ? Object.entries(hash) : [];
b.verifica(`ci sono file sigillati da verificare (${voci.length})`, voci.length > 0);

// i modelli che DECIDONO la misura devono essere dentro: un sigillo che protegge solo i
// file innocui e' un ornamento. `pitloss_interno.json` e' qui perche' e' il file che da'
// a Zandvoort il suo pit-loss, ed era l'unico non sorvegliato.
for (const atteso of ['data/modelli/modello_v2.json', 'data/modelli/banda_rientro.json',
  'data/modelli/pitloss_interno.json']) {
  b.verifica(`${atteso} e' fra i file sigillati`, voci.some(([f]) => f === atteso));
}

// (a)+(b) il contenuto e' ancora quello firmato
for (const [rel, atteso] of voci) {
  const p = path.join(radice, rel);
  if (!existsSync(p)) { b.verifica(`${rel}: il file sigillato esiste ancora`, false); continue; }
  const reale = createHash('sha256').update(readFileSync(p)).digest('hex');
  b.uguale(`${rel}: il contenuto e' quello sigillato`, reale, atteso);
}

b.chiudi();
