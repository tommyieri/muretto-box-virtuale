// collaudo_motori.mjs — COLLAUDO DEL BANCO, lato MOTORI.
//
// Non calcola le cinque metriche: verifica che il METRO sia onesto.
//   (a) il vecchio e' chiamato come lo chiama la produzione?
//   (b) il nuovo e' chiamato come lo chiama la produzione?
//   (c) su casi gia' pre-calcolati (demo/data/vista/) il banco riproduce la stessa posizione?
//   (d) "muto" e' distinto da "sbagliato"?
//
//     node ai_lab/confronto/collaudo_motori.mjs [a|b|c|d|all]
//
// NON scrive niente su disco. Non tocca demo/, simulatore/, data/.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import {
  casi, censimento, rispostaVecchio, rispostaNuovo, contestoNuovo,
  ingressiVecchio, datiVecchio, garaNuova, gare, garaSimDi, svuotaCache, RADICE,
} from './banco.mjs';

import { evaluatePit } from '../../demo/pitscenario.mjs';
import { misura as misuraGradino } from '../../demo/gradino.mjs';
import { rispostaPer, mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';

const arg = (process.argv[2] || 'all').toLowerCase();
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : 'n/d';

// ============================================================================
// (a) IL VECCHIO — i parametri del banco contro quelli della produzione
// ============================================================================
// Due usi di produzione, non uno:
//   gen_hero.mjs::scelta()      la hero della landing (il riferimento indicato)
//   demo/muretto.mjs::pannello  il PANNELLO, cioe' la pagina-gara fino al 30/07
// Qui si ricostruiscono ENTRAMBI gli insiemi di argomenti e si diffano con quelli del banco.

/** Gli argomenti come li monta gen_hero.mjs::scelta (byLap INTERO, orizzonte 5 se gradino). */
function argomentiGenHero(caso) {
  const { G, byLap, nLaps, pitLoss } = datiVecchio(caso.gara);
  const L = caso.freezeLap;
  const pace = G.pace[L] || {};
  const present = G.drivers.filter((d) => typeof byLap[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const viva = misuraGradino(byLap, nLaps, L);
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  return { byLap, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap: caso.pitLap, pitLoss,
           present, gara: caso.gara, laps: G.laps, ZONE: 0,
           orizzonte: gradino != null ? 5 : 0, gradino };
}

/** Gli argomenti come li monta demo/muretto.mjs (PASSO v2 acceso, pit-loss vivo, deriva). */
function argomentiMuretto(caso, modelloPasso, deriva) {
  const { G, byLap, nLaps, pitLoss } = datiVecchio(caso.gara);
  const L = caso.freezeLap;
  const pace = G.pace[L] || {};
  const present = G.drivers.filter((d) => typeof byLap[L]?.[d]?.cum_time === 'number' && pace[d] != null);
  const neutroPre = !!(byLap[caso.pitLap]?.[caso.pilota]?.neutralized);
  const viva = misuraGradino(byLap, nLaps, L);
  const usaViva = viva.perdita != null && viva.n_perdita >= 3;
  const loss = usaViva ? viva.perdita : pitLoss;         // penalitaPendente: qui sempre 0
  const gradino = (viva.gradino != null && viva.n_gradino >= 3) ? viva.gradino : null;
  const der = neutroPre ? null : deriva(byLap, nLaps, L);
  const derVal = (der && der.stato === 'MISURATO') ? der.valore : null;
  const passo = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };
  const orizzonte = ((passo || gradino != null) && !neutroPre) ? 5 : 0;
  return { byLap, nLaps, pace, driver: caso.pilota, freezeLap: L, pitLap: caso.pitLap,
           pitLoss: loss, present, gara: caso.gara, laps: G.laps, ZONE: 0,
           orizzonte, gradino: passo ? null : gradino, deriva: passo ? null : derVal, passo };
}

function diffArgomenti(a, b, etichettaA, etichettaB) {
  const chiavi = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const righe = [];
  for (const k of chiavi) {
    const x = a[k], y = b[k];
    let ugu;
    if (k === 'byLap') ugu = Object.keys(x || {}).length === Object.keys(y || {}).length;
    else if (k === 'laps') ugu = (x?.length ?? null) === (y?.length ?? null);
    else if (k === 'present') ugu = JSON.stringify(x) === JSON.stringify(y);
    else if (k === 'pace') ugu = JSON.stringify(x) === JSON.stringify(y);
    else if (typeof x === 'object' && x !== null) ugu = JSON.stringify(x) === JSON.stringify(y);
    else ugu = x === y;
    if (!ugu) {
      const mostra = (v) => k === 'byLap' ? `${Object.keys(v || {}).length} giri`
        : k === 'laps' ? `${v?.length ?? 'null'} giri`
        : k === 'pace' ? `${Object.keys(v || {}).length} piloti`
        : k === 'present' ? `${v?.length ?? 'null'} piloti`
        : typeof v === 'number' ? v.toFixed(4) : JSON.stringify(v);
      righe.push({ parametro: k, [etichettaA]: mostra(x), [etichettaB]: mostra(y) });
    }
  }
  return righe;
}

/** M1 grezza (mediana |err|, esatti, entro 1) su un elenco di {pos, vera}. */
function m1(coppie) {
  const err = coppie.map(([p, v]) => Math.abs(p - v));
  return { n: coppie.length, mediana: mediana(err), esatti: err.filter((e) => e === 0).length,
           entro1: err.filter((e) => e <= 1).length,
           bias: coppie.length ? coppie.reduce((s, [p, v]) => s + (p - v), 0) / coppie.length : null };
}

async function sezioneA() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(a) IL MOTORE VECCHIO E\' CHIAMATO COME IN PRODUZIONE?');
  console.log('══════════════════════════════════════════════════════════════════');

  const elenco = casi();
  const c0 = elenco.find((c) => c.gara === 'Austria' && c.passoVecchioDisponibile) || elenco[0];

  // --- A1. banco vs gen_hero, sullo stesso caso -----------------------------
  const bancoArg = ingressiVecchio(c0).argomenti;
  const heroArg = argomentiGenHero(c0);
  console.log(`\nA1 · BANCO vs gen_hero.mjs::scelta()   [caso ${c0.id}]`);
  const d1 = diffArgomenti(bancoArg, heroArg, 'banco', 'gen_hero');
  if (!d1.length) console.log('    nessuna differenza');
  else for (const r of d1) console.log(`    ${r.parametro.padEnd(12)} banco=${String(r.banco).padEnd(18)} gen_hero=${r.gen_hero}`);

  // --- A2. banco vs muretto.mjs (il PANNELLO di produzione) -----------------
  const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
  const { deriva } = await import(path.join(RADICE, 'demo', 'grossi.mjs'));
  const murArg = argomentiMuretto(c0, modelloPasso, deriva);
  console.log(`\nA2 · BANCO vs demo/muretto.mjs::pannello   [caso ${c0.id}]`);
  const d2 = diffArgomenti(bancoArg, murArg, 'banco', 'muretto');
  if (!d2.length) console.log('    nessuna differenza');
  else for (const r of d2) console.log(`    ${r.parametro.padEnd(12)} banco=${String(r.banco).padEnd(18)} muretto=${r.muretto}`);

  // --- A3. quanto costa ciascuno scostamento, sulla VERITA' -----------------
  // Quattro varianti del vecchio, sugli stessi 274 casi. Se il banco handicappa il vecchio,
  // si vede qui: una variante piu' vicina alla produzione farebbe meglio del banco.
  console.log('\nA3 · IL PREZZO DI OGNI SCOSTAMENTO (stessi 274 casi, verita\' = posizione al rientro)');
  const varianti = {
    'banco (troncato, oriz 0, no passo)': (c) => rispostaVecchio(c),
    'byLap INTERO, oriz 0, no passo':     (c) => rispostaVecchio(c, { troncato: false }),
    'gen_hero (intero, oriz 5 se grad.)': (c) => {
      const a = argomentiGenHero(c);
      try { const r = evaluatePit(a); return r?.ok ? { ok: true, muto: false, pos: r.rientro_pos, su: r.su_totale, orizzonte: a.orizzonte } : { muto: true, motivo: r?.reason }; }
      catch (e) { return { muto: true, motivo: e.message }; }
    },
    'muretto PASSO v2 (intero, oriz 5)':  (c) => {
      const a = argomentiMuretto(c, modelloPasso, deriva);
      try { const r = evaluatePit(a); return r?.ok ? { ok: true, muto: false, pos: r.rientro_pos, su: r.su_totale, orizzonte: a.orizzonte } : { muto: true, motivo: r?.reason }; }
      catch (e) { return { muto: true, motivo: e.message }; }
    },
    'muretto PASSO v2 ma orizzonte 0':    (c) => {
      const a = { ...argomentiMuretto(c, modelloPasso, deriva), orizzonte: 0 };
      try { const r = evaluatePit(a); return r?.ok ? { ok: true, muto: false, pos: r.rientro_pos, su: r.su_totale, orizzonte: 0 } : { muto: true, motivo: r?.reason }; }
      catch (e) { return { muto: true, motivo: e.message }; }
    },
    'banco + PASSO v2 (troncato, oriz 0)': (c) => {
      const a = { ...ingressiVecchio(c).argomenti,
                  passo: { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro } };
      try { const r = evaluatePit(a); return r?.ok ? { ok: true, muto: false, pos: r.rientro_pos, su: r.su_totale, orizzonte: 0 } : { muto: true, motivo: r?.reason }; }
      catch (e) { return { muto: true, motivo: e.message }; }
    },
  };
  const esiti = {};
  for (const [nome, f] of Object.entries(varianti)) {
    const coppie = [], muti = [];
    for (const c of elenco) {
      const r = f(c);
      if (r.muto) { muti.push(c.id); continue; }
      coppie.push([r.pos, c.posizioneVera]);
    }
    esiti[nome] = { ...m1(coppie), muti: muti.length };
  }
  console.log(`    ${'variante'.padEnd(38)} ${'risp'.padStart(4)} ${'muti'.padStart(4)} ${'mediana|err|'.padStart(12)} ${'esatti'.padStart(12)} ${'entro1'.padStart(12)} ${'bias'.padStart(7)}`);
  for (const [nome, v] of Object.entries(esiti)) {
    console.log(`    ${nome.padEnd(38)} ${String(v.n).padStart(4)} ${String(v.muti).padStart(4)} `
      + `${String(v.mediana).padStart(12)} ${(`${v.esatti} (${pct(v.esatti, v.n)})`).padStart(12)} `
      + `${(`${v.entro1} (${pct(v.entro1, v.n)})`).padStart(12)} ${v.bias.toFixed(3).padStart(7)}`);
  }

  // --- A4. il numero dichiarato nell'intestazione del banco -----------------
  console.log('\nA4 · LE CIFRE DICHIARATE NELL\'INTESTAZIONE DEL BANCO (§3), rimisurate');
  let entrambe = 0, cambiaPos = 0, cambiaSu = 0, cambiaGradino = 0, esattiTr = 0, esattiInt = 0;
  for (const c of elenco) {
    const a = rispostaVecchio(c), b = rispostaVecchio(c, { troncato: false });
    const ga = ingressiVecchio(c).gradino, gb = ingressiVecchio(c, { troncato: false }).gradino;
    if (ga !== gb) cambiaGradino += 1;
    if (a.muto || b.muto) continue;
    entrambe += 1;
    if (a.pos !== b.pos) cambiaPos += 1;
    if (a.su !== b.su) cambiaSu += 1;
    if (a.pos === c.posizioneVera) esattiTr += 1;
    if (b.pos === c.posizioneVera) esattiInt += 1;
  }
  console.log(`    casi con risposta da entrambe le varianti : ${entrambe}   (dichiarato 235)`);
  console.log(`    la posizione cambia                      : ${cambiaPos}    (dichiarato 49)`);
  console.log(`    su_totale cambia                         : ${cambiaSu}    (dichiarato 100)`);
  console.log(`    il gradino cambia (su ${elenco.length})              : ${cambiaGradino}   (dichiarato 112)`);
  console.log(`    esatti troncato / intero                 : ${esattiTr}/${entrambe} vs ${esattiInt}/${entrambe}   (dichiarato 75 vs 82)`);
}

