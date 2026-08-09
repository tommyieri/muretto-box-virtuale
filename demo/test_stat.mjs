#!/usr/bin/env node
// test_stat.mjs — la prima sentinella della CI che guarda l'HTML del sito.
//
//     node demo/test_stat.mjs
//
// PERCHE' ESISTE. Fino al 04/08/2026 .github/workflows/banco.yml non eseguiva un solo
// controllo su HTML o CSS: la suite guarda il motore, il cavo live, la redazione e il
// registro del debito, e nessuno di quei passi apre una pagina. Una voce di nav
// dimenticata in uno dei quindici file che la ripetono a mano, un href che non risolve,
// una pagina nuova mai messa in sitemap: tutto verde. La sezione Statistiche aggiunge
// cinque pagine a quel sito, e cinque modi nuovi di sbagliare in silenzio.
//
// NASCE VERDE SULLO STATO DI OGGI. Le divergenze che gia' esistono stanno in
// demo/REGISTRO_SEZIONE.json con un referto ciascuna. Non e' un condono: come in
// simulatore/banco/ROSSE_DICHIARATE.json, il test esce 1 ANCHE quando una divergenza
// dichiarata guarisce — perche' vorrebbe dire che il registro non descrive piu' la
// realta', ed e' esattamente cosi' che un registro smette di valere.
//
// COSA CONTROLLA
//   A. la sequenza (etichetta, href) della nav e' la stessa in ogni pagina che ne ha una
//   B. ogni href della nav risolve a un file che esiste
//   C. PAGINE_FISSE (in ai_lab/redazione/statico.py) e il disco coincidono NEI DUE VERSI
//   D. stile.css e' caricato con la querystring di versione
//   E. le pagine leggono solo demo/data/ (piu' le eccezioni a registro)
//   F. ogni file in demo/data/stat/ ha un generatore registrato in aggiorna_stat.py
//
// COSA NON CONTROLLA, E VA DETTO: non apre un browser, quindi non sa se una pagina si
// disegna. Sa che i pezzi ci sono e si puntano l'un l'altro.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..');
const REGISTRO = path.join(QUI, 'REGISTRO_SEZIONE.json');
const STATICO = path.join(RADICE, 'ai_lab', 'redazione', 'statico.py');
const AGGIORNA_STAT = path.join(RADICE, 'aggiorna_stat.py');

let rosse = 0;
const esito = (ok, testo) => {
  if (!ok) rosse += 1;
  console.log(`${ok ? 'PASSA ' : 'FALLITO'}  ${testo}`);
};

const reg = JSON.parse(readFileSync(REGISTRO, 'utf8'));
const pagine = readdirSync(QUI).filter(f => f.endsWith('.html')).sort();
const testo = Object.fromEntries(pagine.map(f => [f, readFileSync(path.join(QUI, f), 'utf8')]));

// ogni voce del registro deve spiegarsi: una voce senza referto non e' una decisione,
// e' un difetto che qualcuno ha smesso di guardare.
for (const v of reg.voci ?? []) {
  esito(Boolean(v.referto), `[${v.id}] porta un referto`);
  esito(Boolean(v.guardia?.tipo), `[${v.id}] porta una guardia verificabile`);
}
const guardia = t => reg.voci.find(v => v.guardia?.tipo === t)?.guardia ?? {};

// ---------------------------------------------------------------- A. la nav
//
// RISCRITTA IL 09/08/2026 col sito nuovo. Prima la nav era ripetuta nell'HTML di ogni
// pagina e la sentinella confrontava quindici copie con l'attesa; ora la monta
// demo/muro.mjs::guscio() da una costante sola, e il controllo cambia oggetto:
//   1. la sequenza dichiarata in muro.mjs e' quella attesa dal registro;
//   2. la stessa sequenza sta anche in statico.py (che scrive 404 e articoli);
//   3. OGNI pagina importa muro.mjs e chiama guscio(): una pagina che se lo dimentica
//      resta senza intestazione, ed e' esattamente il guasto che questo blocco cerca.
// Il controllo e' piu' forte di prima, non piu' debole: una copia in meno da sbagliare.
const attesa = reg.nav_attesa.map(([e, h]) => `${e}->${h}`).join(' | ');

