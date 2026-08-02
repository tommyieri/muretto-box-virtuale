// gen_hero.mjs — LA HERO NON INVENTA NIENTE.
//
// La hero della landing e' una demo interattiva: mostra una domanda vera del muretto
// («mi fermo adesso o fra tre giri?») e la risposta del MOTORE DI PRODUZIONE. Perche'
// quella risposta sia un dato e non una scenografia, questo generatore chiama un motore
// vero — simulatore/scenario/costruttore.mjs::doveRientri — e congela l'esito in
// demo/data/hero.json.
//
// ED E' LO STESSO MOTORE DELLA PAGINA-GARA, dal 01/08/2026. Per quattro giorni non lo
// e' stato: il 31/07 gara.html era passata al simulatore nuovo (risposte pre-calcolate
// in demo/data/vista/) mentre questa hero girava ancora sul motore precedente, e le due
// rispondevano vicino ma non uguale — al congelamento del giro 20 su Belgio/LEC
// concordavano (P1), ma il caso "aspetta tre giri" dava P4 di qua e P6 di la', e il
// visitatore non aveva modo di saperlo. Quella divergenza e' CHIUSA alla radice: non e'
// stata dichiarata meglio, e' stato cambiato il motore. Qui sotto si carica lo stesso
// contesto e le stesse costanti che passa simulatore/web/genera_vista_gara.mjs, e la
// targhetta scritta in hero.json (campo `_nota`) lo dice per esteso.
//
// Chi tocca questo file tenga il patto E22 in mente al contrario di come si e' abituati:
// non basta che il numero sia giusto oggi: se il motore cambia ancora, cambiano INSIEME
// questa chiamata e quella riga di targhetta, altrimenti torna un numero pubblicato che
// promette una parita' che nessuno ha piu' rimisurato.
//
// REGOLA DELLA CASA: nessun file dati senza generatore. hero.json non si scrive a mano;
// se cambia il motore, si rilancia questo e la hero cambia con lui.
//
//     node gen_hero.mjs            # scrive demo/data/hero.json
//     node gen_hero.mjs --stdout   # stampa e basta (controllo)
//
// SCELTA DEL CASO (Belgio 2026, congelamento al giro 20, LEC). Non e' arbitraria: e' il
// caso in cui la lezione del muretto si vede a occhio nudo in cinque secondi.
//   - al giro 20 il campo e' neutralizzato (20 vetture su 22 col flag): la sosta costa meno
//     e i rivali a pari giro ancora al 1° stint si fermano con te (assunzione dichiarata);
//   - fermarsi LI' e aspettare tre giri danno due posizioni di rientro DIVERSE, ed e'
//     tutto qui: stesso pilota, stessa gomma, stesso pit-loss — la variabile e' il MOMENTO.
// E' esattamente quello che il prodotto sa dire, e l'unica cosa che promette: dove rientri,
// non se conviene.
//
// I NUMERI DI QUEL CONFRONTO NON STANNO PIU' IN QUESTO COMMENTO, e non e' pignoleria:
// ci stavano, dicevano «P1 contro P4, tre posizioni», e sono invecchiati in silenzio senza
// che nessuno se ne accorgesse. Il posto dei numeri e' demo/data/hero.json, che e' generato:
// chi li vuole li legge di li'.
//
// DERIVA MISURATA IL 02/08/2026, APERTA. `node gen_hero.mjs --stdout` oggi NON riproduce il
// hero.json committato: pubblicato P1 -> P6 (delta 5), rigenerato P4 -> P6 (delta 2). Il
// motore e' lo stesso — a muoversi sono stati i dati sotto, che si ri-stimano a ogni gara —
// ma il hero.json in pagina porta gia' la targhetta del motore nuovo, quindi e' un numero
// pubblicato che nessuno ha piu' rimisurato dopo un cambio: E22, di nuovo e per altra via.
// Rigenerarlo cambia la landing pubblica: e' una decisione del PO, non l'effetto collaterale
// di una correzione ai commenti. Percio' qui resta SCRITTO, non fatto.
//
// COSA NON C'E' E PERCHE'. Nessun numero cambia con la MESCOLA. Sul fondo 2026 la
// differenza fra mescole su gradino, warm-up e degrado non si distingue dal caso
// (p=0,24 / 0,58 / 0,25) — vedi demo/muretto.mjs::righeMescola. La hero mostra i tre
// bottoni gomma perche' sono il gesto vero del muretto, ma con la stessa nota del
// pannello: la mescola non muove la risposta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.join(QUI, 'demo');
const DATI = path.join(DEMO, 'data');

