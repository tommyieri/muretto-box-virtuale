// verifica_M2_adversariale.mjs — RIMISURA INDIPENDENTE DI M2, per smentirla.
//
//     node ai_lab/confronto/verifica_M2_adversariale.mjs [--passo=N] [--json]
//
// Non importa m2_bias_passo.mjs ne' banco.mjs: ricostruisce la griglia, i tre
// motori e la statistica da zero, leggendo direttamente demo/data/<gara>.json e
// costruendo il contesto del nuovo come fa simulatore/web/genera_vista_gara.mjs.
// Se i due codici danno gli stessi numeri, i numeri sono i numeri; se danno numeri
// diversi, uno dei due sbaglia e va detto quale.
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
const HMAX = 10;
const L0 = 5;
const PASSO = Number((process.argv.find((a) => a.startsWith('--passo=')) ?? '--passo=2').split('=')[1]);
const ZONE = 0;
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

// ————————————————————————————————————————————————————————————— statistica
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 4) => (x === null || x === undefined || Number.isNaN(x) ? '   —    ' : x.toFixed(n));

// ————————————————————————————————————————————————————————————— dati
function caricaDemo(sito) {
  const G = JSON.parse(readFileSync(path.join(DD, `${sito}.json`), 'utf8'));
  const byLap = {};
  for (const l of G.laps) byLap[l.lap] = l.cars;
  return { G, byLap, nLaps: G.n_laps };
}

/** byLap ridotto ai soli giri <= L (copia, cosi' nessuno puo' leggere oltre). */
function tronca(byLap, L) {
  const t = {};
  for (let k = 1; k <= L; k += 1) if (byLap[k]) t[k] = byLap[k];
  return t;
}

// ————————————————————————————————————————————————————————————— i tre motori
function proBanco(byLapT, L, pace, H) {
  const present = Object.keys(byLapT[L] ?? {})
    .filter((d) => typeof byLapT[L][d].cum_time === 'number' && pace[d] != null);
  const state = {};
  for (const d of present) state[d] = { cum_time: byLapT[L][d].cum_time };
  const cum = simDemo({ state, pace, steps: H, freezeLap: L, ZONE });
  const o = {};
  for (const d of present) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) o[d] = cum[d];
  return o;
}

function proPannello(byLapT, L, nLaps, H, base) {
  const cum = simulaSimmetrico({
    base, byLap: byLapT, nLaps, freezeLap: L, steps: H, pits: [],
    delta: V2.delta, rho: V2.rho, gradino: null, ZONE,
  });
  const o = {};
  for (const d of Object.keys(cum)) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) o[d] = cum[d];
  return o;
}

function proNuovo(scenario, H) {
  const r = simNuovo({
    state: scenario.state, pace: scenario.pace, freezeLap: scenario.freezeLap,
    steps: H, pits: scenario.pits,
  });
  const o = {};
  for (const d of Object.keys(r.cum)) {
    if (typeof r.cum[d] === 'number' && Number.isFinite(r.cum[d])) o[d] = r.cum[d];
  }
  return o;
}

