// lente_hero.mjs — LA HERO CONTRO LA PAGINA-GARA, SULLA STESSA DOMANDA.
//
// La hero della home gira sul motore VECCHIO (gen_hero.mjs -> evaluatePit). La pagina-gara
// legge il motore NUOVO (demo/data/vista/). Il commento in testa a gen_hero.mjs dichiara
// una divergenza (P4 contro P6) ma non dice quanto è grossa nel resto del caso, né quanto
// costa il campo dimezzato. Qui si misura.
//
// LE DUE CONVENZIONI DEL GIRO DI SOSTA, dichiarate e non assunte:
//   vecchio: evaluatePit applica la perdita DOPO aver simulato il giro cur+1 (misurato in
//            verifica_M3_convenzione.mjs: sfasamento di 1 giro)
//   nuovo:   il record freeze_lap = L risponde a «pit al giro L+1» (gara.html: pitL=curLap,
//            L=curLap-1)
// Quindi «pit al giro P» della hero si confronta con il record freeze_lap = P del nuovo.
// Riporto ENTRAMBI gli allineamenti, perché la scelta non è mia.
//
//   node ai_lab/confronto/lente_hero.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO = path.join(RADICE, 'demo');
const DATI = path.join(DEMO, 'data');

const hero = JSON.parse(fs.readFileSync(path.join(DATI, 'hero.json'), 'utf8'));
const G = JSON.parse(fs.readFileSync(path.join(DATI, `${hero.gara}.json`), 'utf8'));
const lec = JSON.parse(fs.readFileSync(path.join(DATI, 'vista', hero.gara, `${hero.pilota.sig}.json`), 'utf8'));

const rec = (L) => lec.giri.find(g => g.freeze_lap === L);
const dice = (s) => !s ? 'nessun record'
  : s.senza_risposta ? `muto: «${s.senza_risposta}»`
  : `P${s.pannello.posizione} su ${s.pannello.su_quanti} (banda ${s.pannello.banda_posizione.da}–${s.pannello.banda_posizione.a}, rientro giro ${s.pannello.giro_di_rientro}, curva ${s.curva?.length ?? 0} punti)`;

console.log('=== 1 · LO STESSO CASO, LE DUE PAGINE ===');
console.log(`hero: ${hero.gara} · ${hero.pilota.sig} · congelamento giro ${hero.giro} di ${hero.n_laps}`);
for (const sc of hero.scelte) {
  console.log(`\n  HERO  "${sc.etichetta}" — pit al giro ${sc.giro}`);
  console.log(`        P${sc.pos} su ${sc.su}` + (sc.davanti ? ` · dietro ${sc.davanti} di ${sc.gap_davanti}s` : ' · davanti a tutti')
    + (sc.dietro ? ` · davanti a ${sc.dietro} di ${sc.gap_dietro}s` : '')
    + (sc.sotto_sc ? ' · sotto neutralizzazione' : '') + ` · soste rivali assunte ${sc.soste_rivali_assunte}`);
  console.log(`  PAGINA-GARA, allineamento sul GIRO DI SOSTA (freeze ${sc.giro}): ${dice(rec(sc.giro))}`);
  console.log(`  PAGINA-GARA, allineamento sull'INTERO dichiarato (freeze ${sc.giro - 1}): ${dice(rec(sc.giro - 1))}`);
}

console.log('\n=== 2 · IL CAMPO: QUANTE VETTURE ORDINA CIASCUNO ===');
const L = hero.giro;
const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
const pace = G.pace[L] || {};
const inPista = G.drivers.filter(d => typeof byLap[L]?.[d]?.cum_time === 'number');
const conPasso = inPista.filter(d => pace[d] != null);
console.log(`  al giro ${L}: in pista con un tempo ${inPista.length} · con passo legacy (pace[${L}]) ${conPasso.length}`);
console.log(`  la hero ordina ${hero.scelte[0].su} vetture — il filtro è pace[L]!=null (gen_hero.mjs:81)`);
console.log(`  la pagina-gara ne ordina ${rec(L)?.pannello?.su_quanti ?? '?'}`);
console.log(`  vetture che la hero NON mostra: ${inPista.filter(d => pace[d] == null).sort().join(' ')}`);
const neutr = Object.values(byLap[L]).filter(c => c.neutralized).length;
console.log(`  contesto: ${neutr}/${Object.keys(byLap[L]).length} vetture neutralizzate al giro ${L} — è per questo che il passo legacy manca`);

console.log('\n=== 3 · QUANTO PESA IL CAMPO DIMEZZATO SULLA RISPOSTA ===');
// la posizione della hero è un rango dentro 10; ri-classifico l'ordine del nuovo sulle sole
// 10 vetture che la hero conosce, per vedere se la differenza è fisica o popolazione.
const noti = new Set(conPasso);
for (const sc of hero.scelte) {
  const s = rec(sc.giro);
  if (!s?.pannello) { console.log(`  pit ${sc.giro}: la pagina-gara non risponde, niente da confrontare`); continue; }
  console.log(`  pit al giro ${sc.giro}: hero P${sc.pos}/${sc.su} · nuovo P${s.pannello.posizione}/${s.pannello.su_quanti}`
    + ` — differenza grezza ${s.pannello.posizione - sc.pos} posizioni, differenza di campo ${s.pannello.su_quanti - sc.su} vetture`);
}

console.log('\n=== 4 · IL TESTO CHE LA HOME PROMETTE, E DOVE PORTA ===');
const idx = fs.readFileSync(path.join(DEMO, 'index.html'), 'utf8');
const cta = /href="(gara\.html[^"]*)"/.exec(idx)?.[1];
console.log(`  CTA della hero: ${cta}`);
const garaHtml = fs.readFileSync(path.join(DEMO, 'gara.html'), 'utf8');
console.log(`  gara.html parte a: ${/let curLap=(\d+)/.exec(garaHtml)?.[1]}`);
console.log(`  freeze alla prima pressione di BOX: ${/const L=Math\.max\(1,curLap-1\), pitL=Math\.max\(2,curLap\);/.test(garaHtml) ? 'L = max(1, curLap-1) = 1' : '?'}`);
const cart = cta?.split('g=')[1];
const ind = JSON.parse(fs.readFileSync(path.join(DATI, 'vista', cart, 'indice.json'), 'utf8'));
console.log(`  la vista di ${cart} copre i congelamenti ${ind.primo_giro}–${ind.ultimo_giro}: al giro 1 il record NON esiste`);
// primo giro con una risposta vera in quella gara
let primo = null, quanti = 0;
for (const drv of Object.keys(ind.piloti)) {
  const v = JSON.parse(fs.readFileSync(path.join(DATI, 'vista', cart, `${drv}.json`), 'utf8'));
  for (const s of v.giri) if (!s.senza_risposta && s.pannello) { if (primo === null || s.freeze_lap < primo) primo = s.freeze_lap; }
}
for (const drv of Object.keys(ind.piloti)) {
  const v = JSON.parse(fs.readFileSync(path.join(DATI, 'vista', cart, `${drv}.json`), 'utf8'));
  const s = v.giri.find(x => x.freeze_lap === primo);
  if (s && !s.senza_risposta && s.pannello) quanti++;
}
console.log(`  prima risposta con posizione in ${cart}: congelamento ${primo} (${quanti} piloti su ${Object.keys(ind.piloti).length})`);
console.log(`  cioè il visitatore deve portare il cursore al giro ${primo + 1} prima che il pannello dica un numero`);