const muro = readFileSync(path.join(QUI, 'muro.mjs'), 'utf8');
const crudeMuro = [...(muro.match(/const VOCI = \[([\s\S]*?)\];/)?.[1] ?? '')
  .matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map(m => [m[1], m[2]]);
const vociMuro = crudeMuro.map(([e, h]) => `${e}->${h.replace(/^\//, '')}`).join(' | ');
esito(vociMuro === attesa,
  `muro.mjs monta la nav attesa${vociMuro === attesa ? '' : `\n           atteso: ${attesa}\n           trovato: ${vociMuro}`}`);

// I PERCORSI DEVONO PARTIRE DALLA RADICE, e non e' pedanteria: guscio() serve anche le
// dodici pagine in demo/articolo/, che stanno un livello piu' giu'. Con href relativi il
// browser risolveva 'stagione.html' in /articolo/stagione.html — nav e marchio a 404 su
// tutte e dodici, in produzione, e nessun controllo se n'era accorto.
const relativi = crudeMuro.filter(([, h]) => !h.startsWith('/')).map(([e]) => e);
esito(relativi.length === 0,
  `muro.mjs punta dalla radice (le pagine annidate usano lo stesso guscio)`
  + (relativi.length ? ` — relativi: ${relativi.join(', ')}` : ''));
esito(/href: '\/index\.html'/.test(muro), 'il marchio punta dalla radice');

const vociStatico = [...(readFileSync(STATICO, 'utf8').match(/^NAV = \[([\s\S]*?)^\]/m)?.[1] ?? '')
  .matchAll(/\("([^"]+)",\s*"([^"]+)"\)/g)].map(m => `${m[1]}->${m[2]}`).join(' | ');
esito(vociStatico === attesa,
  `statico.py::NAV e' d'accordo con muro.mjs${vociStatico === attesa ? '' : `\n           trovato: ${vociStatico}`}`);

for (const f of pagine) {
  const usa = /muro\.mjs/.test(testo[f]) && /guscio\(/.test(testo[f]);
  esito(usa, `${f} monta il guscio da muro.mjs`);
}

// ---------------------------------------------------------------- A-bis. i footer
//
// Il footer lo scrive lo STESSO guscio della nav (muro.mjs), quindi non c'e' piu' una
// copia per pagina da confrontare: quello che si controlla e' che il posto dove il
// guscio va a scrivere esista davvero in ogni pagina. Senza <div class="piede-in">
// la funzione non trova nulla e la pagina esce senza piede, in silenzio.
for (const f of pagine) {
  esito(/class="piede-in"/.test(testo[f]), `${f} ha il posto del piede (.piede-in)`);
  esito(/class="barra"/.test(testo[f]), `${f} ha il posto dell'intestazione (.barra)`);
}

// ---------------------------------------------------------------- B. gli href risolvono
for (const f of pagine.slice(0, 1)) {
  for (const [, href] of reg.nav_attesa) {
    esito(existsSync(path.join(QUI, href)), `[nav] punta a ${href}, che esiste`);
  }
}
for (const [, href] of reg.nav_attesa) {
  esito(existsSync(path.join(QUI, href)), `la voce di nav ${href} esiste su disco`);
}

// ---------------------------------------------------------------- C. PAGINE_FISSE <-> disco
//
// NEI DUE VERSI, ed e' il punto: una riga di PAGINE_FISSE senza file mette in sitemap un
// indirizzo che risponde 404; un file senza riga e' una pagina che esiste e che nessun
// motore di ricerca trovera' mai. Il secondo verso e' quello che oggi e' rotto (S2).
const fisse = [...readFileSync(STATICO, 'utf8')
  .match(/PAGINE_FISSE\s*=\s*\[([\s\S]*?)\]/)[1]
  .matchAll(/\("([^"]+)"\s*,\s*"([^"]+)"\)/g)].map(m => m[1]);
esito(fisse.length > 0, `PAGINE_FISSE letto da statico.py (${fisse.length} voci)`);

for (const f of fisse) {
  esito(existsSync(path.join(QUI, f)), `PAGINE_FISSE -> disco: ${f} esiste`);
}
const nonIndic = Object.keys(reg.pagine_non_indicizzabili ?? {});
const fuoriDichiarate = new Set(guardia('fuori_da_pagine_fisse').pagine ?? []);
for (const f of pagine) {
  if (nonIndic.includes(f)) continue;                       // non e' un indirizzo fisso
  const dentro = fisse.includes(f);
  if (fuoriDichiarate.has(f)) {
    // divergenza dichiarata: rossa se GUARISCE senza che il registro lo dica
    esito(!dentro, `disco -> PAGINE_FISSE: ${f} e' ancora fuori, come dichiara S2 `
      + '— se e\' stata adottata, la voce del registro va tolta');
  } else {
    esito(dentro, `disco -> PAGINE_FISSE: ${f} e' registrata`);
  }
}
for (const f of nonIndic) {
  esito(Boolean(reg.pagine_non_indicizzabili[f]), `[non indicizzabile] ${f} spiega perche'`);
}

// ---------------------------------------------------------------- C-bis. mai linkate
//
// Un href rotto lo vede il controllo B. Una pagina che NESSUNO punta non la vede nessun
// controllo sui link, perche' li' non c'e' nessun link da guardare: e' il difetto opposto.
const sorgenti = [...pagine.map(f => path.join(QUI, f)),
                  ...readdirSync(QUI).filter(f => f.endsWith('.mjs')).map(f => path.join(QUI, f))];
const maiLinkate = new Set(guardia('mai_linkate').pagine ?? []);
for (const f of pagine) {
  if (nonIndic.includes(f)) continue;
  const puntata = sorgenti.some(p => path.basename(p) !== f
    && readFileSync(p, 'utf8').includes(f));
  if (maiLinkate.has(f)) {
    esito(!puntata, `[S3] ${f} non e' ancora linkata da nessuno, come dichiarato `
      + '— se qualcuno l\'ha adottata, la voce del registro va tolta');
  } else {
    esito(puntata, `${f} e' linkata da almeno un'altra pagina`);
  }
}

// ---------------------------------------------------------------- D. ?v= su muro.css
//
// La lezione del 04/08/2026 vale identica sul foglio nuovo: o si muovono tutte le
// pagine sulla stessa versione, o non si e' invalidato niente. Dal 09/08 il foglio e'
// demo/muro.css e non ci sono eccezioni dichiarate: chi non lo carica e' un errore.
const versioni = new Map();
for (const f of pagine) {
  const m = testo[f].match(/href="\/?muro\.css([^"]*)"/);
  esito(Boolean(m), `${f} carica muro.css`);
  if (!m) continue;
  const v = m[1].startsWith('?v=') ? m[1].slice(3) : null;
  esito(Boolean(v), `${f} carica muro.css con la querystring di versione`);
  if (v) versioni.set(v, [...(versioni.get(v) ?? []), f]);
}
esito(versioni.size <= 1,
  `tutte le pagine chiedono la stessa versione di muro.css`
  + (versioni.size > 1
     ? `\n           ${[...versioni].map(([v, ff]) => `?v=${v}: ${ff.join(', ')}`).join('\n           ')}`
     : ` (?v=${[...versioni.keys()][0] ?? '—'})`));

// ---------------------------------------------------------------- E. si legge solo demo/data/
//
// E' la legge 1 della casa: le pagine sono consumatori puri. Un fetch verso data/ (la
// cartella di laboratorio, fuori da demo/) non fallirebbe in sviluppo e fallirebbe online.
const consentite = new Set(guardia('letture_fuori_da_data').consentite ?? []);
// DAL 09/08/2026 SI GUARDANO ANCHE I MODULI. Col sito nuovo le pagine non fanno piu'
// fetch da sole: chiamano dati()/datiObbligatori() di muro.mjs, e le due letture
// eccezionali (team_colori.json, neutralizzazione.json) sono finite li' dentro. Guardare
// solo l'HTML avrebbe detto «nessuno le legge piu'» mentre le legge tutto il sito: un
// controllo che cerca dove non e' successo niente non e' un controllo.
const moduli = readdirSync(QUI).filter(f => f.endsWith('.mjs') && !f.startsWith('test_'));
const sorgentiLettura = [...pagine.map(f => testo[f]),
                         ...moduli.map(f => readFileSync(path.join(QUI, f), 'utf8'))];
for (const f of pagine) {
  const letti = [...testo[f].matchAll(/(?:fetch|prendiJSON|dati|datiObbligatori)\(\s*[`']([^`']+)[`']/g)].map(m => m[1]);
  const fuori = letti.filter(u => !u.startsWith('data/') && !u.startsWith('http')
    && !consentite.has(u) && u.endsWith('.json'));
  esito(fuori.length === 0,
    `${f} legge solo demo/data/${fuori.length ? ` — trovati: ${fuori.join(', ')}` : ''}`);
}
for (const u of consentite) {
  const usata = sorgentiLettura.some(t => t.includes(u));
  esito(usata, `[S5] l'eccezione ${u} e' ancora usata da qualcuno `
    + '— se nessuno la legge piu\', la voce del registro va tolta');
}

// ---------------------------------------------------------------- F. demo/data/stat/
//
// La sezione scrive i suoi artefatti qui. Un file in questa cartella senza un generatore
// registrato e' un file orfano — legge 6, il debito che il progetto ha gia' pagato sei volte.
const STAT = path.join(QUI, 'data', 'stat');
if (existsSync(STAT)) {
  const registrati = existsSync(AGGIORNA_STAT) ? readFileSync(AGGIORNA_STAT, 'utf8') : '';
  esito(existsSync(AGGIORNA_STAT),
    'demo/data/stat/ esiste, quindi aggiorna_stat.py deve esistere');
  // LA SEZIONE NON PUO' RESTARE INDIETRO, e questo e' il controllo che lo dimostra.
  //
  // «Tutto si ri-aggiorna a ogni gara» e' una regola di casa, e una regola che nessuno
  // verifica e' un desiderio. aggiorna_stat.py e' agganciato ad auto_gara.py in due punti
  // (dopo la gara nuova e dopo l'avanzamento della release f1db) con check=False, cioe' puo'
  // fallire in silenzio: se fallisse e basta, la sezione mostrerebbe la gara precedente con
  // una targhetta che sembra fresca — il guasto che questo progetto ha gia' pagato.
  // Qui si confronta il PERIMETRO DICHIARATO da ogni artefatto con le gare davvero
  // pubblicate (demo/data/manifest.json). Se la sezione e' rimasta indietro, la CI diventa
  // rossa prima che qualcuno se ne accorga guardando il sito.
  const pubblicate = existsSync(path.join(QUI, 'data', 'manifest.json'))
    ? JSON.parse(readFileSync(path.join(QUI, 'data', 'manifest.json'), 'utf8')).map(m => m.gara)
    : [];
  for (const f of readdirSync(STAT).filter(f => f.endsWith('.json'))) {
    // si cerca il NOME DEL FILE, non il percorso: in aggiorna_stat.py il percorso e'
    // composto con os.path.join e la stringa 'stat/confronti.json' non compare mai.
    esito(registrati.includes(f),
      `demo/data/stat/${f} e' prodotto da un generatore registrato in aggiorna_stat.py `
      + '— un file senza generatore e\' un debito, non una fonte (legge 6)');

    const d = JSON.parse(readFileSync(path.join(STAT, f), 'utf8'));
    esito(Boolean(d._generatore && d.calcolato_il && d.perimetro),
      `demo/data/stat/${f} porta l'involucro (_generatore, calcolato_il, perimetro)`);

    // un artefatto per-gara deve conoscere TUTTE le gare pubblicate; uno storico (che
    // dichiara `anni` invece di `gare`) e' fuori da questo controllo, ma deve arrivare
    // all'anno in corso.
    const per = d.perimetro ?? {};
    // DUE FORME AMMESSE per `perimetro.gare`, e sono ammesse entrambe apposta:
    //   ["Australia", "Cina", ...]                        la forma minima
    //   [{gara:"Australia", round:1, ...}, ...]           la stessa piu' la copertura per gara
    // La seconda porta strettamente piu' informazione (quale fonte copre quale gara), e
    // vietarla per uniformita' sarebbe peggio del problema che risolve. Quello che NON e'
    // ammesso e' una terza forma: il nome della gara sta in una stringa o nel campo `gara`.
    const nomeGara = g => (typeof g === 'string' ? g : g?.gara);
    if (Array.isArray(per.gare) && pubblicate.length) {
      const dentro = new Set(per.gare.map(nomeGara).filter(Boolean));
      esito(dentro.size === per.gare.length,
        `demo/data/stat/${f} dichiara ogni gara del perimetro con un nome leggibile`);
      const mancanti = pubblicate.filter(g => !dentro.has(g)
        && !(per.assenti ?? []).some(a => nomeGara(a) === g));
      esito(mancanti.length === 0,
        `demo/data/stat/${f} copre tutte le ${pubblicate.length} gare pubblicate`
        + (mancanti.length
           ? `\n           — indietro di ${mancanti.length}: ${mancanti.join(', ')}. `
             + 'La sezione non si e\' ri-aggiornata: lanciare `python3 aggiorna_stat.py`.'
           : ''));
    } else if (Array.isArray(per.anni)) {
      const anno = new Date().getFullYear();
      esito(per.anni.includes(anno) || per.anni.includes(String(anno)),
        `demo/data/stat/${f} arriva all'anno in corso (${anno})`);
    }
  }
} else {
  console.log("SALTO    demo/data/stat/ non esiste ancora: nessun artefatto della sezione da sorvegliare");
}

// ---------------------------------------------------------------- G. i nomi delle squadre
//
// AGGIUNTO DOPO UN GUASTO VERO. Gli artefatti della sezione chiamano le squadre in modi
// diversi — «Haas» in uno, «Haas F1 Team» in un altro — e team_colori.json ne conosce solo
// uno. Un nome che non risolve NON produce un errore: produce il grigio di riserva, cioe' la
// livrea sbagliata su una tabella che sembra a posto. E' il tipo di difetto che nessun test
// vede se non lo si va a cercare, e che un lettore esperto nota prima di noi.
//
// La normalizzazione vive in stat.mjs::normalizzaTeam ed e' un CEROTTO dichiarato (voce S6):
// questo controllo pretende che il cerotto continui a bastare. Il giorno in cui un nome nuovo
// non risolve piu', il test lo dice invece di far diventare grigia una squadra.
const IDENT = path.join(QUI, 'data', 'stat', 'identita.json');
const gS6 = guardia('colori_squadre_risolvono');
if (existsSync(IDENT) && (gS6.artefatti ?? []).length) {
  const id = JSON.parse(readFileSync(IDENT, 'utf8'));
  esito(Boolean(id.alias && id.squadre?.length),
    'la tabella di identita\' esiste ed elenca le squadre');
  // il generatore dichiara da se' i propri guasti: qui si pretende che siano vuoti
  esito((id.senza_colore ?? []).length === 0,
    `[S6] ogni squadra ha la sua livrea${(id.senza_colore ?? []).length
      ? ` — senza colore: ${id.senza_colore.join(', ')}` : ` (${id.squadre.length} squadre)`}`);
  esito((id.alias_ignoti ?? []).length === 0,
    `[S6] nessun nome usato dagli artefatti e' sconosciuto alla tabella`
    + ((id.alias_ignoti ?? []).length ? ` — ignoti: ${id.alias_ignoti.join(', ')}` : ''));

  // e la controprova indipendente: si rileggono gli artefatti e si verifica che ogni nome
  // risolva. Se il generatore smettesse di accorgersene, questo se ne accorge lo stesso.
  const nomi = new Set();
  for (const rel of gS6.artefatti) {
    const p = path.join(RADICE, rel);
    if (!existsSync(p)) { esito(false, `[S6] artefatto dichiarato assente: ${rel}`); continue; }
    const cerca = v => {
      if (Array.isArray(v)) return v.forEach(cerca);
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if ((k === 'team' || k === 'squadra') && typeof x === 'string') nomi.add(x);
          else cerca(x);
        }
      }
    };
    cerca(JSON.parse(readFileSync(p, 'utf8')));
  }
  const orfani = [...nomi].filter(n => n !== '?' && !id.alias[n]);
  esito(orfani.length === 0,
    `[S6] ogni squadra degli artefatti risolve nella tabella (${nomi.size} nomi distinti)`
    + (orfani.length ? ` — non risolvono: ${orfani.join(', ')}` : ''));

  // il cerotto e' andato: stat.mjs non deve piu' portarsi dentro un dizionario di alias
  const mjs = readFileSync(path.join(QUI, 'stat.mjs'), 'utf8');
  esito(!/'Haas':\s*'Haas F1 Team'/.test(mjs),
    'stat.mjs non contiene piu\' il dizionario di alias scritto a mano '
    + '(l\'identita\' viene dalla tabella generata)');
}

