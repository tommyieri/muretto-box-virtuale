#!/usr/bin/env node
// sweep_min_giri.mjs — LA LENTE DELLA COPERTURA.
//
// Domanda: MIN_GIRI_BASE = 8 (simulatore/scenario/costruttore.mjs:31) e' prudenza
// GIUSTIFICATA o prudenza ECCESSIVA? Il modo onesto di rispondere non e' discutere:
// e' abbassare la soglia, guardare le risposte che compaiono, e misurare se valgono
// qualcosa. Se le risposte nuove sono spazzatura, il silenzio e' giusto. Se sono
// paragonabili a quelle che il motore gia' pubblica, il silenzio costa e basta.
//
// NON TOCCA simulatore/. Usa una COPIA di costruttore.mjs con la sola soglia resa
// variabile (costruttore_param.mjs) e verifica la PARITA' con il motore vero a
// minGiri = 8: se la copia non riproduce il banco caso per caso, il resto non vale.
//
// Uso: node ai_lab/confronto/lente_copertura/sweep_min_giri.mjs
import { casi, censimento, contestoNuovo, garaNuova, rispostaNuovo, rispostaVecchio } from '../banco.mjs';
import { doveRientri, impostaMinGiriBase } from './costruttore_param.mjs';
import { osservazioniVerdi } from '../../../simulatore/provenienza/gare_indice.mjs';
import { mescolaAlGiro } from '../../../simulatore/scenario/risposta.mjs';

const SOGLIE = [8, 7, 6, 5, 4, 3, 2];

const ordina = (cum) => (a, b) => (cum[a] - cum[b]) || (a < b ? -1 : b < a ? 1 : 0);
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : 'n/d');

// ── quanti giri VERDI utilizzabili ha davvero quel pilota fino al congelamento ──
// E' la grandezza che la soglia taglia: la misuro una volta, e' la covariata di tutto.
const cacheGiri = new Map();
function giriUtili(caso) {
  const k = caso.gara;
  if (!cacheGiri.has(k)) {
    const g = garaNuova(caso.gara);
    const per = new Map();
    for (const { drv, lap } of osservazioniVerdi(g.righe)) {
      if (!per.has(drv)) per.set(drv, []);
      per.get(drv).push(lap);
    }
    cacheGiri.set(k, per);
  }
  const laps = cacheGiri.get(k).get(caso.pilota) ?? [];
  return laps.filter((l) => l <= caso.freezeLap).length;
}

// ── la risposta del NUOVO a soglia variabile, stessa forma del banco ──
function rispostaNuovaSoglia(caso) {
  const gSim = garaNuova(caso.gara);
  const scelta = mescolaAlGiro(gSim, caso.freezeLap, caso.pilota);
  if (scelta === null) return { muto: true, motivo: 'mescola non nota o non slick', pos: null, su: null, banda: null, ordine: null };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota, giroPit: caso.pitLap, mescola: scelta }, contestoNuovo(caso.gara));
  } catch (e) { return { muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, banda: null, ordine: null }; }
  if (!r || r.approvato !== true) return { muto: true, motivo: 'respinto dal Director', pos: null, su: null, banda: null, ordine: null };
  if (r.posizione === null || r.posizione === undefined) return { muto: true, motivo: 'nessun passo base (regola 6)', pos: null, su: null, banda: null, ordine: null };
  let ordine = null;
  if (r.traccia) {
    const cum = {};
    for (const [drv, passi] of Object.entries(r.traccia)) {
      if (!passi) continue;
      const p = passi.find((x) => x.lap === caso.rientroLap);
      if (p) cum[drv] = p.cum_time;
    }
    ordine = Object.keys(cum).sort(ordina(cum));
  }
  return { muto: false, motivo: null, pos: r.posizione, su: r.su_quanti, banda: r.banda_posizione, ordine, perdita: r.perdita };
}

// ── lettura B: previsione e verita' ri-classificate sulla popolazione comune ──
function erroreB(caso, ordine, pos) {
  if (!ordine) return null;
  const set = new Set(ordine);
  const comune = caso.ordineVero.filter((d) => set.has(d));
  if (!comune.includes(caso.pilota)) return null;
  const vero = comune.indexOf(caso.pilota) + 1;
  const mioOrdine = ordine.filter((d) => new Set(caso.ordineVero).has(d));
  const prev = mioOrdine.indexOf(caso.pilota) + 1;
  if (prev === 0) return null;
  return { err: prev - vero, prev, vero, su: comune.length };
}

