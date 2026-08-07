// test_ese.mjs — il banco della pagina «E se?» (ese.mjs), eseguibile in Node.
//
// COSA FA FALLIRE QUESTO TEST:
//  (a) la derivazione delle soste vere sbaglia il caso verificato a mano
//      (Australia/LEC: in-lap 25, gomma nuova HARD letta dall'out-lap 26);
//  (b) l'arrivo reale derivato non è una permutazione 1..n, o contraddice
//      esiti.json (un «pieno_giro» che non ha percorso tutti i giri);
//  (c) la pipeline intera (preparaGara → scegliCongelamento → rigioca) non
//      produce un run approvato dal Director sulla strategia vera;
//  (d) A/A: una strategia DIVERSA produce lo stesso identico cumulato del
//      soggetto — i bracci non si distinguono e il "rigioca" non rigioca;
//  (e) l'assunzione SOSTE_VERE_DEI_RIVALI non compare nel run: la pagina
//      girerebbe senza dichiarare l'informazione dal futuro (la condizione
//      della deroga s25).
//  (f) l'onestà sparisce dalla pagina: ese.html non rende più il blocco
//      sempre-visibile («informazione dal futuro», «non una previsione»).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { byLapDa, sosteVereDa, arrivoRealeDa, preparaGara, scegliCongelamento, rigioca } from './ese.mjs';

const qui = path.dirname(fileURLToPath(import.meta.url));
let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`test_ese FALLITA — ${msg}`); };
const leggi = (rel) => JSON.parse(readFileSync(path.join(qui, rel), 'utf8'));

// (a) — il caso verificato a mano
const australia = leggi('data/Australia.json');
australia.byLap = byLapDa(australia);
{
  const s = sosteVereDa(australia);
  const lec = JSON.stringify(s.LEC);
  if (lec !== JSON.stringify([{ giro: 25, mescola: 'HARD' }])) {
    fallisci(`soste vere di LEC in Australia: atteso [{giro:25, mescola:'HARD'}], ottenuto ${lec}`);
  }
}

// (b) — arrivo reale: permutazione, e coerenza con esiti.json
{
  const arrivo = arrivoRealeDa(australia);
  const posizioni = arrivo.map((r) => r.posizione);
  const attese = arrivo.map((_, i) => i + 1);
  if (JSON.stringify(posizioni) !== JSON.stringify(attese)) fallisci('le posizioni derivate non sono 1..n contigue');
  const esiti = leggi('data/esiti.json').Australia ?? {};
  const nGiri = australia.n_laps;
  if (arrivo[0].giri !== nGiri) fallisci(`il vincitore derivato ha ${arrivo[0].giri}/${nGiri} giri`);
  for (const r of arrivo) {
    // Chi taglia il traguardo DOPO la bandiera chiude il lap chart a n−1 giri pur
    // essendo «pieno_giro» (osservato: 7 piloti in Australia). Sotto n−1 invece
    // la derivazione starebbe contraddicendo la fonte.
    if (esiti[r.drv] === 'pieno_giro' && r.giri < nGiri - 1) {
      fallisci(`${r.drv} è «pieno_giro» in esiti.json ma la derivazione gli dà ${r.giri}/${nGiri} giri`);
    }
  }
}

