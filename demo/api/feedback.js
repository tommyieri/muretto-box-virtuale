// feedback.js — la buca delle lettere del sito: l'utente scrive che cosa non va, noi leggiamo.
//
// PERCHE' ESISTE. Il sito va live e nessuno di noi lo usera' come lo usera' un estraneo.
// Un difetto che il lettore vede e non puo' dire e' un difetto che non esiste per noi:
// questa e' l'unica strada per cui un guasto trovato da fuori arriva fino a una riga di
// codice. Non e' un modulo di contatto: e' strumentazione del prodotto.
//
// PRIVACY, DETTA COM'E'. Qui, a differenza del contatore, entra TESTO SCRITTO DA UNA
// PERSONA, e puo' entrare un indirizzo email se il lettore lo lascia. Quindi la regola
// «non entra niente» non basta piu' e va sostituita da tre garanzie verificabili:
//   1. il lettore vede in pagina l'elenco esatto dei campi che partono, prima di premere;
//   2. l'email e' FACOLTATIVA e serve a una cosa sola (rispondere), e lo si scrive;
//   3. l'IP non e' mai a riposo: per il tetto anti-abuso si conserva un'impronta
//      sha256(sale + ip) che scade in un'ora, e il sale e' la chiave di lettura.
// L'IP transita nei log Vercel come per qualunque richiesta web, e questo codice non lo usa.
//
// LA LETTURA E' CHIUSA A CHIAVE, e senza chiave NON si apre: se FEEDBACK_CHIAVE manca,
// l'endpoint di lettura risponde 503 invece di rispondere in chiaro. Il verso sbagliato di
// questo interruttore pubblicherebbe le segnalazioni di tutti — compresi gli indirizzi email.
//
// Storage: Upstash Redis via REST (fetch puro, zero dipendenze), lo stesso di contatore.js.
// Env attese:
//   KV_REST_API_URL / KV_REST_API_TOKEN  oppure  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   FEEDBACK_CHIAVE  — segreto scelto da noi, serve SOLO a leggere e a segnare lavorato
//
// API:
//   POST /api/feedback                          body JSON -> {id} 201
//   GET  /api/feedback?leggi=1&chiave=…&n=100   -> elenco, dal piu' recente
//   GET  /api/feedback?fatto=<id>&chiave=…      -> segna la voce come lavorata
//   GET  /api/feedback?stato=1                  -> {attivo:true|false}, senza dati: serve
//                                                  alla pagina per non promettere una buca
//                                                  che non c'e'.

const { createHash, timingSafeEqual } = require('node:crypto');

const URL_KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN  = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CHIAVE = process.env.FEEDBACK_CHIAVE || '';

// I TIPI SONO UN INSIEME CHIUSO, e il motivo non e' l'ordine: e' che un campo libero in
// piu' e' un campo in piu' da ripulire prima di renderlo. Quello che il lettore ha da dire
// sta in `testo`; questo serve solo a smistare.
const TIPI = new Set(['rotto', 'sbagliato', 'oscuro', 'manca', 'idea']);

const TESTO_MIN = 10;      // sotto, non e' una segnalazione: e' una prova del modulo
const TESTO_MAX = 2000;
const CONTATTO_MAX = 120;
const PAGINA_MAX = 120;
const TETTO_ORA = 6;       // segnalazioni per impronta-IP in un'ora
const CODA_MAX = 500;      // quante ne tiene l'indice (i valori scadono da soli)
const VITA = 60 * 60 * 24 * 365;   // un anno

const CHIAVI = {
  coda: 'muretto:fb:coda',
  tot:  'muretto:fb:tot',
  voce: (id) => `muretto:fb:v:${id}`,
  esca: 'muretto:fb:esca',
  rl:   (impronta) => `muretto:fb:rl:${impronta}`,
};

