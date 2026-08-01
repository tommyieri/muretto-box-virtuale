// domande.mjs — le altre domande del motore per casi.
//
//     node ai_lab/casi/domande.mjs [--json]
//
// Tre domande che il prodotto fa e a cui oggi risponde simulando: cosa succede
// dopo un restart, quanto rende un undercut, quanto rimescola una bandiera rossa.
// Qui si risponde CONTANDO cosa e' successo davvero.
//
// LA CARTA DELLE ERE HA FATTO UNA PREVISIONE, e questo file la mette alla prova
// invece di assumerla: «per i sorpassi il fondo NON vale, perche' nel 2026 il DRS
// non esiste». Se e' vera, il confronto fondo/2026 sui sorpassi deve DIVERGERE —
// e se non diverge, o l'ipotesi e' sbagliata o il confronto e' cieco. In entrambi
// i casi lo si scrive.
//
// Ogni risposta porta gli stessi quattro numeri della prima: fondo, 2026,
// compatibilita', e il POTERE del confronto.
//
// NON SCRIVE NIENTE su disco.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { regimeDiCella, garaSospesa } from '../../simulatore/provenienza/definizioni.mjs';
import { MESCOLE_BAGNATO } from '../../simulatore/provenienza/vocabolario.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.resolve(QUI, '..', '..', 'simulatore');
const MIN_CASI = 30;
const B_BOOT = 1000;
const SEME = 20260801;

function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
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
function rispondi(perGara) {
  const tutti = Object.values(perGara).flat();
  if (tutti.length < MIN_CASI) return { sa: false, n: tutti.length };
  const s = tutti.filter(Boolean).length;
  return { sa: true, n: tutti.length, n_gare: Object.keys(perGara).filter((k) => perGara[k].length).length,
           quota: Number((s / tutti.length).toFixed(4)), ic95: icQuota(perGara) };
}
function confronta(a, b) {
  if (!a.sa || !b.sa) return { verdetto: 'non giudicabile', potere: '—' };
  if (!a.ic95 || !b.ic95) return { verdetto: 'non giudicabile', potere: '—' };
  const sovrappone = a.ic95[0] <= b.ic95[1] && b.ic95[0] <= a.ic95[1];
  const cieco = b.ic95[0] <= a.quota && a.quota <= b.ic95[1] && b.ic95[0] <= a.quota * 2 && a.quota * 2 <= b.ic95[1];
  return { verdetto: sovrappone ? 'compatibili' : 'DIVERGONO', potere: cieco ? 'CIECO' : 'utile',
           scarto: Number((100 * (b.quota - a.quota)).toFixed(1)) };
}

