// test_parita_live.mjs — IL CANCELLO DI PARITA': la diretta e il replay
// rispondono con lo stesso motore, e si misura di quanto differiscono.
//
//     node demo/test_parita_live.mjs      (esce 1 se la parita' si rompe)
//
// PERCHE' ESISTE. Fino al 31/07/2026 gara.html e live.html rispondevano con DUE
// motori diversi, ed era una divergenza dichiarata in testa a live.html. Ora il
// montaggio della risposta e' lo stesso modulo (scenario/risposta.mjs), quindi
// la parita' e' garantita PER COSTRUZIONE — e proprio per questo va misurata:
// una proprieta' garantita da una frase non fallisce mai da sola, e il giorno in
// cui qualcuno tocca il ponte la frase resta vera mentre il numero cambia.
//
// COSA CONFRONTA. Da un lato la registrazione VERA del flusso di Spa 2026
// (live/fixture/spa_2026_gara.jsonl), fatta passare per live_bylap → ponte_live
// → motore. Dall'altro la vista PRE-CALCOLATA della stessa gara
// (demo/data/vista/Belgio/), prodotta in Node dai dati ufficiali.
//
// COSA NON SI ASPETTA. Che i numeri coincidano SEMPRE. I due percorsi partono da
// due conoscenze diverse della stessa gara, e la differenza e' esattamente la
// somma dei due limiti dichiarati del live:
//   · lo stato pista e' track-wide (84,8% di accordo, 34,1% delle celle di passo
//     oltre 0,10 s);
//   · il feed non revoca i giri cancellati (1,34% di falsi verdi, misurato).
// Il cancello quindi non chiede identita': chiede che la differenza resti dentro
// cio' che quei limiti spiegano, e la STAMPA. Un giorno in cui peggiora, si va a
// vedere: non si alza la soglia.
//
// COSA FA FALLIRE QUESTO TEST:
//  (a) il ponte non produce risposte per abbastanza casi (il motore muto in
//      diretta e' il modo piu' silenzioso di fallire);
//  (b) la posizione di rientro differisce in piu' della quota attesa;
//  (c) il giro consigliato dalla curva differisce in mediana di piu' di un giro;
//  (d) LA PROVA DI IDENTITA': sulle STESSE celle — cioe' togliendo di mezzo i due
//      limiti e lasciando solo il motore — la risposta della diretta e quella del
//      pre-calcolo devono essere IDENTICHE campo per campo. Se questa cade, non
//      e' il live a essere impreciso: sono tornate due fisiche (E17).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { creaByLapLive } from './live_bylap.mjs';
import { rispostaLive, garaDaLive, contestoDa, rigiocaLive } from './ponte_live.mjs';
import { simDaRigioca } from './fantasma_sim.mjs';
import { rispostaPer } from './vendor/simulatore/motore/scenario/risposta.mjs';
import { indicizza } from './vendor/simulatore/motore/provenienza/gare_indice.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(QUI, '..', 'live', 'fixture', 'spa_2026_gara.jsonl');
const VISTA = path.join(QUI, 'data', 'vista', 'Belgio');
const CONTESTO = path.join(QUI, 'vendor', 'simulatore', 'motore', 'contesto_live.json');
const GARA_SITO = 'Belgio';

// ---- soglie. Le prime due sono MISURATE (vedi il report); la terza e' 0 e non
// e' negoziabile: e' la prova che il motore e' uno solo.
const SOGLIA = {
  casi_minimi: 100,             // sotto, il test non ha guardato abbastanza
  // MISURATO il 31/07/2026 su Spa: 5 posizioni diverse su 111 = 4,5%, tutte di
  // un solo posto. La soglia e' il misurato piu' margine, non un desiderio: se
  // un giorno sale, e' cambiato qualcosa nel ponte o nel cavo — non si alza la
  // soglia, si va a vedere.
  quota_posizione_diversa: 0.15,
  mediana_giro_diverso: 1,      // misurato: mediana 0 giri, massimo 2
  identita_su_stesse_celle: 0,  // non negoziabile: e' la prova che il motore e' uno
};
const PASSO_CONGELAMENTO = 5;