function riassunto(righe) {
  const a = righe.map((r) => r.errA).filter((x) => x !== null);
  const b = righe.map((r) => r.errB).filter((x) => x !== null);
  const inBanda = righe.filter((r) => r.inBanda !== null);
  return {
    n: righe.length,
    A_mediana: mediana(a.map(Math.abs)), A_media: media(a.map(Math.abs)),
    A_esatti: a.filter((x) => x === 0).length, A_n: a.length,
    A_entro1: a.filter((x) => Math.abs(x) <= 1).length,
    A_bias: media(a),
    B_mediana: mediana(b.map(Math.abs)), B_media: media(b.map(Math.abs)),
    B_esatti: b.filter((x) => x === 0).length, B_n: b.length,
    B_entro1: b.filter((x) => Math.abs(x) <= 1).length,
    B_bias: media(b),
    banda_ok: inBanda.filter((r) => r.inBanda).length, banda_n: inBanda.length,
    larghezza: media(inBanda.map((r) => r.larghezza)),
  };
}
const riga = (et, s) => `  ${et.padEnd(22)} n=${String(s.n).padStart(3)} | A med ${s.A_mediana ?? '-'} media ${s.A_media?.toFixed(2) ?? '-'} esatti ${String(s.A_esatti).padStart(3)}/${String(s.A_n).padStart(3)} ${pc(s.A_esatti, s.A_n).padStart(6)} entro1 ${pc(s.A_entro1, s.A_n).padStart(6)} bias ${s.A_bias?.toFixed(2) ?? '-'} | B esatti ${pc(s.B_esatti, s.B_n).padStart(6)} media ${s.B_media?.toFixed(2) ?? '-'} bias ${s.B_bias?.toFixed(2) ?? '-'} | banda ${pc(s.banda_ok, s.banda_n).padStart(6)} larg ${s.larghezza?.toFixed(2) ?? '-'}`;

// ═══════════════════════════════════════════════════════════════════════════
const elenco = casi();
console.log(`PERIMETRO: ${elenco.length} soste ammesse su ${censimento().soste_reali_trovate} trovate`);

// il VECCHIO, una volta sola: e' il termine di paragone
const vecchio = new Map();
for (const c of elenco) {
  const r = rispostaVecchio(c);
  let errA = null, errB = null;
  if (!r.muto) {
    errA = r.pos - c.posizioneVera;
    const ord = r.ordine ? r.ordine.map((x) => (Array.isArray(x) ? x[0] : x)) : null;
    const b = erroreB(c, ord, r.pos);
    errB = b ? b.err : null;
  }
  vecchio.set(c.id, { muto: r.muto, errA, errB });
}

// parita' con il banco a soglia 8
impostaMinGiriBase(8);
let divergenze = 0;
for (const c of elenco) {
  const mia = rispostaNuovaSoglia(c);
  const suo = rispostaNuovo(c);
  if (mia.muto !== suo.muto || (!mia.muto && (mia.pos !== suo.pos || mia.su !== suo.su))) divergenze += 1;
}
console.log(`PARITA' copia-vs-banco a minGiri=8: ${divergenze} divergenze su ${elenco.length}${divergenze ? '  ← LA COPIA NON E\' FEDELE, il resto non vale' : '  (la copia e\' fedele)'}`);

const perSoglia = new Map();
for (const soglia of SOGLIE) {
  impostaMinGiriBase(soglia);
  const righe = [];
  for (const c of elenco) {
    const r = rispostaNuovaSoglia(c);
    let errA = null, errB = null, inBanda = null, larghezza = null;
    if (!r.muto) {
      errA = r.pos - c.posizioneVera;
      const b = erroreB(c, r.ordine, r.pos);
      errB = b ? b.err : null;
      if (r.banda) {
        inBanda = c.posizioneVera >= r.banda.da && c.posizioneVera <= r.banda.a;
        larghezza = r.banda.a - r.banda.da + 1;
      }
    }
    righe.push({ id: c.id, caso: c, muto: r.muto, motivo: r.motivo, pos: r.pos, su: r.su, errA, errB, inBanda, larghezza, giri: giriUtili(c) });
  }
  perSoglia.set(soglia, righe);
}

// ── 1. COPERTURA E QUALITA' COMPLESSIVA ──
console.log('\n═══ 1 · SOGLIA PER SOGLIA, tutti i 274 casi ═══');
for (const soglia of SOGLIE) {
  const righe = perSoglia.get(soglia);
  const parla = righe.filter((r) => !r.muto);
  console.log(`minGiri=${soglia}  copertura ${parla.length}/${righe.length} ${pc(parla.length, righe.length)}`);
  console.log(riga('  su chi parla', riassunto(parla)));
}

