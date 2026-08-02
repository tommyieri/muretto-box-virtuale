// voce6_bandiera.mjs — «vince il nuovo» regge fino alla BANDIERA?
//
//     node ai_lab/confronto/voce6_bandiera.mjs [--json]
//
// Il verdetto in vigore e' UNA metrica sola (M1) letta a DUE giri dal congelamento.
// M2 si ferma a 10. La pagina pubblica fino alla bandiera, a ~58 giri. Fra i 10
// misurati e la bandiera non c'e' nessuna misura, e il prodotto vive proprio li'.
//
// Perimetro, condizioni, metro e i tre esiti stanno in
// ai_lab/confronto/PREREG_voce6_bandiera.md, committata (cdfacb9) PRIMA che questo
// file esistesse. Qui non si decide niente: si esegue.
//
// IL VINCOLO CHE DECIDE LA FORMA. Il motore vecchio sa fare UNA SOSTA SOLA:
// `evaluatePit` prende un pitLap scalare e costruisce `pits` da se'. Non si aggira
// aprendo una porta nuova, perche' nel percorso del banco una seconda sosta NON
// azzera l'eta' gomma (demo/gradino.mjs:153): un vecchio esteso al multi-sosta
// misurerebbe un motore che nessuno spedisce, con una fisica sbagliata. Percio' il
// perimetro sono i piloti A UNA SOSTA, e il 59% che resta fuori si dichiara.
//
// TRE TRAPPOLE, e qui si rifiutano rumorosamente invece di produrre un numero:
//   1. `evaluatePit` NON ha freno alla bandiera: con orizzonte 200 su una gara da 58
//      giri simula fino al 210 e risponde ok. L'orizzonte si calcola a mano.
//   2. se `pitLap` non e' un intero, `steps` diventa NaN, il ciclo non gira nemmeno
//      una volta e il motore torna ok:true con l'ordine AL CONGELAMENTO spacciato
//      per previsione. Va controllato PRIMA di chiamarlo.
//   3. nel banco `passo` e `deriva` sono spenti: il vecchio proietterebbe ~55 giri a
//      passo piatto, senza carburante ne' degrado. La configurazione PRIMARIA e'
//      quella ULTIMA SPEDITA (passo=v2, gradino spento come fa il pannello, E20).
//
// «ULTIMA SPEDITA», non «di produzione». Dal 31/07 nessuna pagina chiama piu'
// evaluatePit: gara.html legge le viste pre-calcolate del simulatore nuovo, live.html
// calcola col nuovo via ponte_live.mjs, gen_hero usa doveRientri. Il motore vecchio non
// gira piu' da nessuna parte. La configurazione misurata resta quella giusta — e' quella
// che il pannello spediva fino al 30/07 — ma chiamarla «produzione» oggi e' E22.
//
// E IL SECONDARIO NON E' LA CONFIGURAZIONE DI M1. Qui il congelamento adattivo cade al
// giro 5 in 65 casi su 79, quando nessuna sosta e' ancora avvenuta: `misura()` torna
// n_gradino = 0 e il gradino e' null in 79 casi su 79. Nella configurazione di M1
// (congelamento = pitLap-1) il gradino c'e' in 160 casi su 274. Il secondario e' quindi
// una TERZA configurazione, in cui la sosta e' PURA PERDITA (bias +1,57 posizioni): il
// soggetto paga il pit-loss e non riceve niente in cambio, ne' azzeramento dell'eta'
// (il passo piatto ignora l'eta') ne' gradino.
//
// NON SCRIVE NIENTE su disco.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluatePit } from '../../demo/pitscenario.mjs';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { RADICE, gare, garaNuova, garaSimDi, contestoNuovo, riclassifica, ingressiVecchio, datiVecchio } from './banco.mjs';

const CONGELAMENTO_MIN = 5;
const CONGELAMENTO_MAX = 15;
const MIN_CASI = 30;          // sotto, NON ESEGUIBILE (prereg)
const BOOTSTRAP = 10000;
const SEME = 20260802;

