#!/usr/bin/env node
// esporta_esiti_per_caso.mjs — la tabella dei casi che il PRODOTTO consuma.
//
//     node provenienza/esporta_esiti_per_caso.mjs [--write]
//
// Il motore risponde «ti fermi al giro 22: rientri P8». E' una previsione, e per
// farla deve simulare passo, duelli e reazione dei rivali — due su tre che
// dichiara di non saper fare. Questa tabella affianca a quel numero una cosa che
// non e' una previsione: COM'E' FINITA a chi si e' trovato li'.
//
// Nessun modello entra in questi numeri: sono soste vere e posizioni vere.
// I duelli ci sono dentro perche' sono successi; la reazione dei rivali pure.
//
// LA CARTA DELLE ERE decide quale campione risponde (ai_lab/casi/CARTA_DELLE_ERE.md):
// dove fondo e 2026 DIVERGONO vince il 2026 e il fondo diventa contesto; dove sono
// compatibili risponde il fondo, che ha l'intervallo utilizzabile; e dove i casi
// non bastano si scrive «non lo so» invece di riempire il buco.
//
// Il file prodotto e' piccolo e PURO: `scenario/risposta.mjs` gira anche nel
// browser e non puo' leggere dal disco, quindi i casi viaggiano come dato.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { regimeDiCella } from './definizioni.mjs';
import { MESCOLE_BAGNATO } from './vocabolario.mjs';
import { caricaGare2026 } from './gare_2026.mjs';

export const PERCORSO = 'data/modelli/esiti_per_caso.json';
const ORIZZONTE = 10;
const MIN_CASI = 30;
const B_BOOT = 1000;
const SEME = 20260801;

function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