let falliti = 0;
const esito = (ok, testo, dettaglio = '') => {
  if (!ok) falliti++;
  console.log(`  ${ok ? 'ok  ' : 'ROTTO'} ${testo}${dettaglio ? '   ' + dettaglio : ''}`);
};
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

for (const [che, dove] of [['fixture', FIXTURE], ['vista pre-calcolata', VISTA], ['contesto trasportato', CONTESTO]]) {
  if (!fs.existsSync(dove)) { console.error(`${che} assente: ${dove}`); process.exit(1); }
}

const contestoLive = JSON.parse(fs.readFileSync(CONTESTO, 'utf8'));

// ── il flusso vero, fino in fondo ──────────────────────────────────────────
const A = creaByLapLive();
for (const riga of fs.readFileSync(FIXTURE, 'utf8').split('\n')) {
  if (riga) A.applica(JSON.parse(riga));
}
const byLapPieno = A.byLap();
const nGiriGara = A.nLaps();

// ── la vista pre-calcolata ─────────────────────────────────────────────────
const indice = JSON.parse(fs.readFileSync(path.join(VISTA, 'indice.json'), 'utf8'));
const attesoDi = new Map();   // "drv@Lf" -> record
for (const f of fs.readdirSync(VISTA)) {
  if (!f.endsWith('.json') || f === 'indice.json' || f.includes('fantasma')) continue;
  const v = JSON.parse(fs.readFileSync(path.join(VISTA, f), 'utf8'));
  for (const g of v.giri) attesoDi.set(`${v.pilota}@${g.freeze_lap}`, g);
}

console.log('LA PARITA\' — Spa 2026 dal flusso live, contro la vista pre-calcolata\n');
console.log(`  gara ${GARA_SITO} · ${indice.n_giri} giri · vista: ${Object.keys(indice.piloti).length} piloti, `
  + `congelamenti ${indice.primo_giro}–${indice.ultimo_giro}`);
console.log(`  flusso live: ${Object.keys(byLapPieno).length} giri ricostruiti, giri_totali dal feed = ${nGiriGara}\n`);

esito(nGiriGara === indice.n_giri, 'la distanza di gara del feed e\' quella ufficiale',
  `feed ${nGiriGara} · ufficiale ${indice.n_giri}`);

// il byLap TRONCATO al congelamento: in diretta i giri dopo non esistono.
// Troncare qui equivale a troncare il flusso, perche' la riga di un giro si
// chiude quando il contagiri passa e da li' non si tocca piu' (invariante di
// live_bylap.mjs); e la sentinella s14 del banco verifica proprio che una
// misura al congelamento non cambi fra dato intero e dato troncato.
function troncato(Lf) {
  const fuori = {};
  for (const [L, righe] of Object.entries(byLapPieno)) if (Number(L) <= Lf) fuori[L] = righe;
  return fuori;
}

const congelamenti = [];
for (let L = indice.primo_giro; L <= indice.ultimo_giro; L += PASSO_CONGELAMENTO) congelamenti.push(L);

// ── (a)(b)(c) la parita' end-to-end ────────────────────────────────────────
let casi = 0, senzaRispostaLive = 0, posDiversa = 0;
const scartiGiro = [], scartiPerdita = [];
const esempi = [];
for (const Lf of congelamenti) {
  const bl = troncato(Lf);
  for (const drv of Object.keys(indice.piloti).sort()) {
    const atteso = attesoDi.get(`${drv}@${Lf}`);
    if (!atteso || atteso.senza_risposta || atteso.approvato === false) continue;
    const ottenuto = rispostaLive({
      byLap: bl, nGiriGara, nomeGara: GARA_SITO, pilota: drv, freezeLap: Lf,
      contestoLive, data: atteso._data,
    });
    casi += 1;
    if (!ottenuto || ottenuto.senza_risposta || ottenuto.approvato === false) { senzaRispostaLive += 1; continue; }
    if (ottenuto.pannello.posizione !== atteso.pannello.posizione) {
      posDiversa += 1;
      if (esempi.length < 5) {
        esempi.push(`${drv}@${Lf}: live P${ottenuto.pannello.posizione} · pre-calcolo P${atteso.pannello.posizione}`);
      }
    }
    if (ottenuto.minimo && atteso.minimo) scartiGiro.push(Math.abs(ottenuto.minimo.giroPit - atteso.minimo.giroPit));
    if (typeof ottenuto.perdita?.valore === 'number' && typeof atteso.perdita?.valore === 'number') {
      scartiPerdita.push(Math.abs(ottenuto.perdita.valore - atteso.perdita.valore));
    }
  }
}

