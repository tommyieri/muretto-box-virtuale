#!/usr/bin/env node
// esporta_soste_fondo.mjs — ogni sosta del fondo, con la sua perdita MISURATA.
//
// Metodologia, la stessa che il prior esterno dichiara di aver usato (così i due
// numeri sono confrontabili invece di somigliarsi):
//
//     perdita = t(in-lap) + t(out-lap) − 2 × mediana del passo pulito
//               del PILOTA STESSO, adiacente alla sosta
//
// Solo soste a bandiera verde, su gara asciutta. La baseline si calcola su tre
// ampiezze di finestra (2, 3, 5 giri per lato) perché la robustezza a quella
// scelta è parte del cancello, non una curiosità.
//
// In-lap e out-lap NON sono giri verdi per costruzione: per giudicarli si usa
// `statusVerde` — la parte solo-status del filtro, che vive in definizioni.mjs e
// da lì si importa (regola 1, E12).
//
// Uso: node provenienza/esporta_soste_fondo.mjs

import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { passoUtilizzabile, statusVerde } from './definizioni.mjs';
import { MESCOLE_BAGNATO } from './vocabolario.mjs';

export const PERCORSO_SOSTE = 'data/viste/soste_fondo.json';
export const FINESTRE = [2, 3, 5];
const MIN_PER_LATO = 2; // dichiarato: senza almeno due giri puliti per lato la baseline è un aneddoto

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function costruisciSosteFondo(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const soste = [];
  const gareEscluse = [];
  const scarti = {};
  const scarta = (motivo) => { scarti[motivo] = (scarti[motivo] ?? 0) + 1; };

  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try {
        ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` }));
      } catch (e) {
        gareEscluse.push(`${anno}/${gara}`);
        continue;
      }

      // Gara asciutta: nessuna gomma da bagnato compare, per nessuno. È la
      // definizione conservativa — una gara con dieci giri di pioggia non è
      // "quasi asciutta", è bagnata.
      let asciutta = true;
      const perPilota = new Map();
      for (const { drv, lap, cella } of righe) {
        if (cella.compound !== null && MESCOLE_BAGNATO.has(cella.compound)) asciutta = false;
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
      }
      if (!asciutta) { scarta('gara bagnata'); continue; }

      for (const [drv, celle] of perPilota) {
        for (const [L, cella] of celle) {
          if (!cella.in_lap) continue;
          const out = celle.get(L + 1);
          if (!out) { scarta('nessun out-lap dopo l\'in-lap'); continue; }
          if (cella.status === null || out.status === null || cella.del === null || out.del === null) {
            scarta('status o del assenti sull\'in-lap o sull\'out-lap'); continue;
          }
          // bandiera verde: sull'in-lap E sull'out-lap
          if (!statusVerde(cella) || !statusVerde(out)) { scarta('sosta non a bandiera verde'); continue; }
          if (cella.del || out.del) { scarta('in-lap o out-lap cancellato'); continue; }
          if (cella.lap_time === null || out.lap_time === null) { scarta('tempo assente su in-lap o out-lap'); continue; }

          const perFinestra = {};
          let almenoUna = false;
          for (const W of FINESTRE) {
            const prima = [];
            const dopo = [];
            for (let l = L - W; l <= L - 1; l += 1) {
              const c = celle.get(l);
              if (c && c.status !== null && c.del !== null && passoUtilizzabile(c)) prima.push(c.lap_time);
            }
            for (let l = L + 2; l <= L + 1 + W; l += 1) {
              const c = celle.get(l);
              if (c && c.status !== null && c.del !== null && passoUtilizzabile(c)) dopo.push(c.lap_time);
            }
            if (prima.length < MIN_PER_LATO || dopo.length < MIN_PER_LATO) { perFinestra[W] = null; continue; }
            const pulito = mediana([...prima, ...dopo]);
            perFinestra[W] = Number((cella.lap_time + out.lap_time - 2 * pulito).toFixed(3));
            almenoUna = true;
          }
          if (!almenoUna) { scarta('baseline non calcolabile: meno di due giri puliti per lato'); continue; }
          soste.push({ anno: Number(anno), gara, drv, giro: L, perdita: perFinestra });
        }
      }
    }
  }
  soste.sort((a, b) => a.anno - b.anno || (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : 0) || (a.drv < b.drv ? -1 : 1) || a.giro - b.giro);
  return { soste, gareEscluse, scarti };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { soste, gareEscluse, scarti } = costruisciSosteFondo(radice);
  const perGara = {};
  for (const s of soste) perGara[s.gara] = (perGara[s.gara] ?? 0) + 1;
  const vista = {
    _targhetta: {
      tipo: 'misurato sul fondo 2018-2025 — perdita ai box per sosta',
      metodologia: 'perdita = t(in-lap) + t(out-lap) − 2 × mediana del passo pulito del pilota adiacente alla sosta; solo soste a bandiera verde su gara asciutta',
      finestre_baseline: FINESTRE,
      min_giri_puliti_per_lato: MIN_PER_LATO,
      definizioni: 'provenienza/definizioni.mjs · statusVerde per in-lap e out-lap, passoUtilizzabile per la baseline',
      generata_da: 'provenienza/esporta_soste_fondo.mjs',
      data: '2026-07-29',
      gare_escluse: gareEscluse,
      scarti_per_motivo: scarti,
    },
    n_soste: soste.length,
    per_gara: Object.fromEntries(Object.entries(perGara).sort((a, b) => b[1] - a[1])),
    soste,
  };
  const dest = path.join(radice, PERCORSO_SOSTE);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  console.log(`soste misurate: ${soste.length}`);
  console.log('scarti per motivo:', scarti);
  console.log('\nGP con più soste misurate:');
  for (const [g, n] of Object.entries(vista.per_gara).slice(0, 12)) console.log(`  ${g.padEnd(34)} ${n}`);
  console.log(`\n→ ${PERCORSO_SOSTE}`);
}