async function pipeline(comandi) {
  const r = await fetch(`${URL_KV}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandi),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  return r.json(); // [{result:...}, ...]
}

/** Confronto a tempo costante su due segreti di lunghezza qualunque: si confrontano i
 *  digest, che sono sempre 32 byte. Un `a === b` qui perde informazione a ogni tentativo. */
function stessaChiave(data) {
  if (!CHIAVE || !data) return false;
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(data), h(CHIAVE));
}

/** L'impronta dell'IP: mai l'IP. Il sale e' la chiave segreta, cosi' l'impronta non e'
 *  ricostruibile da chi legge il database senza conoscerla. */
function impronta(req) {
  const avanti = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '');
  const ip = avanti.split(',')[0].trim() || 'ignoto';
  return createHash('sha256').update(`${CHIAVE}|${ip}`).digest('hex').slice(0, 16);
}

const stringa = (x, max) => (typeof x === 'string' ? x : '').trim().slice(0, max);

/** Il numero di protocollo: leggibile, non indovinabile a colpo sicuro, e uguale nella
 *  forma per chiunque — anche per chi e' finito nell'esca. */
const protocollo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Il corpo, sia che la piattaforma l'abbia gia' aperto sia che arrivi grezzo. */
function corpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = async (req, res) => {
  const q = req.query || {};

  // --- lo stato: l'unica risposta che si da' senza chiave, e non contiene dati -------
  if (q.stato !== undefined) {
    return res.status(200).json({ attivo: Boolean(URL_KV && TOKEN) });
  }

  if (!URL_KV || !TOKEN) {
    return res.status(503).json({ errore: 'buca non configurata (manca il provisioning Upstash)' });
  }

  // --- lettura: solo con la chiave --------------------------------------------------
  if (q.leggi !== undefined) {
    if (!CHIAVE) return res.status(503).json({ errore: 'lettura non configurata (manca FEEDBACK_CHIAVE)' });
    if (!stessaChiave(q.chiave)) return res.status(401).json({ errore: 'chiave non valida' });

    const n = Math.min(parseInt(q.n, 10) || 100, CODA_MAX);
    const [ids, tot, esca] = await pipeline([
      ['LRANGE', CHIAVI.coda, 0, n - 1],
      ['GET', CHIAVI.tot],
      ['GET', CHIAVI.esca],
    ]);
    const scatti = parseInt(esca.result ?? 0, 10) || 0;
    const elenco = ids.result || [];
    if (!elenco.length) return res.status(200).json({ totale: 0, esca: scatti, voci: [] });

    const valori = await pipeline(elenco.map((id) => ['GET', CHIAVI.voce(id)]));
    const voci = valori
      .map((v) => { try { return JSON.parse(v.result); } catch { return null; } })
      .filter(Boolean);
    return res.status(200).json({ totale: parseInt(tot.result ?? 0, 10) || 0, esca: scatti, voci });
  }

  // --- segna lavorato: solo con la chiave -------------------------------------------
  if (q.fatto !== undefined) {
    if (!CHIAVE) return res.status(503).json({ errore: 'lettura non configurata (manca FEEDBACK_CHIAVE)' });
    if (!stessaChiave(q.chiave)) return res.status(401).json({ errore: 'chiave non valida' });

    const id = stringa(q.fatto, 40);
    const [letta] = await pipeline([['GET', CHIAVI.voce(id)]]);
    if (!letta.result) return res.status(404).json({ errore: 'segnalazione non trovata' });
    const v = JSON.parse(letta.result);
    v.stato = 'fatto';
    v.chiusa_il = new Date().toISOString();
    await pipeline([['SET', CHIAVI.voce(id), JSON.stringify(v), 'EX', VITA]]);
    return res.status(200).json({ id, stato: 'fatto' });
  }

  // --- scrittura --------------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ errore: 'serve POST' });
  }

  const b = corpo(req);

  // L'ESCA. Un campo che nessun essere umano vede e nessun essere umano compila: se
  // arriva pieno, e' un robot. Si risponde 201 come a tutti, con un protocollo che
  // sembra vero — dire «ti ho riconosciuto», anche solo con un id diverso dagli altri,
  // insegna a chi scrive il robot come non farsi riconoscere la volta dopo.
  //
  // MA E' L'UNICO PUNTO DEL SISTEMA IN CUI UN FALSO POSITIVO E' MUTO: se un gestore di
  // password compilasse questo campo per conto di una persona vera, quella persona
  // vedrebbe una ricevuta e il messaggio non arriverebbe mai. Per questo il campo si
  // chiama `campo_x` e non `sito` (un nome che un compilatore automatico in italiano
  // puo' riconoscere come «indirizzo del sito»), e per questo ogni scatto si CONTA:
  // il contatore e' l'unico strumento che possiamo guardare per sapere se l'esca sta
  // prendendo qualcuno che non doveva. Se `esca` cresce come `tot`, l'esca va tolta.
  if (stringa(b.campo_x, 200)) {
    await pipeline([['INCR', CHIAVI.esca]]);
    return res.status(201).json({ id: protocollo(), salvato: true });
  }

  const tipo = TIPI.has(b.tipo) ? b.tipo : null;
  if (!tipo) return res.status(400).json({ errore: 'tipo non riconosciuto' });

  const testo = stringa(b.testo, TESTO_MAX);
  if (testo.length < TESTO_MIN) {
    return res.status(400).json({ errore: `servono almeno ${TESTO_MIN} caratteri` });
  }

  const contatto = stringa(b.contatto, CONTATTO_MAX);
  if (contatto && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contatto)) {
    return res.status(400).json({ errore: 'indirizzo email non valido' });
  }

  // il tetto anti-abuso, prima di scrivere
  const imp = impronta(req);
  const [conteggio] = await pipeline([['INCR', CHIAVI.rl(imp)]]);
  const quante = parseInt(conteggio.result ?? 1, 10) || 1;
  if (quante === 1) await pipeline([['EXPIRE', CHIAVI.rl(imp), 3600]]);
  if (quante > TETTO_ORA) {
    return res.status(429).json({ errore: 'troppe segnalazioni in un\'ora, riprova piu\' tardi' });
  }

  const id = protocollo();
  const voce = {
    id,
    tipo,
    testo,
    pagina: stringa(b.pagina, PAGINA_MAX),
    contatto: contatto || null,          // null, non '': l'assenza e' una risposta
    schermo: stringa(b.schermo, 20) || null,
    navigatore: stringa(b.navigatore, 40) || null,
    ricevuta_il: new Date().toISOString(),
    stato: 'nuova',
  };

  await pipeline([
    ['SET', CHIAVI.voce(id), JSON.stringify(voce), 'EX', VITA],
    ['LPUSH', CHIAVI.coda, id],
    ['LTRIM', CHIAVI.coda, 0, CODA_MAX - 1],
    ['INCR', CHIAVI.tot],
  ]);

  return res.status(201).json({ id, salvato: true });
};
