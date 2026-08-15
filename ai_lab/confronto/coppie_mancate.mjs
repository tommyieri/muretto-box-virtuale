// coppie_mancate.mjs — LE 62 COPPIE CHE LA REALTA' SCAMBIA E IL MOTORE NO.
//
//     node ai_lab/confronto/coppie_mancate.mjs [--json]
//
// `ESITO_quali_coppie.md` (15/08) chiude con una domanda che si risponde CONTANDO, non
// ipotizzando: delle 82 coppie che la realta' scambia fra congelamento e bandiera, il
// motore ne prende 20 e ne manca 62. Quelle 62 sono il DUELLO — cioe' sorpassi in pista,
// il ramo che il progetto ha chiuso fuori campione su 78 gare — oppure no?
//
// Se lo fossero, l'arco si chiude: il motore e' conservativo perche' ha deciso di non
// simulare i sorpassi, e lo e' nella misura giusta. Se NON lo fossero, c'e' movimento che
// nessuna scelta dichiarata del progetto spiega.
//
// LA REGOLA DI CLASSIFICAZIONE, dichiarata prima di eseguire:
//
//   Per ogni coppia si trova l'ULTIMO giro in cui il loro ordine relativo cambia nella
//   realta' — quello dopo il quale non cambia piu', cioe' lo scambio che RESTA fino alla
//   bandiera. Poi quel giro si mette in uno dei tre secchi di `movimento_verde.mjs`, con
//   la stessa identica definizione:
//     · SUO CICLO    — A o B si e' fermato entro ±1 giro
//     · CICLO ALTRUI — si e' fermato qualcun altro entro ±1 giro, non loro due
//     · PISTA PURA   — nessuno si e' fermato entro ±1 giro  ← il duello
//   piu' un quarto secco che i tre non coprono:
//     · NEUTRALIZZATO — il giro cade in una finestra SC/VSC/rossa
//
// L'ultimo e non il primo: e' quello che determina lo stato finale, ed e' senza ambiguita'.
//
// IL CONTROLLO, che vale quanto la misura: la STESSA classificazione sulle 20 coppie che
// il motore AZZECCA. Se i due profili fossero uguali, il secchio non spiega la mancanza —
// e allora si dice, invece di raccontare la differenza che non c'e'.
//
// NON SCRIVE NIENTE su disco, non decide niente: e' un referto descrittivo.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');

const coppie = [];
for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  const piani = pianiVeriDi(nomeSito);
  let e = null;
  for (const x of perGara(nomeSito)) {
    const t = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
    });
    if (!t.saltato) { e = t; break; }
  }
  if (!e) continue;

  const lf = e.congelamento; const fine = e.n_giri;
  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  const cumV = {}; const cumM = {};
  for (const d of campo) {
    cumV[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumV[d][L] = c.cum_time;
    cumM[d] = {}; for (const p of e.traccia[d]) cumM[d][p.lap] = p.cum_time;
  }
  const vivi = campo.filter((d) => Number.isFinite(cumV[d][lf]) && Number.isFinite(cumV[d][fine]) && Number.isFinite(cumM[d][fine]));

  const sosteAlGiro = {};
  for (const r of perGara(nomeSito)) for (const s of r.soste_piano) (sosteAlGiro[s.giro] ||= new Set()).add(r.pilota);
  const secchioDi = (L, A, B) => {
    if (neutraVera[L]) return 'neutralizzato';
    let qualcuno = false; let loro = false;
    for (let x = L - 1; x <= L + 1; x += 1) {
      const s = sosteAlGiro[x];
      if (!s || !s.size) continue;
      qualcuno = true;
      if (s.has(A) || s.has(B)) loro = true;
    }
    return loro ? 'suo' : (qualcuno ? 'altrui' : 'pista');
  };

  for (let i = 0; i < vivi.length; i += 1) {
    for (let j = i + 1; j < vivi.length; j += 1) {
      const A = vivi[i]; const B = vivi[j];
      const primaA = cumV[A][lf] < cumV[B][lf];
      const veroFlip = primaA !== (cumV[A][fine] < cumV[B][fine]);
      const motFlip = primaA !== (cumM[A][fine] < cumM[B][fine]);
      if (!veroFlip) continue;                       // solo le coppie che la REALTA' scambia
      // l'ULTIMO giro in cui l'ordine relativo cambia nella realta'
      let ultimo = null; let stato = primaA;
      for (let L = lf + 1; L <= fine; L += 1) {
        const a = cumV[A][L]; const b = cumV[B][L];
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        const ora = a < b;
        if (ora !== stato) { ultimo = L; stato = ora; }
      }
      if (ultimo === null) continue;
      coppie.push({
        gara: nomeSito, A, B, lap: ultimo, presa: motFlip,
        secchio: secchioDi(ultimo, A, B),
      });
    }
  }
}

const SECCHI = ['suo', 'altrui', 'pista', 'neutralizzato'];
const conta = (v) => Object.fromEntries(SECCHI.map((s) => [s, v.filter((x) => x.secchio === s).length]));
const mancate = coppie.filter((x) => !x.presa);
const prese = coppie.filter((x) => x.presa);
const cM = conta(mancate); const cP = conta(prese);
const pct = (n, tot) => (tot ? Number((n / tot * 100).toFixed(1)) : null);

const fuori = {
  n_scambiate_dalla_realta: coppie.length,
  mancate: { n: mancate.length, ...cM, quote: Object.fromEntries(SECCHI.map((s) => [s, pct(cM[s], mancate.length)])) },
  prese: { n: prese.length, ...cP, quote: Object.fromEntries(SECCHI.map((s) => [s, pct(cP[s], prese.length)])) },
  per_gara: Object.values(coppie.reduce((acc, x) => {
    (acc[x.gara] ||= { gara: x.gara, mancate: 0, prese: 0, pista_mancate: 0 });
    if (x.presa) acc[x.gara].prese += 1; else { acc[x.gara].mancate += 1; if (x.secchio === 'pista') acc[x.gara].pista_mancate += 1; }
    return acc;
  }, {})),
  elenco: coppie,
};

if (JSON_OUT) { console.log(JSON.stringify(fuori, null, 1)); } else {
  console.log('');
  console.log('  LE COPPIE CHE LA REALTA\' SCAMBIA — dove cade lo scambio che RESTA');
  console.log('');
  console.log(`  ${coppie.length} coppie scambiate dalla realta': ${prese.length} prese dal motore, ${mancate.length} mancate`);
  console.log('');
  console.log('  secchio           MANCATE            PRESE');
  for (const s of SECCHI) {
    console.log(`  ${s.padEnd(16)} ${String(cM[s]).padStart(4)} (${String(fuori.mancate.quote[s]).padStart(5)}%)    ${String(cP[s]).padStart(3)} (${String(fuori.prese.quote[s]).padStart(5)}%)`);
  }
  console.log('');
  console.log('  per gara:');
  for (const r of fuori.per_gara) {
    console.log(`  ${r.gara.padEnd(15)} mancate ${String(r.mancate).padStart(2)} (di cui in pista pura ${r.pista_mancate}) · prese ${r.prese}`);
  }
  console.log('');
}
