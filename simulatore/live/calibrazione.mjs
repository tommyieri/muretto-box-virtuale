// calibrazione.mjs — il moltiplicatore di degrado live.
//
//     m = pendenza osservata (giri verdi ≤ Lf, fuel-corrected col δ del
//         modello) / pendenza attesa da ρ
//
// smussato con EMA dal prior, pesato per stint con n·R², clamp [0,3; 3,0].
// La definizione operativa completa è PRE-REGISTRATA in
// banco/prereg/PREREG_G5.md: questo file la esegue, non la decide.
//
// ── LE REGOLE DEL §4, EREDITATE ─────────────────────────────────────────────
// La durata di uno stint è una DECISIONE dei team, non una misura. Le mediane
// storiche (SOFT 14 · MEDIUM 19 · HARD 22 — misurate sul 2026) entrano SOLO
// come allarme: se oggi gli stint chiusi sono molto più corti dello storico,
// il vivo sta dicendo qualcosa che lo storico non sa — quindi si ALZA il peso
// del vivo e si ALLARGA la banda, dichiarandolo nel risultato. MAI una stima
// di durata: "lo storico dice 18" non è una previsione di quando ci si ferma.
//
// Il filtro dei giri utilizzabili è IMPORTATO da provenienza (E12): questo
// modulo non sa cosa rende verde un giro, lo chiede a chi lo possiede.

import { passoUtilizzabile } from '../provenienza/definizioni.mjs';
import { derivaPerGiro } from '../engine/passo_v2.mjs';
import { LIMITE_TRACK_WIDE } from './collettore.mjs';

export const COSTANTI_CALIBRAZIONE = Object.freeze({
  // politica dichiarata (pre-registrata in PREREG_G5.md)
  alpha_base: 0.3,
  alpha_allarme: 0.5,
  K_mezzo_peso: 60,
  clamp: [0.3, 3.0],
  fattore_banda_allarme: 1.5,
  min_punti_stint: 4,
  // misurato 2026 — DECISIONI dei team, usate SOLO come allarme (§4)
  mediane_stint_2026: Object.freeze({ SOFT: 14, MEDIUM: 19, HARD: 22 }),
  soglia_allarme: 0.6,
  min_stint_chiusi_allarme: 3,
});

const ols = (punti) => {
  const n = punti.length;
  const mx = punti.reduce((a, p) => a + p.x, 0) / n;
  const my = punti.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of punti) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null; // età costante: pendenza non identificata
  const b = sxy / sxx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { pendenza: b, r2, n };
};

/**
 * Calibra il moltiplicatore sui soli giri ≤ finoA (regola 5: la sentinella di
 * troncamento s14 lo verifica tramite il registro del banco).
 *
 * @param righe  record `{ drv, lap, cella }` del contratto (da collettore o da
 *               adattatore: la parità s18 garantisce che sia lo stesso).
 * @returns `{ moltiplicatore, banda, clampato, allarme_stint, alpha_usato,
 *            stint_usati, fonte_status, limite, dichiarazioni, motivo_null }`
 *          — `moltiplicatore` è null ESPLICITO se non c'è nulla da misurare.
 */