// ============================================================================
// (b) IL NUOVO — il banco contro simulatore/scenario/risposta.mjs
// ============================================================================
function sezioneB() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(b) IL MOTORE NUOVO E\' CHIAMATO COME IN PRODUZIONE?');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();

  // B1. il contesto: gli stessi cinque campi che monta genera_vista_gara.mjs::main
  const ctx = contestoNuovo('Australia');
  console.log('\nB1 · IL CONTESTO');
  console.log(`    chiavi: ${Object.keys(ctx).sort().join(', ')}`);
  console.log(`    nGiriGara(Australia) = ${ctx.nGiriGara}  ·  gare caricate = ${Object.keys(ctx.gare).length}`);

  // B2. giroPit: la vista del sito usa freeze+1. Sui casi del banco pitLap = freezeLap+1?
  const diversi = elenco.filter((c) => c.pitLap !== c.freezeLap + 1);
  console.log(`\nB2 · giroPit  ·  casi con pitLap != freezeLap+1: ${diversi.length}/${elenco.length}`
    + (diversi.length ? `  (${diversi.slice(0, 3).map((c) => c.id).join(', ')})` : '  → stessa domanda della vista'));

  // B3. la prova che conta: rispostaPer() (il montatore di produzione) contro rispostaNuovo().
  //     Se differiscono, il banco chiama il motore in modo diverso dalla produzione.
  const extra = {
    prior: ctx.prior,
    durate2026: null, esitoPiano: null,     // servono solo al piano, non al rientro
  };
  let ok = 0, diverso = 0, esplosi = 0;
  const esempi = [];
  for (const c of elenco) {
    const gSim = garaNuova(c.gara);
    const b = rispostaNuovo(c);
    let p;
    try {
      p = rispostaPerSoloRientro(c.garaSim, gSim, c.freezeLap, c.pilota, contestoNuovo(c.gara));
    } catch (e) { esplosi += 1; continue; }
    const bPos = b.muto ? null : b.pos, pPos = p;
    if (bPos === pPos) ok += 1;
    else { diverso += 1; if (esempi.length < 5) esempi.push(`${c.id}: banco=${bPos} produzione=${pPos}`); }
  }
  console.log(`\nB3 · rispostaNuovo() del banco vs il percorso di produzione (stessa chiamata di risposta.mjs)`);
  console.log(`    identici ${ok}/${elenco.length}  ·  diversi ${diverso}  ·  eccezioni ${esplosi}`);
  for (const e of esempi) console.log(`      ${e}`);

  // B4. la mescola: quella del banco e' la stessa di mescolaAlGiro (la convenzione del sito)?
  let mescolaOk = 0, mescolaNo = 0;
  for (const c of elenco) {
    const gSim = garaNuova(c.gara);
    const m = mescolaAlGiro(gSim, c.freezeLap, c.pilota);
    const r = rispostaNuovo(c);
    const usata = r.mescola_usata ?? null;
    if ((m ?? null) === usata) mescolaOk += 1; else mescolaNo += 1;
  }
  console.log(`\nB4 · mescola passata = mescolaAlGiro(freezeLap): ${mescolaOk}/${elenco.length} (divergenti ${mescolaNo})`);
}