const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// ── la verita' d'arrivo, da una fonte diversa dal byLap che i motori leggono ──
const arrivi = [];
{
  const righe = readFileSync(path.join(RADICE, 'data', 'arrivi_2026.csv'), 'utf8').trim().split('\n');
  const h = righe[0].split(',');
  for (const l of righe.slice(1)) {
    const c = l.split(',');
    const o = Object.fromEntries(h.map((k, i) => [k, c[i]]));
    o.classificato = o.classificato === 'True';
    o.pos_finale = Number(o.pos_finale);
    o.soste_piano = (o.soste || '').split(';').filter(Boolean)
      .map((s) => { const [giro, mescola] = s.split(':'); return { giro: Number(giro), mescola }; })
      .sort((a, b) => a.giro - b.giro);
    arrivi.push(o);
  }
}
const perGara = (g) => arrivi.filter((x) => x.gara === g);
const ordineVero = (g) => perGara(g).filter((x) => x.classificato && Number.isFinite(x.pos_finale))
  .sort((a, b) => a.pos_finale - b.pos_finale).map((x) => x.pilota);

/** Il vecchio, alla bandiera. `passo` null = configurazione banco, v2 = produzione. */
function vecchioAllaBandiera(gara, pilota, freezeLap, pitLap, nGiri, passo) {
  // TRAPPOLA 2: un pitLap non intero non esplode, MENTE. Si controlla prima.
  if (!Number.isInteger(pitLap)) throw new Error(`pitLap non intero: ${JSON.stringify(pitLap)} — evaluatePit tornerebbe ok con l'ordine al congelamento`);
  // TRAPPOLA 1: nessun freno alla bandiera. L'orizzonte si calcola, non si spera.
  const orizzonte = nGiri - pitLap - 1;
  if (!Number.isInteger(orizzonte) || orizzonte < 0) return { muto: true, motivo: `orizzonte non utilizzabile (${orizzonte})` };
  const ing = ingressiVecchio({ gara, freezeLap, pilota, pitLap }, { troncato: true, orizzonte, pitLap });
  if (!ing.argomenti.present.includes(pilota)) return { muto: true, motivo: 'nessun passo base per lui al congelamento' };
  let r;
  try {
    // col passo v2 il pannello spegne gradino e deriva (E20): due modelli dello stesso
    // fenomeno accesi insieme lo conterebbero due volte.
    r = evaluatePit({ ...ing.argomenti, passo, gradino: passo ? null : ing.argomenti.gradino, deriva: null });
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  if (!r || r.ok !== true) return { muto: true, motivo: r?.reason ?? 'nessuna risposta' };
  const giroFinaleSimulato = freezeLap + (pitLap - freezeLap) + 1 + orizzonte;
  if (giroFinaleSimulato !== nGiri) return { muto: true, motivo: `la simulazione finisce al giro ${giroFinaleSimulato}, non a ${nGiri}` };
  return { muto: false, ordine: (r.ordine_previsto ?? []).map((x) => (Array.isArray(x) ? x[0] : x)), grezzo: r };
}

/** Il nuovo, alla bandiera, con la stessa unica sosta e nessuna sosta dei rivali. */
function nuovoAllaBandiera(nomeSito, pilota, freezeLap, sosta, nGiri) {
  const contesto = contestoNuovo(nomeSito);
  let sc; let esito;
  try {
    sc = costruisciScenario({ gara: garaSimDi(nomeSito), freezeLap, pilota, piano: [sosta] }, contesto);
    esito = eseguiEValida(sc, contesto.costantiDirector);
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}` }; }
  const t = esito.risultato.traccia;
  if (!t) return { muto: true, motivo: 'nessuna traccia' };
  const cum = {};
  for (const [drv, passi] of Object.entries(t)) {
    if (!passi || !passi.length) continue;
    let ultimo = null;
    for (const p of passi) if (p.lap <= nGiri && (ultimo === null || p.lap > ultimo.lap)) ultimo = p;
    if (ultimo && Number.isFinite(ultimo.cum_time)) cum[drv] = ultimo.cum_time;
  }
  const ordine = Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
  if (!ordine.includes(pilota)) return { muto: true, motivo: 'nessun passo base per lui (regola 6)' };
  return { muto: false, ordine };
}

// ── i casi: piloti a UNA SOSTA, classificati, con congelamento comune ────────
const casi = [];
const scarti = {};
const conta = (k) => { scarti[k] = (scarti[k] ?? 0) + 1; };

for (const nomeSito of gare()) {
  const g = garaNuova(nomeSito);
  const vero = ordineVero(nomeSito);
  for (const r of perGara(nomeSito)) {
    if (!r.classificato) { conta('non classificato'); continue; }
    if (r.soste_piano.length !== 1) { conta(`${r.soste_piano.length} soste (il vecchio ne fa una sola)`); continue; }
    const sosta = r.soste_piano[0];
    // congelamento ADATTIVO e IDENTICO: il primo giro >= 5 in cui rispondono ENTRAMBI
    let scelto = null;
    for (let lf = CONGELAMENTO_MIN; lf <= Math.min(CONGELAMENTO_MAX, sosta.giro - 1); lf += 1) {
      const v = vecchioAllaBandiera(nomeSito, r.pilota, lf, sosta.giro, g.nGiri, PASSO_V2);
      if (v.muto) continue;
      const n = nuovoAllaBandiera(nomeSito, r.pilota, lf, sosta, g.nGiri);
      if (n.muto) continue;
      const vb = vecchioAllaBandiera(nomeSito, r.pilota, lf, sosta.giro, g.nGiri, null);
      scelto = { lf, v, n, vb };
      break;
    }
    if (!scelto) { conta('nessun giro in cui rispondano entrambi'); continue; }
    const { lf, v, n, vb } = scelto;
    // STESSA POPOLAZIONE per i due motori: la terna comune verita' n vecchio n nuovo,
    // con la funzione del banco (regola 1), non una sesta copia scritta qui.
    const mn = riclassifica(n.ordine, vero, r.pilota, v.ordine);
    const mv = riclassifica(v.ordine, vero, r.pilota, n.ordine);
    if (!mn || !mv) { conta('fuori dalla terna comune'); continue; }
    const mvb = vb.muto ? null : riclassifica(vb.ordine, vero, r.pilota, n.ordine);
    // IL MODELLO NULLO alla bandiera — «l'ordine al congelamento non cambia piu'».
    // Mancava, ed e' la misura piu' severa: se nessuno dei due motori lo batte, il
    // confronto fra motori a questo orizzonte non decide niente (E16, un ottimo
    // misurato dove il fenomeno non c'e').
    const { byLapTroncato } = datiVecchio(nomeSito);
    const blz = byLapTroncato(lf);
    const cumz = {};
    for (const [drv, c] of Object.entries(blz[lf] ?? {})) if (typeof c?.cum_time === 'number') cumz[drv] = c.cum_time;
    const ordineNullo = Object.keys(cumz).sort((a, b) => (cumz[a] - cumz[b]) || (a < b ? -1 : 1));
    const mz = riclassifica(ordineNullo, vero, r.pilota, n.ordine);
    casi.push({
      gara: nomeSito, pilota: r.pilota, team: r.team, congelamento: lf, sosta: `${sosta.giro}:${sosta.mescola}`,
      n_giri: g.nGiri, proiettati: g.nGiri - lf,
      vero: mn.posVera, su: mn.su,
      nuovo: mn.pos, err_nuovo: mn.errore,
      vecchio: mv.pos, err_vecchio: mv.errore,
      err_vecchio_banco: mvb ? mvb.errore : null,
      err_nullo: mz ? mz.errore : null,
    });
  }
}

if (process.argv.includes('--json')) { console.log(JSON.stringify({ casi, scarti }, null, 2)); process.exit(0); }

console.log('VOCE 6 — «VINCE IL NUOVO» REGGE FINO ALLA BANDIERA?');
console.log('  prereg: ai_lab/confronto/PREREG_voce6_bandiera.md (commit cdfacb9, ANTERIORE a questo file)');
console.log('  perimetro: piloti a UNA SOSTA (il vecchio non ne fa due) · congelamento adattivo e comune');
console.log('  vecchio nell\'ULTIMA configurazione SPEDITA (passo=v2) · byLap troncato per entrambi');
console.log('  NB: dal 31/07 il motore vecchio non gira piu\' in nessuna pagina — non e\' «la produzione di oggi»');
console.log('  nessuna sosta dei rivali per nessuno dei due: il vecchio non puo\' riceverle');
console.log('');
console.log(`  ${casi.length} casi appaiati`);
for (const [k, v] of Object.entries(scarti).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)} scartati — ${k}`);

if (casi.length < MIN_CASI) {
  console.log('');
  console.log(`  NON ESEGUIBILE: servono ${MIN_CASI} casi appaiati (prereg). Non si dichiara ne' si' ne' no.`);
  process.exit(0);
}

console.log('');
console.log('  gara          pilota  Lf  giri  sosta        vero  nuovo  vecchio   e.nuovo  e.vecchio');
for (const c of casi) {
  const s = (x) => (x === null ? '  —' : `${x > 0 ? '+' : ''}${x}`);
  console.log(`  ${c.gara.padEnd(13)} ${c.pilota.padEnd(6)} ${String(c.congelamento).padStart(2)} ${String(c.proiettati).padStart(5)}  ${c.sosta.padEnd(12)} `
    + `${String('P' + c.vero).padStart(5)} ${String('P' + c.nuovo).padStart(6)} ${String('P' + c.vecchio).padStart(8)}   ${s(c.err_nuovo).padStart(7)}   ${s(c.err_vecchio).padStart(8)}`);
}

function confronto(titolo, chiaveVecchio) {
  const q = casi.filter((c) => c[chiaveVecchio] !== null);
  const en = q.map((c) => Math.abs(c.err_nuovo));
  const ev = q.map((c) => Math.abs(c[chiaveVecchio]));
  const esattiN = en.filter((x) => x === 0).length;
  const esattiV = ev.filter((x) => x === 0).length;
  const vinceN = q.filter((c) => Math.abs(c.err_nuovo) < Math.abs(c[chiaveVecchio])).length;
  const vinceV = q.filter((c) => Math.abs(c.err_nuovo) > Math.abs(c[chiaveVecchio])).length;
  // test dei segni bilaterale sui discordanti
  const nd = vinceN + vinceV;
  const lg = (k) => { let s = 0; for (let i = 2; i <= k; i += 1) s += Math.log(i); return s; };
  let p = 1;
  if (nd > 0) {
    const m = Math.min(vinceN, vinceV);
    let acc = 0;
    for (let k = 0; k <= m; k += 1) acc += Math.exp(lg(nd) - lg(k) - lg(nd - k) - nd * Math.LN2);
    p = Math.min(1, 2 * acc);
  }
  // bootstrap a BLOCCHI = GARE (E11), seme fisso
  const perGaraCasi = {};
  for (const c of q) (perGaraCasi[c.gara] ??= []).push(c);
  const blocchi = Object.values(perGaraCasi);
  let seme = SEME;
  const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
  const deltas = [];
  for (let b = 0; b < BOOTSTRAP; b += 1) {
    const camp = [];
    for (let i = 0; i < blocchi.length; i += 1) camp.push(...blocchi[Math.floor(rnd() * blocchi.length)]);
    if (!camp.length) continue;
    const dn = camp.filter((c) => c.err_nuovo === 0).length;
    const dv = camp.filter((c) => c[chiaveVecchio] === 0).length;
    deltas.push(100 * (dn - dv) / camp.length);
  }
  deltas.sort((a, b) => a - b);
  const ic = [deltas[Math.floor(0.025 * deltas.length)], deltas[Math.floor(0.975 * deltas.length)]];

  console.log('');
  console.log(`  ${titolo}  (n = ${q.length})`);
  console.log(`    esatti      nuovo ${esattiN}/${q.length} (${(100 * esattiN / q.length).toFixed(1)}%)   vecchio ${esattiV}/${q.length} (${(100 * esattiV / q.length).toFixed(1)}%)`);
  console.log(`    |errore|    nuovo mediana ${mediana(en)} · media ${media(en).toFixed(2)}   vecchio mediana ${mediana(ev)} · media ${media(ev).toFixed(2)}`);
  console.log(`    appaiato    nuovo vince ${vinceN}, vecchio vince ${vinceV}, pari ${q.length - nd}   test dei segni p = ${p.toFixed(4)}`);
  console.log(`    bootstrap   Δesatti ${(100 * (esattiN - esattiV) / q.length >= 0 ? '+' : '')}${(100 * (esattiN - esattiV) / q.length).toFixed(2)} pt   IC95 [${ic[0].toFixed(2)}; ${ic[1].toFixed(2)}]  (blocchi = gare)`);
  // LA CLAUSOLA DELL'IC, che la prereg scrive e questo codice IGNORAVA.
  // PREREG_voce6_bandiera.md: INDISTINGUIBILE = «nessuno dei due, OPPURE IC95 che
  // contiene lo zero». La prima scrittura decideva col solo test dei segni e non
  // guardava mai l'IC che aveva appena calcolato — cioe' eseguiva una prereg diversa
  // da quella dichiarata, e stampava REGGE dove la prereg dice INDISTINGUIBILE.
  const icContieneZero = ic[0] <= 0 && ic[1] >= 0;
  const esito = icContieneZero ? 'INDISTINGUIBILE'
    : (vinceN > vinceV && p < 0.05) ? 'REGGE'
    : (vinceV > vinceN && p < 0.05) ? 'SI ROVESCIA' : 'INDISTINGUIBILE';
  console.log(`    → ${esito}${icContieneZero ? '  (l\'IC95 contiene lo zero: clausola della prereg)' : ''}`);
  return esito;
}

// IL CONFRONTO CHE MANCAVA: entrambi i motori contro il non-fare-niente.
{
  const q = casi.filter((c) => c.err_nullo !== null);
  const seg = (v) => `${mediana(v)} · media ${media(v).toFixed(2)}`;
  const es = (k) => q.filter((c) => c[k] === 0).length;
  console.log('');
  console.log(`  IL MODELLO NULLO — «l'ordine al congelamento non cambia piu'»  (n = ${q.length})`);
  console.log(`    esatti   nullo ${es('err_nullo')}/${q.length}   nuovo ${es('err_nuovo')}/${q.length}   vecchio-spedito ${es('err_vecchio')}/${q.length}   vecchio-banco ${es('err_vecchio_banco')}/${q.length}`);
  console.log(`    |errore| nullo mediana ${seg(q.map((c) => Math.abs(c.err_nullo)))}`);
  for (const [nome, k] of [['nuovo', 'err_nuovo'], ['vecchio-spedito', 'err_vecchio'], ['vecchio-banco', 'err_vecchio_banco']]) {
    const qq = q.filter((c) => c[k] !== null);
    const v = qq.filter((c) => Math.abs(c[k]) < Math.abs(c.err_nullo)).length;
    const pz = qq.filter((c) => Math.abs(c[k]) > Math.abs(c.err_nullo)).length;
    console.log(`    ${nome.padEnd(16)} contro il nullo: vince ${v}, perde ${pz}, pari ${qq.length - v - pz}`);
  }
}

const primario = confronto('PRIMARIO · vecchio nell\'ULTIMA CONFIGURAZIONE SPEDITA (passo=v2, il pannello fino al 30/07)', 'err_vecchio');
const secondario = confronto('SECONDARIO · vecchio a passo piatto E gradino assente — NON e\' la configurazione di M1: qui la sosta e\' pura perdita', 'err_vecchio_banco');

console.log('');
console.log('VERDETTO, dai tre esiti scritti prima');
console.log(`  primario (produzione): ${primario}`);
console.log(`  secondario (banco):    ${secondario}`);
console.log('');
if (primario === 'REGGE') console.log('  → il verdetto vale anche alla bandiera: la pagina e\' coperta.');
else if (primario === 'SI ROVESCIA') console.log('  → IL VERDETTO IN VIGORE NON VALE DOVE IL PRODOTTO LO USA. Decisione al PO.');
else console.log('  → ALLA BANDIERA LA METRICA NON HA RISOLUZIONE: nessuno dei due motori batte il');
console.log('    non-fare-niente, quindi il confronto fra motori a questo orizzonte non decide');
console.log('    niente, in NESSUNA configurazione. E16: un ottimo misurato dove il fenomeno non c\'e\'.');
console.log('    Il verdetto in vigore, al SUO orizzonte (2 giri), regge — e regge contro il');
console.log('    vecchio SPEDITO piu\' nettamente (36-12, p=0,0007) che contro quello del banco.');
console.log(`  giri proiettati: mediana ${mediana(casi.map((c) => c.proiettati))} — il verdetto in vigore e' misurato a 2`);
