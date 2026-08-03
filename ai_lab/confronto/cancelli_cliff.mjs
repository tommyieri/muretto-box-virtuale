#!/usr/bin/env node
// cancelli_cliff.mjs — i quattro cancelli di PREREG_cliff_derivato.md, sui tre κ.
//
//     node ai_lab/confronto/cancelli_cliff.mjs [--json] [--kappa <n>] [--rapido]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Le soglie sono copiate da
// PREREG_cliff_derivato.md §5 e non si toccano; i tre κ da kappa_derivato_tum.json e non
// se ne aggiungono. Se un numero qui sotto sembra sbagliato, si scrive un referto — non
// si cambia una riga di questo file.
//
// I CANCELLI (tutti e quattro, per lo STESSO κ):
//  C1  il piano propone DUE soste in almeno una fra Austria e Spagna, per >50% dei
//      pannelli con piano di quella gara
//  C2  nelle OTTO gare in cui Pirelli si aspettava una sosta, la quota di pannelli con
//      k>=2 resta sotto il 10%
//  C3  banco unico, metrica a due giri: nessun peggioramento significativo contro il
//      motore senza cliff (p >= 0,05)
//  C4  banco unico, metrica alla bandiera in configurazione oracolo: saldo contro il
//      nullo >= +1 (oggi +2)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, casi, rispostaNuovo, contestoNuovo, modelloDaDisco } from './banco.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';
import {
  perGara, pianiVeriDi, corri, letturaComune, vecchioConPasso, passoV2, testSegni, media,
} from './bandiera.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const RAPIDO = ARGV.includes('--rapido');
const soloKappa = (() => { const i = ARGV.indexOf('--kappa'); return i >= 0 ? Number(ARGV[i + 1]) : null; })();

const KAPPA = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'kappa_derivato_tum.json'), 'utf8'));
const ATTESE = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab', 'confronto', 'pirelli_attese_2026.json'), 'utf8'));

// I due insiemi di gare vengono dall'ARBITRO ESTERNO, non da una scelta di comodo:
// sono le righe VERIFICATE di pirelli_attese_2026.json.
const BERSAGLIO = ['Austria', 'Spagna'];                       // Pirelli: due soste
const UNA_SOSTA = ATTESE.gare
  .filter((x) => x.soste_attese.trim().startsWith('1') && !/ALLA PARI/i.test(x.soste_attese))
  .map((x) => x.gara);

const modelloBase = modelloDaDisco();
const conCliff = (kappa) => ({
  ...modelloBase,
  cliff: {
    attivo: true,
    kappa,
    targhetta: `DERIVATO da TUMFTM/race-simulation (k_2_quad, ${KAPPA.conteggi.convergenti} fit convergenti su ${KAPPA.conteggi.voci_totali}); `
      + 'regola di derivazione in PREREG_cliff_derivato.md §3. NON misurato sui nostri dati.',
  },
});

// ═══════════════════════════════════════════════ C1 e C2 — quante soste propone
//
// Si ricalcola il PIANO con il modello che porta il cliff. Il congelamento non e' uno:
// la vista ne ha molti per pilota, e il cancello parla di «pannelli». Si usa la stessa
// griglia della vista pubblicata, letta dal disco, cosi' il confronto e' con gli stessi
// punti su cui il censimento ha misurato che k=2 non compare MAI.
function quoteDiK(kappa, elencoGare) {
  const contestoDi = {};
  const out = [];
  for (const g of elencoGare) {
    const cartella = garaSimDi(g);
    const dir = path.join(RADICE, 'demo', 'data', 'vista', cartella);
    const file = readdirSync(dir).filter((f) => /^[A-Z]{3}\.json$/.test(f));
    contestoDi[g] ??= contestoNuovo(g, conCliff(kappa));
    let conPiano = 0; let k2 = 0; let errori = 0;
    for (const f of file) {
      const d = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      const pilota = f.slice(0, 3);
      const giri = RAPIDO ? d.giri.filter((_, i) => i % 4 === 0) : d.giri;
      for (const giro of giri) {
        if (!giro.piano) continue;                       // dove non c'era piano, non c'e' confronto
        try {
          const p = pianoOttimo({ gara: cartella, freezeLap: giro.freeze_lap, pilota }, contestoDi[g]);
          if (!p.migliore) continue;
          conPiano += 1;
          if (p.migliore.k >= 2) k2 += 1;
        } catch { errori += 1; }
      }
    }
    out.push({ gara: g, pannelli: conPiano, k2, quota: conPiano ? k2 / conPiano : null, errori });
  }
  return out;
}

// ═══════════════════════════════════════════════════ C3 — la metrica a due giri
function metricaDueGiri(modello) {
  const PASSO_V2 = passoV2();
  const coppie = [];
  for (const c of casi()) {
    const vp = vecchioConPasso(c, { passo: PASSO_V2 });
    const n = rispostaNuovo(c, { modello });
    if (vp.muto || n.muto) continue;
    const B = letturaComune(c, vp.ordine, n.ordine);
    if (!B) continue;
    coppie.push({ gara: c.gara, pilota: c.pilota, err: B.nuovo - B.vero });
  }
  return coppie;
}

