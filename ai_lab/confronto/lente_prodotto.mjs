// lente_prodotto.mjs — COSA VEDE CHI ARRIVA DALLA HOME.
//
// Non misura i motori: misura la SUPERFICIE PUBBLICATA. Legge demo/data/vista/<gara>/*.json
// (i file che gara.html serve senza calcolare nulla) e conta, per ogni giro di congelamento,
// che cosa finisce davvero sullo schermo: una risposta, un silenzio, o una risposta senza
// curva del quando.
//
// Riproduce il percorso di gara.html::mostraRisposta riga per riga:
//   record assente        -> "A questo giro il simulatore non risponde per <DRV>"
//   s.senza_risposta      -> quella frase
//   s.approvato === false -> pannello con il veto
//   altrimenti            -> pannello; curva disegnata se s.curva esiste (vuota = ramo "perché no")
//
// node ai_lab/confronto/lente_prodotto.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const VISTA = path.join(RADICE, 'demo', 'data', 'vista');
const DATI = path.join(RADICE, 'demo', 'data');

const man = JSON.parse(fs.readFileSync(path.join(VISTA, 'manifest.json'), 'utf8'));
const cartelle = [...new Set(Object.values(man.cartella_di))];

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/d';

// --------------------------------------------------------------- censimento
const righe = [];          // una per (gara, pilota, freeze_lap)
const perGara = {};

for (const cart of cartelle) {
  const idx = JSON.parse(fs.readFileSync(path.join(VISTA, cart, 'indice.json'), 'utf8'));
  const g = { cart, gara: idx.gara, n_giri: idx.n_giri, primo: idx.primo_giro, ultimo: idx.ultimo_giro,
              piloti: Object.keys(idx.piloti).length, tot: 0, muti: 0, veti: 0, curva_vuota: 0, ok: 0 };
  for (const drv of Object.keys(idx.piloti)) {
    const f = path.join(VISTA, cart, `${drv}.json`);
    if (!fs.existsSync(f)) continue;
    const v = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const s of v.giri) {
      const stato = s.senza_risposta ? 'muto'
                  : s.approvato === false ? 'veto'
                  : (!s.curva || s.curva.length === 0) ? 'curva_vuota' : 'ok';
      righe.push({ gara: idx.gara, cart, drv, L: s.freeze_lap, n_giri: idx.n_giri, stato,
                   motivo: s.senza_risposta || null });
      g.tot++;
      if (stato === 'muto') g.muti++; else if (stato === 'veto') g.veti++;
      else if (stato === 'curva_vuota') g.curva_vuota++; else g.ok++;
    }
  }
  perGara[idx.gara] = g;
}

console.log('=== 1 · LA VISTA PUBBLICATA (demo/data/vista/) ===');
console.log('gara            giri  piloti  primo-ultimo  record   muti  veti  curva-vuota  piene');
for (const g of Object.values(perGara)) {
  console.log(`${g.gara.padEnd(15)} ${String(g.n_giri).padStart(3)} ${String(g.piloti).padStart(6)}  `
    + `${String(g.primo).padStart(4)}-${String(g.ultimo).padEnd(4)} ${String(g.tot).padStart(7)} `
    + `${String(g.muti).padStart(6)} ${String(g.veti).padStart(5)} ${String(g.curva_vuota).padStart(12)} ${String(g.ok).padStart(6)}`);
}
const T = righe.length;
const M = righe.filter(r => r.stato === 'muto').length;
const V = righe.filter(r => r.stato === 'veto').length;
const CV = righe.filter(r => r.stato === 'curva_vuota').length;
console.log(`TOTALE record ${T} · muti ${M} (${pct(M, T)}) · veti ${V} (${pct(V, T)}) · `
  + `curva vuota ${CV} (${pct(CV, T)}) · piene ${T - M - V - CV} (${pct(T - M - V - CV, T)})`);

