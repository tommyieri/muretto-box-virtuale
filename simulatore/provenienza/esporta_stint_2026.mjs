#!/usr/bin/env node
// esporta_stint_2026.mjs — quanto durano gli stint nel 2026, per mescola.
//
// ATTENZIONE A COSA SONO QUESTI NUMERI. Non sono fisica: sono DECISIONI dei
// muretti. CLAUDE.md è esplicito — in live sono ALLARMI, mai stime. Escono da
// qui con quella targhetta addosso, e `scenario/allarmi.mjs` li usa solo per
// dire «questo piano propone uno stint più lungo di qualunque stint 2026»,
// mai per vincolare un piano (PREREG_multistint.md, cancello M4).
//
// SOLO GLI STINT CHIUSI DA UNA SOSTA. Lo stint finale non finisce con una
// decisione, finisce con la bandiera: contarlo mescolerebbe «quanto un team ha
// scelto di far durare un set» con «quanti giri mancavano alla fine». È la
// stessa ragione per cui una durata censurata non entra in una mediana di
// durate senza dichiararlo.
//
// Uso: node provenienza/esporta_stint_2026.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from './gare_2026.mjs';
import { MESCOLE_SLICK_ATTUALI } from './vocabolario.mjs';

export const PERCORSO_STINT_2026 = 'data/viste/stint_2026.json';

/**
 * Uno stint di 3 giri o meno non è una DECISIONE: è un incidente — foratura,
 * danno al via, ripartenza dopo la rossa. La soglia è dichiarata perché è stata
 * scelta DOPO aver visto una divergenza, e va detto: la prima misura senza
 * filtro dava SOFT 8 contro i 14 ereditati da CLAUDE.md, e la SOFT aveva 34
 * stint su 103 sotto i 4 giri. Escludendoli i tre numeri tornano
 * (13 · 19 · 22 contro 14 · 19 · 22): il conflitto era di estimando, non di
 * misura, e la soglia lo RICONCILIA invece di sostituire un numero all'altro
 * (E21 — entrambe le versioni restano nella vista).
 *
 * Sceglierla dopo aver guardato non contamina niente, e va detto anche questo:
 * questi numeri non entrano in nessun cancello e non possono cambiare un piano
 * (cancello M4 lo prova). Se un giorno entrassero in una decisione, la soglia
 * andrebbe pre-registrata come tutto il resto.
 */
export const MIN_GIRI_DECISIONE = 4;

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const percentile = (v, p) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(p * (s.length - 1))];
};

export function misuraStint2026(radice) {
  const gare = caricaGare2026(radice);
  const durate = {};
  let chiusi = 0;
  let censurati = 0;
  for (const gara of Object.values(gare)) {
    for (const celle of gara.perPilota.values()) {
      const gruppi = new Map();
      for (const c of celle.values()) {
        if (c.stint === null) continue;
        if (!gruppi.has(c.stint)) gruppi.set(c.stint, { giri: 0, mescola: c.compound, chiuso: false });
        const g = gruppi.get(c.stint);
        g.giri += 1;
        if (g.mescola === null) g.mescola = c.compound;
        if (c.in_lap === true) g.chiuso = true;
      }
      for (const g of gruppi.values()) {
        if (g.mescola === null || !MESCOLE_SLICK_ATTUALI.has(g.mescola)) continue;
        if (!g.chiuso) { censurati += 1; continue; }
        (durate[g.mescola] ??= []).push(g.giri);
        chiusi += 1;
      }
    }
  }
  const perMescola = {};
  for (const m of [...MESCOLE_SLICK_ATTUALI].sort()) {
    const tutti = durate[m] ?? [];
    const decisioni = tutti.filter((x) => x >= MIN_GIRI_DECISIONE);
    perMescola[m] = {
      n_stint_chiusi: tutti.length,
      n_stint_decisione: decisioni.length,
      n_stint_brevi_esclusi: tutti.length - decisioni.length,
      // Regola 6: senza stint non esiste una mediana, e non se ne inventa una
      // prendendo quella di un'altra mescola.
      mediana_giri: decisioni.length ? mediana(decisioni) : null,
      p90_giri: decisioni.length ? percentile(decisioni, 0.9) : null,
      massimo_giri: decisioni.length ? Math.max(...decisioni) : null,
      // la misura SENZA filtro resta a referto: una misura non si cancella (E21)
      mediana_giri_senza_filtro: tutti.length ? mediana(tutti) : null,
    };
  }
  return { perMescola, chiusi, censurati, n_gare: Object.keys(gare).length };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { perMescola, chiusi, censurati, n_gare } = misuraStint2026(radice);
  const vista = {
    _targhetta: {
      tipo: 'MISURATO sulle gare 2026 — durata degli stint per mescola',
      natura: 'DECISIONI dei team, NON fisica: in live sono ALLARMI, mai stime (CLAUDE.md, §Numeri ereditati)',
      uso_consentito: 'scenario/allarmi.mjs, per segnalare un piano fuori dall\'esperienza 2026. VIETATO come vincolo di un piano (banco/prereg/PREREG_multistint.md, cancello M4)',
      selezione: `solo stint CHIUSI da una sosta (lo stint finale termina con la bandiera, non con una decisione) e lunghi almeno ${MIN_GIRI_DECISIONE} giri (sotto, è un incidente: foratura, danno, ripartenza dopo la rossa)`,
      ereditato: 'CLAUDE.md riporta SOFT 14 · MEDIUM 19 · HARD 22. Senza il filtro sui 4 giri questa misura dà SOFT 8: la differenza è di ESTIMANDO, non di misura — 34 stint SOFT su 103 durano meno di 4 giri. Col filtro i numeri si riconciliano (13 · 19 · 22). Entrambe le versioni restano qui: una misura non si cancella (E21)',
      generata_da: 'provenienza/esporta_stint_2026.mjs',
      data: '2026-07-30',
    },
    n_gare,
    n_stint_chiusi: chiusi,
    n_stint_censurati_esclusi: censurati,
    per_mescola: perMescola,
  };
  const dest = path.join(radice, PERCORSO_STINT_2026);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  console.log(`${chiusi} stint chiusi (${censurati} censurati esclusi) su ${n_gare} gare → ${PERCORSO_STINT_2026}`);
  for (const [m, x] of Object.entries(perMescola)) {
    console.log(`  ${m.padEnd(7)} n=${String(x.n_stint_decisione).padStart(3)} (${x.n_stint_brevi_esclusi} brevi esclusi)  mediana ${x.mediana_giri ?? '—'}  p90 ${x.p90_giri ?? '—'}  massimo ${x.massimo_giri ?? '—'}  · senza filtro ${x.mediana_giri_senza_filtro ?? '—'}`);
  }
}