// ═══════════════════════════════════════════════════════════════ raccolta
function raccogli({ passo = PASSO, sporcaFuturo = false } = {}) {
  const righe = [];
  const diag = {
    congelamenti: 0, coppie_con_cum: 0, scenari_falliti: 0,
    scarti_leader: { verita: 0, banco: 0, pannello: 0, nuovo: 0 },
    copertura: { piloti: 0, banco: 0, pannello: 0, nuovo: 0 },
  };

  for (const sito of GARE) {
    const { G, byLap, nLaps } = caricaDemo(sito);
    const nomeSim = MAN[sito];
    const gSim = gareSim[nomeSim];
    const ctx = { ...CTX0, nGiriGara: gSim.nGiri };

    for (let L = L0; L + HMAX <= nLaps; L += passo) {
      if (!byLap[L]) continue;
      const conCum = Object.keys(byLap[L]).filter((d) => typeof byLap[L][d].cum_time === 'number');
      if (!conCum.length) continue;
      const leader = conCum.reduce((m, d) => (byLap[L][d].cum_time < byLap[L][m].cum_time ? d : m), conCum[0]);
      diag.congelamenti += 1;
      diag.copertura.piloti += conCum.length;

      const byLapT = tronca(byLap, L);
      const pace = G.pace[String(L)] || {};
      const base = passiBase(byLapT, nLaps, L, conCum, { delta: V2.delta, rho: V2.rho, eta0: 0 });

      // SENTINELLA FUTURO: se richiesto, si passa ai motori un byLap in cui i
      // giri > L sono sfasciati. Chi legge il futuro cambia risposta.
      let gSimUsata = gSim;
      if (sporcaFuturo) {
        const perPilota = new Map();
        for (const [drv, celle] of gSim.perPilota) {
          const c2 = new Map();
          for (const [lap, cella] of celle) {
            c2.set(lap, lap <= L ? cella : { ...cella, lap_time: (cella.lap_time ?? 0) + 999, cum_time: (cella.cum_time ?? 0) + 999 });
          }
          perPilota.set(drv, c2);
        }
        const righeS = gSim.righe.map((r) => (r.lap <= L ? r : { ...r, lap_time: (r.lap_time ?? 0) + 999, cum_time: (r.cum_time ?? 0) + 999 }));
        gSimUsata = { ...gSim, perPilota, righe: righeS };
      }
      const ctxU = sporcaFuturo ? { ...ctx, gare: { ...gareSim, [nomeSim]: gSimUsata } } : ctx;

      let sc = null;
      for (const cand of [leader, ...conCum]) {
        try {
          sc = costruisciScenario({ gara: nomeSim, freezeLap: L, pilota: cand }, { ...ctxU, giroFinale: L + HMAX });
          break;
        } catch { /* prova il prossimo */ }
      }
      if (!sc) diag.scenari_falliti += 1;

      const P = {};
      for (const H of ORIZZONTI) {
        P[H] = {
          banco: proBanco(byLapT, L, pace, H),
          pannello: proPannello(byLapT, L, nLaps, H, base),
          nuovo: sc ? proNuovo(sc, H) : {},
        };
      }
      for (const m of MOT) diag.copertura[m] += conCum.filter((d) => P[3][m][d] !== undefined).length;

      for (const H of ORIZZONTI) {
        const Lf = L + H;
        const veroLeader = byLap[Lf]?.[leader]?.cum_time;
        const okLeader = typeof veroLeader === 'number' && MOT.every((m) => P[H][m][leader] !== undefined);
        if (!okLeader) {
          if (typeof veroLeader !== 'number') diag.scarti_leader.verita += 1;
          for (const m of MOT) if (P[H][m][leader] === undefined) diag.scarti_leader[m] += 1;
          continue;
        }
        for (const d of conCum) {
          if (d === leader) continue;
          const vero = byLap[Lf]?.[d]?.cum_time;
          if (typeof vero !== 'number') continue;
          diag.coppie_con_cum += 1;
          const gapVero = vero - veroLeader;

          let sosta = false; let neutroFin = false;
          for (let k = L + 1; k <= Lf; k += 1) {
            for (const x of [d, leader]) {
              const c = byLap[k]?.[x];
              if (!c) continue;
              if (c.in_lap === true || c.out_lap === true) sosta = true;
              if (c.neutralized === true) neutroFin = true;
            }
          }

          const err = {}; const errAss = {}; const errLead = {};
          for (const m of MOT) {
            const p = P[H][m];
            err[m] = p[d] === undefined ? null : ((p[d] - p[leader]) - gapVero) / H;
            errAss[m] = p[d] === undefined ? null : (p[d] - vero) / H;
            errLead[m] = (p[leader] - veroLeader) / H;
          }
          righe.push({
            gara: sito, L, H, d, leader, err, errAss, errLead,
            comune: MOT.every((m) => err[m] !== null),
            sosta, neutroFin,
            neutroFreeze: byLap[L]?.[d]?.neutralized === true || byLap[L]?.[leader]?.neutralized === true,
          });
        }
      }
    }
  }
  return { righe, diag };
}