// ---------------------------------------------------------------- H. il feed non e' cambiato
//
// gen_stat_feed.py conta a ogni gara i canali dell'archivio ufficiale F1. Dal 04/08/2026 il
// risultato NON si rende piu' in pagina (decisione di Tommi: quella prosa e' un referto interno
// e leggeva come un sito incompleto) — ma la misura resta, e resta sorvegliata. Il motivo e' che
// serve a NOI: e' cio' che ci dice se F1 riapre il rubinetto sull'energia, e quel giorno
// cambierebbe cosa il sito puo' raccontare. Un artefatto invisibile al lettore non e' un
// artefatto che puo' invecchiare in silenzio.
const FEED = path.join(QUI, 'data', 'stat', 'feed.json');
if (existsSync(FEED)) {
  const f = JSON.parse(readFileSync(FEED, 'utf8'));
  const s = f.sentinella ?? {};
  esito(!s.allarme,
    's[feed] nessun canale nuovo nell\'archivio ufficiale F1'
    + (s.canali_nuovi?.length ? ` — COMPARSI: ${s.canali_nuovi.join(', ')}. `
       + 'Se e\' un canale energetico, la riga sull\'osservabilita\' va RISCRITTA.' : '')
    + (s.canali_spariti?.length ? ` — SPARITI: ${s.canali_spariti.join(', ')}` : ''));
  const c26 = Object.keys(f.per_anno?.['2026']?.canali ?? {});
  esito(c26.length > 0 && !c26.includes('45'),
    `[feed] il 2026 non trasmette il canale DRS (${c26.length} canali misurati)`);
}