// --------------------------------------------------- 2 · IL BUCO DEI PRIMI GIRI
// gara.html: freeze L = max(1, curLap-1). Chi arriva dalla home entra a curLap=1.
console.log('\n=== 2 · IL BUCO DEI PRIMI GIRI (il record esiste? e cosa dice?) ===');
console.log('Per ogni giro di congelamento L: quante coppie (gara,pilota) hanno un record,');
console.log('e quante di quelle danno una risposta con posizione.');
const primoDi = {};
for (const g of Object.values(perGara)) primoDi[g.gara] = g.primo;
// denominatore onesto: quante coppie (gara,pilota) esistono in totale
let coppie = 0;
for (const g of Object.values(perGara)) coppie += g.piloti;
const perL = {};
for (const r of righe) {
  (perL[r.L] ??= { rec: 0, ok: 0, muti: 0, cv: 0 });
  perL[r.L].rec++;
  if (r.stato === 'muto') perL[r.L].muti++;
  else if (r.stato === 'curva_vuota') perL[r.L].cv++;
  else if (r.stato === 'ok') perL[r.L].ok++;
}
console.log('  L   record/coppie      con risposta    muti   curva-vuota');
for (let L = 1; L <= 20; L++) {
  const p = perL[L] || { rec: 0, ok: 0, muti: 0, cv: 0 };
  console.log(`${String(L).padStart(3)}  ${String(p.rec).padStart(4)}/${coppie}  ${pct(p.rec, coppie).padStart(7)}`
    + `   ${String(p.ok + p.cv).padStart(4)} ${pct(p.ok + p.cv, coppie).padStart(7)}`
    + `   ${String(p.muti).padStart(4)}  ${String(p.cv).padStart(6)}`);
}
const buchi = righe.filter(r => r.L <= 8).length;
console.log(`Record con L<=8 su tutte le gare: ${buchi} (coppie possibili: ${coppie * 8})`);

// il primo giro utile per gara
console.log('\nprimo giro con almeno una risposta con posizione, per gara:');
for (const g of Object.values(perGara)) {
  const suoi = righe.filter(r => r.gara === g.gara && (r.stato === 'ok' || r.stato === 'curva_vuota'));
  const min = suoi.length ? Math.min(...suoi.map(r => r.L)) : null;
  const q = suoi.filter(r => r.L === min).length;
  console.log(`  ${g.gara.padEnd(15)} indice dichiara ${String(g.primo).padStart(2)} · prima risposta vera al giro ${String(min).padStart(2)} (${q} piloti su ${g.piloti})`);
}

