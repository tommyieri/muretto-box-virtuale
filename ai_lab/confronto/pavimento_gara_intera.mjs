// pavimento_gara_intera.mjs — IL PAVIMENTO GIUDICATO CONTRO LA REALTA'.
//
//     node ai_lab/confronto/pavimento_gara_intera.mjs [--json]
//
// PERCHE' ESISTE, ed e' tutta la lezione del tentativo precedente.
//
// `PREREG_compressione_pavimento.md` chiedeva, col cancello C2, che i giri VERDI non
// si muovessero di un bit. Il cancello e' uscito rosso, e la riparazione e' stata
// annullata — ma la diagnosi ha mostrato che C2 era impassabile per costruzione: il
// TETTO AL MOVIMENTO gira sui giri verdi ed e' order-dependent, quindi qualunque
// modifica alla compressione gli cambia il campo sotto e gli fa decidere sorpassi
// diversi. Spegnendo il tetto, i giri verdi diversi erano ZERO su 2.947.
//
// Un cancello che vieta il MOVIMENTO non sa distinguere «la riparazione e' uscita dal
// suo perimetro» da «una seconda meccanica ha reagito». Questo banco cambia la
// domanda: non «cosa si e' mosso» ma **«ci si e' avvicinati o allontanati dalla gara
// vera»**. La verita' d'arrivo non e' order-dependent, e non si puo' tarare.
//
// COSA FA. Le 11 gare, ogni coppia pilota-gara, con la strategia VERA del soggetto e
// le soste vere dei rivali — la stessa configurazione di `gara_intera.mjs` — piu' i
// tre ingressi di laboratorio che `migliora_strategia.mjs` usa gia':
//   · `neutralizzazioneVera`: le finestre SC/VSC/rossa VERE della gara.
//   · `ritiriRivali`: chi si e' ritirato davvero, e quando.
// Senza il primo la compressione si accende SOLO se il campo e' neutralizzato al giro
// di congelamento (5-15): quasi mai. E' per questo che i numeri pubblicati di
// `gara_intera.mjs` non toccano quasi il difetto, e perche' questo banco esiste
// separato invece di essere un flag: sono due domande diverse.
//
// Le stesse quattro misure di PREREG_gara_intera_2.md (G1..G4), piu' il censimento
// dei giri impossibili SULLA STESSA CORSA che produce l'errore di posizione.
//
// NON SCRIVE NIENTE su disco. Non decide niente: i cancelli stanno in
// PREREG_compressione_pavimento_2.md.

import { createHash } from 'node:crypto';
import { gare, garaNuova, contestoNuovo, garaSimDi } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, mediana, media } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
// D5(c) — IL SECONDO BRACCIO. `contesto.tetto === false` spegne il tetto al movimento
// (il costruttore lo prevede apposta per chi misura). Serve a separare il costo del
// PAVIMENTO da quello della REAZIONE del tetto: senza, un D5(a) rosso non saprebbe di chi
// e' la colpa — che e' il buco esatto del 13/08. Non e' una configurazione di produzione.
const TETTO_SPENTO = process.argv.includes('--tetto-spento');

// ── i tre ingressi di laboratorio, montati come in migliora_strategia.mjs ────
function ingressiVeri(nomeSito) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  return { neutraVera, ritiriVeri, piani: pianiVeriDi(nomeSito) };
}

// ── il pavimento del circuito, LA STESSA definizione del Director ────────────
// `pavimenti_2026.json` meno il margine dichiarato. Non una soglia di questo banco:
// e' il numero con cui il Director gia' rifiuta, e per questo non e' un parametro.
// LA CHIAVE E' IL NOME DEL MOTORE, non quello del sito. `pavimenti_2026.json` indicizza
// "GranBretagna"; il sito la chiama "Gran Bretagna". La prima scrittura di questa
// funzione cercava col nome del sito e restituiva `null` in silenzio: la Gran Bretagna
// risultava con ZERO giri sotto il pavimento — e quello zero era un pavimento assente,
// non un vincolo che non morde. Ci finiva dentro come «gara di controllo», cioe' il
// campione del cancello piu' importante era in parte un artefatto.
// Adesso l'assenza ESPLODE (regola 7): un pavimento che manca e' una gara che questo
// banco non puo' giudicare, e deve dirlo, non contarla come pulita.
function pavimentoDi(nomeSito) {
  const c = contestoNuovo(nomeSito);
  const pav = c.costantiDirector?.pavimenti?.gare?.[garaSimDi(nomeSito)];
  const margine = c.costantiDirector?.limiti?.margine_pavimento_s?.valore;
  if (!pav || pav.pavimento_s === null) throw new Error(`pavimento assente per ${nomeSito}: questo banco non la puo' giudicare`);
  if (typeof margine !== 'number') throw new Error('margine_pavimento_s assente nelle costanti del Director');
  return pav.pavimento_s - margine;
}