// ═══════════════════════════════════════════════════════════ aggregazioni
function riassunto(v) {
  if (!v.length) return { n: 0, bias_mediano: null, bias_medio: null, ass_mediano: null };
  return { n: v.length, bias_mediano: mediana(v), bias_medio: media(v), ass_mediano: mediana(v.map(Math.abs)) };
}
function tabellaBias(righe, filtro, campo = 'err', { comune = true } = {}) {
  const out = {};
  for (const H of ORIZZONTI) {
    out[H] = {};
    for (const m of MOT) {
      const v = righe.filter((r) => r.H === H && filtro(r) && (comune ? r.comune : true) && r[campo][m] !== null)
        .map((r) => r[campo][m]);
      out[H][m] = riassunto(v);
    }
  }
  return out;
}
function stampa(titolo, agg) {
  console.log(`\n${titolo}`);
  console.log('   H  motore        n      bias mediano   bias medio   |err| mediano');
  for (const H of ORIZZONTI) {
    for (const m of MOT) {
      const r = agg[H][m];
      console.log(`  ${String(H).padStart(2)}  ${m.padEnd(10)} ${String(r.n).padStart(5)}   ${f(r.bias_mediano).padStart(12)}  ${f(r.bias_medio).padStart(11)}  ${f(r.ass_mediano).padStart(13)}`);
    }
  }
}

// riferimenti alternativi, ricostruiti dagli stessi errori assoluti
function biasConRiferimento(righe, filtro, tipo) {
  const out = {};
  for (const H of ORIZZONTI) {
    const gruppi = new Map();
    for (const r of righe) {
      if (r.H !== H || !filtro(r) || !r.comune) continue;
      const k = `${r.gara}|${r.L}`;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(r);
    }
    out[H] = {};
    for (const m of MOT) {
      const e = [];
      for (const g of gruppi.values()) {
        const vals = g.map((r) => r.errAss[m]);
        let rif;
        if (tipo === 'media') rif = media(vals);
        else if (tipo === 'mediana') rif = mediana(vals);
        else if (tipo === 'leader') rif = g[0].errLead[m];
        for (const v of vals) e.push(v - rif);
      }
      out[H][m] = riassunto(e);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════ bootstrap a blocchi (mio)
// PRNG diverso da quello dello script misurato (mulberry32), per non ereditarne
// gli eventuali difetti.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bootBlocchi(perBlocco, stat, { B = 4000, seme = 7 } = {}) {
  const chiavi = Object.keys(perBlocco).filter((k) => perBlocco[k].length);
  if (chiavi.length < 2) return null;
  const rnd = mulberry32(seme);
  const v = [];
  for (let b = 0; b < B; b += 1) {
    const u = [];
    for (let i = 0; i < chiavi.length; i += 1) u.push(...perBlocco[chiavi[Math.floor(rnd() * chiavi.length)]]);
    const x = stat(u);
    if (x !== null && Number.isFinite(x)) v.push(x);
  }
  v.sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.floor(p * v.length)))];
  return [q(0.025), q(0.975)];
}

