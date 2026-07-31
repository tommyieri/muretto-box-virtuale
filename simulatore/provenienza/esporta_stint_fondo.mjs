#!/usr/bin/env node
// esporta_stint_fondo.mjs — lo STINT come unità di misura, su tutto il fondo.
//
// La Fase Mescola confronta la pendenza di degrado fra mescole APPAIANDO entro
// pilota/stint. L'unità naturale è quindi lo stint, non il giro: qui si esporta
// un record per stint con la sua pendenza OLS, calcolata sui soli giri che il
// filtro verde di provenienza/ ammette (la definizione si importa, E12).
//
// PERCHÉ LA PENDENZA GREZZA BASTA. Dentro uno stint l'età cresce di pari passo
// col giro di gara, quindi la pendenza osservata è ρ(mescola) + δ_giro, dove
// δ_giro = −δ₇₀/N è la deriva del carburante. Nel CONTRASTO fra due stint della
// STESSA gara δ_giro è identico e si cancella esattamente: la differenza
// SOFT−HARD non dipende da δ, e non eredita l'incertezza della sua stima.
// È il motivo per cui l'appaiamento entro pilota/gara è la scelta giusta, non
// una comodità.
//
// Uso: node provenienza/esporta_stint_fondo.mjs

import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { passoUtilizzabile } from './definizioni.mjs';
import { MESCOLE_SLICK_ATTUALI } from './vocabolario.mjs';

export const PERCORSO_STINT = 'data/viste/stint_fondo.json';
const MIN_GIRI_STINT = 5; // dichiarato: sotto questo una pendenza è rumore

/** OLS della pendenza di `y` su `x`, con R². null se x è costante. */
function pendenza(punti) {
  const n = punti.length;
  const mx = punti.reduce((a, p) => a + p.x, 0) / n;
  const my = punti.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0; let sxy = 0; let syy = 0;
  for (const p of punti) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;
  return { b: sxy / sxx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy), n };
}

