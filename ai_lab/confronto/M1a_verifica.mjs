// M1a_verifica — controlli sulla misura M1, prima di crederci.
//   1. la verita' del banco ricalcolata a mano dal JSON del sito (oracolo indipendente)
//   2. ordine.length == su, per entrambi i motori (se no, la lettura B e' su un altro campo)
//   3. i 39 muti del vecchio: dove sono e perche'
//   4. i casi asimmetrici (uno risponde, l'altro no) e quanto sbaglia chi risponde
//   5. sensibilita': la mediana di lettura A passa il cancello per pari merito?
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { casi, rispostaVecchio, rispostaNuovo, RADICE } from './banco.mjs';

const elenco = casi();

// —— 1. oracolo indipendente sulla verita'
let controllati = 0, divergenti = 0;
const esempi = [];
const fileGara = new Map();
for (const c of elenco) {
  if (!fileGara.has(c.gara)) fileGara.set(c.gara, JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', `${c.gara}.json`), 'utf8')));
  const G = fileGara.get(c.gara);
  const giro = G.laps.find((l) => l.lap === c.rientroLap);
  const coppie = Object.entries(giro.cars).filter(([, v]) => typeof v.cum_time === 'number')
    .sort((a, b) => (a[1].cum_time - b[1].cum_time) || (a[0] < b[0] ? -1 : 1));
  const pos = coppie.findIndex(([d]) => d === c.pilota) + 1;
  controllati += 1;
  if (pos !== c.posizioneVera || coppie.length !== c.suQuantiVeri) {
    divergenti += 1;
    if (esempi.length < 5) esempi.push({ id: c.id, banco: `${c.posizioneVera}/${c.suQuantiVeri}`, oracolo: `${pos}/${coppie.length}` });
  }
}
console.log(`1. VERITA' RICALCOLATA A MANO: ${controllati} casi · divergenze ${divergenti}`, esempi);

// —— 2. ordine vs su
let mismV = 0, mismN = 0, nV = 0, nN = 0;
for (const c of elenco) {
  const v = rispostaVecchio(c); const n = rispostaNuovo(c);
  if (!v.muto) { nV += 1; if (v.ordine.length !== v.su) mismV += 1; }
  if (!n.muto) { nN += 1; if (!n.ordine || n.ordine.length !== n.su) mismN += 1; }
}
console.log(`2. ordine.length != su — vecchio ${mismV}/${nV} · nuovo ${mismN}/${nN}`);

// —— 3. i muti del vecchio
const mutiV = elenco.filter((c) => rispostaVecchio(c).muto);
const perGara = {};
for (const c of mutiV) perGara[c.gara] = (perGara[c.gara] ?? 0) + 1;
console.log('3. MUTI DEL VECCHIO per gara:', perGara);
const senzaPasso = mutiV.filter((c) => !c.passoVecchioDisponibile).length;
const regime = mutiV.filter((c) => c.regimeAlCongelamento !== null).length;
console.log(`   di cui senza passo al congelamento (passoVecchioDisponibile=false): ${senzaPasso} · sotto regime SC/VSC al congelamento: ${regime}`);
console.log('   primi 6:', mutiV.slice(0, 6).map((c) => `${c.id} passo=${c.passoVecchioDisponibile} eta=${c.etaGommaAlCongelamento} stint=${c.stintAlCongelamento}`));
// controprova: nel Monaco quanti casi hanno passo disponibile?
const mon = elenco.filter((c) => c.gara === 'Monaco');
console.log(`   Monaco: ${mon.length} casi · con passo ${mon.filter((c) => c.passoVecchioDisponibile).length} · muti vecchio ${mon.filter((c) => rispostaVecchio(c).muto).length}`);

// —— 4. asimmetrie
const soloV = elenco.filter((c) => !rispostaVecchio(c).muto && rispostaNuovo(c).muto);
const soloN = elenco.filter((c) => rispostaVecchio(c).muto && !rispostaNuovo(c).muto);
const dueMuti = elenco.filter((c) => rispostaVecchio(c).muto && rispostaNuovo(c).muto);
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const eV = soloV.map((c) => Math.abs(rispostaVecchio(c).pos - c.posizioneVera));
const eN = soloN.map((c) => Math.abs(rispostaNuovo(c).pos - c.posizioneVera));
console.log(`4. solo il vecchio risponde: ${soloV.length} casi · mediana|e| ${mediana(eV)} · esatti ${eV.filter((x) => x === 0).length}`);
console.log(`   solo il nuovo risponde:   ${soloN.length} casi · mediana|e| ${mediana(eN)} · esatti ${eN.filter((x) => x === 0).length}`);
console.log(`   muti entrambi: ${dueMuti.length}`);

// —— 5. il cancello sulla mediana passa per pari merito?
const ent = elenco.filter((c) => !rispostaVecchio(c).muto && !rispostaNuovo(c).muto);
const av = ent.map((c) => Math.abs(rispostaVecchio(c).pos - c.posizioneVera));
const an = ent.map((c) => Math.abs(rispostaNuovo(c).pos - c.posizioneVera));
console.log(`5. lettura A mediana|e| vecchio ${mediana(av)} · nuovo ${mediana(an)}  (pari merito: ${mediana(av) === mediana(an)})`);
console.log(`   quartili |e| vecchio: ${[0.25, 0.5, 0.75, 0.9].map((q) => [...av].sort((a, b) => a - b)[Math.floor(q * (av.length - 1))]).join(' / ')}`);
console.log(`   quartili |e| nuovo:   ${[0.25, 0.5, 0.75, 0.9].map((q) => [...an].sort((a, b) => a - b)[Math.floor(q * (an.length - 1))]).join(' / ')}`);
// media dei ranghi: chi sbaglia di piu' quando sbaglia
console.log(`   media|e| vecchio ${(av.reduce((a, b) => a + b, 0) / av.length).toFixed(3)} · nuovo ${(an.reduce((a, b) => a + b, 0) / an.length).toFixed(3)}`);
