// gen_hero.mjs — LA HERO NON INVENTA NIENTE.
//
// La hero della landing e' una demo interattiva: mostra una domanda vera del muretto
// («mi fermo adesso o fra tre giri?») e la risposta del MOTORE DI PRODUZIONE. Perche'
// quella risposta sia un dato e non una scenografia, questo generatore chiama un motore
// vero — demo/pitscenario.mjs::evaluatePit e ::traiettoriaPit, demo/gradino.mjs::misura —
// e congela l'esito in demo/data/hero.json.
//
// ATTENZIONE, DAL 31/07/2026 NON E' PIU' IL MOTORE DELLA PAGINA-GARA. gara.html e'
// passata al simulatore nuovo, che pre-calcola le risposte (demo/data/vista/). Questo
// generatore usa ancora il motore precedente, e le due cose NON dicono sempre lo stesso:
// misurato su Belgio/LEC, al congelamento del giro 20 concordano (P1), ma il caso
// "aspetta tre giri" della hero da' P4 mentre la pagina-gara, congelata al giro 23,
// da' P6 — sono due domande vicine e non identiche, e il visitatore non ha modo di
// saperlo. La hero conta anche su 10 vetture dove il simulatore ne conta 20.
//
// Finche' la hero non viene ricostruita sul motore nuovo, la sua targhetta lo DICE
// invece di promettere una parita' che non c'e' piu' (E22: un numero pubblicato con una
// targhetta che non e' stata rimisurata dopo un cambio e' peggio di un numero senza).
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
//   - fermarsi LI' -> si rientra P1, davanti a tutti;
//   - aspettare tre giri e fermarsi in verde -> si rientra P4, dietro PIA di 5,35 s.
// Tre posizioni di differenza a parita' di pilota, di gomma e di pit-loss: la variabile e'
// il MOMENTO. E' esattamente quello che il prodotto sa dire, e l'unica cosa che promette:
// dove rientri, non se conviene.
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

const { evaluatePit } = await import(path.join(DEMO, 'pitscenario.mjs'));
const { misura: misuraSoste } = await import(path.join(DEMO, 'gradino.mjs'));

// ---------------------------------------------------------------- il caso
const CASO = {
  gara: 'Belgio',
  circuito: 'Spa-Francorchamps',
  driver: 'LEC',
  freezeLap: 20,
  pitOra: 20,        // la sosta sotto neutralizzazione
  pitDopo: 23,       // la stessa sosta, tre giri dopo, in verde
  righeTorre: 6,     // quante righe mostra la torre della hero
};

const MIN_SOSTE_UI = 3;      // stessa soglia del pannello (demo/muretto.mjs)
const ZONE = 0;              // CAP_TRAFFICO = false in produzione
const ORIZZONTE = 5;         // stesso orizzonte del pannello quando il gradino c'e'

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

const viva = misuraSoste(byLap, nLaps, L);
const gradino = (viva.gradino != null && viva.n_gradino >= MIN_SOSTE_UI) ? viva.gradino : null;

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
  const r = evaluatePit({ byLap, nLaps, pace, driver: CASO.driver, freezeLap: L, pitLap, pitLoss,
                          present, gara: CASO.gara, laps: G.laps, ZONE,
                          orizzonte: gradino != null ? ORIZZONTE : 0, gradino });
  if (!r.ok) throw new Error(`evaluatePit ${id}: ${r.reason}`);
  // la torre di arrivo: stesso ordine del motore, tagliata alle righe che la hero mostra,
  // ma sempre includendo il pilota instradato (se cadesse fuori dal taglio).
  const ord = r.ordine_previsto;
  const mio = ord.findIndex(([d]) => d === CASO.driver);
  const inizio = Math.max(0, Math.min(mio - Math.floor(CASO.righeTorre / 2), ord.length - CASO.righeTorre));
  const fetta = ord.slice(inizio, inizio + CASO.righeTorre);
  const tt0 = fetta[0][1];
  return {
    id, etichetta, giro: pitLap,
    sotto_sc: r.sotto_neutralizzazione,
    giro_neutralizzato: r.giro_neutralizzato,
    soste_rivali_assunte: r.soste_rivali_assunte,
    pos: r.rientro_pos, su: r.su_totale,
    davanti: r.davanti_ho, gap_davanti: r.gap_ahead == null ? null : +r.gap_ahead.toFixed(2),
    dietro: r.dietro_esco, gap_dietro: r.gap_behind == null ? null : +r.gap_behind.toFixed(2),
    nota_gap: r.nota_gap,
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
       + 'demo/pitscenario.mjs::evaluatePit. ATTENZIONE (31/07/2026): NON e\' piu\' il '
       + 'motore della pagina-gara, che dal 31/07/2026 legge le risposte pre-calcolate '
       + 'del simulatore (data/vista/). Le due non dicono sempre lo stesso: su '
       + 'Belgio/LEC concordano al congelamento del giro 20 (P1), ma il caso "aspetta '
       + 'tre giri" qui da\' P4 e la pagina-gara, congelata al giro 23, da\' P6. '
       + 'La hero va ricostruita sul motore nuovo: finche\' non succede, questa nota e\' '
       + 'il posto in cui la differenza e\' dichiarata invece che nascosta.',
  gara: CASO.gara, circuito: CASO.circuito, n_laps: nLaps,
  giro: L,
  pilota: {
    sig: CASO.driver, team: cellaMia.team, colore: TEAM_COL[cellaMia.team] || '#8b93a5',
    compound: cellaMia.compound, tyre_age: cellaMia.tyre_age,
    pos: ordFreeze.findIndex(([d]) => d === CASO.driver) + 1,
  },
  pitloss: { s: pitLoss, provenienza: 'misurato su questa gara (FastF1)' },
  gradino: gradino == null ? null : { s_giro: +gradino.toFixed(3), n: viva.n_gradino },
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
  console.log(`  delta = ${OUT.delta_posizioni} posizioni · pit-loss ${pitLoss}s · gradino ${gradino?.toFixed(3)} (n=${viva.n_gradino})`);
}