function icQuota(perGara) {
  const k = Object.keys(perGara).filter((x) => perGara[x].length > 0);
  if (k.length < 2) return null;
  const r = rng(SEME); const out = [];
  for (let b = 0; b < B_BOOT; b += 1) {
    let s = 0; let n = 0;
    for (let i = 0; i < k.length; i += 1) for (const v of perGara[k[Math.floor(r() * k.length)]]) { n += 1; if (v) s += 1; }
    if (n) out.push(s / n);
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return [Number(q(0.025).toFixed(4)), Number(q(0.975).toFixed(4))];
}

function raccogli(perPilota, nGiri, chiave, out) {
  const posDi = new Map();
  for (let l = 1; l <= nGiri; l += 1) {
    const v = [];
    for (const [drv, celle] of perPilota) {
      const c = celle.get(l);
      if (c && typeof c.cum_time === 'number') v.push({ drv, cum: c.cum_time });
    }
    v.sort((a, b) => a.cum - b.cum);
    v.forEach((x, i) => posDi.set(`${x.drv}|${l}`, i + 1));
  }
  for (const [drv, celle] of perPilota) {
    for (const [lap, c] of celle) {
      if (c.in_lap !== true) continue;
      const prima = posDi.get(`${drv}|${lap - 1}`);
      const dopo = posDi.get(`${drv}|${lap + ORIZZONTE}`);
      if (prima === undefined || dopo === undefined) continue;
      let reg = null; try { reg = regimeDiCella(c); } catch { reg = null; }
      const chiaveReg = reg === null ? 'VERDE' : 'NEUTRA';
      ((out[chiaveReg] ??= {})[chiave] ??= []).push(dopo - prima);
    }
  }
}

function distribuzione(perGara) {
  const tutti = Object.values(perGara ?? {}).flat();
  if (tutti.length < MIN_CASI) return { sa: false, n: tutti.length };
  const perdePerGara = {};
  for (const [g, v] of Object.entries(perGara)) perdePerGara[g] = v.map((x) => x > 0);
  return {
    sa: true, n: tutti.length, n_gare: Object.keys(perGara).length,
    mediana: mediana(tutti), p10: quant(tutti, 0.10), p90: quant(tutti, 0.90),
    guadagna: Number((100 * tutti.filter((x) => x < 0).length / tutti.length).toFixed(1)),
    invariata: Number((100 * tutti.filter((x) => x === 0).length / tutti.length).toFixed(1)),
    perde: Number((100 * tutti.filter((x) => x > 0).length / tutti.length).toFixed(1)),
    ic95_perde: icQuota(perdePerGara),
  };
}

export function costruisci(radice) {
  const fondo = {}; const d2026 = {};
  const base = path.join(radice, 'data', 'fondo');
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try { ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` })); } catch { continue; }
      if (righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound))) continue;
      const perPilota = new Map(); let nGiri = 0;
      for (const { drv, lap, cella } of righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
        if (lap > nGiri) nGiri = lap;
      }
      raccogli(perPilota, nGiri, `${anno}/${gara}`, fondo);
    }
  }
  for (const [nome, g] of Object.entries(caricaGare2026(radice))) raccogli(g.perPilota, g.nGiri, nome, d2026);

  const contesti = {};
  for (const ctx of ['VERDE', 'NEUTRA']) {
    const F = distribuzione(fondo[ctx]); const D = distribuzione(d2026[ctx]);
    // quale era risponde: la carta delle ere, applicata
    let era = 'fondo'; let motivo = 'fondo e 2026 non sono distinguibili: risponde il fondo, che ha l\'intervallo utilizzabile';
    let divergono = false;
    if (F.sa && D.sa && F.ic95_perde && D.ic95_perde) {
      divergono = !(F.ic95_perde[0] <= D.ic95_perde[1] && D.ic95_perde[0] <= F.ic95_perde[1]);
      if (divergono) { era = '2026'; motivo = 'fondo e 2026 DIVERGONO: vince il 2026, il fondo resta come contesto'; }
    }
    if (!D.sa && !F.sa) { era = null; motivo = `meno di ${MIN_CASI} casi in entrambe le ere: non lo so`; }
    contesti[ctx] = { era_che_risponde: era, motivo, divergono, fondo: F, d2026: D };
  }

  return {
    _targhetta: {
      tipo: 'MISURATO — cosa e\' successo davvero a chi si e\' fermato, senza nessun modello',
      domanda: `quante posizioni ha guadagnato o perso, ${ORIZZONTE} giri dopo la sosta`,
      convenzione: 'NEGATIVO = ha guadagnato posizioni · POSITIVO = le ha perse',
      cosa_non_e: 'NON e\' una previsione. E\' cio\' che e\' successo a chi si e\' trovato in quella situazione: i duelli ci sono dentro perche\' sono avvenuti, e la reazione dei rivali pure. Il rumore di gara non e\' un errore da correggere: e\' la distribuzione.',
      carta_delle_ere: 'ai_lab/casi/CARTA_DELLE_ERE.md — dove fondo e 2026 divergono vince il 2026; dove i casi non bastano si dice «non lo so»',
      soglia_non_lo_so: MIN_CASI,
      incertezza: `bootstrap ${B_BOOT}, blocchi = gare (E11), seme ${SEME}`,
      prodotto_da: 'provenienza/esporta_esiti_per_caso.mjs',
      data: '2026-08-01',
    },
    contesti,
  };
}

function main() {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const v = costruisci(radice);
  console.log('ESITI PER CASO — cosa e\' successo a chi si e\' fermato (10 giri dopo)');
  for (const [ctx, x] of Object.entries(v.contesti)) {
    console.log(`\n  ${ctx}: risponde ${x.era_che_risponde ?? 'NESSUNO'} — ${x.motivo}`);
    for (const [nome, d] of [['fondo', x.fondo], ['2026', x.d2026]]) {
      console.log(`    ${nome.padEnd(6)} ${d.sa
        ? `n=${String(d.n).padStart(5)} (${d.n_gare} gare) · mediana ${d.mediana >= 0 ? '+' : ''}${d.mediana} · guadagna ${d.guadagna}% · pari ${d.invariata}% · perde ${d.perde}%`
        : `NON LO SO (${d.n} casi)`}`);
    }
  }
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(radice, PERCORSO), `${JSON.stringify(v, null, 1)}\n`);
    console.log(`\n  scritto: ${PERCORSO}`);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