// ═══════════════════════════════════════════════════════════════ il referto
function main() {
  const t0 = Date.now();
  const { righe, diag } = raccogli();
  const pulita = (r) => !r.sosta;
  const tutte = () => true;

  console.log('VERIFICA ADVERSARIALE DI M2 — rimisura indipendente');
  console.log(`\nGRIGLIA (L da ${L0}, passo ${PASSO}, L+${HMAX} ≤ nGiri)`);
  console.log(`  congelamenti ${diag.congelamenti} · coppie ${diag.coppie_con_cum} · scenari falliti ${diag.scenari_falliti}`);
  console.log(`  coppie per orizzonte: ${ORIZZONTI.map((H) => `${H}g ${righe.filter((r) => r.H === H).length}`).join(' · ')}`);
  console.log(`  copertura incondizionata su ${diag.copertura.piloti} coppie (congelamento, pilota):`);
  for (const m of MOT) console.log(`    ${m.padEnd(10)} ${diag.copertura[m]} (${(100 * diag.copertura[m] / diag.copertura.piloti).toFixed(1)}%)`);
  console.log(`  scarti del leader: ${JSON.stringify(diag.scarti_leader)}`);

  const AP = tabellaBias(righe, pulita);
  const AI = tabellaBias(righe, tutte);
  stampa('╔═ FINESTRA PULITA, popolazione COMUNE (la lettura principale del misurato)', AP);
  stampa('╔═ GRIGLIA INTERA, popolazione COMUNE', AI);
  stampa('   finestra pulita, PROPRIA popolazione', tabellaBias(righe, pulita, 'err', { comune: false }));

  // n identici? (mediane su popolazioni diverse = il trucco cercato)
  console.log('\n══ CONTROLLO: le mediane sono su popolazioni IDENTICHE? ══');
  for (const H of ORIZZONTI) {
    const ns = MOT.map((m) => AP[H][m].n);
    console.log(`  ${H}g  n = ${ns.join(' / ')}  ${new Set(ns).size === 1 ? 'IDENTICHE' : 'DIVERSE ← problema'}`);
  }

  // muti: mai zero, mai infinito
  const nulli = righe.filter((r) => MOT.some((m) => r.err[m] === null));
  const zeriSospetti = righe.filter((r) => MOT.some((m) => r.err[m] === 0));
  const nonFiniti = righe.filter((r) => MOT.some((m) => r.err[m] !== null && !Number.isFinite(r.err[m])));
  console.log(`\n══ CONTROLLO: il MUTO ══`);
  console.log(`  righe con almeno un motore muto : ${nulli.length} su ${righe.length} — entrano nella lettura comune? ${nulli.some((r) => r.comune) ? 'SI ← problema' : 'no'}`);
  console.log(`  errori esattamente 0 (muto travestito da zero) : ${zeriSospetti.length}`);
  console.log(`  errori non finiti (muto travestito da infinito): ${nonFiniti.length}`);

  // il cancello
  console.log('\n══ IL CANCELLO M2, rifatto ══');
  for (const [nome, agg] of [['finestra pulita', AP], ['griglia intera', AI]]) {
    for (const v of ['banco', 'pannello']) {
      const det = ORIZZONTI.map((H) => ({
        H, n: Math.abs(agg[H].nuovo.bias_mediano), o: Math.abs(agg[H][v].bias_mediano),
      }));
      const passa = det.every((x) => x.n <= x.o);
      console.log(`  ${nome} vs ${v}: ${passa ? 'PASSA' : 'NON PASSA'}  ${det.map((x) => `${x.H}g ${f(x.n, 3)}/${f(x.o, 3)}${x.n <= x.o ? '' : ' ✗'}`).join(' · ')}`);
    }
  }

  // DECOMPOSIZIONE: quanto del bias e' del LEADER e quanto degli altri?
  console.log('\n══ DECOMPOSIZIONE: bias(gap) = err(pilota) − err(leader) ══');
  console.log('   H  motore      med err_pilota   med err_leader   med(differenza)');
  for (const H of ORIZZONTI) {
    for (const m of MOT) {
      const rr = righe.filter((r) => r.H === H && pulita(r) && r.comune);
      console.log(`  ${String(H).padStart(2)}  ${m.padEnd(10)} ${f(mediana(rr.map((r) => r.errAss[m]))).padStart(14)}  ${f(mediana(rr.map((r) => r.errLead[m]))).padStart(15)}  ${f(mediana(rr.map((r) => r.err[m]))).padStart(16)}`);
    }
  }

  // RIFERIMENTI ALTERNATIVI
  for (const tipo of ['media', 'mediana']) {
    stampa(`══ RIFERIMENTO ALTERNATIVO: ${tipo} del campo invece del leader (finestra pulita)`, biasConRiferimento(righe, pulita, tipo));
  }
  stampa('══ ERRORE SUL TEMPO ASSOLUTO (nessun riferimento) — finestra pulita', tabellaBias(righe, pulita, 'errAss'));

  // il cancello sotto i riferimenti alternativi
  console.log('\n══ IL CANCELLO sotto riferimenti diversi (finestra pulita) ══');
  for (const [nome, agg] of [
    ['leader (misurato)', AP],
    ['media campo', biasConRiferimento(righe, pulita, 'media')],
    ['mediana campo', biasConRiferimento(righe, pulita, 'mediana')],
    ['tempo assoluto', tabellaBias(righe, pulita, 'errAss')],
  ]) {
    for (const v of ['banco', 'pannello']) {
      const det = ORIZZONTI.map((H) => ({ H, n: Math.abs(agg[H].nuovo.bias_mediano), o: Math.abs(agg[H][v].bias_mediano) }));
      console.log(`  ${nome.padEnd(18)} vs ${v.padEnd(9)}: ${det.every((x) => x.n <= x.o) ? 'PASSA' : 'NON PASSA'}  ${det.map((x) => `${x.H}g ${f(x.n, 3)}/${f(x.o, 3)}`).join(' · ')}`);
    }
  }

  // bootstrap a blocchi, PRNG diverso
  console.log('\n══ IC95 dello scarto appaiato |bias(nuovo)|−|bias(vecchio)| — mulberry32, 4000 ricampionamenti ══');
  for (const H of ORIZZONTI) {
    const u = righe.filter((r) => r.H === H && pulita(r) && r.comune);
    for (const v of ['banco', 'pannello']) {
      const bl = {};
      for (const g of GARE) bl[g] = u.filter((r) => r.gara === g).map((r) => [r.err.nuovo, r.err[v]]);
      const ic = bootBlocchi(bl, (x) => Math.abs(mediana(x.map((y) => y[0]))) - Math.abs(mediana(x.map((y) => y[1]))));
      const punto = Math.abs(AP[H].nuovo.bias_mediano) - Math.abs(AP[H][v].bias_mediano);
      console.log(`  ${String(H).padStart(2)}g  vs ${v.padEnd(9)} punto ${f(punto).padStart(8)}  IC95 [${f(ic[0])}; ${f(ic[1])}]  ${ic[0] <= 0 && ic[1] >= 0 ? 'contiene lo zero' : 'NON contiene lo zero'}`);
    }
  }

  // appaiato coppia per coppia
  console.log('\n══ APPAIATO coppia per coppia (finestra pulita): chi e\' piu\' vicino al vero ══');
  for (const H of ORIZZONTI) {
    const u = righe.filter((r) => r.H === H && pulita(r) && r.comune);
    for (const v of ['banco', 'pannello']) {
      const dif = u.map((r) => Math.abs(r.err.nuovo) - Math.abs(r.err[v]));
      const vinc = dif.filter((x) => x < 0).length;
      const gareVinte = GARE.filter((g) => {
        const dd = u.filter((r) => r.gara === g).map((r) => Math.abs(r.err.nuovo) - Math.abs(r.err[v]));
        return dd.length && mediana(dd) < 0;
      }).length;
      console.log(`  ${String(H).padStart(2)}g  vs ${v.padEnd(9)} n=${dif.length}  nuovo vince ${(100 * vinc / dif.length).toFixed(1)}%  mediana Δ|err| ${f(mediana(dif))}  gare ${gareVinte}/11`);
    }
  }

  // spacchettamenti e contaminante
  stampa('══ VERDE al congelamento (finestra pulita)', tabellaBias(righe, (r) => pulita(r) && !r.neutroFreeze));
  stampa('══ NEUTRALIZZATO al congelamento (finestra pulita)', tabellaBias(righe, (r) => pulita(r) && r.neutroFreeze));
  stampa('══ SOLO finestre CON sosta (il contaminante)', tabellaBias(righe, (r) => r.sosta));

  // per gara
  console.log('\n══ PER GARA — bias mediano (finestra pulita, popolazione comune) ══');
  for (const H of ORIZZONTI) {
    console.log(`  orizzonte ${H}g`);
    const perM = { banco: [], pannello: [], nuovo: [] };
    for (const g of GARE) {
      const u = righe.filter((r) => r.H === H && r.gara === g && pulita(r) && r.comune);
      const riga = MOT.map((m) => { const x = mediana(u.map((r) => r.err[m])); perM[m].push(x); return f(x).padStart(10); });
      console.log(`    ${g.padEnd(16)} ${riga.join(' ')}   n=${u.length}`);
    }
    console.log(`    ${'MEDIANA fra gare'.padEnd(16)} ${MOT.map((m) => f(mediana(perM[m].filter((x) => x !== null))).padStart(10)).join(' ')}`);
  }

  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ═══════════════════════════════ sentinella: qualcuno legge il futuro?
function sentinellaFuturo() {
  console.log('\n══ SENTINELLA FUTURO — si sfascia tutto cio\' che sta oltre L e si riguarda ══');
  const a = raccogli({ passo: 8 });
  const b = raccogli({ passo: 8, sporcaFuturo: true });
  // il grezzo del simulatore alimenta SOLO il nuovo; i due vecchi leggono demo/data,
  // che qui viene troncato per costruzione. Quindi la sentinella prova il NUOVO.
  let diverse = 0; let confrontate = 0;
  for (let i = 0; i < Math.min(a.righe.length, b.righe.length); i += 1) {
    const x = a.righe[i]; const y = b.righe[i];
    if (x.gara !== y.gara || x.L !== y.L || x.H !== y.H || x.d !== y.d) { console.log('  righe disallineate, confronto abortito'); return; }
    for (const m of MOT) {
      if (x.err[m] === null && y.err[m] === null) continue;
      confrontate += 1;
      if (x.err[m] === null || y.err[m] === null || Math.abs(x.err[m] - y.err[m]) > 1e-12) diverse += 1;
    }
  }
  console.log(`  proiezioni confrontate ${confrontate} · cambiate sporcando il futuro: ${diverse}  ${diverse === 0 ? '→ nessuno legge oltre L' : '← QUALCUNO LEGGE IL FUTURO'}`);
}

// ═══════════════════════════════ sentinella: lo scenario dipende dal pilota?
function sentinellaPilota() {
  console.log('\n══ SENTINELLA: senza soste lo scenario del nuovo dipende dal PILOTA passato? ══');
  const sito = 'Cina'; const nomeSim = MAN[sito];
  const gSim = gareSim[nomeSim];
  const ctx = { ...CTX0, nGiriGara: gSim.nGiri };
  const { byLap } = caricaDemo(sito);
  const L = 21;
  const piloti = Object.keys(byLap[L]).filter((d) => typeof byLap[L][d].cum_time === 'number');
  const rif = proNuovo(costruisciScenario({ gara: nomeSim, freezeLap: L, pilota: piloti[0] }, { ...ctx, giroFinale: L + 10 }), 10);
  let diff = 0;
  for (const p of piloti) {
    const c = proNuovo(costruisciScenario({ gara: nomeSim, freezeLap: L, pilota: p }, { ...ctx, giroFinale: L + 10 }), 10);
    for (const d of Object.keys(rif)) if (Math.abs((c[d] ?? NaN) - rif[d]) > 1e-12) diff += 1;
  }
  console.log(`  ${piloti.length} piloti provati al congelamento ${L} di ${sito}: differenze ${diff} ${diff === 0 ? '→ indipendente, il ripiego del misurato e\' innocuo' : '← DIPENDE, e il ripiego sposta i numeri'}`);
}

// ═══════════════════════════════ verifica a mano di una coppia
function aMano() {
  console.log('\n══ VERIFICA A MANO — Cina, L=21, ALO, H=3 (la stessa coppia che il misurato dichiara) ══');
  const sito = 'Cina'; const nomeSim = MAN[sito];
  const { G, byLap, nLaps } = caricaDemo(sito);
  const L = 21; const H = 3; const d = 'ALO';
  const conCum = Object.keys(byLap[L]).filter((x) => typeof byLap[L][x].cum_time === 'number');
  const leader = conCum.reduce((m, x) => (byLap[L][x].cum_time < byLap[L][m].cum_time ? x : m), conCum[0]);
  const pace = G.pace[String(L)];
  // banco a mano: cum(L) + H * pace
  const predD = byLap[L][d].cum_time + H * pace[d];
  const predLead = byLap[L][leader].cum_time + H * pace[leader];
  const veroD = byLap[L + H][d].cum_time; const veroLead = byLap[L + H][leader].cum_time;
  const errMano = ((predD - predLead) - (veroD - veroLead)) / H;
  const P = proBanco(tronca(byLap, L), L, pace, H);
  const errKernel = ((P[d] - P[leader]) - (veroD - veroLead)) / H;
  console.log(`  leader = ${leader}`);
  console.log(`  a mano  ${errMano.toFixed(6)}   dal kernel demo ${errKernel.toFixed(6)}   scarto ${Math.abs(errMano - errKernel).toExponential(2)}`);
  const gSim = gareSim[nomeSim];
  const sc = costruisciScenario({ gara: nomeSim, freezeLap: L, pilota: leader }, { ...CTX0, nGiriGara: gSim.nGiri, giroFinale: L + 10 });
  const N = proNuovo(sc, H);
  console.log(`  nuovo   ${(((N[d] - N[leader]) - (veroD - veroLead)) / H).toFixed(6)}   · pits dello scenario: ${JSON.stringify(sc.pits)}  steps ${sc.steps}`);
  console.log(`  stato di partenza = cum reale? banco ${Math.abs(byLap[L][d].cum_time - (byLap[L][d].cum_time)) === 0}  nuovo ${Math.abs(sc.state.find((s) => s.drv === d).cum_time - byLap[L][d].cum_time) < 1e-9}`);
  void nLaps;
}

main();
aMano();
sentinellaPilota();
sentinellaFuturo();
