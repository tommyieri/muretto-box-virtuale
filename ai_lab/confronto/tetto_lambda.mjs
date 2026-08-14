// tetto_lambda.mjs — I CANCELLI DI PREREG_tetto_sottotarato.md.
//
//     node ai_lab/confronto/tetto_lambda.mjs [--json]
//
// Un parametro solo: λ moltiplica la soglia di sorpasso SIGILLATA (0,6054 ovunque,
// 2,8337 a Monaco). La geometria misurata resta intatta; λ dice se il livello e' alto
// o basso. λ < 1 = si passa piu' facilmente = piu' movimento.
//
// Il rischio numero uno e' tarare λ sui 193 casi e chiamarlo scoperta: per questo il
// cancello che decide (E1) e' un LEAVE-ONE-RACE-OUT, e si stampano sempre accanto la
// curva intera, gli undici λ scelti e il λ ottimo IN campione. La distanza fra dentro e
// fuori campione e' quanto la griglia si stava adattando al rumore.
//
// NON SCRIVE NIENTE su disco e non decide niente: i cancelli stanno nella prereg.

import { gare, garaNuova, contestoNuovo, garaSimDi } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const LAMBDA = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];   // griglia DICHIARATA nella prereg
const SEME = 20260814;

// generatore riproducibile (mulberry32): il seme e' dichiarato, le permutazioni si rifanno
function rnd(seme) {
  let a = seme >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// il tetto della gara, con la soglia sigillata moltiplicata per λ. `tetto: false` spegne.
function tettoDi(nomeSito, lam) {
  const c = contestoNuovo(nomeSito);
  const s = c.sogliaSorpasso;
  const base = s.soglia_sorpasso?.[garaSimDi(nomeSito)] ?? s.soglia_comune;
  if (typeof base !== 'number') throw new Error(`soglia assente per ${nomeSito}`);
  return { minGap: s.parametri.minGap, sogliaSorpasso: base * lam,
    costoDuello: s.parametri.costoDuello, costoSubito: s.parametri.costoSubito };
}

// ── una passata completa a un dato λ ─────────────────────────────────────────
function passata(lam) {
  const casi = [];
  for (const nomeSito of gare()) {
    const gSim = garaNuova(nomeSito);
    const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
    const ritiriVeri = {};
    for (const x of perGara(nomeSito)) {
      if (x.classificato) continue;
      const celle = gSim.perPilota.get(x.pilota);
      if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
    }
    const piani = pianiVeriDi(nomeSito);
    const tetto = lam === null ? false : tettoDi(nomeSito, lam);
    for (const x of perGara(nomeSito)) {
      const e = corri(nomeSito, x.pilota, {
        pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, tetto,
      });
      if (e.saltato) continue;
      casi.push({ chiave: `${nomeSito}/${x.pilota}`, gara: nomeSito, errore: e.errore,
        cambi_reali: e.cambi_reali, cambi_motore: e.cambi_motore,
        passa: e.tetto_passa, blocca: e.tetto_blocca });
    }
  }
  return casi;
}

const A = Math.abs;
const perLambda = new Map();
for (const lam of LAMBDA) perLambda.set(lam, passata(lam));
const spento = passata(null);

const err = (casi) => media(casi.map((c) => A(c.errore)));
const mov = (casi) => media(casi.map((c) => A(c.cambi_motore - c.cambi_reali)));
const errGara = (casi, g) => media(casi.filter((c) => c.gara === g).map((c) => A(c.errore)));

// ── la curva, e se e' piatta ─────────────────────────────────────────────────
const curva = LAMBDA.map((lam) => ({ lambda: lam, errore: err(perLambda.get(lam)),
  movimento: mov(perLambda.get(lam)),
  cambi: media(perLambda.get(lam).map((c) => c.cambi_motore)) }));
const nonDegeneri = curva.filter((r) => r.lambda !== 0);
const spread = Math.max(...nonDegeneri.map((r) => r.errore)) - Math.min(...nonDegeneri.map((r) => r.errore));

// incertezza della media a BLOCCHI = GARE (E11), bootstrap dichiarato
function seBlocchi(casi, nRip = 2000, seme = SEME) {
  const g = [...new Set(casi.map((c) => c.gara))];
  const perG = Object.fromEntries(g.map((x) => [x, casi.filter((c) => c.gara === x)]));
  const r = rnd(seme); const medie = [];
  for (let i = 0; i < nRip; i += 1) {
    const dentro = [];
    for (let j = 0; j < g.length; j += 1) dentro.push(...perG[g[Math.floor(r() * g.length)]]);
    medie.push(media(dentro.map((c) => A(c.errore))));
  }
  const m = media(medie);
  return Math.sqrt(media(medie.map((x) => (x - m) ** 2)));
}
const se = seBlocchi(perLambda.get(1));

// ── E1: leave-one-race-out ───────────────────────────────────────────────────
const GARE = gare();
const scelto = {};
for (const fuori of GARE) {
  let best = null;
  for (const lam of LAMBDA) {
    const dentro = perLambda.get(lam).filter((c) => c.gara !== fuori);
    const e = err(dentro);
    if (best === null || e < best.e) best = { lam, e };
  }
  scelto[fuori] = best.lam;
}
// il λ ottimo IN campione, per misurare quanto la griglia si adattava al rumore
let inCampione = null;
for (const lam of LAMBDA) { const e = err(perLambda.get(lam)); if (inCampione === null || e < inCampione.e) inCampione = { lam, e }; }

// il predittore LOO, caso per caso
const base = new Map(perLambda.get(1).map((c) => [c.chiave, c]));
const loo = [];
for (const c of perLambda.get(1)) {
  const lam = scelto[c.gara];
  const alt = perLambda.get(lam).find((x) => x.chiave === c.chiave);
  if (alt) loo.push(alt);
}
const appaiato = (nuovi) => {
  let mig = 0; let peg = 0; let pari = 0;
  for (const n of nuovi) { const b = base.get(n.chiave); if (!b) continue;
    if (A(n.errore) < A(b.errore)) mig += 1; else if (A(n.errore) > A(b.errore)) peg += 1; else pari += 1; }
  return { mig, peg, pari, disc: mig + peg };
};
const E1 = appaiato(loo);

// ── E4: il placebo sull'ASSEGNAZIONE ─────────────────────────────────────────
const r = rnd(SEME);
const saldoVero = E1.mig - E1.peg;
const saldiFinti = [];
for (let i = 0; i < 200; i += 1) {
  const lam = GARE.map((g) => scelto[g]);
  for (let j = lam.length - 1; j > 0; j -= 1) { const k = Math.floor(r() * (j + 1)); [lam[j], lam[k]] = [lam[k], lam[j]]; }
  const mescolato = {}; GARE.forEach((g, i2) => { mescolato[g] = lam[i2]; });
  const finti = [];
  for (const c of perLambda.get(1)) {
    const alt = perLambda.get(mescolato[c.gara]).find((x) => x.chiave === c.chiave);
    if (alt) finti.push(alt);
  }
  const a = appaiato(finti); saldiFinti.push(a.mig - a.peg);
}
saldiFinti.sort((a, b) => a - b);
const p95 = saldiFinti[Math.floor(0.95 * saldiFinti.length)];

const fuori = {
  curva, spento: { errore: err(spento), movimento: mov(spento), cambi: media(spento.map((c) => c.cambi_motore)) },
  cambi_reali: media(perLambda.get(1).map((c) => c.cambi_reali)),
  spread_non_degeneri: Number(spread.toFixed(4)),
  se_blocchi_gare: Number(se.toFixed(4)),
  curva_leggibile: spread > se,
  lambda_scelti: scelto,
  lambda_in_campione: inCampione.lam,
  E1: { ...E1, errore_loo: err(loo), errore_lambda1: err(perLambda.get(1)) },
  E2: { movimento_loo: mov(loo), movimento_lambda1: mov(perLambda.get(1)) },
  E4: { saldo_vero: saldoVero, p95_finti: p95, mediana_finti: saldiFinti[100] },
  n_casi: perLambda.get(1).length,
};

if (JSON_OUT) { console.log(JSON.stringify(fuori, null, 1)); } else {
  console.log('');
  console.log('  IL TETTO E\' SOTTO-TARATO? — PREREG_tetto_sottotarato.md');
  console.log(`  ${fuori.n_casi} casi · cambi di posizione REALI ${fuori.cambi_reali.toFixed(2)} per caso`);
  console.log('');
  console.log('    λ      |errore|   |mot−vero|   cambi motore');
  for (const c of curva) {
    console.log(`   ${String(c.lambda).padStart(5)}   ${c.errore.toFixed(4)}     ${c.movimento.toFixed(3)}        ${c.cambi.toFixed(2)}${c.lambda === 1 ? '   ← produzione' : ''}`);
  }
  console.log(`   spento   ${fuori.spento.errore.toFixed(4)}     ${fuori.spento.movimento.toFixed(3)}        ${fuori.spento.cambi.toFixed(2)}`);
  console.log('');
  console.log(`    la curva e' leggibile? scarto ${spread.toFixed(4)} contro incertezza ${se.toFixed(4)} → ${fuori.curva_leggibile ? 'SI' : 'NO — il minimo e\' rumore'}`);
  console.log(`    λ scelti fuori campione: ${GARE.map((g) => `${g.slice(0, 3)}=${scelto[g]}`).join(' ')}`);
  console.log(`    λ ottimo IN campione: ${inCampione.lam}`);
  console.log('');
  console.log(`    E1  appaiato LOO contro λ=1: migliora ${E1.mig} · peggiora ${E1.peg} · pari ${E1.pari} (discordanti ${E1.disc})`);
  console.log(`        |errore| ${fuori.E1.errore_lambda1.toFixed(4)} → ${fuori.E1.errore_loo.toFixed(4)}`);
  console.log(`    E2  |movimento−vero| ${fuori.E2.movimento_lambda1.toFixed(3)} → ${fuori.E2.movimento_loo.toFixed(3)}`);
  console.log(`    E4  placebo sull'assegnazione: saldo vero ${saldoVero} · p95 dei finti ${p95} · mediana ${saldiFinti[100]}`);
  console.log('');
}