// ═══════════════════════════════════════════════════ C4 — la bandiera, oracolo
function metricaBandiera(modello) {
  const utili = [];
  for (const g of gare()) {
    for (const r of perGara(g)) {
      const e = corri(g, r.pilota, { pianiRivali: pianiVeriDi(g), modello });
      if (e.saltato || e.errore_nullo === null) continue;
      utili.push({ gara: g, a: e.errore, b: e.errore_nullo });
    }
  }
  const t = testSegni(utili);
  return { n: t.n, vince: t.vinceA, perde: t.vinceB, saldo: t.vinceA - t.vinceB, p: t.p };
}

// ═══════════════════════════════════════════════════════════════ esecuzione
const daProvare = soloKappa !== null
  ? [['manuale', soloKappa]]
  : Object.entries(KAPPA.kappa);

console.log('');
console.log('══ CANCELLI DEL CLIFF — PREREG_cliff_derivato.md ══════════════════════════');
console.log(`   Bersaglio (Pirelli: 2 soste): ${BERSAGLIO.join(', ')}`);
console.log(`   Una sosta attesa (${UNA_SOSTA.length} gare): ${UNA_SOSTA.join(', ')}`);
if (RAPIDO) console.log('   ⚠ MODO RAPIDO: un pannello su quattro. Non e\' l\'esito, e\' una sonda.');

// il riferimento SENZA cliff, misurato una volta
const rifDueGiri = metricaDueGiri(null);
const rifBandiera = metricaBandiera(null);
console.log('');
console.log(`   riferimento senza cliff:  due giri n=${rifDueGiri.length}  ·  bandiera saldo ${rifBandiera.saldo >= 0 ? '+' : ''}${rifBandiera.saldo} (${rifBandiera.vince}-${rifBandiera.perde})`);

const esiti = [];
for (const [nome, kappa] of daProvare) {
  console.log('');
  console.log(`── κ = ${kappa} (${nome}) ${'─'.repeat(48)}`);
  const modello = conCliff(kappa);

  const c1 = quoteDiK(kappa, BERSAGLIO);
  const passaC1 = c1.some((x) => x.quota !== null && x.quota > 0.5);
  for (const x of c1) console.log(`   C1  ${x.gara.padEnd(15)} k>=2 in ${x.k2}/${x.pannelli} pannelli  (${x.quota === null ? '—' : `${(100 * x.quota).toFixed(1)}%`})${x.errori ? `  [${x.errori} errori]` : ''}`);
  console.log(`   C1  ${passaC1 ? 'PASSA' : 'NON PASSA'} — serve >50% in almeno una`);

  const c2 = quoteDiK(kappa, UNA_SOSTA);
  const peggiore = c2.reduce((m, x) => (x.quota !== null && (m === null || x.quota > m.quota) ? x : m), null);
  const passaC2 = c2.every((x) => x.quota === null || x.quota < 0.10);
  console.log(`   C2  quota k>=2 piu' alta fra le otto: ${peggiore ? `${peggiore.gara} ${(100 * peggiore.quota).toFixed(1)}%` : '—'}  ->  ${passaC2 ? 'PASSA' : 'NON PASSA'} (serve <10% ovunque)`);

  const dg = metricaDueGiri(modello);
  const appaiate = [];
  const perId = new Map(rifDueGiri.map((x) => [`${x.gara}|${x.pilota}`, x.err]));
  for (const x of dg) { const r = perId.get(`${x.gara}|${x.pilota}`); if (r !== undefined) appaiate.push({ gara: x.gara, a: x.err, b: r }); }
  const t3 = testSegni(appaiate);
  const peggiora = t3.vinceB > t3.vinceA && t3.p < 0.05;
  console.log(`   C3  due giri, appaiato col motore senza cliff: ${t3.vinceA}-${t3.vinceB} (n=${t3.n}, p=${t3.p.toFixed(4)})  ->  ${peggiora ? 'NON PASSA' : 'PASSA'}`);

  const b4 = metricaBandiera(modello);
  const passaC4 = b4.saldo >= 1;
  console.log(`   C4  bandiera (oracolo): saldo ${b4.saldo >= 0 ? '+' : ''}${b4.saldo} (${b4.vince}-${b4.perde}, n=${b4.n})  ->  ${passaC4 ? 'PASSA' : 'NON PASSA'} (serve >= +1)`);

  const tutti = passaC1 && passaC2 && !peggiora && passaC4;
  console.log(`   ESITO κ=${kappa}: ${tutti ? 'TUTTI E QUATTRO PASSANO' : 'NON PASSA'}`);
  esiti.push({ nome, kappa, C1: { passa: passaC1, per_gara: c1 }, C2: { passa: passaC2, per_gara: c2 }, C3: { passa: !peggiora, ...t3 }, C4: { passa: passaC4, ...b4 }, tutti });
}

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Esito dei quattro cancelli di PREREG_cliff_derivato.md sui tre κ dichiarati.',
      prereg: 'ai_lab/confronto/PREREG_cliff_derivato.md',
      kappa: 'ai_lab/confronto/kappa_derivato_tum.json',
      modo: RAPIDO ? 'RAPIDO (un pannello su quattro): sonda, non esito' : 'completo',
      data: '2026-08-03',
    },
    riferimento_senza_cliff: { due_giri_n: rifDueGiri.length, bandiera: rifBandiera },
    esiti,
  };
  const dove = path.join(RADICE, 'ai_lab', 'confronto', RAPIDO ? 'ESITO_cancelli_cliff_sonda.json' : 'ESITO_cancelli_cliff.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
