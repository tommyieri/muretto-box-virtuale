// motore.mjs — il ponte fra il MOTORE VERO e la fabbrica dei contenuti.
//
// PERCHE' ESISTE, ed e' la correzione editoriale del 18/08/2026. I primi formati
// raccontavano fatti di Formula 1: quanto costa una sosta, quanto dura una gomma.
// Roba giusta e inutile — quelle cose le sa gia' chi guarda, e soprattutto non
// sono il nostro prodotto. Il prodotto e' UNO: ti fermi adesso o fra qualche
// giro, e il motore ti dice DOVE RIENTRI. Niente altro.
//
// Quindi i contenuti devono venire da li'. Questo script chiede al motore di
// produzione — simulatore/scenario/costruttore.mjs::doveRientri, LO STESSO che
// risponde nella pagina-gara e nella hero — la stessa domanda per due momenti
// diversi, e cerca i casi in cui le due risposte NON coincidono. Quelli sono i
// post: stesso pilota, stessa gomma, stesso pit-loss, cambia solo il momento.
//
// La promessa che il prodotto fa, e che i post devono ripetere senza allargarla,
// e' scritta in gen_hero.mjs: **dove rientri, non se conviene.**
//
//     node ai_lab/social/motore.mjs Belgio           # cerca i casi buoni
//     node ai_lab/social/motore.mjs Belgio --json    # solo JSON, per Python
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DATI = path.join(RADICE, 'demo', 'data');
const SIM = path.join(RADICE, 'simulatore');

const { caricaGare2026 } = await import(path.join(SIM, 'provenienza/gare_2026.mjs'));
const { caricaPrior } = await import(path.join(SIM, 'provenienza/pitloss_dati.mjs'));
const { caricaCostanti } = await import(path.join(SIM, 'scenario/director_dati.mjs'));
const { doveRientri } = await import(path.join(SIM, 'scenario/costruttore.mjs'));

const leggi = (f) => JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8'));

// QUANTO ASPETTARE. «Fra tre giri» e' la domanda che si sente davvero alla radio,
// ed e' quella della hero. Non e' un parametro da girare a caso: cambiarlo cambia
// la domanda, quindi se cambia va cambiata anche la scritta sul post.
const ATTESA = 3;

export function cerca(nomeGara, { attesa = ATTESA, quanti = 6 } = {}) {
  const G = leggi(`${nomeGara}.json`);
  const gare = caricaGare2026(SIM);
  const nomeSim = nomeGara.replace(/\s+/g, '');
  const garaSim = gare[nomeSim];
  if (!garaSim) return { errore: `il simulatore non conosce ${nomeSim}` };

  const CONTESTO = {
    gare,
    modello: JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/modello_v2.json'), 'utf8')),
    prior: caricaPrior(SIM),
    costantiDirector: caricaCostanti(SIM),
    bandaRientro: JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/banda_rientro.json'), 'utf8')),
    nGiriGara: garaSim.nGiri,
  };

  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const TEAM = JSON.parse(fs.readFileSync(path.join(RADICE, 'demo', 'team_colori.json'), 'utf8'));
  const n = G.n_laps;

  // LA FINESTRA. Fuori dal 22%-62% della gara la domanda non e' interessante:
  // troppo presto nessuno si ferma, troppo tardi la sosta non si recupera piu'.
  const daGiro = Math.max(6, Math.round(n * 0.22));
  const aGiro = Math.round(n * 0.62);

  const casi = [];
  for (let L = daGiro; L <= aGiro; L++) {
    const auto = byLap[L];
    if (!auto) continue;
    const pace = G.pace[L] || {};
    // solo chi sta davanti: una scelta strategica su chi e' 15° non interessa
    const ordine = Object.entries(auto)
      .filter(([, c]) => typeof c.cum_time === 'number')
      .sort((a, b) => a[1].cum_time - b[1].cum_time)
      .slice(0, 6)
      .map(([d]) => d);

    for (const pilota of ordine) {
      if (pace[pilota] == null) continue;
      const mescola = garaSim.perPilota.get(pilota)?.get(L)?.compound ?? null;
      if (!mescola) continue;
      let ora, dopo;
      try {
        ora = doveRientri({ gara: nomeSim, freezeLap: L, pilota, giroPit: L + 1, mescola }, CONTESTO);
        dopo = doveRientri({ gara: nomeSim, freezeLap: L, pilota, giroPit: L + 1 + attesa, mescola }, CONTESTO);
      } catch (e) { continue; }
      if (!ora || !dopo) continue;
      if (ora.approvato === false || dopo.approvato === false) continue;
      if (ora.posizione == null || dopo.posizione == null) continue;

      const posOra = ordine.indexOf(pilota) + 1;   // solo per riferimento visivo
      const posReale = Object.entries(auto)
        .filter(([, c]) => typeof c.cum_time === 'number')
        .sort((a, b) => a[1].cum_time - b[1].cum_time)
        .findIndex(([d]) => d === pilota) + 1;

      casi.push({
        gara: nomeGara,
        circuito: G.circuito ?? null,
        pilota,
        team: auto[pilota].team,
        colore: TEAM[auto[pilota].team] ?? '#8A8F98',
        n_giri: n,
        giro: L,
        pos_al_congelamento: posReale,
        mescola,
        attesa,
        box_ora: { giro_pit: L + 1, posizione: ora.posizione, giro_rientro: ora.giro_di_rientro ?? null },
        box_dopo: { giro_pit: L + 1 + attesa, posizione: dopo.posizione, giro_rientro: dopo.giro_di_rientro ?? null },
        differenza: dopo.posizione - ora.posizione,
      });
      void posOra;
    }
  }

  // I casi buoni sono quelli in cui il MOMENTO cambia la risposta. Se le due
  // scelte danno la stessa posizione il post non ha niente da dire — ed e' giusto
  // che non esista, invece di essere gonfiato con un aggettivo.
  const utili = casi.filter((c) => c.differenza !== 0);
  utili.sort((a, b) => Math.abs(b.differenza) - Math.abs(a.differenza) || a.giro - b.giro);

  // uno per pilota: sei post sullo stesso pilota non sono sei post
  const visti = new Set();
  const scelti = [];
  for (const c of utili) {
    if (visti.has(c.pilota)) continue;
    visti.add(c.pilota);
    scelti.push(c);
    if (scelti.length >= quanti) break;
  }
  return { gara: nomeGara, esaminati: casi.length, con_differenza: utili.length, casi: scelti };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gara = process.argv[2];
  if (!gara) { console.error('uso: node ai_lab/social/motore.mjs <Gara> [--json]'); process.exit(1); }
  const r = cerca(gara);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
  if (r.errore) { console.error(r.errore); process.exit(1); }
  console.log(`${r.gara}: ${r.esaminati} scenari provati, ${r.con_differenza} in cui il momento cambia la risposta\n`);
  for (const c of r.casi) {
    console.log(`  giro ${String(c.giro).padStart(2)}  ${c.pilota}  (P${c.pos_al_congelamento}, ${c.mescola})`
      + `   box ora -> P${c.box_ora.posizione}   fra ${c.attesa} giri -> P${c.box_dopo.posizione}`
      + `   [${c.differenza > 0 ? '+' : ''}${c.differenza}]`);
  }
}
