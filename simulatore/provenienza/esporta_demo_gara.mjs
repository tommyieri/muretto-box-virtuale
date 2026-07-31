#!/usr/bin/env node
// esporta_demo_gara.mjs — il per-giro che il SITO legge, prodotto dalla provenienza nuova.
//
//     node provenienza/esporta_demo_gara.mjs                 tutte le gare 2026
//     node provenienza/esporta_demo_gara.mjs Belgio          una sola
//     node provenienza/esporta_demo_gara.mjs --confronta     non scrive: confronta e basta
//     node provenienza/esporta_demo_gara.mjs --da <file> --nome <Gara> [--stdout]
//         esporta UNA gara da un grezzo qualunque, anche non ancora pinnato
//
// `--stdout` NON e' una comodita': e' cio' che permette a pipeline_gara.py di continuare a
// scrivere nella STAGING invece che dritto in demo/. Quella pipeline ha una regola scritta
// in chiaro — "scrivi la STAGING (mai demo/)" — ed e' la rete che impedisce a una gara
// mezza convertita di finire online. Un esportatore che scrive da se' in demo/ la
// scavalcherebbe: qui si stampa e basta, e chi ci chiama decide dove mettere il risultato.
//
// PERCHE' L'INGRESSO `--da`. Il simulatore legge dal suo data/ PINNATO (manifest per hash,
// regola 7): una gara appena corsa non ci sta ancora, e l'import pinnato e' un atto
// deliberato, non un passo automatico di domenica sera. Con `--da` la pipeline esporta il
// per-giro dal grezzo che ha appena scaricato e validato, senza toccare il pinnato: le due
// cose restano separate, ed e' giusto che lo siano — una e' pubblicazione, l'altra e'
// archiviazione.
//
// PERCHE' ESISTE. Fino a oggi `demo/data/<gara>.json` — pista, torre, timeline, strategia
// gomme, cioe' TUTTO cio' che il sito disegna — usciva dal kernel Python vecchio
// (engine/engine.py via export_demo.py). Finche' e' cosi', quel kernel non si puo'
// cancellare: e' il fornitore dei dati del sito, non un residuo. Questo file prende quel
// lavoro, e lo fa dalla provenienza pinnata: manifest per hash, UNA definizione di verde,
// `status` e `del` grezzi che viaggiano fino in fondo.
//
// COSA CAMBIA DAVVERO, e non e' cosmetico:
//   - le celle vengono dal contratto unico (provenienza/contratto.mjs), non da un adapter
//     pandas che nessuna sentinella guarda;
//   - `neutralized` e `verde` NON sono piu' ricalcolati qui: si importano dal loro unico
//     proprietario (definizioni.mjs). E' la regola 1, quella che nel vecchio repo e'
//     costata il 37% di divergenza replay/live (E12).
//
// DUE DIFFERENZE DI SEMANTICA, misurate e dichiarate — non silenziose:
//
//   1. `neutralized`. Il kernel vecchio (dopo il fix del 28/07) contava neutralizzato uno
//      status con 4, 5 o 6. Qui vale la definizione del simulatore: 4 o 6, perche' la
//      ROSSA NON E' UN REGIME — e' gara sospesa, un'altra cosa. Misurato sul 2026: 16 giri
//      hanno un '5', e TUTTI hanno anche 4 o 6 -> zero celle cambiano valore. La
//      differenza esiste e oggi non morde; il giorno di una rossa pura, mordera'.
//
//   2. IL FILTRO VERDE del passo. Il kernel vecchio voleva `status == '1'` esatto; il
//      simulatore esclude i simboli committati come non-verdi (2 gialla, 4 SC, 5 rossa,
//      6 VSC) e lascia passare il resto. Divergono su 32 giri, tutti con status '71'
//      (VSC in chiusura, simbolo NON committato). Vince il proprietario della
//      definizione: `verde` sta in definizioni.mjs e non si riscrive qui. Lo scostamento
//      sui passi che ne segue e' stampato da --confronta: si guarda, non si indovina.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026, caricaGara } from './gare_2026.mjs';
import { regimeNeutralizzato } from './definizioni.mjs';
import { MESCOLE_SLICK } from './vocabolario.mjs';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_DATA = path.join(RADICE, '..', 'demo', 'data');

// Il sito chiama una gara "Gran Bretagna", il simulatore "GranBretagna" (E24: lo spazio
// spezza i glob). La cartella resta senza spazio; il FILE del sito conserva il suo nome,
// perche' demo/data/manifest.json e mezzo sito ci puntano.
const nomeSito = (g) => g.replace(/([a-z])([A-Z])/g, '$1 $2');