// (c) + (d) + (e) — la pipeline intera, e i bracci che si distinguono
{
  const fetchJson = async (u) => leggi(u.replace(/\?.*$/, ''));
  const prep = await preparaGara('Australia', { fetchJson });
  const pilota = 'LEC';
  const { freezeLap } = scegliCongelamento({ nome: prep.nome, contesto: prep.contesto, pilota });
  if (freezeLap === null) { fallisci('nessun congelamento utilizzabile per LEC in Australia'); }
  else {
    const vere = (prep.sosteVere[pilota] ?? []).filter((s) => s.giro > freezeLap && ['SOFT', 'MEDIUM', 'HARD'].includes(s.mescola));
    const runVero = rigioca({ nome: prep.nome, contesto: prep.contesto, pilota, freezeLap, soste: vere,
      sosteRivali: prep.sosteVere, nonClassificati: prep.nonClassificati, ritiriVeri: prep.ritiriVeri,
      neutraVera: prep.neutraVera });
    // (g) i ritirati veri escono al loro giro: ALO/BOT fuori da ordine, dentro ritirati
    for (const drv of ['ALO', 'BOT']) {
      if (runVero.risultato.ordine.includes(drv)) fallisci(`${drv} si ritiro' davvero ma sta ancora nella classifica simulata`);
      const rit = (runVero.risultato.ritirati ?? []).find((x) => x.drv === drv);
      if (!rit) fallisci(`${drv} non compare fra i ritirati del kernel`);
      else if (!(rit.lap > freezeLap && rit.lap < australia.n_laps)) fallisci(`${drv} ritirato a un giro implausibile: ${rit.lap}`);
    }
    if (!runVero.direttore.approved) {
      fallisci(`il Director respinge la strategia VERA di ${pilota}: ${JSON.stringify(runVero.direttore.violazioni?.filter((v) => v.severita === 'FATAL').map((v) => v.codice))}`);
    }
    if (!runVero.risultato.ordine.length) fallisci('il run non produce un ordine alla bandiera');
    if (!runVero.risultato.traccia?.[pilota]?.length) fallisci('il run non produce la traccia del soggetto');
    // (e) la deroga s25 pretende le assunzioni dichiarate: soste vere E finestre vere
    const codici = (runVero.scenario.assunzioni ?? []).map((a) => a.codice);
    if (!codici.includes('SOSTE_VERE_DEI_RIVALI')) {
      fallisci(`SOSTE_VERE_DEI_RIVALI non è fra le assunzioni del run: ${JSON.stringify(codici)}`);
    }
    if (!codici.includes('NEUTRALIZZAZIONE_VERA')) {
      fallisci(`NEUTRALIZZAZIONE_VERA non è fra le assunzioni (l'Australia ha giri SC veri): ${JSON.stringify(codici)}`);
    }
    // Il caso di confine trovato da questo banco (ritirati squalificati da REG01)
    // era gestito con la tacca «strategia non dichiarata»; dal 07/08 i ritiri VERI
    // fanno il passo intero — chi si ritiro' esce al suo giro e REG01 non lo
    // riguarda per costruzione (non completa). L'asserzione vive sopra, in (g).
    // (d) anti-A/A: spostare la sosta di 8 giri deve muovere il cumulato
    const spostate = vere.map((s) => ({ ...s, giro: Math.min(s.giro + 8, australia.n_laps - 1) }));
    const runAltro = rigioca({ nome: prep.nome, contesto: prep.contesto, pilota, freezeLap, soste: spostate,
      sosteRivali: prep.sosteVere, nonClassificati: prep.nonClassificati, ritiriVeri: prep.ritiriVeri,
      neutraVera: prep.neutraVera });
    if (runAltro.risultato.cum[pilota] === runVero.risultato.cum[pilota]) {
      fallisci('due strategie diverse producono lo stesso cumulato: i bracci non si distinguono (A/A)');
    }
  }
}

// (f) — l'onestà resa in pagina, sempre visibile — in TUTTE le pagine che rigiocano
{
  for (const pagina of ['ese.html', 'gara.html']) {
    const html = readFileSync(path.join(qui, pagina), 'utf8');
    if (!/informazione dal futuro/i.test(html)) fallisci(`${pagina} non dichiara più «informazione dal futuro»`);
    if (!/non una previsione/i.test(html)) fallisci(`${pagina} non dice più «non una previsione»`);
    if (!/class="ese-onesta"/.test(html)) fallisci(`${pagina}: il blocco di onestà sempre-visibile non c'è più`);
  }
  // l'E se? dentro la gara (08/08): bottone nel pannello pit + vista condivisa
  const gara = readFileSync(path.join(qui, 'gara.html'), 'utf8');
  if (!/id="eseBtn"/.test(gara)) fallisci('gara.html non offre più il bottone E se? nel pannello pit');
  if (!/ese_vista\.mjs/.test(gara)) fallisci('gara.html non usa la vista condivisa ese_vista.mjs');
}

if (errori === 0) console.log('test_ese: verde (soste vere, arrivo, pipeline, bracci distinti, assunzione dichiarata, onestà in pagina)');
process.exit(errori === 0 ? 0 : 1);