// IL MOTORE E' QUELLO DELLA PAGINA-GARA. Questo generatore gira in Node alla
// radice del repo, quindi puo' importare da simulatore/ direttamente: non ha i
// vincoli del browser, e non deve passare dagli artefatti trasportati.
const SIM = path.join(QUI, 'simulatore');
const { caricaGare2026 } = await import(path.join(SIM, 'provenienza/gare_2026.mjs'));
const { caricaPrior } = await import(path.join(SIM, 'provenienza/pitloss_dati.mjs'));
const { caricaCostanti } = await import(path.join(SIM, 'scenario/director_dati.mjs'));
const { doveRientri } = await import(path.join(SIM, 'scenario/costruttore.mjs'));
// LA PERDITA AI BOX dalla stessa funzione che chiama il costruttore: una
// definizione, un posto (regola 1). Vedi la nota al campo `pitloss` più sotto.
const { perditaBox } = await import(path.join(SIM, 'provenienza/pitloss.mjs'));

// ---------------------------------------------------------------- il caso
const CASO = {
  gara: 'Belgio',
  circuito: 'Spa-Francorchamps',
  driver: 'LEC',
  freezeLap: 20,
  // LA SOSTA E' AL GIRO DOPO IL CONGELAMENTO, non sullo stesso giro. Il motore
  // nuovo rifiuta una sosta nel passato o nell'istante congelato — e ha ragione:
  // al giro 20 la macchina il giro 20 lo ha gia' fatto. E' anche la convenzione
  // della pagina-gara, quindi le due ora rispondono alla stessa domanda.
  pitOra: 21,        // la sosta sotto la neutralizzazione osservata al giro 20
  pitDopo: 24,       // la stessa sosta, tre giri dopo
  righeTorre: 6,     // quante righe mostra la torre della hero
};

// RESIDUI DEL MOTORE VECCHIO, non piu' letti da nessuno. Erano i parametri che si
// passavano a evaluatePit; doveRientri prende le sue costanti dal contesto caricato
// sopra (caricaCostanti / modello_v2.json), quindi questi tre non entrano piu' in
// nessuna chiamata. Restano qui solo perche' toglierli e' codice, non commento: vanno
// rimossi, ma in un cambio che si dichiara tale.
const MIN_SOSTE_UI = 3;      // era: soglia soste del pannello vecchio — NON USATA
const ZONE = 0;              // era: CAP_TRAFFICO = false — NON USATA
const ORIZZONTE = 5;         // era: orizzonte del pannello vecchio — NON USATA

const leggi = (f) => JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8'));
const G = leggi(`${CASO.gara}.json`);
const PITLOSS = leggi('pitloss.json');
const PISTA = leggi(`pista_${CASO.gara}.json`);
const TEAM_COL = JSON.parse(fs.readFileSync(path.join(DEMO, 'team_colori.json'), 'utf8'));

const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
const nLaps = G.n_laps;
const pitLoss = PITLOSS[CASO.gara];
if (pitLoss == null) throw new Error(`pit-loss assente per ${CASO.gara}`);

const L = CASO.freezeLap;
const pace = G.pace[L] || {};
const present = G.drivers.filter(d => typeof byLap[L]?.[d]?.cum_time === 'number' && pace[d] != null);
if (!present.includes(CASO.driver)) throw new Error(`${CASO.driver} non simulabile al giro ${L}`);

