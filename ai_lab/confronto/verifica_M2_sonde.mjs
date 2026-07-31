// verifica_M2_sonde.mjs — le sonde che restano dopo la rimisura.
//
//     node ai_lab/confronto/verifica_M2_sonde.mjs
//
// Sei domande a cui la rimisura principale (verifica_M2_adversariale.mjs) non risponde:
//   S1  il cancello calcolato RISPETTANDO i blocchi (mediana fra gare) invece che pooled —
//       la pre-registrazione dice «blocchi = gare», e il numero principale del misurato e'
//       una mediana che MESCOLA le gare.
//   S2  C2: quanto distano fra loro i due vecchi (il misurato lo dichiara, va rifatto).
//   S3  lo spacchettamento per neutralizzazione DENTRO la finestra (numero dichiarato dal
//       misurato e non verificato altrove).
//   S4  riferimento = la SECONDA auto invece del leader: il leader e' una macchina speciale
//       (aria libera sempre), e se il verdetto dipendesse da lui sarebbe una scelta e non
//       una misura.
//   S5  chi produce il bias del nuovo: quante gare, quanti congelamenti, quanti piloti.
//   S6  il cancello con la MEDIA invece della mediana (il pre-reg dice «bias», non «bias
//       mediano»: la scelta della statistica e' del misuratore).
//
// Non scrive niente su disco, non tocca demo/, simulatore/, data/.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simulate as simDemo } from '../../demo/engine.mjs';
import { passiBase, simulaSimmetrico } from '../../demo/passo.mjs';
import { costruisciScenario } from '../../simulatore/scenario/costruttore.mjs';
import { simulate as simNuovo } from '../../simulatore/engine/kernel.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { caricaPrior } from '../../simulatore/provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../simulatore/scenario/director_dati.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');
const DD = path.join(RADICE, 'demo', 'data');

const ORIZZONTI = [3, 5, 10];
const HMAX = 10; const L0 = 5; const PASSO = 2; const ZONE = 0;
const MOT = ['banco', 'pannello', 'nuovo'];
const MP = JSON.parse(readFileSync(path.join(DD, 'modello_passo_2026.json'), 'utf8'));
const V2 = { delta: MP.deriva.delta_gara_s, rho: MP.degrado.rho_s_giro };
const MAN = JSON.parse(readFileSync(path.join(DD, 'vista', 'manifest.json'), 'utf8')).cartella_di;
const GARE = Object.keys(MAN).sort();
const gareSim = caricaGare2026(SIM);
const CTX0 = {
  gare: gareSim,
  modello: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8')),
  prior: caricaPrior(SIM),
  costantiDirector: caricaCostanti(SIM),
  bandaRientro: JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'banda_rientro.json'), 'utf8')),
};

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 4) => (x === null || x === undefined || Number.isNaN(x) ? '   —    ' : x.toFixed(n));

function caricaDemo(sito) {
  const G = JSON.parse(readFileSync(path.join(DD, `${sito}.json`), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  return { G, byLap, nLaps: G.n_laps };
}
const tronca = (byLap, L) => { const t = {}; for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k]; return t; };

function proBanco(byLapT, L, pace, H) {
  const present = Object.keys(byLapT[L] ?? {}).filter((d) => typeof byLapT[L][d].cum_time === 'number' && pace[d] != null);
  const state = {};
  for (const d of present) state[d] = { cum_time: byLapT[L][d].cum_time };
  const cum = simDemo({ state, pace, steps: H, freezeLap: L, ZONE });
  const o = {};
  for (const d of present) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) o[d] = cum[d];
  return o;
}
function proPannello(byLapT, L, nLaps, H, base) {
  const cum = simulaSimmetrico({ base, byLap: byLapT, nLaps, freezeLap: L, steps: H, pits: [], delta: V2.delta, rho: V2.rho, gradino: null, ZONE });
  const o = {};
  for (const d of Object.keys(cum)) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) o[d] = cum[d];
  return o;
}
function proNuovo(sc, H) {
  const r = simNuovo({ state: sc.state, pace: sc.pace, freezeLap: sc.freezeLap, steps: H, pits: sc.pits });
  const o = {};
  for (const d of Object.keys(r.cum)) if (typeof r.cum[d] === 'number' && Number.isFinite(r.cum[d])) o[d] = r.cum[d];
  return o;
}