/** Il pezzo di rispostaPer() che produce la posizione, chiamato come in produzione. */
function rispostaPerSoloRientro(nomeGara, gara, Lf, pilota, contesto) {
  const extra = { prior: { stazionario_tipico_s: null, stazionario_minimo_fisico_s: null },
                  durate2026: {}, esitoPiano: { limite_dichiarato: { conseguenza: '', spiegazione: '' } } };
  const s = rispostaPer(nomeGara, gara, Lf, pilota, contesto, extra, '2026-07-31');
  if (s === null) return null;
  if (s.senza_risposta) return null;
  if (s.approvato === false) return null;
  return s.pannello?.posizione ?? null;
}

// ============================================================================
// (c) IL PRE-CALCOLATO — il banco riproduce la vista gia' su disco?
// ============================================================================
function sezioneC() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(c) IL BANCO RIPRODUCE LA VISTA PRE-CALCOLATA?');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();
  const perGara = new Map();
  for (const c of elenco) if (!perGara.has(c.gara)) perGara.set(c.gara, c);

  let confrontati = 0, uguali = 0, diversiPos = 0, diversiSu = 0, diversiBanda = 0, assenti = 0;
  const dettagli = [];
  for (const c of elenco) {
    const f = path.join(RADICE, 'demo', 'data', 'vista', c.garaSim, `${c.pilota}.json`);
    if (!existsSync(f)) { assenti += 1; continue; }
    const vista = JSON.parse(readFileSync(f, 'utf8'));
    const g = vista.giri.find((x) => x.freeze_lap === c.freezeLap);
    if (!g || g.senza_risposta || g.approvato === false || !g.pannello) { assenti += 1; continue; }
    const r = rispostaNuovo(c);
    confrontati += 1;
    const posOk = !r.muto && r.pos === g.pannello.posizione;
    const suOk = !r.muto && r.su === g.pannello.su_quanti;
    const bandaOk = !r.muto && JSON.stringify([r.banda?.da ?? null, r.banda?.a ?? null])
      === JSON.stringify([g.pannello.banda_posizione?.da ?? null, g.pannello.banda_posizione?.a ?? null]);
    if (posOk && suOk && bandaOk) uguali += 1;
    if (!posOk) { diversiPos += 1; if (dettagli.length < 8) dettagli.push(`${c.id}: banco P${r.pos}/${r.su} · vista P${g.pannello.posizione}/${g.pannello.su_quanti}`); }
    if (!suOk) diversiSu += 1;
    if (!bandaOk) diversiBanda += 1;
  }
  console.log(`\n    casi confrontabili col pre-calcolato : ${confrontati}  (senza pre-calcolato utilizzabile: ${assenti})`);
  console.log(`    identici su posizione+su_quanti+banda: ${uguali}  (${pct(uguali, confrontati)})`);
  console.log(`    divergenze  posizione ${diversiPos} · su_quanti ${diversiSu} · banda ${diversiBanda}`);
  for (const d of dettagli) console.log(`      ${d}`);

  console.log('\n    TRE CASI IN CHIARO (uno per gara, i primi tre del perimetro):');
  let n = 0;
  for (const [gara, c] of perGara) {
    if (n >= 3) break;
    const f = path.join(RADICE, 'demo', 'data', 'vista', c.garaSim, `${c.pilota}.json`);
    if (!existsSync(f)) continue;
    const vista = JSON.parse(readFileSync(f, 'utf8'));
    const g = vista.giri.find((x) => x.freeze_lap === c.freezeLap);
    if (!g?.pannello) continue;
    const r = rispostaNuovo(c);
    n += 1;
    console.log(`      ${c.id.padEnd(24)} freeze ${String(c.freezeLap).padStart(2)}  `
      + `vista P${g.pannello.posizione}/${g.pannello.su_quanti} rientro ${g.pannello.giro_di_rientro}  ·  `
      + `banco P${r.pos}/${r.su} rientro ${r.giro_di_rientro}  ·  ${r.pos === g.pannello.posizione && r.su === g.pannello.su_quanti ? 'UGUALI' : 'DIVERSI'}`);
  }
}