// ---------------------------------------------------------------- I. il regolamento firmato
//
// Come per il feed: l'artefatto esiste e NON si rende in pagina. Restano due controlli.
// (1) Ogni voce confermata porta il suo articolo — un numero di regolamento senza l'articolo
// da cui viene non e' tracciabile, e la tracciabilita' e' proprio cio' che la decisione del
// 04/08 ha voluto CONSERVARE nei dati mentre la toglieva dalla resa.
// (2) La Sezione C ha avuto diciannove revisioni in una stagione: se la FIA ne pubblica una
// piu' recente di quella firmata, la firma va rifatta.
const REG = path.join(QUI, 'data', 'stat', 'regolamento.json');
if (existsSync(REG)) {
  const r = JSON.parse(readFileSync(REG, 'utf8'));
  const senzArt = (r.voci ?? []).filter(v => !v.articolo);
  esito(senzArt.length === 0,
    `[regolamento] ogni voce pubblicata porta il suo articolo (${(r.voci ?? []).length} voci)`
    + (senzArt.length ? ` — senza articolo: ${senzArt.map(v => v.id).join(', ')}` : ''));
  esito(!r.sentinella_issue?.allarme,
    '[regolamento] nessuna revisione FIA piu\' recente di quella firmata'
    + (r.sentinella_issue?.allarme
       ? ` — ${Object.entries(r.sentinella_issue.piu_recenti_di_quello_firmato)
             .map(([k, v]) => `${k}: firmata ${v.firmato}, pubblicata ${v.pubblicato}`).join('; ')}. `
         + 'La firma va rifatta sull\'Issue nuovo.' : ''));
  if (!r.firma?.firmato)
    console.log(`SALTO    [regolamento] non firmato: ${(r.da_firmare ?? []).length} voci in attesa, `
      + 'nessun numero di regolamento e\' pubblicato');
}