console.log('\nend-to-end (flusso live vs dati ufficiali) — i due limiti dichiarati sono DENTRO questi numeri');
esito(casi >= SOGLIA.casi_minimi, `il confronto ha guardato abbastanza casi`, `${casi} (minimo ${SOGLIA.casi_minimi})`);
const conRisposta = casi - senzaRispostaLive;
esito(conRisposta > 0, 'il ponte produce risposte in diretta',
  `${conRisposta}/${casi} (${senzaRispostaLive} mute)`);
const quotaPos = casi ? posDiversa / Math.max(1, conRisposta) : 1;
esito(quotaPos <= SOGLIA.quota_posizione_diversa,
  'la posizione di rientro coincide nella maggior parte dei casi',
  `diversa ${posDiversa}/${conRisposta} = ${(100 * quotaPos).toFixed(1)}% (soglia ${(100 * SOGLIA.quota_posizione_diversa).toFixed(0)}%)`);
const medGiro = med(scartiGiro);
esito(medGiro !== null && medGiro <= SOGLIA.mediana_giro_diverso,
  'il giro consigliato dalla curva coincide, in mediana, entro un giro',
  `mediana ${medGiro} giri su ${scartiGiro.length} curve · massimo ${scartiGiro.length ? Math.max(...scartiGiro) : '—'}`);
if (scartiPerdita.length) {
  console.log(`       (pit-loss: mediana |Δ| ${med(scartiPerdita).toFixed(3)} s su ${scartiPerdita.length} casi)`);
}
if (esempi.length) {
  console.log('       primi scarti di posizione:');
  for (const e of esempi) console.log(`         ${e}`);
}

// ── (d) LA PROVA DI IDENTITA': stesse celle, stessa risposta ───────────────
// Qui i due limiti del live non c'entrano: si danno a ENTRAMBI i percorsi le
// stesse identiche celle. Se il risultato non e' identico campo per campo, il
// motore non e' piu' uno solo — ed e' l'unica cosa che questo file non tollera.
console.log('\nprova di identita\' (stesse celle a entrambi i percorsi) — qui la tolleranza e\' zero');
{
  let confrontati = 0, diversi = 0, conNumeri = 0;
  const primoDiverso = [];
  for (const Lf of congelamenti) {
    const bl = troncato(Lf);
    // le STESSE opzioni che usa rispostaLive: costruire la gara in un altro modo
    // renderebbe questo confronto un confronto fra due cose diverse
    const gara = garaDaLive(bl, nGiriGara, { tolleranzaCum: contestoLive.limiti.tolleranza_cum_s.valore });
    const { contesto, extra } = contestoDa(contestoLive, 'Belgio', gara);
    // la stessa gara, ricostruita a parte dalle stesse righe: due oggetti
    // distinti con lo stesso contenuto, cosi' l'uguaglianza non e' identita' di
    // riferimento ma davvero uguaglianza di risultato
    const garaBis = { ...indicizza(gara.righe.map((r) => ({ ...r }))), nGiri: gara.nGiri };
    const ctxBis = contestoDa(contestoLive, 'Belgio', garaBis);
    for (const drv of Object.keys(indice.piloti).sort()) {
      const viaPonte = rispostaLive({
        byLap: bl, nGiriGara, nomeGara: GARA_SITO, pilota: drv, freezeLap: Lf,
        contestoLive, data: '2026-07-31',
      });
      const diretto = rispostaPer('Belgio', garaBis, Lf, drv, ctxBis.contesto, ctxBis.extra, '2026-07-31');
      confrontati += 1;
      // due silenzi sono uguali, e confrontarli non prova niente (E09): il caso
      // conta come PROVA solo se da entrambe le parti c'e' una risposta con
      // dentro dei numeri.
      if (viaPonte?.pannello?.posizione != null && diretto?.pannello?.posizione != null) conNumeri += 1;
      if (JSON.stringify(viaPonte) !== JSON.stringify(diretto)) {
        diversi += 1;
        if (primoDiverso.length < 3) primoDiverso.push(`${drv}@${Lf}`);
      }
    }
  }
  esito(confrontati >= SOGLIA.casi_minimi, 'la prova di identita\' ha guardato abbastanza casi', `${confrontati}`);
  esito(conNumeri >= SOGLIA.casi_minimi,
    'i casi confrontati contengono davvero una risposta (due silenzi non sono una parita\')',
    `${conNumeri}/${confrontati} con posizione di rientro`);
  esito(diversi === SOGLIA.identita_su_stesse_celle,
    'a parita\' di celle, diretta e pre-calcolo danno la STESSA risposta campo per campo',
    `diversi ${diversi}/${confrontati}${primoDiverso.length ? ' — ' + primoDiverso.join(', ') : ''}`);
}