// ── 2. LE RISPOSTE MARGINALI: quelle che compaiono abbassando la soglia ──
console.log('\n═══ 2 · LE RISPOSTE CHE COMPAIONO (contro la soglia 8) ═══');
const base8 = new Map(perSoglia.get(8).map((r) => [r.id, r]));
for (const soglia of SOGLIE.filter((s) => s < 8)) {
  const righe = perSoglia.get(soglia);
  const nuove = righe.filter((r) => !r.muto && base8.get(r.id).muto);
  const gia = righe.filter((r) => !r.muto && !base8.get(r.id).muto);
  console.log(`\nminGiri=${soglia}: ${nuove.length} risposte NUOVE (+${nuove.length} copertura)`);
  if (nuove.length) console.log(riga('  SOLO le nuove', riassunto(nuove)));
  console.log(riga('  quelle di prima', riassunto(gia)));
  // il vecchio sugli STESSI casi nuovi
  const vA = nuove.map((r) => vecchio.get(r.id)).filter((v) => v && !v.muto);
  const eA = vA.map((v) => v.errA).filter((x) => x !== null);
  const eB = vA.map((v) => v.errB).filter((x) => x !== null);
  console.log(`  VECCHIO sugli stessi casi: parla ${vA.length}/${nuove.length} · A esatti ${eA.filter((x) => x === 0).length}/${eA.length} ${pc(eA.filter((x) => x === 0).length, eA.length)} media ${media(eA.map(Math.abs))?.toFixed(2) ?? '-'} · B esatti ${pc(eB.filter((x) => x === 0).length, eB.length)}`);
  // cambiano le risposte gia' esistenti?
  const cambiate = gia.filter((r) => r.pos !== base8.get(r.id).pos).length;
  console.log(`  risposte GIA' esistenti che cambiano: ${cambiate}/${gia.length}`);
}

// ── 3. PER NUMERO DI GIRI UTILI: la covariata che la soglia taglia ──
console.log('\n═══ 3 · QUALITA\' PER NUMERO DI GIRI VERDI UTILI (soglia 2, tutti parlano) ═══');
const tutte = perSoglia.get(2);
const fasce = [[2, 2], [3, 3], [4, 4], [5, 5], [6, 7], [8, 11], [12, 19], [20, 99]];
for (const [lo, hi] of fasce) {
  const sub = tutte.filter((r) => !r.muto && r.giri >= lo && r.giri <= hi);
  if (!sub.length) continue;
  console.log(riga(`giri ${lo}${hi > lo ? '-' + hi : ''}`, riassunto(sub)));
  const v = sub.map((r) => vecchio.get(r.id)).filter((x) => x && !x.muto);
  const eA = v.map((x) => x.errA), eB = v.map((x) => x.errB).filter((x) => x !== null);
  console.log(`    VECCHIO stessa fascia: parla ${v.length}/${sub.length} · A esatti ${pc(eA.filter((x) => x === 0).length, eA.length)} media ${media(eA.map(Math.abs))?.toFixed(2) ?? '-'} · B esatti ${pc(eB.filter((x) => x === 0).length, eB.length)} media ${media(eB.map(Math.abs))?.toFixed(2) ?? '-'}`);
}

// ── 4. DOVE STANNO I CASI MARGINALI (giro della sosta, gara, regime) ──
console.log('\n═══ 4 · I CASI CHE LA SOGLIA 8 ZITTISCE ═══');
const zittiti = perSoglia.get(2).filter((r) => !r.muto && base8.get(r.id).muto);
console.log(`totale ${zittiti.length}`);
const perGara = {}; const perGiro = {};
for (const r of zittiti) {
  perGara[r.caso.gara] = (perGara[r.caso.gara] ?? 0) + 1;
  const f = r.caso.pitLap <= 8 ? '4-8' : r.caso.pitLap <= 13 ? '9-13' : r.caso.pitLap <= 20 ? '14-20' : '21+';
  perGiro[f] = (perGiro[f] ?? 0) + 1;
}
console.log('  per gara: ' + Object.entries(perGara).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('  per fascia del giro di sosta: ' + Object.entries(perGiro).sort().map(([k, v]) => `${k}: ${v}`).join(' · '));
console.log('  giri utili: ' + JSON.stringify(zittiti.map((r) => r.giri).sort((a, b) => a - b)));
console.log('  elenco: ' + zittiti.map((r) => `${r.id}(g${r.giri})`).join(', '));

// ── 5. LA BANDA: quanto dovrebbe essere larga per coprire l'80% sui marginali ──
console.log('\n═══ 5 · QUANTO DEVE ESSERE LARGA LA BANDA SUI MARGINALI ═══');
for (const [et, sub] of [['marginali (soglia 2 vs 8)', zittiti], ['gia\' coperti a 8', perSoglia.get(2).filter((r) => !r.muto && !base8.get(r.id).muto)]]) {
  const e = sub.map((r) => r.errA).filter((x) => x !== null);
  const out = [];
  for (let s = 0; s <= 6; s += 1) out.push(`±${s} ${pc(e.filter((x) => Math.abs(x) <= s).length, e.length)}`);
  console.log(`  ${et.padEnd(26)} n=${e.length} · ${out.join(' · ')} · bias medio ${media(e)?.toFixed(2)} mediano ${mediana(e)}`);
  // asimmetrica: (-k, +0) e simili
  for (const [sotto, sopra] of [[2, 0], [3, 0], [4, 0], [2, 1], [3, 1], [4, 1]]) {
    const q = e.filter((x) => x >= -sopra && x <= sotto).length;
    if (q / e.length >= 0.8) { console.log(`    prima asimmetrica che raggiunge l'80%: (sotto ${sotto}, sopra ${sopra}) → ${pc(q, e.length)} larghezza ${sotto + sopra + 1}`); break; }
  }
}
