// lente_neutralizzazione.mjs — LA POSIZIONE AL RIENTRO SOTTO NEUTRALIZZAZIONE.
//
// Domanda: il motore nuovo legge il regime SOLO dalla cella del pilota che fa la
// domanda (costruttore.mjs:105 `regimeAlCongelamento(mia)`). In pista, al giro L,
// c'e' altra informazione <= L: le celle degli ALTRI piloti. Quanta ne butta via?
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_neutralizzazione.mjs

import { casi, garaNuova, censimento } from './banco.mjs';
import { regimeNeutralizzato } from '../../simulatore/provenienza/definizioni.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

/** Il regime di UNA cella, senza far esplodere niente su status assente. */
export function regimeDiCella(c) {
  if (!c || c.status === null) return null;
  let neutra;
  try { neutra = regimeNeutralizzato(c); } catch { return null; }
  if (!neutra) return null;
  return simboliStatus(c.status).has('4') ? 'SC' : 'VSC';
}

/** Il regime del CAMPO al giro k: quante celle sono neutralizzate, su quante. */
export function regimeDelCampo(gSim, k) {
  let n = 0, tot = 0, sc = 0, vsc = 0;
  for (const [, celle] of gSim.perPilota) {
    const c = celle.get(k);
    if (!c) continue;
    tot += 1;
    const r = regimeDiCella(c);
    if (r === null) continue;
    n += 1;
    if (r === 'SC') sc += 1; else vsc += 1;
  }
  return { n, tot, frazione: tot ? n / tot : 0, sc, vsc, prevalente: sc >= vsc ? 'SC' : 'VSC' };
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/d');

function main() {
  const elenco = casi();
  const righe = [];
  for (const k of elenco) {
    const g = garaNuova(k.gara);
    const mieCelle = g.perPilota.get(k.pilota);
    const mioL = regimeDiCella(mieCelle?.get(k.freezeLap));      // cio' che il NUOVO usa
    const mioPit = regimeDiCella(mieCelle?.get(k.pitLap));       // futuro: il vero regime della sosta
    const mioOut = regimeDiCella(mieCelle?.get(k.rientroLap));
    const campoL = regimeDelCampo(g, k.freezeLap);               // informazione <= L, oggi ignorata
    const campoPit = regimeDelCampo(g, k.pitLap);
    righe.push({ ...k, mioL, mioPit, mioOut, campoL, campoPit });
  }

  const c = censimento();
  console.log(`PERIMETRO: ${c.ammessi} casi ammessi su ${c.soste_reali_trovate} soste reali.`);

  // ── 1. quanto regime vede il nuovo, e quanto ce n'e' davvero ──────────────
  const conMioL = righe.filter((r) => r.mioL !== null);
  const conMioPit = righe.filter((r) => r.mioPit !== null);
  console.log(`\n1 · IL REGIME, TRE MODI DI GUARDARLO (su ${righe.length} casi)`);
  console.log(`  cella MIA al congelamento L (cio' che il nuovo usa)   ${conMioL.length}  (${pct(conMioL.length, righe.length)})`);
  console.log(`  cella MIA al giro della sosta Li (FUTURO, la verita') ${conMioPit.length}  (${pct(conMioPit.length, righe.length)})`);
  for (const soglia of [1, 0.25, 0.5]) {
    const n = righe.filter((r) => (soglia === 1 ? r.campoL.n >= 1 : r.campoL.frazione > soglia)).length;
    const et = soglia === 1 ? 'almeno UNA cella del campo neutralizzata a L' : `> ${Math.round(soglia * 100)}% del campo neutralizzato a L`;
    console.log(`  ${et.padEnd(52)} ${n}  (${pct(n, righe.length)})`);
  }

  // ── 2. il recuperabile: sosta neutralizzata, mia cella a L muta ───────────
  const sostaNeutra = righe.filter((r) => r.mioPit !== null);
  const persi = sostaNeutra.filter((r) => r.mioL === null);
  console.log(`\n2 · IL BUCO: soste che AVVENGONO sotto regime ma che il nuovo valuta in verde`);
  console.log(`  soste neutralizzate (cella mia a Li)              ${sostaNeutra.length}`);
  console.log(`  di cui il nuovo NON sa nulla al congelamento      ${persi.length}  (${pct(persi.length, sostaNeutra.length)})`);
  const soglie = [
    ['almeno 1 cella del campo a L', (r) => r.campoL.n >= 1],
    ['>= 25% del campo a L', (r) => r.campoL.frazione >= 0.25],
    ['>= 50% del campo a L', (r) => r.campoL.frazione >= 0.5],
    ['>= 75% del campo a L', (r) => r.campoL.frazione >= 0.75],
  ];
  console.log(`  di quei ${persi.length}, quanti sono RECUPERABILI con informazione <= L (il campo, non io):`);
  for (const [et, f] of soglie) {
    const n = persi.filter(f).length;
    console.log(`    ${et.padEnd(32)} ${n}  (${pct(n, persi.length)})`);
  }

  // ── 3. e i falsi positivi? campo neutralizzato a L, sosta poi in verde ────
  console.log(`\n3 · IL PREZZO: quante volte il campo a L direbbe "neutralizzato" e la sosta e' in verde`);
  for (const [et, f] of soglie) {
    const accesi = righe.filter((r) => r.mioL === null && f(r));
    const veri = accesi.filter((r) => r.mioPit !== null).length;
    console.log(`    ${et.padEnd(32)} accende ${String(accesi.length).padStart(3)} casi in piu' · giusti ${String(veri).padStart(3)} (${pct(veri, accesi.length)}) · sbagliati ${accesi.length - veri}`);
  }

  // ── 4. la parte davvero cieca ────────────────────────────────────────────
  const ciechi = persi.filter((r) => r.campoL.n === 0);
  console.log(`\n4 · LA PARTE CIECA (nessuna informazione <= L): ${ciechi.length} casi su ${sostaNeutra.length} soste neutralizzate (${pct(ciechi.length, sostaNeutra.length)})`);
  const perGara = {};
  for (const r of righe) {
    const g = (perGara[r.gara] ??= { casi: 0, neutra: 0, vistoDaMe: 0, vistoDalCampo: 0, cieco: 0 });
    g.casi += 1;
    if (r.mioPit !== null) {
      g.neutra += 1;
      if (r.mioL !== null) g.vistoDaMe += 1;
      else if (r.campoL.n >= 1) g.vistoDalCampo += 1;
      else g.cieco += 1;
    }
  }
  console.log(`\n5 · PER GARA (blocchi): casi · soste neutralizzate · viste dalla MIA cella · viste dal CAMPO · cieche`);
  for (const [gara, g] of Object.entries(perGara).sort()) {
    console.log(`  ${gara.padEnd(15)} ${String(g.casi).padStart(3)}  ${String(g.neutra).padStart(3)}  ${String(g.vistoDaMe).padStart(3)}  ${String(g.vistoDalCampo).padStart(3)}  ${String(g.cieco).padStart(3)}`);
  }

  // ── 6. lo scarto fra la mia cella e il campo, al MEDESIMO giro ────────────
  const discordi = righe.filter((r) => (r.mioL !== null) !== (r.campoL.frazione >= 0.5));
  console.log(`\n6 · DISCORDANZA a parita' di giro L fra la mia cella e la maggioranza del campo: ${discordi.length}/${righe.length} (${pct(discordi.length, righe.length)})`);
  const soloCampo = righe.filter((r) => r.mioL === null && r.campoL.frazione >= 0.5).length;
  const soloIo = righe.filter((r) => r.mioL !== null && r.campoL.frazione < 0.5).length;
  console.log(`  solo il campo dice neutralizzato: ${soloCampo} · solo la mia cella: ${soloIo}`);
  return righe;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