// ============================================================================
// (d) MUTO vs SBAGLIATO
// ============================================================================
function sezioneD() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(d) "MUTO" E\' DISTINTO DA "SBAGLIATO"?');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();
  const conta = { vecchio: {}, nuovo: {} };
  let vMuti = 0, nMuti = 0, vPosNonNull = 0, nPosNonNull = 0, incoerenti = [];
  for (const c of elenco) {
    for (const [chi, r] of [['vecchio', rispostaVecchio(c)], ['nuovo', rispostaNuovo(c)]]) {
      const fam = r.muto ? (r.motivo || 'senza motivo').split(':')[0] : 'RISPONDE';
      conta[chi][fam] = (conta[chi][fam] || 0) + 1;
      // l'invariante che conta: muto <=> nessun numero. Un rifiuto NON deve avere pos.
      if (r.muto && r.pos !== null) incoerenti.push(`${chi} ${c.id}: muto ma pos=${r.pos}`);
      if (!r.muto && (r.pos === null || r.pos === undefined)) incoerenti.push(`${chi} ${c.id}: non muto ma pos=${r.pos}`);
      if (r.muto && r.ok !== false) incoerenti.push(`${chi} ${c.id}: muto ma ok=${r.ok}`);
      if (r.muto) { if (chi === 'vecchio') vMuti += 1; else nMuti += 1; }
      else { if (chi === 'vecchio') vPosNonNull += 1; else nPosNonNull += 1; }
    }
  }
  for (const chi of ['vecchio', 'nuovo']) {
    console.log(`\n    ${chi.toUpperCase()}  (${elenco.length} casi)`);
    for (const [k, v] of Object.entries(conta[chi]).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(v).padStart(4)}  ${k}`);
    }
  }
  console.log(`\n    invariante «muto ⇔ nessun numero»: ${incoerenti.length === 0 ? 'RISPETTATA' : `VIOLATA ${incoerenti.length} volte`}`);
  for (const i of incoerenti.slice(0, 5)) console.log(`      ${i}`);

  // La prova al contrario: un rifiuto del Director NON deve poter essere letto come errore.
  const rifiutati = elenco.map((c) => [c, rispostaNuovo(c)]).filter(([, r]) => r.muto && /Director/.test(r.motivo || ''));
  console.log(`\n    rifiuti del Director: ${rifiutati.length}`);
  if (rifiutati.length) {
    const [c, r] = rifiutati[0];
    console.log(`      esempio ${c.id}  motivo: ${r.motivo}`);
    console.log(`      pos=${r.pos} su=${r.su} banda=${r.banda} ok=${r.ok}  → |pos−vera| = ${Math.abs(r.pos - c.posizioneVera)} (NaN = non conteggiabile come errore)`);
  }
  // e il caso opposto: chi risponde non e' mai contato come muto
  console.log(`    chi risponde ha SEMPRE un numero: vecchio ${vPosNonNull}, nuovo ${nPosNonNull}`);
  console.log(`    muti: vecchio ${vMuti}, nuovo ${nMuti}`);

  // passoVecchioDisponibile promette il silenzio del vecchio: mantiene?
  let promessaRotta = 0;
  for (const c of elenco) {
    const r = rispostaVecchio(c);
    if (c.passoVecchioDisponibile === false && !r.muto) promessaRotta += 1;
  }
  console.log(`    casi con passoVecchioDisponibile=false ma vecchio che risponde: ${promessaRotta}`);
}

// ============================================================================
// STABILITA' DEL BANCO (memoizzazione pura?)
// ============================================================================
function sezioneS() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(s) STABILITA\': stesso risultato invertendo l\'ordine e dopo svuotaCache()');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();
  const campione = elenco.filter((_, i) => i % 17 === 0);
  const dir = campione.map((c) => [rispostaVecchio(c).pos, rispostaNuovo(c).pos]);
  const inv = [...campione].reverse().map((c) => [rispostaNuovo(c).pos, rispostaVecchio(c).pos]).reverse()
    .map(([n, v]) => [v, n]);
  svuotaCache();
  const dopo = campione.map((c) => [rispostaVecchio(c).pos, rispostaNuovo(c).pos]);
  const ug = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  console.log(`    campione ${campione.length} casi`);
  console.log(`    ordine invertito     : ${ug(dir, inv) ? 'IDENTICO' : 'DIVERSO'}`);
  console.log(`    dopo svuotaCache()   : ${ug(dir, dopo) ? 'IDENTICO' : 'DIVERSO'}`);
  const ids1 = casi().map((c) => c.id);
  svuotaCache();
  const ids2 = casi().map((c) => c.id);
  console.log(`    ordine dei casi      : ${ug(ids1, ids2) ? 'DETERMINISTICO' : 'INSTABILE'} (${ids1.length} casi)`);
}

// ————————————————————————————————————————————————————————————————— main
if (arg === 'a' || arg === 'all') await sezioneA();
if (arg === 'b' || arg === 'all') sezioneB();
if (arg === 'c' || arg === 'all') sezioneC();
if (arg === 'd' || arg === 'all') sezioneD();
if (arg === 's' || arg === 'all') sezioneS();

// ============================================================================
// (e) LE PROVE CHE IL PERIMETRO NON ESERCITA DA SOLO
// ============================================================================
// e1  il ramo «rifiutato dal Director» non scatta mai sulle 11 gare (0 su 11.290 record
//     della vista): va provocato, altrimenti (d) non ha verificato niente su quel ramo.
// e2  M3 — il minimo della curva del vecchio: con `passo=null` (la configurazione del
//     banco) e con `passo=v2` (la configurazione del PANNELLO di produzione dal 28/07).
// e3  M2 — bias con segno a 3/5/10 giri, nelle due configurazioni.
// e4  la tavola dei muti incrociata: e' la popolazione di M4.
function sezioneE() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(e) I RAMI CHE IL PERIMETRO NON ESERCITA');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();

  // --- e1. rifiuto del Director provocato -----------------------------------
  svuotaCache();
  const c = elenco.find((x) => !rispostaNuovo(x).muto);
  const prima = rispostaNuovo(c);
  const ctx = contestoNuovo();                       // stesso oggetto memoizzato
  const salvato = ctx.costantiDirector.limiti.tolleranza_cum_s.valore;
  ctx.costantiDirector.limiti.tolleranza_cum_s.valore = -1;   // nessuno scarto e' ammesso
  const dopo = rispostaNuovo(c);
  ctx.costantiDirector.limiti.tolleranza_cum_s.valore = salvato;
  console.log(`\ne1 · RIFIUTO DEL DIRECTOR provocato su ${c.id}`);
  console.log(`    prima : ok=${prima.ok} muto=${prima.muto} pos=${prima.pos}`);
  console.log(`    dopo  : ok=${dopo.ok} muto=${dopo.muto} pos=${dopo.pos} banda=${dopo.banda}`);
  console.log(`    motivo: ${String(dopo.motivo).slice(0, 110)}`);
  console.log(`    ⇒ il rifiuto e' ${dopo.muto && dopo.pos === null ? 'MUTO (giusto)' : 'CONTATO COME NUMERO (sbagliato)'}`);
  svuotaCache();

  // --- e2. M3: dove cade il minimo della curva del VECCHIO -------------------
  // La curva si costruisce a GIRO FINALE COMUNE: steps = (pitLap−L)+1+orizzonte, quindi
  // orizzonte = H − pitLap − 1 fissa Lfin = H per ogni pitLap. Senza, i punti sarebbero
  // valutati a giri diversi e la curva non sarebbe una curva.
  const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
  const passoV2 = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };
  function curvaVecchio(caso, passo) {
    const L = caso.freezeLap;
    const H = Math.min(caso.nGiri, L + 15);
    const punti = [];
    for (let p = L + 1; p <= H - 1; p += 1) {
      const base = ingressiVecchio(caso, { pitLap: p, orizzonte: H - p - 1 }).argomenti;
      let r; try { r = evaluatePit({ ...base, passo }); } catch { r = null; }
      if (!r?.ok) return null;
      const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
      if (!mio) return null;
      punti.push([p, mio[1]]);
    }
    return punti.length >= 3 ? punti : null;
  }
  const esitoM3 = {};
  for (const [nome, passo] of [['passo=null (BANCO e gen_hero)', null], ['passo=v2 (PANNELLO produzione)', passoV2]]) {
    let n = 0, interni = 0, alPrimo = 0, allUltimo = 0;
    for (const caso of elenco) {
      const cu = curvaVecchio(caso, passo);
      if (!cu) continue;
      n += 1;
      const iMin = cu.reduce((m, x, i) => (x[1] < cu[m][1] ? i : m), 0);
      if (iMin === 0) alPrimo += 1;
      else if (iMin === cu.length - 1) allUltimo += 1;
      else interni += 1;
    }
    esitoM3[nome] = { n, interni, alPrimo, allUltimo };
  }
  console.log('\ne2 · M3 — DOVE CADE IL MINIMO DELLA CURVA DEL VECCHIO (giro finale comune H=L+15)');
  for (const [nome, v] of Object.entries(esitoM3)) {
    console.log(`    ${nome.padEnd(32)} n=${String(v.n).padStart(3)}  interni ${String(v.interni).padStart(3)} (${pct(v.interni, v.n)})`
      + `  · al primo giro utile ${String(v.alPrimo).padStart(3)} (${pct(v.alPrimo, v.n)})  · all'ultimo ${v.allUltimo}`);
  }

  // --- e3. M2: bias con segno a 3/5/10 giri ---------------------------------
  // Due letture, perche' «distacco» ammette due sensi e la differenza qui e' tutto:
  //   assoluto = cum previsto − cum reale del pilota            (contiene il carburante)
  //   gap      = (cum previsto − cum previsto del leader) − lo stesso, reale  (lo cancella)
  console.log('\ne3 · M2 — BIAS CON SEGNO (s/giro), stessa domanda alle due configurazioni');
  const { byLap: _ignora } = datiVecchio(elenco[0].gara);
  const righe = [];
  for (const [nome, passo] of [['passo=null (BANCO)', null], ['passo=v2 (PANNELLO)', passoV2]]) {
    for (const k of [3, 5, 10]) {
      const assol = [], rel = [];
      for (const caso of elenco) {
        const { byLap } = datiVecchio(caso.gara);
        const L = caso.freezeLap, H = caso.pitLap + k;
        if (H > caso.nGiri || !byLap[H]) continue;
        const base = ingressiVecchio(caso, { orizzonte: k - 1 }).argomenti;  // Lfin = pitLap+k
        let r; try { r = evaluatePit({ ...base, passo }); } catch { r = null; }
        if (!r?.ok) continue;
        const prev = Object.fromEntries(r.ordine_previsto);
        const mio = prev[caso.pilota];
        const vero = byLap[H]?.[caso.pilota]?.cum_time;
        if (mio == null || typeof vero !== 'number') continue;
        assol.push((mio - vero) / k);
        // leader: il primo dell'ordine previsto, confrontato con lo stesso pilota nel vero
        const capo = r.ordine_previsto[0][0];
        const veroCapo = byLap[H]?.[capo]?.cum_time;
        if (typeof veroCapo === 'number') rel.push(((mio - prev[capo]) - (vero - veroCapo)) / k);
      }
      righe.push({ nome, k, n: assol.length, assoluto: mediana(assol), gap: mediana(rel) });
    }
  }
  console.log(`    ${'configurazione'.padEnd(22)} ${'k'.padStart(3)} ${'n'.padStart(4)} ${'bias assoluto'.padStart(14)} ${'bias sul gap'.padStart(13)}`);
  for (const r of righe) {
    console.log(`    ${r.nome.padEnd(22)} ${String(r.k).padStart(3)} ${String(r.n).padStart(4)} `
      + `${(r.assoluto == null ? 'n/d' : r.assoluto.toFixed(3)).padStart(14)} ${(r.gap == null ? 'n/d' : r.gap.toFixed(3)).padStart(13)}`);
  }

  // --- e4. la tavola dei muti (la popolazione di M4) -------------------------
  let vv = 0, vn = 0, nv = 0, nn = 0;
  for (const caso of elenco) {
    const a = !rispostaVecchio(caso).muto, b = !rispostaNuovo(caso).muto;
    if (a && b) vv += 1; else if (a && !b) vn += 1; else if (!a && b) nv += 1; else nn += 1;
  }
  console.log('\ne4 · LA TAVOLA DEI MUTI (popolazione di M4)');
  console.log(`    entrambi rispondono          : ${vv}`);
  console.log(`    solo il VECCHIO risponde     : ${vn}   ← i "casi persi" del cancello M4`);
  console.log(`    solo il NUOVO risponde       : ${nv}`);
  console.log(`    nessuno dei due              : ${nn}`);
}