// ————————————————————————————————————————————————————————————————————————————
// IL PASSO LEGACY. Questa e' l'UNICA cosa qui dentro che non appartiene al simulatore
// nuovo: e' la mediana fuel-corretta del kernel vecchio (3 s su 70 kg, convenzione
// pre-2026), e la riproduce perche' i suoi consumatori sono ancora vivi — il pannello
// vecchio di live.html?demo= e quattro test del sito.
//
// NON e' il modello v2: quello vive in engine/passo_v2.mjs e ha un'altra forma. Tenerli
// separati e chiamarli con nomi diversi e' deliberato — due grandezze diverse con lo
// stesso nome sono l'errore E20.
//
// SCADENZA DICHIARATA: questo campo muore col pannello vecchio. Quando live.html passera'
// al motore nuovo, si cancellano questa funzione, il filtro congelato qui sotto e il campo
// `pace` dal file.
//
// IL FILTRO E' CONGELATO, E NON E' UNA SECONDA DEFINIZIONE DI "VERDE".
// Il primo tentativo usava `verde()` di definizioni.mjs — il proprietario, come vuole la
// regola 1. Ma i due filtri divergono su 32 giri con status '71' (VSC in chiusura, simbolo
// NON committato): quello del simulatore li ammette, il kernel vecchio voleva '1' esatto.
// Risultato misurato: 2.199 passi spostati, mediana 0,04 s, punte di 1,57 s.
//
// Cambiare il VALORE di un campo tenendogli il NOME e' E20. `pace` appartiene al pannello
// vecchio: deve continuare a significare quello che significava, finche' quel pannello
// vive. Quindi qui si congela il filtro storico — dichiarato tale, con la sua data di
// morte — invece di far cambiare risposta a un consumatore che nessuno ha migrato.
// La regola 1 non e' violata: questa non e' "la definizione di verde", e' la definizione
// storica di UN campo deprecato, e non la importa nessun altro.
const FUEL_COEFF = 3.0 / 70.0;
function verdeCongelatoDelKernelVecchio(c) {
  return c.lap_time !== null && String(c.status ?? '') === '1' && c.del !== true
      && !c.in_lap && !c.out_lap && MESCOLE_SLICK.has(c.compound);
}
function passoLegacy(celle, nGiri, finoA) {
  // il kernel vecchio prendeva lo stint dell'ULTIMO giro osservato <= finoA, non di finoA:
  // per chi si e' ritirato i due non coincidono, ed e' una differenza che si vede.
  let cur = null;
  for (let k = 1; k <= finoA; k += 1) { const c = celle.get(k); if (c) cur = c; }
  if (!cur || cur.stint === null) return null;
  const v = [];
  for (let k = 1; k <= finoA; k += 1) {
    const c = celle.get(k);
    if (!c || c.stint !== cur.stint) continue;
    if (!verdeCongelatoDelKernelVecchio(c)) continue;
    v.push(c.lap_time - Math.max(0, 70.0 - (70.0 / nGiri) * (k - 1)) * FUEL_COEFF);
  }
  if (v.length < 3) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** I team per pilota: non stanno nel contratto della cella (non sono un fatto del giro). */
function teamPerPilota(fonteAbs) {
  const d = JSON.parse(readFileSync(fonteAbs, 'utf8'));
  const out = {};
  for (let i = 0; i < d.drv.length; i += 1) {
    const drv = d.drv[i];
    if (drv && out[drv] === undefined) out[drv] = d.team?.[i] ?? null;
  }
  return out;
}

export function costruisciDemoGara(nomeGara, gara) {
  const team = teamPerPilota(gara.fonteAbs);
  const drivers = [...gara.perPilota.keys()].sort();
  const laps = [];
  for (let L = 1; L <= gara.nGiri; L += 1) {
    const cars = {};
    for (const drv of drivers) {
      const c = gara.perPilota.get(drv)?.get(L);
      if (!c) continue;
      cars[drv] = {
        team: team[drv] ?? null,
        cum_time: c.cum_time, lap_time: c.lap_time, lap: L,
        stint: c.stint, compound: c.compound, tyre_age: c.tyre_age,
        in_lap: c.in_lap, out_lap: c.out_lap,
        // DERIVATO ALLA FRONTIERA, dal proprietario della definizione: il contratto della
        // cella vieta di congelarlo dentro (E12), ma il sito ne ha bisogno per disegnare.
        neutralized: regimeNeutralizzato(c),
        status: c.status,
        deleted: c.del === true,     // il sito lo chiama `deleted`, il contratto `del`
      };
    }
    if (Object.keys(cars).length) laps.push({ lap: L, cars });
  }
  const pace = {};
  for (let L = 1; L <= gara.nGiri; L += 1) {
    const riga = {};
    for (const drv of drivers) {
      const p = passoLegacy(gara.perPilota.get(drv), gara.nGiri, L);
      if (p !== null) riga[drv] = p;
    }
    pace[String(L)] = riga;
  }
  return { gara: nomeSito(nomeGara), n_laps: gara.nGiri, drivers, laps, pace };
}

function confronta(nuovo, vecchio) {
  const d = { celle: 0, campi: {}, pace_celle: 0, pace_scostamenti: [] };
  const idx = (o) => {
    const m = {};
    for (const lp of o.laps) for (const [drv, c] of Object.entries(lp.cars)) m[`${lp.lap}|${drv}`] = c;
    return m;
  };
  const A = idx(nuovo), B = idx(vecchio);
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k], b = B[k];
    d.celle += 1;
    if (!a || !b) { d.campi.assente = (d.campi.assente ?? 0) + 1; continue; }
    for (const campo of Object.keys(b)) {
      const x = a[campo], y = b[campo];
      const uguale = (typeof x === 'number' && typeof y === 'number') ? Math.abs(x - y) < 1e-9 : x === y;
      if (!uguale) d.campi[campo] = (d.campi[campo] ?? 0) + 1;
    }
  }
  for (const L of Object.keys(vecchio.pace)) {
    for (const [drv, p] of Object.entries(vecchio.pace[L])) {
      const q = nuovo.pace[L]?.[drv];
      d.pace_celle += 1;
      if (q === undefined) { d.pace_scostamenti.push({ L, drv, scarto: null }); continue; }
      if (Math.abs(q - p) > 1e-9) d.pace_scostamenti.push({ L, drv, scarto: q - p });
    }
  }
  for (const L of Object.keys(nuovo.pace)) {
    for (const drv of Object.keys(nuovo.pace[L])) {
      if (vecchio.pace[L]?.[drv] === undefined) d.pace_scostamenti.push({ L, drv, scarto: 'in piu' });
    }
  }
  return d;
}