export function costruisciStintFondo(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const stint = [];
  const perAnno = {};
  // Celle senza status: `verde()` si rifiuta di dedurre (E13) e ha ragione.
  // Escluderle è l'unica mossa onesta, ma va CONTATA: un'esclusione silenziosa
  // e un dato pulito si somigliano troppo.
  let celleSenzaStatus = 0;
  let celleTotali = 0;
  // Sei gare del 2019 non hanno le colonne dell'identità (drv) né dello stint,
  // dell'età, dello status e del del: senza quelle non esiste uno stint da
  // misurare. Si ESCLUDONO dichiarandole per nome, e se il conto salisse oltre
  // il noto la funzione fallisce — un'esclusione che cresce in silenzio è un
  // inventario parziale (E24).
  const gareEscluse = [];
  const MAX_GARE_ESCLUSE = 6;

  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    perAnno[anno] = { gare: 0, stint: 0, per_mescola: {} };
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try {
        ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` }));
      } catch (e) {
        gareEscluse.push({ anno, gara, motivo: e.message });
        continue;
      }
      perAnno[anno].gare += 1;

      let nGiri = 0;
      for (const { lap } of righe) if (Number.isInteger(lap) && lap > nGiri) nGiri = lap;

      const gruppi = new Map(); // drv@stint → { punti, mescola, giro_inizio }
      for (const { drv, lap, cella } of righe) {
        if (cella.stint === null) continue;
        const chiave = `${drv}@${cella.stint}`;
        if (!gruppi.has(chiave)) gruppi.set(chiave, { drv, numero: cella.stint, mescola: cella.compound, punti: [], giro_inizio: lap });
        const g = gruppi.get(chiave);
        if (lap < g.giro_inizio) g.giro_inizio = lap;
        // la mescola dello stint è quella dei suoi giri: se cambia, il grezzo è
        // incoerente e lo si dichiara invece di scegliere a caso
        if (cella.compound !== null && g.mescola !== null && cella.compound !== g.mescola) g.mescola = 'INCOERENTE';
        if (cella.compound !== null && g.mescola === null) g.mescola = cella.compound;
        celleTotali += 1;
        if (cella.status === null || cella.del === null) { celleSenzaStatus += 1; continue; }
        if (!passoUtilizzabile(cella) || cella.tyre_age === null) continue;
        g.punti.push({ x: cella.tyre_age, y: cella.lap_time });
      }

      for (const g of gruppi.values()) {
        if (g.punti.length < MIN_GIRI_STINT) continue;
        if (g.mescola === null || g.mescola === 'INCOERENTE') continue;
        const fit = pendenza(g.punti);
        if (fit === null) continue;
        stint.push({
          anno: Number(anno), gara, drv: g.drv, stint: g.numero, mescola: g.mescola,
          n: fit.n, pendenza: Number(fit.b.toFixed(6)), r2: Number(fit.r2.toFixed(4)),
          giro_inizio: g.giro_inizio, eta_media: Number((g.punti.reduce((a, p) => a + p.x, 0) / fit.n).toFixed(2)),
          n_giri_gara: nGiri,
        });
        perAnno[anno].stint += 1;
        perAnno[anno].per_mescola[g.mescola] = (perAnno[anno].per_mescola[g.mescola] ?? 0) + 1;
      }
    }
  }
  if (gareEscluse.length > MAX_GARE_ESCLUSE) {
    throw new Error(`gare escluse ${gareEscluse.length} > ${MAX_GARE_ESCLUSE} noto: qualcosa di sistemico è rotto, non è il solito buco del 2019\n${gareEscluse.map((g) => `${g.anno}/${g.gara}: ${g.motivo}`).join('\n')}`);
  }
  stint.sort((a, b) => a.anno - b.anno || (a.gara < b.gara ? -1 : a.gara > b.gara ? 1 : 0) || (a.drv < b.drv ? -1 : 1) || a.stint - b.stint);
  return { stint, perAnno, celleSenzaStatus, celleTotali, gareEscluse };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { stint, perAnno, celleSenzaStatus, celleTotali, gareEscluse } = costruisciStintFondo(radice);
  const vista = {
    _targhetta: {
      tipo: 'misurato sul fondo 2018-2025 — un record per stint, con la pendenza di degrado',
      definizione: 'provenienza/definizioni.mjs · passoUtilizzabile (verde && tempo presente) && età presente',
      pendenza: 'OLS del tempo sul giro contro l\'età gomma, GREZZA: dentro uno stint contiene anche la deriva del carburante, che si cancella nel contrasto fra stint della stessa gara',
      min_giri_stint: MIN_GIRI_STINT,
      generata_da: 'provenienza/esporta_stint_fondo.mjs',
      data: '2026-07-29',
      mescole_attuali: [...MESCOLE_SLICK_ATTUALI],
      celle_non_giudicabili_escluse: celleSenzaStatus,
      gare_escluse: gareEscluse.map((g) => `${g.anno}/${g.gara}`),
      nota_gare_escluse: 'gare senza le colonne di identità/stint/età/status: non contengono uno stint misurabile. Escluse e DICHIARATE, mai saltate in silenzio (E24)',
      celle_totali: celleTotali,
      nota_non_giudicabili: 'celle senza status o senza del: non si possono giudicare verdi e sono ESCLUSE, contate. Dedurre il verde da un\'assenza è E13; dedurre "non cancellato" da "non lo so" è E03',
    },
    per_anno: perAnno,
    stint,
  };
  const dest = path.join(radice, PERCORSO_STINT);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(vista, null, 1) + '\n');
  console.log('anno  gare  stint  per mescola');
  for (const [anno, v] of Object.entries(perAnno)) {
    console.log(`${anno}  ${String(v.gare).padStart(4)}  ${String(v.stint).padStart(5)}  ${JSON.stringify(v.per_mescola)}`);
  }
  console.log(`\ngare escluse (colonne mancanti): ${gareEscluse.length} — ${gareEscluse.map((g) => `${g.anno}/${g.gara}`).join(', ')}`);
  console.log(`celle non giudicabili escluse (status o del assenti): ${celleSenzaStatus} su ${celleTotali} (${(100 * celleSenzaStatus / celleTotali).toFixed(2)}%)`);
  console.log(`${stint.length} stint → ${PERCORSO_STINT}`);
}