function raccogli() {
  const righe = [];
  for (const sito of GARE) {
    const { G, byLap, nLaps } = caricaDemo(sito);
    const nomeSim = MAN[sito];
    const ctx = { ...CTX0, nGiriGara: gareSim[nomeSim].nGiri };
    for (let L = L0; L + HMAX <= nLaps; L += PASSO) {
      if (!byLap[L]) continue;
      const conCum = Object.keys(byLap[L]).filter((d) => typeof byLap[L][d].cum_time === 'number');
      if (!conCum.length) continue;
      const ordL = [...conCum].sort((a, b) => byLap[L][a].cum_time - byLap[L][b].cum_time);
      const leader = ordL[0]; const secondo = ordL[1] ?? null;
      const byLapT = tronca(byLap, L);
      const pace = G.pace[String(L)] || {};
      const base = passiBase(byLapT, nLaps, L, conCum, { delta: V2.delta, rho: V2.rho, eta0: 0 });
      let sc = null;
      for (const cand of [leader, ...conCum]) {
        try { sc = costruisciScenario({ gara: nomeSim, freezeLap: L, pilota: cand }, { ...ctx, giroFinale: L + HMAX }); break; } catch { /* prossimo */ }
      }
      const P = {};
      for (const H of ORIZZONTI) P[H] = { banco: proBanco(byLapT, L, pace, H), pannello: proPannello(byLapT, L, nLaps, H, base), nuovo: sc ? proNuovo(sc, H) : {} };

      for (const H of ORIZZONTI) {
        const Lf = L + H;
        const vL = byLap[Lf]?.[leader]?.cum_time;
        if (typeof vL !== 'number' || !MOT.every((m) => P[H][m][leader] !== undefined)) continue;
        const vS = secondo ? byLap[Lf]?.[secondo]?.cum_time : undefined;
        const secondoOk = secondo && typeof vS === 'number' && MOT.every((m) => P[H][m][secondo] !== undefined);
        for (const d of conCum) {
          if (d === leader) continue;
          const vero = byLap[Lf]?.[d]?.cum_time;
          if (typeof vero !== 'number') continue;
          let sosta = false; let neutroFin = false;
          for (let k = L + 1; k <= Lf; k += 1) {
            for (const x of [d, leader]) {
              const c = byLap[k]?.[x];
              if (!c) continue;
              if (c.in_lap === true || c.out_lap === true) sosta = true;
              if (c.neutralized === true) neutroFin = true;
            }
          }
          const err = {}; const err2 = {};
          for (const m of MOT) {
            const p = P[H][m];
            err[m] = p[d] === undefined ? null : ((p[d] - p[leader]) - vero + vL) / H;
            err2[m] = (!secondoOk || d === secondo || p[d] === undefined) ? null : ((p[d] - p[secondo]) - vero + vS) / H;
          }
          righe.push({ gara: sito, L, H, d, err, err2, sosta, neutroFin, comune: MOT.every((m) => err[m] !== null), comune2: MOT.every((m) => err2[m] !== null) });
        }
      }
    }
  }
  return righe;
}

function agg(righe, filtro, campo, comuneCampo, stat) {
  const out = {};
  for (const H of ORIZZONTI) {
    out[H] = {};
    for (const m of MOT) {
      const v = righe.filter((r) => r.H === H && filtro(r) && r[comuneCampo] && r[campo][m] !== null).map((r) => r[campo][m]);
      out[H][m] = { n: v.length, punto: stat(v), ass: mediana(v.map(Math.abs)) };
    }
  }
  return out;
}
function cancello(nome, a) {
  for (const v of ['banco', 'pannello']) {
    const det = ORIZZONTI.map((H) => ({ H, n: Math.abs(a[H].nuovo.punto), o: Math.abs(a[H][v].punto) }));
    console.log(`  ${nome.padEnd(34)} vs ${v.padEnd(9)}: ${det.every((x) => x.n <= x.o) ? 'PASSA' : 'NON PASSA'}  ${det.map((x) => `${x.H}g ${f(x.n, 3)}/${f(x.o, 3)}${x.n <= x.o ? '' : ' ✗'}`).join(' · ')}`);
  }
}