// --------------------------------------------------- 3 · I MOTIVI DEL SILENZIO
console.log('\n=== 3 · PERCHÉ TACE (testo esatto mostrato al visitatore) ===');
const motivi = {};
for (const r of righe) if (r.motivo) motivi[r.motivo] = (motivi[r.motivo] || 0) + 1;
for (const [m, n] of Object.entries(motivi).sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${m}`);

// --------------------------------------------------- 4 · LA CURVA VUOTA, DOVE
console.log('\n=== 4 · CURVA VUOTA per fascia di giro (la sezione "quando" senza numeri) ===');
const fasce = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 99]];
for (const [a, b] of fasce) {
  const dentro = righe.filter(r => r.L >= a && r.L <= b && r.stato !== 'muto');
  const cv = dentro.filter(r => r.stato === 'curva_vuota').length;
  console.log(`  giri ${a}-${b}: ${cv}/${dentro.length} = ${pct(cv, dentro.length)} con pannello ma curva vuota`);
}
// e in frazione di gara
console.log('  per frazione di gara (L/n_giri):');
for (const [a, b] of [[0, .25], [.25, .5], [.5, .75], [.75, 1.01]]) {
  const dentro = righe.filter(r => r.stato !== 'muto' && r.L / r.n_giri >= a && r.L / r.n_giri < b);
  const cv = dentro.filter(r => r.stato === 'curva_vuota').length;
  console.log(`    ${a}-${b}: ${cv}/${dentro.length} = ${pct(cv, dentro.length)}`);
}

// --------------------------------------------------- 5 · IL CASO DELLA HERO
console.log('\n=== 5 · IL CASO DELLA HERO (Belgio/LEC) — hero contro pagina-gara ===');
const hero = JSON.parse(fs.readFileSync(path.join(DATI, 'hero.json'), 'utf8'));
const lec = JSON.parse(fs.readFileSync(path.join(VISTA, 'Belgio', 'LEC.json'), 'utf8'));
for (const sc of hero.scelte) {
  // la hero congela al giro 20 e fa pit al giro `sc.giro`; la pagina-gara congela a pit-1
  const Lp = sc.giro - 1;
  const s = lec.giri.find(g => g.freeze_lap === Lp);
  const p = s?.pannello;
  console.log(`  hero "${sc.id}" (congelamento ${hero.giro}, pit ${sc.giro}): P${sc.pos} su ${sc.su}`
    + (sc.davanti ? ` · dietro ${sc.davanti} di ${sc.gap}s` : ' · davanti a tutti')
    + `  ||  pagina-gara (congelamento ${Lp}, pit ${sc.giro}): `
    + (p ? `P${p.posizione} su ${p.su_quanti}, banda ${p.banda_posizione.da}-${p.banda_posizione.a}`
         : (s ? `senza risposta: ${s.senza_risposta}` : 'nessun record')));
}
console.log(`  campo: la hero ordina ${hero.scelte[0].su} vetture, la pagina-gara ${lec.giri.find(g => g.freeze_lap === 22)?.pannello?.su_quanti ?? '?'}`);
// e la stessa domanda alla LETTERA (stesso congelamento 20 della hero)
const s20 = lec.giri.find(g => g.freeze_lap === 20);
console.log(`  al congelamento 20 (identico alla hero) la pagina-gara dice: `
  + (s20?.pannello ? `P${s20.pannello.posizione} su ${s20.pannello.su_quanti}, rientro giro ${s20.pannello.giro_di_rientro}, curva ${s20.curva?.length ?? 0} punti`
     : s20?.senza_risposta || 'nessun record'));

// --------------------------------------------------- 6 · IL SELETTORE MESCOLA
console.log('\n=== 6 · IL SELETTORE MESCOLA: il click arriva? ===');
const garaHtml = fs.readFileSync(path.join(RADICE, 'demo', 'gara.html'), 'utf8');
const render = fs.readFileSync(path.join(RADICE, 'demo', 'vendor', 'simulatore', 'render.mjs'), 'utf8');
const pann = fs.readFileSync(path.join(RADICE, 'demo', 'vendor', 'simulatore', 'pannello.mjs'), 'utf8');
console.log(`  gara.html cerca il bersaglio: ${/closest\('\[([^']+)\]'\)/.exec(garaHtml)?.[1] ?? '?'}`);
console.log(`  render.mjs mappa \`valore\` su: ${/valore: '([^']+)'/.exec(render)?.[1] ?? '?'}`);
console.log(`  il pannello emette i bottoni con: ${/valore: (m\.\w+)/.exec(pann)?.[1] ?? '?'}`);
const letture = (garaHtml.match(/mescolaScelta/g) || []).length;
console.log(`  occorrenze di \`mescolaScelta\` in gara.html: ${letture} (dichiarazione, azzeramento, assegnazione — nessuna lettura)`);
console.log(`  \`data-mesc\` presente in gara.html/pannello nuovo: ${/data-mesc/.test(pann) ? 'sì' : 'NO'}`);
// quante mescole distinte pubblica la vista per uno stesso pilota
let variabili = 0, totPil = 0;
for (const cart of cartelle) {
  const idx = JSON.parse(fs.readFileSync(path.join(VISTA, cart, 'indice.json'), 'utf8'));
  for (const drv of Object.keys(idx.piloti)) {
    const f = path.join(VISTA, cart, `${drv}.json`);
    if (!fs.existsSync(f)) continue;
    const v = JSON.parse(fs.readFileSync(f, 'utf8'));
    const set = new Set(v.giri.map(s => s.mescola_scelta).filter(Boolean));
    totPil++; if (set.size > 1) variabili++;
  }
}
console.log(`  mescole pre-calcolate: 1 sola per (pilota,giro); piloti con >1 mescola nel file: ${variabili}/${totPil}`);
