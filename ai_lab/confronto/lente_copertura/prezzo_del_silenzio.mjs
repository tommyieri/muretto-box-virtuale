#!/usr/bin/env node
// prezzo_del_silenzio.mjs — QUANTO costa MIN_GIRI_BASE = 8 sul bersaglio vero.
//
// Le soste vere sono 274 e il silenzio del nuovo la' vale 14 casi: e' il perimetro
// del CONFRONTO, non quello del PRODOTTO. Il prodotto e' la vista — ogni pilota,
// ogni giro dal 5 in poi — e li' il silenzio si conta a migliaia. Questo script
// misura la taglia del premio (quante caselle si accendono) e il primo effetto
// collaterale (il CAMPO: abbassando la soglia entrano rivali, e il denominatore
// cambia anche per le risposte che gia' c'erano).
//
// Uso: node ai_lab/confronto/lente_copertura/prezzo_del_silenzio.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { casi, contestoNuovo, garaNuova, gare, RADICE } from '../banco.mjs';
import { doveRientri, impostaMinGiriBase } from './costruttore_param.mjs';
import { osservazioniVerdi } from '../../../simulatore/provenienza/gare_indice.mjs';
import { mescolaAlGiro } from '../../../simulatore/scenario/risposta.mjs';

const SOGLIE = [8, 7, 6, 5, 4, 3, 2];
const PRIMO_CONGELAMENTO = 5;   // simulatore/web/genera_vista_gara.mjs
const GIRI_MINIMI_DOPO = 3;
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : 'n/d');

// ═══ 1 · LA GRIGLIA DELLA VISTA: quante caselle si accendono ═══
// La copertura del nuovo e' decisa da UNA condizione (regola 6: il pilota ha una
// base?), quindi si conta invece di simulare — ma la conta va VERIFICATA contro il
// motore vero, che e' cio' che fa il blocco 2.
console.log('═══ 1 · LA GRIGLIA DELLA VISTA (ogni pilota, ogni giro di congelamento) ═══');
const perSoglia = new Map(SOGLIE.map((s) => [s, { tot: 0, ok: 0, perLf: new Map() }]));
let celleTotali = 0;
const perGara = {};
for (const nomeSito of gare()) {
  const g = garaNuova(nomeSito);
  const verdiPer = new Map();
  for (const { drv, lap } of osservazioniVerdi(g.righe)) {
    if (!verdiPer.has(drv)) verdiPer.set(drv, []);
    verdiPer.get(drv).push(lap);
  }
  const ultimo = g.nGiri - GIRI_MINIMI_DOPO;
  perGara[nomeSito] = {};
  for (const [pilota, celle] of g.perPilota) {
    for (let Lf = PRIMO_CONGELAMENTO; Lf <= ultimo; Lf += 1) {
      const c = celle.get ? celle.get(Lf) : celle[Lf];
      if (!c) continue;                      // il pilota non e' in pista a quel giro
      if (typeof c.cum_time !== 'number') continue;
      celleTotali += 1;
      const verdi = (verdiPer.get(pilota) ?? []).filter((l) => l <= Lf).length;
      for (const s of SOGLIE) {
        const r = perSoglia.get(s);
        r.tot += 1;
        const ok = verdi >= s;
        if (ok) r.ok += 1;
        if (!r.perLf.has(Lf)) r.perLf.set(Lf, { tot: 0, ok: 0 });
        const q = r.perLf.get(Lf); q.tot += 1; if (ok) q.ok += 1;
        if (s === 8 || s === 4) { perGara[nomeSito][s] ??= { tot: 0, ok: 0 }; perGara[nomeSito][s].tot += 1; if (ok) perGara[nomeSito][s].ok += 1; }
      }
    }
  }
}
console.log(`caselle (pilota × giro) nella finestra della vista: ${celleTotali}`);
for (const s of SOGLIE) {
  const r = perSoglia.get(s);
  console.log(`  minGiri=${s}: base disponibile ${r.ok}/${r.tot} ${pc(r.ok, r.tot)}   (+${r.ok - perSoglia.get(8).ok} rispetto a 8)`);
}
console.log('\n  copertura per giro di congelamento (Lf: soglia8 → soglia4):');
const lfs = [...perSoglia.get(8).perLf.keys()].sort((a, b) => a - b).filter((l) => l <= 26);
for (const Lf of lfs) {
  const a = perSoglia.get(8).perLf.get(Lf), b = perSoglia.get(4).perLf.get(Lf), c = perSoglia.get(5).perLf.get(Lf);
  console.log(`    Lf=${String(Lf).padStart(2)}  ${String(a.ok).padStart(4)}/${String(a.tot).padStart(4)} ${pc(a.ok, a.tot).padStart(6)} → (5) ${pc(c.ok, c.tot).padStart(6)} → (4) ${pc(b.ok, b.tot).padStart(6)}`);
}