function main() {
  const righe = raccogli();
  const pulita = (r) => !r.sosta;
  const tutte = () => true;

  console.log('SONDE SU M2 — cio\' che la rimisura principale non copre\n');

  // S1 — il cancello che rispetta i blocchi
  console.log('══ S1 · il cancello con la statistica CHE RISPETTA I BLOCCHI (mediana fra gare) ══');
  console.log('   (la pre-registrazione dice «blocchi = gare»; il numero principale del misurato e\' pooled)');
  const perGaraStat = (filtro, campo, comuneCampo) => {
    const out = {};
    for (const H of ORIZZONTI) {
      out[H] = {};
      for (const m of MOT) {
        const perG = GARE.map((g) => mediana(righe.filter((r) => r.H === H && r.gara === g && filtro(r) && r[comuneCampo] && r[campo][m] !== null).map((r) => r[campo][m]))).filter((x) => x !== null);
        out[H][m] = { n: perG.length, punto: mediana(perG), ass: null };
      }
    }
    return out;
  };
  const bloc = perGaraStat(pulita, 'err', 'comune');
  for (const H of ORIZZONTI) console.log(`  ${String(H).padStart(2)}g  ${MOT.map((m) => `${m} ${f(bloc[H][m].punto)}`).join(' · ')}`);
  cancello('mediana FRA GARE, finestra pulita', bloc);
  cancello('mediana FRA GARE, griglia intera', perGaraStat(tutte, 'err', 'comune'));

  // S6 — media invece di mediana
  console.log('\n══ S6 · il cancello con la MEDIA invece della mediana (pooled, finestra pulita) ══');
  cancello('media pooled, finestra pulita', agg(righe, pulita, 'err', 'comune', media));
  cancello('media pooled, griglia intera', agg(righe, tutte, 'err', 'comune', media));

  // S2 — C2
  console.log('\n══ S2 · C2 rifatto: distanza fra i motori sul distacco (mediana di |err_A − err_B|) ══');
  for (const H of ORIZZONTI) {
    const u = righe.filter((r) => r.H === H && pulita(r) && r.comune);
    console.log(`  ${String(H).padStart(2)}g  banco↔pannello ${f(mediana(u.map((r) => Math.abs(r.err.banco - r.err.pannello))), 3)}  ·  nuovo↔pannello ${f(mediana(u.map((r) => Math.abs(r.err.nuovo - r.err.pannello))), 3)}  ·  nuovo↔banco ${f(mediana(u.map((r) => Math.abs(r.err.nuovo - r.err.banco))), 3)}`);
  }

  // S3 — neutralizzazione DENTRO la finestra
  console.log('\n══ S3 · spacchettamento per neutralizzazione DENTRO la finestra (finestra pulita) ══');
  for (const [nome, filtro] of [['VERDE ', (r) => pulita(r) && !r.neutroFin], ['NEUTRO', (r) => pulita(r) && r.neutroFin]]) {
    const a = agg(righe, filtro, 'err', 'comune', mediana);
    for (const H of ORIZZONTI) console.log(`  ${nome} ${String(H).padStart(2)}g n=${String(a[H].banco.n).padStart(4)}  bias ${MOT.map((m) => f(a[H][m].punto, 3)).join(' / ')}   |err| ${MOT.map((m) => f(a[H][m].ass, 3)).join(' / ')}`);
  }

  // S4 — riferimento = la SECONDA auto
  console.log('\n══ S4 · riferimento = la SECONDA auto al congelamento invece del leader (finestra pulita) ══');
  const a2 = agg(righe, pulita, 'err2', 'comune2', mediana);
  for (const H of ORIZZONTI) console.log(`  ${String(H).padStart(2)}g n=${String(a2[H].banco.n).padStart(4)}  bias ${MOT.map((m) => f(a2[H][m].punto)).join(' / ')}   |err| ${MOT.map((m) => f(a2[H][m].ass)).join(' / ')}`);
  cancello('riferimento = seconda auto', a2);

  // S5 — chi produce il bias del nuovo
  console.log('\n══ S5 · da dove viene lo scarto del nuovo: quota di congelamenti in cui il nuovo e\' piu\' biased ══');
  for (const H of ORIZZONTI) {
    const gruppi = new Map();
    for (const r of righe) {
      if (r.H !== H || !pulita(r) || !r.comune) continue;
      const k = `${r.gara}|${r.L}`;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(r);
    }
    for (const v of ['banco', 'pannello']) {
      let peggio = 0; let tot = 0;
      for (const g of gruppi.values()) {
        const bn = Math.abs(mediana(g.map((r) => r.err.nuovo)));
        const bv = Math.abs(mediana(g.map((r) => r.err[v])));
        tot += 1;
        if (bn > bv) peggio += 1;
      }
      console.log(`  ${String(H).padStart(2)}g vs ${v.padEnd(9)}: il nuovo e' piu' biased in ${peggio}/${tot} congelamenti (${(100 * peggio / tot).toFixed(1)}%)`);
    }
  }
}

main();