// il contesto del motore nuovo: gli STESSI oggetti che passa
// simulatore/web/genera_vista_gara.mjs, cosi' hero e pagina-gara non possono
// rispondere con due tarature diverse
const RAD_SIM = SIM;
const gareSim = caricaGare2026(RAD_SIM);
const nomeSim = CASO.gara.replace(/\s+/g, '');
const garaSim = gareSim[nomeSim];
if (!garaSim) throw new Error(`il simulatore non conosce la gara ${nomeSim}`);
const modelloSim = JSON.parse(fs.readFileSync(path.join(RAD_SIM, 'data/modelli/modello_v2.json'), 'utf8'));
const CONTESTO = {
  gare: gareSim,
  modello: modelloSim,
  prior: caricaPrior(RAD_SIM),
  costantiDirector: caricaCostanti(RAD_SIM),
  bandaRientro: JSON.parse(fs.readFileSync(path.join(RAD_SIM, 'data/modelli/banda_rientro.json'), 'utf8')),
  nGiriGara: garaSim.nGiri,
};
const mescolaMia = garaSim.perPilota.get(CASO.driver)?.get(L)?.compound ?? null;
if (mescolaMia === null) throw new Error(`${CASO.driver} non ha mescola nota al giro ${L}`);

// ------------------------------------------------------- torre al congelamento
const ordFreeze = present
  .map(d => [d, byLap[L][d].cum_time])
  .sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
const t0 = ordFreeze[0][1];
const rigaDi = (sig, pos, gap) => {
  const c = byLap[L][sig];
  return { sig, pos, team: c.team, colore: TEAM_COL[c.team] || '#8b93a5',
           gap: gap == null ? null : +gap.toFixed(3) };
};
const torrePartenza = ordFreeze
  .slice(0, CASO.righeTorre)
  .map(([d, t], i) => rigaDi(d, i + 1, i === 0 ? null : t - t0));

// ------------------------------------------------------------ le due scelte
function scelta({ id, etichetta, pitLap }) {
  const r = doveRientri({ gara: nomeSim, freezeLap: L, pilota: CASO.driver, giroPit: pitLap,
                          mescola: mescolaMia }, CONTESTO);
  if (r.approvato === false) {
    throw new Error(`il Director rifiuta lo scenario ${id}: `
      + r.direttore.violazioni.filter((v) => v.severita === 'FATAL').map((v) => v.messaggio ?? v.codice).join(' · '));
  }
  if (r.posizione === null || r.posizione === undefined) throw new Error(`nessuna posizione per ${id}`);

  // LA TORRE DI ARRIVO dalla TRACCIA del motore: i cumulati previsti al giro di
  // rientro, ordinati. Non e' un secondo calcolo — e' lo stesso oggetto da cui il
  // motore ha ricavato la posizione, riletto per mostrarlo.
  const G_ = r.giro_di_rientro;
  const ord = [];
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) {
    const p = (passi ?? []).find((x) => x.lap === G_);
    if (p && typeof p.cum_time === 'number') ord.push([drv, p.cum_time]);
  }
  ord.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const mio = ord.findIndex(([d]) => d === CASO.driver);
  const inizio = Math.max(0, Math.min(mio - Math.floor(CASO.righeTorre / 2), ord.length - CASO.righeTorre));
  const fetta = ord.slice(inizio, inizio + CASO.righeTorre);
  const tt0 = fetta.length ? fetta[0][1] : 0;
  const gapDi = (v) => (v && typeof v.gap_s === 'number' ? +v.gap_s.toFixed(2) : null);
  return {
    id, etichetta, giro: pitLap,
    sotto_sc: r.perdita.fattore !== 1,
    giro_neutralizzato: r.perdita.fattore !== 1,
    // il motore nuovo NON assume soste dei rivali: e' un'assunzione in meno, e va
    // detta invece di lasciare il campo a zero come se non fosse mai esistita
    soste_rivali_assunte: 0,
    pos: r.posizione, su: r.su_quanti,
    davanti: r.davanti?.drv ?? null, gap_davanti: gapDi(r.davanti),
    dietro: r.dietro?.drv ?? null, gap_dietro: gapDi(r.dietro),
    nota_gap: r.gap_soppressi ?? null,
    banda: r.banda_posizione ? { da: r.banda_posizione.da, a: r.banda_posizione.a } : null,
    torre: fetta.map(([d, t], i) => {
      const c = byLap[L][d] || {};
      return { sig: d, pos: inizio + i + 1, team: c.team || null,
               colore: TEAM_COL[c.team] || '#8b93a5',
               gap: i === 0 ? null : +(t - tt0).toFixed(2),
               io: d === CASO.driver };
    }),
  };
}