if (arg === 'e' || arg === 'all') sezioneE();

// ============================================================================
// (f) TRE CONTROLLI CHE NASCONO DA (e)
// ============================================================================
function sezioneF() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(f) DENOMINATORI, ETICHETTE, ORIZZONTE LUNGO');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();

  // --- f1. i tre denominatori --------------------------------------------
  // `pos` da sola non e' confrontabile se i due motori classificano su popolazioni diverse.
  let ugualiTutti = 0, vDiv = 0, nDiv = 0, n = 0;
  const scarti = { vecchio: [], nuovo: [] };
  for (const c of elenco) {
    const a = rispostaVecchio(c), b = rispostaNuovo(c);
    if (a.muto || b.muto) continue;
    n += 1;
    if (a.su !== c.suQuantiVeri) { vDiv += 1; scarti.vecchio.push(a.su - c.suQuantiVeri); }
    if (b.su !== c.suQuantiVeri) { nDiv += 1; scarti.nuovo.push(b.su - c.suQuantiVeri); }
    if (a.su === c.suQuantiVeri && b.su === c.suQuantiVeri) ugualiTutti += 1;
  }
  console.log(`\nf1 · SU QUANTI SI CLASSIFICA (casi con risposta da entrambi: ${n})`);
  console.log(`    su(vecchio) != su(verita') : ${vDiv}  (${pct(vDiv, n)})  scarto mediano ${mediana(scarti.vecchio)}`);
  console.log(`    su(nuovo)   != su(verita') : ${nDiv}  (${pct(nDiv, n)})  scarto mediano ${mediana(scarti.nuovo)}`);
  console.log(`    tutti e tre uguali         : ${ugualiTutti}  (${pct(ugualiTutti, n)})`);

  // --- f2. l'etichetta `giro_di_rientro` quando si varia l'orizzonte -------
  const c0 = elenco.find((x) => !rispostaVecchio(x).muto);
  const r0 = rispostaVecchio(c0), r5 = rispostaVecchio(c0, { orizzonte: 5 });
  console.log(`\nf2 · ETICHETTA giro_di_rientro AL VARIARE DELL'ORIZZONTE  [${c0.id}]`);
  console.log(`    orizzonte 0 : giro_di_rientro=${r0.giro_di_rientro}  pos=${r0.pos}   (rientro vero ${c0.rientroLap})`);
  console.log(`    orizzonte 5 : giro_di_rientro=${r5.giro_di_rientro}  pos=${r5.pos}   (la simulazione finisce al ${c0.pitLap + 1 + 5})`);
  console.log(`    ⇒ l'etichetta ${r5.giro_di_rientro === c0.pitLap + 1 + 5 ? 'segue l\'orizzonte' : 'RESTA FERMA E MENTE'}`);

  // --- f3. M3 con orizzonte lungo (fino al traguardo) ---------------------
  const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
  const passoV2 = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };
  function curva(caso, passo, H) {
    const L = caso.freezeLap, punti = [];
    for (let p = L + 1; p <= H - 1; p += 1) {
      const base = ingressiVecchio(caso, { pitLap: p, orizzonte: H - p - 1 }).argomenti;
      let r; try { r = evaluatePit({ ...base, passo }); } catch { r = null; }
      if (!r?.ok) return null;
      const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
      if (!mio) return null;
      punti.push([p, mio[1]]);
    }
    return punti.length >= 3 ? punti : null;
  }
  console.log('\nf3 · M3 CON ORIZZONTE FINO AL TRAGUARDO (H = nGiri)');
  for (const [nome, passo] of [['passo=null (BANCO)', null], ['passo=v2 (PANNELLO)', passoV2]]) {
    let tot = 0, interni = 0, primo = 0, ultimo = 0;
    for (const caso of elenco) {
      const cu = curva(caso, passo, caso.nGiri);
      if (!cu) continue;
      tot += 1;
      const i = cu.reduce((m, x, j) => (x[1] < cu[m][1] ? j : m), 0);
      if (i === 0) primo += 1; else if (i === cu.length - 1) ultimo += 1; else interni += 1;
    }
    console.log(`    ${nome.padEnd(22)} n=${String(tot).padStart(3)}  interni ${String(interni).padStart(3)} (${pct(interni, tot)})`
      + `  · primo giro utile ${String(primo).padStart(3)} (${pct(primo, tot)})  · ultimo ${ultimo}`);
  }

  // --- f4. M2 contro un rivale che NON si e' fermato ----------------------
  // Il gap contro il leader e' inquinato dalle soste VERE dei rivali (il campo congelato
  // e' un'assunzione del motore, non un errore di passo). Qui il riferimento e' un rivale
  // che nella finestra non e' entrato ai box: quel che resta e' passo contro passo.
  console.log('\nf4 · M2 — BIAS CON SEGNO CONTRO UN RIVALE CHE NON SI E\' FERMATO (s/giro)');
  const out = [];
  for (const [nome, passo] of [['passo=null (BANCO)', null], ['passo=v2 (PANNELLO)', passoV2]]) {
    for (const k of [3, 5, 10]) {
      const v = [];
      for (const caso of elenco) {
        const { byLap } = datiVecchio(caso.gara);
        const L = caso.freezeLap, H = caso.pitLap + k;
        if (H > caso.nGiri || !byLap[H]) continue;
        const base = ingressiVecchio(caso, { orizzonte: k - 1 }).argomenti;
        let r; try { r = evaluatePit({ ...base, passo }); } catch { r = null; }
        if (!r?.ok) continue;
        const prev = Object.fromEntries(r.ordine_previsto);
        const mio = prev[caso.pilota], vero = byLap[H]?.[caso.pilota]?.cum_time;
        if (mio == null || typeof vero !== 'number') continue;
        // il rivale: il primo dell'ordine previsto che non ha in_lap in (L, H] e ha cum vero
        const pulito = r.ordine_previsto.map(([d]) => d).find((d) => {
          if (d === caso.pilota) return false;
          if (typeof byLap[H]?.[d]?.cum_time !== 'number') return false;
          for (let q = L + 1; q <= H; q += 1) if (byLap[q]?.[d]?.in_lap) return false;
          return true;
        });
        if (!pulito) continue;
        v.push((((mio - prev[pulito]) - (vero - byLap[H][pulito].cum_time)) / k));
      }
      out.push([nome, k, v.length, mediana(v)]);
    }
  }
  console.log(`    ${'configurazione'.padEnd(22)} ${'k'.padStart(3)} ${'n'.padStart(4)} ${'bias sul gap'.padStart(13)}`);
  for (const [nome, k, nn, m] of out) {
    console.log(`    ${nome.padEnd(22)} ${String(k).padStart(3)} ${String(nn).padStart(4)} ${(m == null ? 'n/d' : m.toFixed(3)).padStart(13)}`);
  }
}