// --- G. la torre di cronometraggio non si ri-scrive in pagina ------------------------
// Le regole .tw-* stavano copiate in QUATTRO pagine (live, quali, libere, sprint) e la
// traduzione sessione-archiviata -> snapshot in ALTRETTANTE quattro, byte per byte. Quattro
// copie che sarebbero divergute alla prima modifica: e' l'errore E12 applicato alla vista.
// Ora l'aspetto sta in stile.css e la traduzione in live_timing.mjs::snapshotDaSessione.
// Questo controllo esiste perche' il modo naturale di rompere l'unificazione non e'
// cancellarla: e' incollare di nuovo una regola «solo per questa pagina».
{
  const colpevoliCss = [], colpevoliFn = [];
  for (const f of pagine) {
    const t = testo[f];
    // regole .tw-* dentro un <style> della pagina (non i selettori usati nel markup)
    for (const stile of t.match(/<style[\s\S]*?<\/style>/g) || []) {
      if (/^\s*\.tw-[\w-]*\s*[{,]/m.test(stile)) { colpevoliCss.push(f); break; }
    }
    if (/function\s+\w*ToSnapshot\s*\(/.test(t)) colpevoliFn.push(f);
  }
  esito(colpevoliCss.length === 0,
    'nessuna pagina ridefinisce le regole .tw-* (stanno in muro.css)'
    + (colpevoliCss.length ? ` — le ridefiniscono: ${colpevoliCss.join(', ')}` : ''));
  esito(colpevoliFn.length === 0,
    'nessuna pagina ri-scrive la traduzione snapshot (sta in live_timing.mjs)'
    + (colpevoliFn.length ? ` — la ri-scrivono: ${colpevoliFn.join(', ')}` : ''));
  // e il modulo condiviso deve davvero esportarla, altrimenti il controllo sopra e' vuoto
  const lt = readFileSync(path.join(QUI, 'live_timing.mjs'), 'utf8');
  esito(/export function snapshotDaSessione/.test(lt),
    'live_timing.mjs esporta snapshotDaSessione (senza, il controllo sopra passerebbe a vuoto)');
  esito(/\.tw-list\{/.test(readFileSync(path.join(QUI, 'muro.css'), 'utf8')),
    'muro.css contiene le regole della torre');
}

console.log(rosse === 0
  ? `\nstruttura del sito: ${pagine.length} pagine, ${reg.voci.length} divergenze a registro, tutte ancora vere.`
  : `\nstruttura del sito: ${rosse} asserzioni rosse.`);
process.exit(rosse === 0 ? 0 : 1);