// ═══ 2 · VERIFICA: la conta corrisponde al motore vero? ═══
console.log('\n═══ 2 · VERIFICA DELLA CONTA contro il motore (soste vere, 274 casi) ═══');
const elenco = casi();
for (const s of [8, 4]) {
  impostaMinGiriBase(s);
  let parla = 0, contati = 0, disaccordi = 0;
  for (const c of elenco) {
    const g = garaNuova(c.gara);
    const verdi = osservazioniVerdi(g.righe).filter((o) => o.drv === c.pilota && o.lap <= c.freezeLap).length;
    const previsto = verdi >= s;
    if (previsto) contati += 1;
    const scelta = mescolaAlGiro(g, c.freezeLap, c.pilota);
    let ok = false;
    if (scelta !== null) {
      try {
        const r = doveRientri({ gara: c.garaSim, freezeLap: c.freezeLap, pilota: c.pilota, giroPit: c.pitLap, mescola: scelta }, contestoNuovo(c.gara));
        ok = r?.approvato === true && r.posizione !== null && r.posizione !== undefined;
      } catch { ok = false; }
    }
    if (ok) parla += 1;
    if (ok !== previsto) disaccordi += 1;
  }
  console.log(`  minGiri=${s}: motore parla ${parla}/274 · conta prevede ${contati}/274 · disaccordi ${disaccordi}`);
}

// ═══ 3 · L'EFFETTO COLLATERALE: il CAMPO delle risposte che c'erano gia' ═══
// M1 ha misurato che il denominatore vale ~0,9 posizioni di bias. Abbassando la
// soglia entrano rivali: il campo si allarga anche dove il motore gia' rispondeva.
console.log('\n═══ 3 · IL CAMPO (su_quanti) DELLE RISPOSTE GIA\' ESISTENTI ═══');
const risp = new Map();
for (const s of [8, 4]) {
  impostaMinGiriBase(s);
  const m = new Map();
  for (const c of elenco) {
    const g = garaNuova(c.gara);
    const scelta = mescolaAlGiro(g, c.freezeLap, c.pilota);
    if (scelta === null) { m.set(c.id, null); continue; }
    try {
      const r = doveRientri({ gara: c.garaSim, freezeLap: c.freezeLap, pilota: c.pilota, giroPit: c.pitLap, mescola: scelta }, contestoNuovo(c.gara));
      m.set(c.id, (r?.approvato === true && r.posizione != null) ? { pos: r.posizione, su: r.su_quanti } : null);
    } catch { m.set(c.id, null); }
  }
  risp.set(s, m);
}
let campoCresce = 0, campoUguale = 0, posCambia = 0, meglio = 0, peggio = 0, n = 0;
const scarti = [];
for (const c of elenco) {
  const a = risp.get(8).get(c.id), b = risp.get(4).get(c.id);
  if (!a || !b) continue;
  n += 1;
  if (b.su > a.su) campoCresce += 1; else campoUguale += 1;
  scarti.push(b.su - a.su);
  if (b.pos !== a.pos) {
    posCambia += 1;
    const ea = Math.abs(a.pos - c.posizioneVera), eb = Math.abs(b.pos - c.posizioneVera);
    if (eb < ea) meglio += 1; else if (eb > ea) peggio += 1;
  }
}
const med = (v) => { const s = [...v].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2; };
console.log(`  risposte presenti a entrambe le soglie: ${n}`);
console.log(`  il campo CRESCE in ${campoCresce}/${n} · resta uguale in ${campoUguale} · scarto mediano ${med(scarti)} · massimo ${Math.max(...scarti)}`);
console.log(`  la posizione cambia in ${posCambia}/${n}: migliora ${meglio}, peggiora ${peggio}`);

// ═══ 4 · LA VISTA GIA' PUBBLICATA: quanto silenzio c'e' davvero ═══
console.log('\n═══ 4 · LA VISTA PUBBLICATA (demo/data/vista) ═══');
const dirV = path.join(RADICE, 'demo', 'data', 'vista');
if (existsSync(dirV)) {
  let tot = 0, senza = 0, curvaVuota = 0;
  const senzaPerLf = new Map();
  for (const gdir of readdirSync(dirV, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(path.join(dirV, gdir.name)).filter((f) => f.endsWith('.json') && !f.includes('fantasma') && f !== 'indice.json')) {
      const j = JSON.parse(readFileSync(path.join(dirV, gdir.name, f), 'utf8'));
      for (const g of j.giri ?? []) {
        tot += 1;
        if (g.senza_risposta) {
          senza += 1;
          senzaPerLf.set(g.freeze_lap, (senzaPerLf.get(g.freeze_lap) ?? 0) + 1);
        } else if (!g.quando?.curva?.length) curvaVuota += 1;
      }
    }
  }
  console.log(`  record ${tot} · senza_risposta ${senza} (${pc(senza, tot)}) · con pannello ma curva vuota ${curvaVuota}`);
  const righe = [...senzaPerLf.entries()].sort((a, b) => a[0] - b[0]).slice(0, 16);
  console.log('  silenzi per giro di congelamento: ' + righe.map(([k, v]) => `Lf${k}:${v}`).join(' · '));
  const entro12 = [...senzaPerLf.entries()].filter(([k]) => k <= 12).reduce((a, [, v]) => a + v, 0);
  console.log(`  silenzi con Lf ≤ 12: ${entro12}/${senza} (${pc(entro12, senza)})`);
} else console.log('  (vista non presente su disco)');