if (arg === 'f' || arg === 'all') sezioneF();

// ============================================================================
// (g) M1 SULLA STESSA POPOLAZIONE
// ============================================================================
// `pos` e' un RANGO dentro una popolazione, e le tre popolazioni non coincidono (f1).
// Qui M1 si rifa' re-classificando le due previsioni e la verita' sull'INTERSEZIONE.
// Se il verdetto cambia fra le due letture, M1 come sta scritta non e' ancora una misura.
function sezioneG() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(g) M1 GREZZA vs M1 SULLA STESSA POPOLAZIONE');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();
  const grezzo = { vecchio: [], nuovo: [] }, comune = { vecchio: [], nuovo: [] };
  let usati = 0;
  for (const c of elenco) {
    const a = rispostaVecchio(c), b = rispostaNuovo(c);
    if (a.muto || b.muto || !a.ordine || !b.ordine) continue;
    grezzo.vecchio.push([a.pos, c.posizioneVera]);
    grezzo.nuovo.push([b.pos, c.posizioneVera]);
    const sa = new Set(a.ordine.map(([d]) => d)), sb = new Set(b.ordine.map(([d]) => d));
    const S = c.ordineVero.filter((d) => sa.has(d) && sb.has(d));
    if (!S.includes(c.pilota) || S.length < 3) continue;
    usati += 1;
    const rango = (ordine) => ordine.filter(([d]) => S.includes(d)).findIndex(([d]) => d === c.pilota) + 1;
    const vera = S.indexOf(c.pilota) + 1;   // ordineVero e' gia' ordinato per cum vero
    comune.vecchio.push([rango(a.ordine), vera]);
    comune.nuovo.push([rango(b.ordine), vera]);
  }
  const riga = (et, cop) => {
    const e = cop.map(([p, v]) => Math.abs(p - v));
    console.log(`    ${et.padEnd(30)} n=${String(cop.length).padStart(3)}  mediana ${String(mediana(e)).padStart(4)}`
      + `  esatti ${String(e.filter((x) => x === 0).length).padStart(3)} (${pct(e.filter((x) => x === 0).length, cop.length)})`
      + `  entro1 ${String(e.filter((x) => x <= 1).length).padStart(3)} (${pct(e.filter((x) => x <= 1).length, cop.length)})`
      + `  bias ${(cop.reduce((s, [p, v]) => s + p - v, 0) / cop.length).toFixed(3)}`);
  };
  console.log('\n    LETTURA A · `pos` cosi\' com\'e\' (ognuno nella sua popolazione)');
  riga('vecchio', grezzo.vecchio); riga('nuovo', grezzo.nuovo);
  console.log(`\n    LETTURA B · re-classificati sull'intersezione (${usati} casi)`);
  riga('vecchio', comune.vecchio); riga('nuovo', comune.nuovo);
}