const ora = scelta({ id: 'ora', etichetta: 'BOX ORA', pitLap: CASO.pitOra });
const dopo = scelta({ id: 'dopo', etichetta: `ASPETTA ${CASO.pitDopo - CASO.pitOra} GIRI`, pitLap: CASO.pitDopo });

// -------------------------------------------------------------- la pista (SVG)
// Il tracciato e' il giro GPS di gen_pista_svg.py, gia' parametrizzato in distanza.
// Qui diventa solo un path SVG chiuso: stesso nastro della pagina-gara, altra tecnica.
const d3 = (n) => +n.toFixed(1);
const aPath = (punti, chiuso) =>
  punti.map((p, i) => `${i ? 'L' : 'M'}${d3(p[0])} ${d3(p[1])}`).join('') + (chiuso ? 'Z' : '');

const P = PISTA.punti;
const PL = PISTA.pitlane;
// start/finish: tacca perpendicolare al senso di marcia nel punto 0
const dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1];
const ang = Math.atan2(dy, dx) * 180 / Math.PI;

// ------------------------------------------------------------------- mescole
// Non muovono la risposta (vedi testa del file). Qui c'e' solo cosa il pilota HA su e
// quanto e' durata OGGI ciascuna mescola in questa gara — un conteggio, non una stima.
const cellaMia = byLap[L][CASO.driver];
const durate = {};
for (const c of ['SOFT', 'MEDIUM', 'HARD']) {
  let max = 0;
  for (let l = 1; l <= nLaps; l++) {
    for (const d of G.drivers) {
      const x = byLap[l]?.[d];
      if (x && x.compound === c && x.tyre_age > max) max = x.tyre_age;
    }
  }
  durate[c] = max || null;
}