// ── il censimento sulla traccia: giri impossibili, e quanti sono compressi ───
function censisci(traccia, pavimento, perGiroCompressione) {
  const compressi = new Set(Object.keys(perGiroCompressione ?? {}).map(Number));
  let sotto = 0; let sottoInFinestra = 0; let negativi = 0; let giriCompressi = 0;
  // un pilota senza traccia NON si nasconde: si conta e si stampa. La traccia e' null
  // per chi al congelamento non e' piu' in corsa (ritiro gia' avvenuto), ed e' un
  // caso legittimo — ma il numero deve restare visibile, non essere saltato in
  // silenzio: se crescesse, il censimento starebbe guardando meno gara di quanta ce
  // n'e' e non se ne accorgerebbe nessuno.
  let senzaTraccia = 0;
  // QUANTO manca al pavimento nel giro compresso piu' vicino. Serve a sapere se le
  // gare di controllo di D1 ci arrivano vicine (e allora un bit di virgola mobile
  // potrebbe far scattare il vincolo dove non deve) o se hanno margine.
  let margineMin = Infinity;
  for (const passi of Object.values(traccia ?? {})) {
    if (!Array.isArray(passi)) { senzaTraccia += 1; continue; }
    for (let i = 0; i < passi.length; i += 1) {
      const p = passi[i];
      if (compressi.has(p.lap)) {
        giriCompressi += 1;
        if (pavimento !== null && typeof p.lap_time === 'number') {
          margineMin = Math.min(margineMin, p.lap_time - pavimento);
        }
      }
      if (pavimento !== null && typeof p.lap_time === 'number' && p.lap_time < pavimento) {
        sotto += 1;
        if (compressi.has(p.lap)) sottoInFinestra += 1;
      }
      if (i > 0 && p.cum_time - passi[i - 1].cum_time < 0) negativi += 1;
    }
  }
  return { sotto, sottoInFinestra, negativi, giriCompressi, senzaTraccia, margineMin: Number.isFinite(margineMin) ? Number(margineMin.toFixed(4)) : null };
}