if (arg === 'g' || arg === 'all') sezioneG();

// ============================================================================
// (h) DUE COSE CHE NESSUNO DICHIARA
// ============================================================================
function sezioneH() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('(h) PIT-LOSS DIVERSI · E CHI ESCE DAL PERIMETRO');
  console.log('══════════════════════════════════════════════════════════════════');
  const elenco = casi();

  console.log('\nh1 · IL COSTO DELLA SOSTA CHE OGNI MOTORE RICEVE (s)');
  console.log(`    ${'gara'.padEnd(16)} ${'vecchio (pitloss.json)'.padStart(22)} ${'nuovo: verde'.padStart(13)} ${'nuovo: applicato'.padStart(17)}`);
  for (const g of gare()) {
    const { pitLoss } = datiVecchio(g);
    const v = [], u = [];
    for (const c of elenco.filter((x) => x.gara === g)) {
      const r = rispostaNuovo(c);
      if (r.muto) continue;
      v.push(r.perdita.perdita_verde); u.push(r.perdita.perdita);
    }
    console.log(`    ${g.padEnd(16)} ${String(pitLoss).padStart(22)} ${(mediana(v)?.toFixed(2) ?? 'n/d').padStart(13)} ${(mediana(u)?.toFixed(2) ?? 'n/d').padStart(17)}`);
  }

  console.log('\nh2 · L\'ESCLUSIONE «DOPPIATO AL RIENTRO» E\' INNESCATA DALLA SOSTA STESSA?');
  let dopp = 0, nonAlFreeze = 0;
  for (const g of gare()) {
    const { byLap, nLaps } = datiVecchio(g);
    const leader = {};
    for (let k = 1; k <= nLaps; k += 1) {
      const cars = byLap[k]; if (!cars) continue;
      let m = Infinity;
      for (const d of Object.keys(cars)) { const t = cars[d].cum_time; if (typeof t === 'number' && t < m) m = t; }
      if (m < Infinity) leader[k] = m;
    }
    const dopA = (lap, cum) => leader[lap + 1] !== undefined && cum > leader[lap + 1];
    for (let Li = 4; Li <= nLaps; Li += 1) {
      const cars = byLap[Li]; if (!cars) continue;
      for (const p of Object.keys(cars)) {
        if (cars[p].in_lap !== true) continue;
        const L = Li - 1, Lo = Li + 1;
        const cL = byLap[L]?.[p]?.cum_time; if (typeof cL !== 'number') continue;
        const cLo = byLap[Lo]?.[p]?.cum_time; if (typeof cLo !== 'number') continue;
        if (!dopA(Lo, cLo)) continue;
        dopp += 1;
        if (!dopA(L, cL)) nonAlFreeze += 1;
      }
    }
  }
  console.log(`    escluse per doppiaggio al rientro : ${dopp}`);
  console.log(`    di cui NON doppiate al congelamento: ${nonAlFreeze}  (${pct(nonAlFreeze, dopp)})`);
  console.log('    ⇒ un terzo delle esclusioni e\' prodotto dai ~20 s della sosta, non da un ritardo preesistente');
}

if (arg === 'h' || arg === 'all') sezioneH();