// ═══════════════════════════════════════ le tre domande, su una gara qualunque
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
  const regime = (drv, l) => { const c = perPilota.get(drv)?.get(l); if (!c) return undefined; try { return regimeDiCella(c); } catch { return undefined; } };
  const campoNeutro = (l) => {
    let n = 0; let t = 0;
    for (const [drv] of perPilota) { const r = regime(drv, l); if (r === undefined) continue; t += 1; if (r !== null) n += 1; }
    return t >= 6 && n / t >= 0.5;
  };

  // 1 · DOPO UN RESTART: chi cambia posizione nei tre giri successivi?
  for (let l = 3; l <= nGiri - 4; l += 1) {
    if (!campoNeutro(l) || campoNeutro(l + 1)) continue;   // ultimo giro neutralizzato
    for (const [drv] of perPilota) {
      const a = posDi.get(`${drv}|${l}`); const b = posDi.get(`${drv}|${l + 3}`);
      if (a === undefined || b === undefined) continue;
      let pulito = true;
      for (let k = l; k <= l + 3; k += 1) { const c = perPilota.get(drv)?.get(k); if (!c || c.in_lap === true || c.out_lap === true) { pulito = false; break; } }
      if (!pulito) continue;
      (out.restart[chiave] ??= []).push(a !== b);
    }
  }

  // 2 · UNDERCUT: mi fermo, il rivale davanti no. Cinque giri dopo sono davanti a lui?
  for (const [drv, celle] of perPilota) {
    for (const [lap, c] of celle) {
      if (c.in_lap !== true) continue;
      const mia = posDi.get(`${drv}|${lap - 1}`);
      if (mia === undefined || mia === 1) continue;
      const rivale = [...perPilota.keys()].find((d) => posDi.get(`${d}|${lap - 1}`) === mia - 1);
      if (!rivale) continue;
      // L'UNDERCUT SI GIUDICA DOPO CHE SI E' FERMATO ANCHE LUI.
      //
      // La prima versione guardava la posizione cinque giri dopo LA MIA sosta, e
      // dava il 3,4%: ovvio, perche' li' io ho pagato la perdita ai box e il
      // rivale no. Non misurava l'undercut, misurava «ho gia' scontato la sosta
      // mentre lui deve ancora farla». Il vantaggio dell'undercut esiste solo
      // quando anche lui e' rientrato: prima di quel momento non c'e' niente da
      // confrontare.
      let sostaRivale = null;
      for (let k = lap + 1; k <= Math.min(lap + 25, nGiri); k += 1) {
        if (perPilota.get(rivale)?.get(k)?.in_lap === true) { sostaRivale = k; break; }
      }
      if (sostaRivale === null) continue;          // non si e' mai fermato: non e' un duello di soste
      const quando = sostaRivale + 3;              // tre giri dopo il SUO rientro, entrambi su gomme nuove
      const io = posDi.get(`${drv}|${quando}`); const lui = posDi.get(`${rivale}|${quando}`);
      if (io === undefined || lui === undefined) continue;
      (out.undercut[chiave] ??= []).push(io < lui);   // riuscito = l'ho scavalcato
    }
  }

  // 3 · BANDIERA ROSSA: chi cambia posizione fra prima della sospensione e cinque giri dopo?
  for (let l = 2; l <= nGiri - 6; l += 1) {
    let rossa = false;
    for (const [drv] of perPilota) { const c = perPilota.get(drv)?.get(l); if (c) { try { if (garaSospesa(c)) { rossa = true; break; } } catch { /* ignora */ } } }
    if (!rossa) continue;
    for (const [drv] of perPilota) {
      const a = posDi.get(`${drv}|${l - 1}`); const b = posDi.get(`${drv}|${l + 5}`);
      if (a === undefined || b === undefined) continue;
      (out.rossa[chiave] ??= []).push(a !== b);
    }
    l += 5;   // una sospensione sola per finestra
  }
}

const fondo = { restart: {}, undercut: {}, rossa: {} };
const d2026 = { restart: {}, undercut: {}, rossa: {} };
{
  const base = path.join(SIM, 'data', 'fondo');
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
}
{
  const gare = caricaGare2026(SIM);
  for (const [nome, g] of Object.entries(gare)) raccogli(g.perPilota, g.nGiri, nome, d2026);
}

const DOMANDE = [
  { k: 'restart', nome: 'dopo un RESTART: cambia posizione nei 3 giri successivi?',
    previsione: 'il fondo NON vale — dipende dai sorpassi, e nel 2026 il DRS non esiste' },
  { k: 'undercut', nome: 'UNDERCUT: mi fermo prima di chi era davanti. Quando si ferma anche lui, l\'ho scavalcato?',
    previsione: 'il fondo NON vale — dipende da riscaldamento gomma e degrado, mescole diverse' },
  { k: 'rossa', nome: 'BANDIERA ROSSA: cambia posizione fra prima e cinque giri dopo?',
    previsione: 'da verificare' },
];

const esito = DOMANDE.map((d) => {
  const F = rispondi(fondo[d.k]); const D = rispondi(d2026[d.k]);
  return { ...d, fondo: F, d2026: D, confronto: confronta(F, D) };
});
if (process.argv.includes('--json')) { console.log(JSON.stringify(esito, null, 2)); process.exit(0); }

const pc = (x) => (x.sa
  ? `${(100 * x.quota).toFixed(1)}%  (${x.n} casi, ${x.n_gare} gare${x.ic95 ? `, IC95 ${(100 * x.ic95[0]).toFixed(1)}-${(100 * x.ic95[1]).toFixed(1)}%` : ''})`
  : `NON LO SO — solo ${x.n} casi`);
console.log('MOTORE PER CASI — le altre domande');
for (const e of esito) {
  console.log(`\n  ${e.nome}`);
  console.log(`    previsione della carta: ${e.previsione}`);
  console.log(`    FONDO 2018-2025 : ${pc(e.fondo)}`);
  console.log(`    2026            : ${pc(e.d2026)}`);
  console.log(`    -> ${e.confronto.verdetto}${e.confronto.potere !== '—' ? ` (potere: ${e.confronto.potere})` : ''}`
    + `${e.confronto.scarto !== undefined ? ` · il 2026 sta ${e.confronto.scarto >= 0 ? '+' : ''}${e.confronto.scarto} punti` : ''}`);
}
