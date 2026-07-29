// contatore.js — contatore anonimo aggregato della demo (strumentazione, NON simulatore).
//
// PRIVACY BY CONSTRUCTION: memorizza SOLO interi (conteggi per giorno + totali).
// Nessun cookie, nessun ID, nessun user-agent, nessun IP a riposo: non c'e' niente
// da anonimizzare perche' non entra niente. Gli IP transitano nei log Vercel come
// per qualunque richiesta web (retention breve, non usati da questo codice).
//
// Storage: Upstash Redis via Vercel Marketplace (REST, fetch puro, zero dipendenze).
// Env attese (arrivano dal provisioning nel dashboard Vercel; supporto entrambi i nomi):
//   KV_REST_API_URL / KV_REST_API_TOKEN  oppure  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Senza env il contatore risponde 503 e la demo continua a funzionare (fire-and-forget).
//
// API:
//   GET/POST /api/contatore?e=apertura          -> INCR muretto:apertura:<giorno> e totale
//   GET/POST /api/contatore?e=valutazione_pit   -> idem per le valutazioni pit
//   GET      /api/contatore?leggi=1             -> JSON aggregato (totali + ultimi 14 giorni)

const URL_KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN  = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const EVENTI = new Set(['apertura', 'valutazione_pit']);

async function pipeline(comandi) {
  const r = await fetch(`${URL_KV}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandi),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  return r.json(); // [{result:...}, ...]
}

const giornoUTC = (d) => d.toISOString().slice(0, 10);

module.exports = async (req, res) => {
  if (!URL_KV || !TOKEN) {
    return res.status(503).json({ errore: 'contatore non configurato (manca il provisioning Upstash)' });
  }
  const q = req.query || {};

  if (q.leggi !== undefined) {
    const giorni = [...Array(14)].map((_, i) => giornoUTC(new Date(Date.now() - i * 864e5)));
    const cmds = [];
    for (const e of EVENTI) cmds.push(['GET', `muretto:tot:${e}`]);
    for (const e of EVENTI) for (const g of giorni) cmds.push(['GET', `muretto:${e}:${g}`]);
    const out = await pipeline(cmds);
    const int = (x) => parseInt(x?.result ?? 0, 10) || 0;
    const ev = [...EVENTI];
    const risposta = { totali: {}, ultimi_14_giorni: {} };
    ev.forEach((e, i) => { risposta.totali[e] = int(out[i]); });
    ev.forEach((e, ei) => {
      risposta.ultimi_14_giorni[e] = Object.fromEntries(
        giorni.map((g, gi) => [g, int(out[ev.length + ei * giorni.length + gi])]));
    });
    return res.status(200).json(risposta);
  }

  const e = q.e;
  if (!EVENTI.has(e)) return res.status(400).json({ errore: 'evento non riconosciuto' });
  const g = giornoUTC(new Date());
  await pipeline([['INCR', `muretto:${e}:${g}`], ['INCR', `muretto:tot:${e}`]]);
  return res.status(204).end();
};
