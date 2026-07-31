// lente_curva_vuota.mjs — PERCHÉ LA SEZIONE «QUANDO» ESCE VUOTA IN PAGINA.
//
// La vista pubblicata ha 2.678 record con pannello ma curva senza punti (misurato da
// lente_prodotto.mjs). Qui non si deduce la causa: si ri-esegue curvaDelQuando sul
// PERIMETRO DEL PRODOTTO (tutti i giri di congelamento della vista, non le sole soste
// vere) con le due convenzioni di mescola, e si conta.
//
//   A = quella del sito   : mescolaAlGiro(gara, Lf, pilota)  — la gomma che ha su adesso
//   B = quella legale     : mescolePerSoste(1, slick già usate) — la regola già nel repo
//
// Si conta anche il MOTIVO del rifiuto, letto dal Director, invece di assumerlo.
//
//   node ai_lab/confronto/lente_curva_vuota.mjs [gara ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');

const { caricaGare2026 } = await import(path.join(SIM, 'provenienza/gare_2026.mjs'));
const { caricaPrior } = await import(path.join(SIM, 'provenienza/pitloss_dati.mjs'));
const { caricaCostanti } = await import(path.join(SIM, 'scenario/director_dati.mjs'));
const { curvaDelQuando, doveRientri } = await import(path.join(SIM, 'scenario/costruttore.mjs'));
const { mescolaAlGiro } = await import(path.join(SIM, 'scenario/risposta.mjs'));
const { mescolePerSoste } = await import(path.join(SIM, 'scenario/piano.mjs'));
const { MESCOLE_SLICK } = await import(path.join(SIM, 'provenienza/vocabolario.mjs'));

const gare = caricaGare2026(SIM);
const prior = caricaPrior(SIM);
const costantiDirector = caricaCostanti(SIM);
const modello = JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/modello_v2.json'), 'utf8'));
const bandaRientro = JSON.parse(fs.readFileSync(path.join(SIM, 'data/modelli/banda_rientro.json'), 'utf8'));

const PRIMO = 5, DOPO = 3;
const chieste = process.argv.slice(2).filter(a => !a.startsWith('-'));
const nomi = chieste.length ? chieste : Object.keys(gare);

/** le slick già usate dal pilota fino al congelamento (stessa lettura del piano) */
function slickUsate(gara, Lf, pilota) {
  const per = gara.perPilota.get(pilota);
  const usate = new Set();
  if (!per) return usate;
  for (const [l, c] of per) if (l <= Lf && c.compound && MESCOLE_SLICK.has(c.compound)) usate.add(c.compound);
  return usate;
}

const tot = { A: { piene: 0, vuote: 0 }, B: { piene: 0, vuote: 0 }, casi: 0, mesc_diversa: 0 };
const motiviA = {}, motiviB = {};
const perGara = [];
const posDiverse = { n: 0, cambiate: 0 };

for (const nome of nomi) {
  const gara = gare[nome];
  if (!gara) { console.log(`(salto ${nome}: non nel simulatore)`); continue; }
  const contesto = { gare, modello, prior, costantiDirector, bandaRientro, nGiriGara: gara.nGiri };
  const ultimo = gara.nGiri - DOPO;
  const g = { nome, casi: 0, Apiene: 0, Bpiene: 0, mescDiversa: 0 };
  for (const pilota of [...gara.perPilota.keys()].sort()) {
    for (let Lf = PRIMO; Lf <= ultimo; Lf += 1) {
      const mA = mescolaAlGiro(gara, Lf, pilota);
      if (mA === null) continue;                       // il sito qui non produce record
      // il record esiste solo se doveRientri dà una posizione: stesso filtro di risposta.mjs
      let r;
      try { r = doveRientri({ gara: nome, freezeLap: Lf, pilota, giroPit: Lf + 1, mescola: mA }, contesto); }
      catch (e) { continue; }
      if (!r || r.posizione == null || r.approvato === false) continue;
      const mB = mescolePerSoste(1, slickUsate(gara, Lf, pilota))[0];
      const cA = curvaDelQuando({ gara: nome, freezeLap: Lf, pilota, mescola: mA }, contesto);
      const cB = curvaDelQuando({ gara: nome, freezeLap: Lf, pilota, mescola: mB }, contesto);
      const nA = (cA?.curva ?? []).length, nB = (cB?.curva ?? []).length;
      tot.casi++; g.casi++;
      if (nA > 0) { tot.A.piene++; g.Apiene++; } else tot.A.vuote++;
      if (nB > 0) { tot.B.piene++; g.Bpiene++; } else tot.B.vuote++;
      if (mA !== mB) { tot.mesc_diversa++; g.mescDiversa++; }
      // il motivo del rifiuto, letto e non assunto
      if (nA === 0) {
        const rs = cA?.respinti_dal_director ?? [];
        const k = rs.length ? (rs[0].codice ?? rs[0].messaggio ?? JSON.stringify(rs[0]).slice(0,90)) : `approvato=${cA?.approvato} · nessun respinto elencato`;
        motiviA[k] = (motiviA[k] || 0) + 1;
      }
      if (nB === 0) {
        const rs = cB?.respinti_dal_director ?? [];
        const k = rs.length ? (rs[0].codice ?? rs[0].messaggio ?? JSON.stringify(rs[0]).slice(0,90)) : `approvato=${cB?.approvato} · nessun respinto elencato`;
        motiviB[k] = (motiviB[k] || 0) + 1;
      }
      // la POSIZIONE cambia con la mescola? (M1a dice di no su 80 casi: qui su tutti)
      if (mA !== mB) {
        posDiverse.n++;
        const rB = doveRientri({ gara: nome, freezeLap: Lf, pilota, giroPit: Lf + 1, mescola: mB }, contesto);
        if (rB?.posizione !== r.posizione) posDiverse.cambiate++;
      }
    }
  }
  perGara.push(g);
  console.log(`${g.nome.padEnd(14)} casi ${String(g.casi).padStart(5)} · curva piena A ${String(g.Apiene).padStart(5)}`
    + ` (${(100 * g.Apiene / g.casi).toFixed(1)}%) · B ${String(g.Bpiene).padStart(5)}`
    + ` (${(100 * g.Bpiene / g.casi).toFixed(1)}%) · mescola diversa in ${g.mescDiversa}`);
}

console.log('\n=== TOTALE sul perimetro del prodotto (ogni pilota, ogni giro della vista) ===');
console.log(`casi con pannello: ${tot.casi}`);
console.log(`  convenzione A (sito, gomma che ha su): curva piena ${tot.A.piene} (${(100 * tot.A.piene / tot.casi).toFixed(1)}%) · vuota ${tot.A.vuote} (${(100 * tot.A.vuote / tot.casi).toFixed(1)}%)`);
console.log(`  convenzione B (mescola legale):        curva piena ${tot.B.piene} (${(100 * tot.B.piene / tot.casi).toFixed(1)}%) · vuota ${tot.B.vuote} (${(100 * tot.B.vuote / tot.casi).toFixed(1)}%)`);
console.log(`  la mescola scelta differisce in ${tot.mesc_diversa} casi su ${tot.casi}`);
console.log('\nmotivi della curva vuota, convenzione A (letti dal Director):');
for (const [k, n] of Object.entries(motiviA).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}x  ${k}`);
console.log('motivi della curva vuota, convenzione B:');
for (const [k, n] of Object.entries(motiviB).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}x  ${k}`);
console.log(`\nLA POSIZIONE CAMBIA CON LA MESCOLA? casi con mescola diversa ${posDiverse.n} · posizione cambiata ${posDiverse.cambiate}`);