function main() {
  const argv = process.argv.slice(2);
  const soloConfronto = argv.includes('--confronta');
  const iDa = argv.indexOf('--da');
  const iNome = argv.indexOf('--nome');
  // il VALORE di un'opzione non e' un nome di gara. Con l'opzione assente l'indice vale -1
  // e i+1 vale 0: senza questa guardia si scarterebbe il primo posizionale. E' lo stesso
  // inciampo di --json e di --dove: la terza volta si scrive la guardia, non il commento.
  const valori = new Set([iDa, iNome].filter((i) => i >= 0).map((i) => i + 1));
  const soloQueste = argv.filter((a, i) => !a.startsWith('--') && !valori.has(i));

  if (iDa >= 0) {
    const file = path.resolve(argv[iDa + 1]);
    const nome = iNome >= 0 ? argv[iNome + 1] : path.basename(path.dirname(file));
    const gara = { ...caricaGara(file, nome), fonteAbs: file };
    const obj = costruisciDemoGara(nome, gara);
    if (argv.includes('--stdout')) { process.stdout.write(JSON.stringify(obj)); return; }
    const dest = path.join(DEMO_DATA, `${obj.gara}.json`);
    writeFileSync(dest, JSON.stringify(obj));
    console.log(`${obj.gara}: ${obj.n_laps} giri, ${obj.drivers.length} piloti -> ${path.relative(process.cwd(), dest)}`);
    console.log(`  fonte: ${path.relative(process.cwd(), file)} (NON pinnata: l'import nel data/ del simulatore resta un atto a parte)`);
    return;
  }

  const gare = caricaGare2026(RADICE);

  console.log(soloConfronto ? 'CONFRONTO col file prodotto dal kernel vecchio' : 'ESPORTO il per-giro del sito');
  for (const [nomeGara, gara] of Object.entries(gare)) {
    if (soloQueste.length && !soloQueste.includes(nomeGara)) continue;
    const obj = costruisciDemoGara(nomeGara, gara);
    const dest = path.join(DEMO_DATA, `${obj.gara}.json`);
    if (soloConfronto) {
      const vecchio = JSON.parse(readFileSync(dest, 'utf8'));
      const d = confronta(obj, vecchio);
      const campi = Object.entries(d.campi).map(([k, v]) => `${k}:${v}`).join(' ') || 'nessuno';
      const sc = d.pace_scostamenti;
      const mediano = sc.filter((x) => typeof x.scarto === 'number').map((x) => Math.abs(x.scarto)).sort((a, b) => a - b);
      console.log(`  ${obj.gara.padEnd(16)} celle ${String(d.celle).padStart(5)}  difformi: ${campi}`);
      console.log(`  ${''.padEnd(16)} passo ${String(d.pace_celle).padStart(5)}  scostamenti: ${sc.length}`
        + (mediano.length ? `  mediano ${mediano[mediano.length >> 1].toFixed(4)} s  max ${mediano[mediano.length - 1].toFixed(4)} s` : ''));
    } else {
      // compatto, come scriveva export_demo.py (separators=(',',':')): l'ordine delle
      // chiavi e' lo stesso, quindi il file esce IDENTICO byte a byte e nessun diff di
      // formattazione nasconde una differenza di sostanza.
      writeFileSync(dest, JSON.stringify(obj));
      console.log(`  ${obj.gara.padEnd(16)} ${obj.n_laps} giri, ${obj.drivers.length} piloti`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