// ── (e) il BOX ORA in diretta: rigiocaLive porta la gara alla BANDIERA ──────
// Il guasto grave del vecchio flusso (dichiarato dal PO il 08/08) era la gara
// che si fermava alla sosta. Qui si prova, sul flusso vero di Spa troncato al
// congelamento (in diretta i giri dopo non esistono), che un piano MULTI-SOSTA
// viene approvato e che la traccia arriva all'ultimo giro — e che l'adattatore
// di scena la sa mettere in pista.
{
  console.log("\nIL RIGIOCA IN DIRETTA (BOX ORA) — multi-sosta, fino alla bandiera\n");
  const Lf = indice.primo_giro + 10;
  const bl = troncato(Lf);
  const soste = [
    { giro: Lf + 1, mescola: 'MEDIUM' },
    { giro: Math.min(Lf + 15, nGiriGara - 1), mescola: 'HARD' },
  ];
  let provato = null;
  for (const drv of Object.keys(indice.piloti).sort()) {
    let esitoRun;
    try {
      esitoRun = rigiocaLive({ byLap: bl, nGiriGara, nomeGara: GARA_SITO,
        pilota: drv, freezeLap: Lf, contestoLive, soste });
    } catch (_) { continue; }
    if (!esitoRun.direttore.approved) continue;
    provato = { drv, ...esitoRun };
    break;
  }
  esito(!!provato, 'almeno un pilota ha un piano a due soste approvato dal Director',
    provato ? `${provato.drv}@${Lf}, soste ai giri ${soste.map((x) => x.giro).join(' e ')}` : 'nessuno');
  if (provato) {
    const passi = provato.risultato.traccia[provato.drv] ?? [];
    const ultimo = passi.length ? passi[passi.length - 1].lap : null;
    esito(ultimo === nGiriGara, 'la gara rigiocata arriva alla BANDIERA, non alla sosta',
      `ultimo giro in traccia ${ultimo} · gara ${nGiriGara}`);
    const inLap = passi.filter((x) => x.in_lap === true).map((x) => x.lap);
    esito(soste.every((x) => inLap.includes(x.giro)), 'tutte e due le soste del piano sono in traccia',
      `in_lap ai giri ${inLap.join(', ')}`);
    esito(provato.risultato.ordine.includes(provato.drv), 'il pilota e\' classificato all\'arrivo proiettato');
    const sim = simDaRigioca({ risultato: provato.risultato, race: { byLap: bl },
      pilota: provato.drv, freeze: Lf });
    esito(!!sim && sim.laps[sim.laps.length - 1] === nGiriGara,
      'l\'adattatore di scena copre la proiezione fino all\'ultimo giro',
      sim ? `giri ${sim.laps[0]}–${sim.laps[sim.laps.length - 1]}` : 'sim nullo');
  }
}

console.log(falliti ? `\nPARITA' ROTTA: ${falliti} controlli falliti.` : '\nparita\' verificata.');
process.exit(falliti ? 1 : 0);