// ── l'impronta: identico AL BIT non e' un modo di dire ───────────────────────
// sha256 su tutti i tempi sul giro e i cumulati, con la precisione piena di JS
// (`toString()` di un double e' esatto: due impronte uguali ⇒ gli stessi bit).
// Serve a D1: sulle gare in cui il pavimento non morde mai, questa deve restare
// la stessa dopo la riparazione — tetto compreso, perche' il tetto vede lo stesso
// campo e quindi deve decidere gli stessi sorpassi.
function impronta(traccia) {
  const h = createHash('sha256');
  for (const drv of Object.keys(traccia ?? {}).sort()) {
    const passi = traccia[drv];
    if (!Array.isArray(passi)) { h.update(`${drv}|nulla\n`); continue; }
    h.update(`${drv}|${passi.map((p) => `${p.lap}:${p.lap_time}:${p.cum_time}`).join(',')}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

// ── esecuzione ───────────────────────────────────────────────────────────────
const casi = [];
const saltati = [];
for (const nomeSito of gare()) {
  const { neutraVera, ritiriVeri, piani } = ingressiVeri(nomeSito);
  const pavimento = pavimentoDi(nomeSito);
  for (const x of perGara(nomeSito)) {
    const e = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera,
      conTraccia: true, tetto: TETTO_SPENTO ? false : null,
    });
    if (e.saltato) { saltati.push(`${nomeSito}/${x.pilota}: ${e.saltato}`); continue; }
    const c = censisci(e.traccia, pavimento, e.neutra_perGiro);
    casi.push({
      gara: nomeSito, pilota: x.pilota, congelamento: e.congelamento,
      errore: e.errore, errore_nullo: e.errore_nullo,
      cambi_reali: e.cambi_reali, cambi_motore: e.cambi_motore,
      neutra_giri: e.neutra_giri, pavimento, director_fatal: e.director_fatal,
      impronta: impronta(e.traccia),
      ...c,
    });
  }
}

const A = casi.map((e) => Math.abs(e.errore));
const N = casi.filter((e) => e.errore_nullo !== null).map((e) => Math.abs(e.errore_nullo));
const G1 = mediana(A);
const G2 = A.filter((x) => x <= 3).length / A.length;
const G3 = media(casi.map((e) => e.errore));
const G4 = N.length ? mediana(N) : null;

const sotto = casi.reduce((s, c) => s + c.sotto, 0);
const sottoIn = casi.reduce((s, c) => s + c.sottoInFinestra, 0);
const negativi = casi.reduce((s, c) => s + c.negativi, 0);
const compressi = casi.reduce((s, c) => s + c.giriCompressi, 0);
const conNeutra = casi.filter((c) => c.neutra_giri > 0).length;
const senzaTraccia = casi.reduce((s, c) => s + c.senzaTraccia, 0);
const conFatal = casi.filter((c) => c.director_fatal > 0).length;
const movMotore = media(casi.map((c) => c.cambi_motore));
const movReale = media(casi.map((c) => c.cambi_reali));

// chiave stabile per l'appaiamento: il confronto prima/dopo si fa sui casi COMUNI,
// mai su due popolazioni diverse (sarebbe il perimetro a vincere, non il merito)
const perCaso = {};
for (const c of casi) perCaso[`${c.gara}/${c.pilota}`] = c;

const fuori = {
  braccio: TETTO_SPENTO ? 'tetto spento' : 'tetto acceso',
  n_casi: casi.length,
  n_saltati: saltati.length,
  // i motivi in chiaro: se un giorno un caso sparisse per una ragione del MOTORE e non
  // del CSV arrivi, il confronto appaiato starebbe cambiando popolazione di nascosto
  motivi_saltati: saltati,
  casi_con_compressione: conNeutra,
  G1_mediana_errore: G1,
  G2_entro_3: Number((G2 * 100).toFixed(1)),
  G3_bias: Number(G3.toFixed(3)),
  G4_nullo: G4,
  errore_medio: Number(media(A).toFixed(3)),
  giri_compressi: compressi,
  giri_sotto_pavimento: sotto,
  giri_sotto_in_finestra: sottoIn,
  giri_negativi: negativi,
  casi_respinti_dal_director: conFatal,
  piloti_senza_traccia: senzaTraccia,
  movimento_motore: Number(movMotore.toFixed(2)),
  movimento_reale: Number(movReale.toFixed(2)),
  perCaso,
};

if (JSON_OUT) {
  console.log(JSON.stringify(fuori, null, 1));
} else {
  console.log('');
  console.log(`  GARA INTERA CON LE FINESTRE VERE — il pavimento contro la realta' [${TETTO_SPENTO ? 'TETTO SPENTO' : 'tetto acceso'}]`);
  console.log(`  ${casi.length} casi utilizzabili · ${saltati.length} saltati · ${conNeutra} con compressione accesa`);
  console.log('');
  console.log(`    G1  mediana |errore|          ${G1}`);
  console.log(`    G2  quota entro ±3 posizioni  ${(G2 * 100).toFixed(1)}%`);
  console.log(`    G3  bias medio con segno      ${G3 >= 0 ? '+' : ''}${G3.toFixed(2)}`);
  console.log(`    G4  modello nullo             ${G4}`);
  console.log(`        |errore| medio motore     ${media(A).toFixed(3)}`);
  console.log('');
  console.log(`    giri compressi                ${compressi}`);
  console.log(`    giri sotto il pavimento       ${sotto}  (di cui in finestra ${sottoIn})`);
  console.log(`    giri di durata negativa       ${negativi}`);
  console.log(`    casi respinti dal Director    ${conFatal} su ${casi.length}`);
  console.log(`    piloti senza traccia          ${senzaTraccia}`);
  console.log(`    movimento motore / reale      ${movMotore.toFixed(2)} / ${movReale.toFixed(2)}`);
  console.log('');
}