export function calibraDegrado(righe, { finoA, rho, delta70, nGiri, fonteStatus = 'per_auto' }) {
  if (!Number.isInteger(finoA)) throw new Error(`finoA deve essere intero: ${JSON.stringify(finoA)}`);
  if (typeof rho !== 'number' || rho <= 0) throw new Error(`rho non utilizzabile: ${JSON.stringify(rho)}`);
  const C = COSTANTI_CALIBRAZIONE;
  const deriva = derivaPerGiro(delta70, nGiri);
  const limite = fonteStatus === 'track_wide' ? LIMITE_TRACK_WIDE : null;
  const dichiarazioni = [];

  // ── giri utilizzabili per stint, solo ≤ finoA ────────────────────────────
  const perStint = new Map(); // drv@stint → { punti, ultimoGiro, mescola, chiuso, lunghezza }
  const ultimoGiroDi = new Map();
  for (const { drv, lap, cella } of righe) {
    if (lap > finoA) continue;
    const u = ultimoGiroDi.get(drv);
    if (u === undefined || lap > u) ultimoGiroDi.set(drv, lap);
    if (cella.stint === null) continue;
    const chiaveStint = `${drv}@${cella.stint}`;
    if (!perStint.has(chiaveStint)) {
      perStint.set(chiaveStint, { drv, punti: [], ultimoGiro: lap, mescola: cella.compound, lunghezza: 0, chiuso: false });
    }
    const s = perStint.get(chiaveStint);
    s.lunghezza += 1;
    if (lap > s.ultimoGiro) s.ultimoGiro = lap;
    if (cella.in_lap) s.chiuso = true; // chiuso da una sosta, non dal troncamento
    if (passoUtilizzabile(cella) && cella.tyre_age !== null) {
      s.punti.push({ x: cella.tyre_age, y: cella.lap_time - deriva * (lap - 1) });
    }
  }

  // ── allarme §4: stint chiusi molto più corti dello storico ───────────────
  const perMescola = new Map();
  for (const s of perStint.values()) {
    if (!s.chiuso || s.mescola === null) continue;
    if (!perMescola.has(s.mescola)) perMescola.set(s.mescola, []);
    perMescola.get(s.mescola).push(s.lunghezza);
  }
  const mescoleInAllarme = [];
  for (const [mescola, lunghezze] of perMescola) {
    const storica = C.mediane_stint_2026[mescola];
    if (storica === undefined || lunghezze.length < C.min_stint_chiusi_allarme) continue;
    const ordinate = [...lunghezze].sort((a, b) => a - b);
    const m = ordinate.length % 2 ? ordinate[ordinate.length >> 1] : (ordinate[ordinate.length / 2 - 1] + ordinate[ordinate.length / 2]) / 2;
    if (m <= C.soglia_allarme * storica) mescoleInAllarme.push({ mescola, mediana_osservata: m, mediana_storica: storica });
  }
  const allarme = mescoleInAllarme.length > 0
    ? {
      mescole: mescoleInAllarme.map((x) => x.mescola),
      dettaglio: mescoleInAllarme,
      effetto: `peso del vivo alzato (α ${C.alpha_base} → ${C.alpha_allarme}), banda ×${C.fattore_banda_allarme}`,
      targhetta: 'la durata di uno stint è una DECISIONE dei team, non una misura (§4): la divergenza dallo storico è un allarme, mai una stima di durata',
    }
    : null;
  const alphaUsato = allarme ? C.alpha_allarme : C.alpha_base;
  if (allarme) dichiarazioni.push(`ALLARME STINT (${allarme.mescole.join(', ')}): ${allarme.effetto}`);

  // ── pendenze per stint, EMA dal prior in ordine cronologico ──────────────
  const stimeStint = [];
  for (const s of perStint.values()) {
    if (s.punti.length < C.min_punti_stint) continue;
    const fit = ols(s.punti);
    if (fit === null) continue;
    const peso = fit.n * Math.max(fit.r2, 0);
    if (peso <= 0) continue;
    stimeStint.push({ drv: s.drv, ultimoGiro: s.ultimoGiro, moltiplicatore: fit.pendenza / rho, peso, n: fit.n, r2: Number(fit.r2.toFixed(4)) });
  }
  stimeStint.sort((a, b) => a.ultimoGiro - b.ultimoGiro || (a.drv < b.drv ? -1 : 1));

  if (stimeStint.length === 0) {
    return {
      moltiplicatore: null,
      motivo_null: `nessuno stint con ≥ ${C.min_punti_stint} giri utilizzabili ed età variabile entro il giro ${finoA}: niente pendenza, niente numero plausibile (regola 6)`,
      banda: null,
      clampato: false,
      allarme_stint: allarme,
      alpha_usato: alphaUsato,
      stint_usati: 0,
      fonte_status: fonteStatus,
      limite,
      dichiarazioni,
    };
  }

  let m = 1.0; // il prior: degrado = ρ del modello
  for (const s of stimeStint) {
    m += (alphaUsato * (s.peso / (s.peso + C.K_mezzo_peso))) * (s.moltiplicatore - m);
  }
  const grezzo = m;
  const clampato = m < C.clamp[0] || m > C.clamp[1];
  m = Math.min(Math.max(m, C.clamp[0]), C.clamp[1]);
  if (clampato) dichiarazioni.push(`moltiplicatore ${grezzo.toFixed(3)} fuori da [${C.clamp}]: CLAMPATO a ${m}`);

  // ── banda: dispersione pesata delle stime per stint, più gli allargamenti ─
  const sommaPesi = stimeStint.reduce((a, s) => a + s.peso, 0);
  const mediaPesata = stimeStint.reduce((a, s) => a + s.peso * s.moltiplicatore, 0) / sommaPesi;
  const varianzaPesata = stimeStint.reduce((a, s) => a + s.peso * (s.moltiplicatore - mediaPesata) ** 2, 0) / sommaPesi;
  let sigma = Math.sqrt(varianzaPesata / stimeStint.length) + Math.abs(mediaPesata - m) / 2;
  if (sigma === 0) sigma = Math.abs(m) * 0.05; // uno stint solo: incertezza minima dichiarata, non zero
  if (allarme) sigma *= C.fattore_banda_allarme;
  if (limite) {
    sigma *= 1 + limite.quota_celle_passo_oltre_soglia;
    dichiarazioni.push(`fonte track_wide: banda allargata del fattore (1 + ${limite.quota_celle_passo_oltre_soglia}) — ${limite.targhetta}`);
  }

  return {
    moltiplicatore: Number(m.toFixed(6)),
    banda: [Number(Math.max(m - sigma, C.clamp[0]).toFixed(6)), Number(Math.min(m + sigma, C.clamp[1]).toFixed(6))],
    clampato,
    allarme_stint: allarme,
    alpha_usato: alphaUsato,
    stint_usati: stimeStint.length,
    stime_per_stint: stimeStint,
    fonte_status: fonteStatus,
    limite,
    dichiarazioni,
  };
}