const OUT = {
  _nota: 'GENERATO da gen_hero.mjs — non modificare a mano. I numeri vengono da '
       + 'simulatore/scenario/costruttore.mjs::doveRientri, LO STESSO MOTORE della '
       + 'pagina-gara (dal 01/08/2026), con lo stesso contesto e le stesse costanti. '
       + 'La sosta "BOX ORA" e\' al giro dopo il congelamento, come in pagina-gara: il '
       + 'motore rifiuta una sosta nell\'istante congelato, e ha ragione.',
  gara: CASO.gara, circuito: CASO.circuito, n_laps: nLaps,
  giro: L,
  pilota: {
    sig: CASO.driver, team: cellaMia.team, colore: TEAM_COL[cellaMia.team] || '#8b93a5',
    compound: cellaMia.compound, tyre_age: cellaMia.tyre_age,
    pos: ordFreeze.findIndex(([d]) => d === CASO.driver) + 1,
  },
  // IL PIT-LOSS CHE IL MOTORE USA, non un altro.
  //
  // Qui stava `pitLoss` — cioè demo/data/pitloss.json, il costo REALIZZATO dalle
  // soste di quella domenica — con sopra la frase «misurato su questa gara
  // (FastF1)», accanto a una risposta che il motore calcola con la perdita
  // TIPICA del circuito misurata sul fondo. È lo stesso difetto corretto nel
  // badge della pagina-gara il 02/08 (12c99f8), sopravvissuto sulla PRIMA
  // schermata del sito perché il generatore della hero è un altro file.
  //
  // Il realizzato non può entrare nel calcolo: al giro del congelamento quanto
  // costeranno le soste di oggi nessuno lo sa (E14). Resta come nota, dove
  // esiste ed è diverso.
  pitloss: (() => {
    const p = perditaBox(CONTESTO.prior, nomeSim, null);
    const nota = typeof pitLoss === 'number' && Math.abs(pitLoss - p.perdita_verde) >= 0.05
      ? pitLoss : null;
    return {
      s: p.perdita_verde,
      provenienza: p.fallback ? 'non misurato: valore di ripiego dichiarato' : 'usato dal motore',
      targhetta: p.targhetta,
      circuito: p.circuito,
      fallback: p.fallback,
      // fatto vero e POST-GARA: si mostra, non si calcola
      realizzato_in_gara_s: nota,
    };
  })(),
  // IL GRADINO NON ESISTE PIU', ed e' la differenza fra i due modelli. Il vecchio
  // dava alla gomma nuova uno sconto COSTANTE per sempre — ed e' l'errore E01 del
  // catalogo, quello che produceva "fermati subito" nel 100% dei casi. Il modello
  // nuovo non ha uno sconto: ha un DEGRADO che la sosta azzera. La riga di
  // provenienza della hero mostra percio' quello, che e' la grandezza vera.
  degrado: {
    rho_s_giro: modelloSim.rho.valore,
    n_giri: modelloSim._targhetta.n_giri_verdi,
    targhetta: modelloSim.rho.targhetta,
  },
  neutralizzazione: {
    attiva: ora.giro_neutralizzato,
    vetture: Object.values(byLap[L]).filter(c => c.neutralized).length,
    su: Object.keys(byLap[L]).length,
  },
  mescole: { monta: cellaMia.compound, durata_max_oggi: durate },
  torre_partenza: torrePartenza,
  scelte: [ora, dopo],
  delta_posizioni: dopo.pos - ora.pos,
  pista: {
    viewBox: PISTA.viewBox,
    d: aPath(P, true),
    pit_d: PL ? aPath(PL.punti, false) : null,
    sf: { x: d3(P[0][0]), y: d3(P[0][1]), ang: +ang.toFixed(1) },
    frazione_ingresso: PL?.frazione_ingresso ?? 0.95,
    frazione_uscita: PL?.frazione_uscita ?? 0.05,
    sorgente: PISTA.sorgente,
  },
};

const testo = JSON.stringify(OUT);
if (process.argv.includes('--stdout')) {
  console.log(JSON.stringify(OUT, null, 2));
} else {
  fs.writeFileSync(path.join(DATI, 'hero.json'), testo);
  console.log(`hero.json scritto — ${(testo.length / 1024).toFixed(1)} KB`);
  console.log(`  ${CASO.gara} giro ${L} · ${CASO.driver} P${OUT.pilota.pos} ${cellaMia.compound}/${cellaMia.tyre_age}g`);
  console.log(`  ${ora.etichetta} (giro ${ora.giro}${ora.sotto_sc ? ', sotto SC' : ''}) -> P${ora.pos}/${ora.su}`);
  console.log(`  ${dopo.etichetta} (giro ${dopo.giro}) -> P${dopo.pos}/${dopo.su}, dietro ${dopo.davanti} di ${dopo.gap_davanti}s`);
  console.log(`  delta = ${OUT.delta_posizioni} posizioni · pit-loss ${OUT.pitloss.s}s (${OUT.pitloss.provenienza})`
    + `${OUT.pitloss.realizzato_in_gara_s != null ? ` · in gara ${OUT.pitloss.realizzato_in_gara_s}s` : ''}`
    + ` · degrado ${OUT.degrado.rho_s_giro} s/giro per giro`);
}
