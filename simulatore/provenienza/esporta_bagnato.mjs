#!/usr/bin/env node
// esporta_bagnato.mjs — l'evidenza della Fase Bagnato: per ogni giro di ogni
// gara bagnata, il passo mediano delle DUE famiglie di gomme.
//
// È il dato su cui si misura (o non si misura) il crossover, e resta pinnato
// perché la fase possa essere rieseguita fra due stagioni senza ridiscutere
// niente. Le due famiglie usano la STESSA definizione di passo pulito con
// l'altra lista di mescole (`verde` e `passoBagnato` da definizioni.mjs): non
// esiste un filtro "del bagnato" scritto a parte.
//
// Uso: node provenienza/esporta_bagnato.mjs

import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { verde, passoBagnato } from './definizioni.mjs';
import { MESCOLE_BAGNATO } from './vocabolario.mjs';

export const PERCORSO_BAGNATO = 'data/viste/bagnato_fondo.json';

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function costruisciVistaBagnato(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const gare = [];
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try {
        ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` }));
      } catch { continue; }

      let giriBagnato = 0;
      const perGiro = new Map();
      const slickPuliti = [];
      for (const { lap, cella } of righe) {
        if (cella.compound !== null && MESCOLE_BAGNATO.has(cella.compound)) giriBagnato += 1;
        if (cella.status === null || cella.del === null || cella.lap_time === null) continue;
        const s = verde(cella);
        const b = passoBagnato(cella);
        if (!s && !b) continue;
        if (s) slickPuliti.push(cella.lap_time);
        if (!perGiro.has(lap)) perGiro.set(lap, { slick: [], bagnato: [] });
        perGiro.get(lap)[s ? 'slick' : 'bagnato'].push(cella.lap_time);
      }
      if (giriBagnato === 0) continue;

      // riferimento asciutto della gara: 5° percentile dei giri slick puliti.
      // null se la gara non ha abbastanza asciutto — non si inventa (regola 6).
      const ordinati = [...slickPuliti].sort((a, b) => a - b);
      const riferimentoAsciutto = ordinati.length >= 30
        ? Number(ordinati[Math.floor(0.05 * (ordinati.length - 1))].toFixed(3))
        : null;

      const giri = [...perGiro.entries()].sort((a, b) => a[0] - b[0]).map(([giro, g]) => ({
        giro,
        n_slick: g.slick.length,
        n_bagnato: g.bagnato.length,
        mediana_slick: g.slick.length ? Number(mediana(g.slick).toFixed(3)) : null,
        mediana_bagnato: g.bagnato.length ? Number(mediana(g.bagnato).toFixed(3)) : null,
        mediana_campo: Number(mediana([...g.slick, ...g.bagnato]).toFixed(3)),
      }));

      gare.push({
        anno: Number(anno), gara, chiave: `${anno}/${gara}`,
        giri_su_bagnato: giriBagnato,
        n_slick_puliti: slickPuliti.length,
        riferimento_asciutto_s: riferimentoAsciutto,
        giri,
      });
    }
  }
  return gare;
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gare = costruisciVistaBagnato(radice);
  const vista = {
    _targhetta: {
      tipo: 'misurato sul fondo 2018-2025 — passo mediano per famiglia di mescole, giro per giro, sulle gare bagnate',
      prereg: 'banco/prereg/PREREG_bagnato.md',
      definizioni: 'provenienza/definizioni.mjs · verde (slick) e passoBagnato (intermedia/wet): stessa definizione, altra famiglia',
      riferimento_asciutto: '5° percentile dei giri slick puliti della gara; null sotto 30 giri slick puliti (regola 6)',
      generata_da: 'provenienza/esporta_bagnato.mjs',
      data: '2026-07-29',
    },
    n_gare: gare.length,
    giri_su_bagnato_totali: gare.reduce((a, g) => a + g.giri_su_bagnato, 0),
    gare,
  };
  const dest = path.join(radice, PERCORSO_BAGNATO);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  console.log(`${vista.n_gare} gare bagnate · ${vista.giri_su_bagnato_totali} giri su bagnato → ${PERCORSO_BAGNATO}`);
}
