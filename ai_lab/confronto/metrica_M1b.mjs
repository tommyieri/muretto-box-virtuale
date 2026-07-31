// metrica_M1b.mjs — M1: ERRORE DI POSIZIONE AL RIENTRO SULLE SOSTE VERE.
// Seconda misura indipendente (M1b). Usa SOLO il banco: ai_lab/confronto/banco.mjs.
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//
// Cosa fa, e perche' cosi':
//   1. per ognuno dei 274 casi chiede la risposta ai due motori (parametri di banco:
//      vecchio = evaluatePit con byLap TRONCATO e orizzonte 0; nuovo = doveRientri con
//      mescola al congelamento);
//   2. calcola l'errore in DUE LETTURE, entrambe pre-dichiarate qui prima di stampare:
//        LETTURA A (letterale, quella che la PREREG scrive): |pos − posizioneVera|,
//                  cioe' i due campi cosi' come il banco li consegna;
//        LETTURA B (popolazione comune): previsione e verita' RI-CLASSIFICATE
//                  sull'intersezione dei piloti che il motore ha simulato e che esistono
//                  nella classifica vera. Serve perche' `pos` e' un rango dentro una
//                  popolazione e le popolazioni dei due motori NON coincidono.
//        LETTURA B2 (terna comune): l'intersezione dei TRE insiemi (verita' ∩ vecchio ∩
//                  nuovo), calcolabile solo dove rispondono entrambi: e' il confronto
//                  piu' stretto possibile fra i due motori.
//   3. taglia i risultati per GARA (blocchi = gare, mai una media che le mescoli in
//      silenzio) e per REGIME al congelamento (verde / SC / VSC).
//   4. conta i MUTI a parte, con il motivo, e non li scarta per l'altro motore.
//
// Integrita' verificata dallo script stesso, non assunta:
//   - il `pos` dichiarato da ogni motore coincide col rango del pilota nel suo `ordine`;
//   - il `su` dichiarato coincide con la lunghezza del suo `ordine`.
//
//   node ai_lab/confronto/metrica_M1b.mjs           referto a schermo
//   node ai_lab/confronto/metrica_M1b.mjs --json    lo stesso, in JSON

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  casi, censimento, rispostaVecchio, rispostaNuovo, RADICE,
} from './banco.mjs';

// ————————————————————————————————— la verita', ricalcolata da capo (indipendente)
// Non mi fido del campo `posizioneVera` che il banco consegna: lo RIFACCIO leggendo
// demo/data/<gara>.json con codice mio. Se i due numeri divergessero, il referto lo dice
// prima di qualunque altra cosa. E' l'unico pezzo in cui questo script non passa dal banco.
function veritaRicalcolata(gara, pilota, rientroLap) {
  const G = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', `${gara}.json`), 'utf8'));
  const riga = G.laps.find((l) => l.lap === rientroLap);
  if (!riga) return null;
  const coppie = Object.entries(riga.cars)
    .filter(([, c]) => typeof c.cum_time === 'number')
    .map(([d, c]) => [d, c.cum_time])
    .sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
  const i = coppie.findIndex(([d]) => d === pilota);
  return i < 0 ? null : { pos: i + 1, su: coppie.length };
}

// ————————————————————————————————————————————————————————————— statistica
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const pct = (k, n) => (n ? (100 * k) / n : null);
const f1 = (x) => (x === null || x === undefined ? '  —  ' : x.toFixed(1));
const f2 = (x) => (x === null || x === undefined ? '  —  ' : x.toFixed(2));
const f3 = (x) => (x === null || x === undefined ? '  —  ' : x.toFixed(3));

/** Il riassunto di una lista di errori con segno. */
function riassunto(err) {
  const n = err.length;
  const abs = err.map(Math.abs);
  return {
    n,
    mediana_assoluto: mediana(abs),
    media_assoluto: media(abs),
    esatti: abs.filter((e) => e === 0).length,
    entro1: abs.filter((e) => e <= 1).length,
    entro2: abs.filter((e) => e <= 2).length,
    quota_esatti: pct(abs.filter((e) => e === 0).length, n),
    quota_entro1: pct(abs.filter((e) => e <= 1).length, n),
    quota_entro2: pct(abs.filter((e) => e <= 2).length, n),
    mediana_segno: mediana(err),
    media_segno: media(err),
    troppo_avanti: err.filter((e) => e < 0).length,   // previsto MIGLIORE del vero
    troppo_indietro: err.filter((e) => e > 0).length, // previsto PEGGIORE del vero
    max_assoluto: n ? Math.max(...abs) : null,
  };
}

// ————————————————————————————————————— rango dentro una popolazione ristretta
/** `sigle` in ordine di classifica; restituisce il rango di `pilota` fra i soli `dentro`. */
function rangoRistretto(sigle, dentro, pilota) {
  const f = sigle.filter((d) => dentro.has(d));
  const i = f.indexOf(pilota);
  return i < 0 ? null : { pos: i + 1, su: f.length };
}
const sigleDi = (ordine) => (ordine ? ordine.map((x) => (Array.isArray(x) ? x[0] : x)) : null);

// ————————————————————————————————————————————————————————————————— la misura
function misura() {
  const elenco = casi();
  const righe = [];
  const integrita = {
    vecchio_pos_incoerente: 0, vecchio_su_incoerente: 0,
    nuovo_pos_incoerente: 0, nuovo_su_incoerente: 0,
    vecchio_senza_ordine: 0, nuovo_senza_ordine: 0,
    esempi: [],
  };
  const muti = { vecchio: [], nuovo: [] };
  const controlloVerita = { confrontati: 0, divergenze_pos: 0, divergenze_su: 0, esempi: [] };

  for (const c of elenco) {
    // controllo indipendente della verita', su TUTTI i casi
    const vr = veritaRicalcolata(c.gara, c.pilota, c.rientroLap);
    controlloVerita.confrontati += 1;
    if (!vr || vr.pos !== c.posizioneVera) {
      controlloVerita.divergenze_pos += 1;
      if (controlloVerita.esempi.length < 5) controlloVerita.esempi.push({ id: c.id, banco: c.posizioneVera, mio: vr?.pos ?? null });
    }
    if (!vr || vr.su !== c.suQuantiVeri) controlloVerita.divergenze_su += 1;
    const V = rispostaVecchio(c);
    const N = rispostaNuovo(c);
    if (V.muto) muti.vecchio.push({ id: c.id, motivo: V.motivo });
    if (N.muto) muti.nuovo.push({ id: c.id, motivo: N.motivo });

    const sV = sigleDi(V.ordine);
    const sN = sigleDi(N.ordine);
    const vero = c.ordineVero;
    const setVero = new Set(vero);

    // — integrita': il `pos` dichiarato e' davvero il rango nel proprio `ordine`? —
    if (V.ok) {
      if (!sV) integrita.vecchio_senza_ordine += 1;
      else {
        const r = sV.indexOf(c.pilota) + 1;
        if (r !== V.pos) {
          integrita.vecchio_pos_incoerente += 1;
          if (integrita.esempi.length < 6) integrita.esempi.push({ id: c.id, motore: 'vecchio', pos: V.pos, rango_in_ordine: r });
        }
        if (sV.length !== V.su) integrita.vecchio_su_incoerente += 1;
      }
    }
    if (N.ok) {
      if (!sN) integrita.nuovo_senza_ordine += 1;
      else {
        const r = sN.indexOf(c.pilota) + 1;
        if (r !== N.pos) {
          integrita.nuovo_pos_incoerente += 1;
          if (integrita.esempi.length < 6) integrita.esempi.push({ id: c.id, motore: 'nuovo', pos: N.pos, rango_in_ordine: r });
        }
        if (sN.length !== N.su) integrita.nuovo_su_incoerente += 1;
      }
    }

    // — LETTURA A: i campi come li consegna il banco —
    const errAV = V.ok ? V.pos - c.posizioneVera : null;
    const errAN = N.ok ? N.pos - c.posizioneVera : null;

    // — LETTURA B: popolazione comune fra il motore e la verita' —
    let errBV = null, errBN = null, popBV = null, popBN = null;
    if (V.ok && sV) {
      const dentro = new Set(sV.filter((d) => setVero.has(d)));
      const p = rangoRistretto(sV, dentro, c.pilota);
      const t = rangoRistretto(vero, dentro, c.pilota);
      if (p && t) { errBV = p.pos - t.pos; popBV = dentro.size; }
    }
    if (N.ok && sN) {
      const dentro = new Set(sN.filter((d) => setVero.has(d)));
      const p = rangoRistretto(sN, dentro, c.pilota);
      const t = rangoRistretto(vero, dentro, c.pilota);
      if (p && t) { errBN = p.pos - t.pos; popBN = dentro.size; }
    }

    // — LETTURA B2: la terna comune (solo dove rispondono entrambi) —
    let errB2V = null, errB2N = null, popB2 = null;
    if (V.ok && N.ok && sV && sN) {
      const sSV = new Set(sV), sSN = new Set(sN);
      const dentro = new Set(vero.filter((d) => sSV.has(d) && sSN.has(d)));
      const t = rangoRistretto(vero, dentro, c.pilota);
      const pv = rangoRistretto(sV, dentro, c.pilota);
      const pn = rangoRistretto(sN, dentro, c.pilota);
      if (t && pv && pn) { errB2V = pv.pos - t.pos; errB2N = pn.pos - t.pos; popB2 = dentro.size; }
    }

    righe.push({
      id: c.id, gara: c.gara, pilota: c.pilota,
      freezeLap: c.freezeLap, pitLap: c.pitLap, rientroLap: c.rientroLap,
      regime: c.regimeAlCongelamento,               // 'SC' | 'VSC' | null  (<= L)
      neutralizzatoAlCongelamento: c.neutralizzato, // flag `neutralized` (<= L)
      neutralizzatoAlPit: c.neutralizzatoAlPit,     // FUTURO, diagnostica
      vera: c.posizioneVera, suVeri: c.suQuantiVeri,
      vOk: V.ok, vPos: V.pos, vSu: V.su, vMotivo: V.motivo,
      nOk: N.ok, nPos: N.pos, nSu: N.su, nMotivo: N.motivo,
      nBanda: N.banda ? [N.banda.da, N.banda.a, N.banda.contesto] : null,
      errAV, errAN, errBV, errBN, errB2V, errB2N, popBV, popBN, popB2,
    });
  }
  return { righe, integrita, muti, controlloVerita };
}

// ————————————————————————————————————————————————————— aggregazioni e stampa
const solo = (righe, campo) => righe.map((r) => r[campo]).filter((x) => x !== null && x !== undefined);

function blocco(righe, campoV, campoN) {
  return { vecchio: riassunto(solo(righe, campoV)), nuovo: riassunto(solo(righe, campoN)) };
}

function tabella(nome, R) {
  const riga = (et, s) => `    ${et.padEnd(9)} n=${String(s.n).padStart(3)}  mediana|err| ${f1(s.mediana_assoluto)}  media|err| ${f2(s.media_assoluto)}`
    + `  esatti ${String(s.esatti).padStart(3)} (${f1(s.quota_esatti)}%)  entro1 ${String(s.entro1).padStart(3)} (${f1(s.quota_entro1)}%)`
    + `  entro2 ${f1(s.quota_entro2)}%  bias mediano ${f1(s.mediana_segno)}  bias medio ${f2(s.media_segno)}  max ${s.max_assoluto ?? '—'}`;
  console.log(`  ${nome}`);
  console.log(riga('VECCHIO', R.vecchio));
  console.log(riga('NUOVO', R.nuovo));
}

function verdettoM1(R) {
  const v = R.vecchio, n = R.nuovo;
  const cond1 = n.mediana_assoluto <= v.mediana_assoluto;
  const cond2 = n.quota_esatti >= v.quota_esatti;
  return { cond_mediana: cond1, cond_esatti: cond2, passa: cond1 && cond2 };
}

function main() {
  const json = process.argv.includes('--json');
  const { righe, integrita, muti, controlloVerita } = misura();
  const cens = censimento();

  const entrambi = righe.filter((r) => r.vOk && r.nOk);
  const soloV = righe.filter((r) => r.vOk && !r.nOk);
  const soloN = righe.filter((r) => !r.vOk && r.nOk);
  const nessuno = righe.filter((r) => !r.vOk && !r.nOk);

  // — le tre letture sul set APPAIATO (dove rispondono entrambi): il confronto vero —
  const A = blocco(entrambi, 'errAV', 'errAN');
  const B = blocco(entrambi, 'errBV', 'errBN');
  const B2 = blocco(entrambi, 'errB2V', 'errB2N');
  // — e ciascun motore sul proprio insieme di risposta (copertura piena) —
  const Aproprio = { vecchio: riassunto(solo(righe.filter((r) => r.vOk), 'errAV')),
                     nuovo: riassunto(solo(righe.filter((r) => r.nOk), 'errAN')) };

  // — per gara (blocchi) —
  const gareOrdinate = [...new Set(righe.map((r) => r.gara))].sort();
  const perGara = {};
  for (const g of gareOrdinate) {
    const tutte = righe.filter((r) => r.gara === g);
    const app = tutte.filter((r) => r.vOk && r.nOk);
    perGara[g] = {
      casi: tutte.length,
      muti_vecchio: tutte.filter((r) => !r.vOk).length,
      muti_nuovo: tutte.filter((r) => !r.nOk).length,
      appaiati: app.length,
      A: blocco(app, 'errAV', 'errAN'),
      B: blocco(app, 'errBV', 'errBN'),
    };
  }

  // — il taglio richiesto: NEUTRALIZZAZIONE al congelamento (informazione <= L) —
  const verde = entrambi.filter((r) => r.regime === null && !r.neutralizzatoAlCongelamento);
  const sottoSC = entrambi.filter((r) => r.regime === 'SC');
  const sottoVSC = entrambi.filter((r) => r.regime === 'VSC');
  const sottoQualcosa = entrambi.filter((r) => r.regime !== null || r.neutralizzatoAlCongelamento);
  // — e il taglio col FUTURO (diagnostica: il vecchio in produzione lo legge) —
  const pitVerde = entrambi.filter((r) => !r.neutralizzatoAlPit);
  const pitNeutro = entrambi.filter((r) => r.neutralizzatoAlPit);

  const regimi = {
    verde: { n: verde.length, A: blocco(verde, 'errAV', 'errAN'), B: blocco(verde, 'errBV', 'errBN') },
    SC: { n: sottoSC.length, A: blocco(sottoSC, 'errAV', 'errAN'), B: blocco(sottoSC, 'errBV', 'errBN') },
    VSC: { n: sottoVSC.length, A: blocco(sottoVSC, 'errAV', 'errAN'), B: blocco(sottoVSC, 'errBV', 'errBN') },
    neutralizzato_qualunque: { n: sottoQualcosa.length, A: blocco(sottoQualcosa, 'errAV', 'errAN'), B: blocco(sottoQualcosa, 'errBV', 'errBN') },
    FUTURO_pit_verde: { n: pitVerde.length, A: blocco(pitVerde, 'errAV', 'errAN'), B: blocco(pitVerde, 'errBV', 'errBN') },
    FUTURO_pit_neutralizzato: { n: pitNeutro.length, A: blocco(pitNeutro, 'errAV', 'errAN'), B: blocco(pitNeutro, 'errBV', 'errBN') },
  };

  // — testa a testa caso per caso —
  const t2t = (cv, cn) => {
    const d = entrambi.filter((r) => r[cv] !== null && r[cn] !== null);
    return {
      n: d.length,
      vince_nuovo: d.filter((r) => Math.abs(r[cn]) < Math.abs(r[cv])).length,
      vince_vecchio: d.filter((r) => Math.abs(r[cn]) > Math.abs(r[cv])).length,
      pari: d.filter((r) => Math.abs(r[cn]) === Math.abs(r[cv])).length,
      identici: d.filter((r) => r[cn] === r[cv]).length,
    };
  };

  // — le popolazioni: quanto sono diverse? —
  const popolazioni = {
    su_vecchio_diverso_da_vero: entrambi.filter((r) => r.vSu !== r.suVeri).length,
    su_nuovo_diverso_da_vero: entrambi.filter((r) => r.nSu !== r.suVeri).length,
    tutti_e_tre_uguali: entrambi.filter((r) => r.vSu === r.suVeri && r.nSu === r.suVeri).length,
    mediana_su_vero: mediana(entrambi.map((r) => r.suVeri)),
    mediana_su_vecchio: mediana(entrambi.map((r) => r.vSu)),
    mediana_su_nuovo: mediana(entrambi.map((r) => r.nSu)),
    mediana_scarto_su_vecchio: mediana(entrambi.map((r) => r.vSu - r.suVeri)),
    mediana_scarto_su_nuovo: mediana(entrambi.map((r) => r.nSu - r.suVeri)),
    mediana_popolazione_B_vecchio: mediana(solo(entrambi, 'popBV')),
    mediana_popolazione_B_nuovo: mediana(solo(entrambi, 'popBN')),
    mediana_popolazione_B2: mediana(solo(entrambi, 'popB2')),
  };

  const motiviMuti = (lista) => {
    const m = {};
    for (const x of lista) {
      const k = x.motivo?.split(':')[0] ?? 'senza motivo';
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };

  // — la neutralizzazione: cosa si SA al congelamento e cosa succede DAVVERO alla sosta —
  const crossReg = { con_regime_al_congelamento_e_pit_neutro: 0, con_regime_al_congelamento_e_pit_verde: 0,
                     senza_regime_al_congelamento_e_pit_neutro: 0, senza_regime_al_congelamento_e_pit_verde: 0 };
  for (const r of entrambi) {
    const sa = r.regime !== null || r.neutralizzatoAlCongelamento;
    const poi = r.neutralizzatoAlPit;
    if (sa && poi) crossReg.con_regime_al_congelamento_e_pit_neutro += 1;
    else if (sa && !poi) crossReg.con_regime_al_congelamento_e_pit_verde += 1;
    else if (!sa && poi) crossReg.senza_regime_al_congelamento_e_pit_neutro += 1;
    else crossReg.senza_regime_al_congelamento_e_pit_verde += 1;
  }

  const out = {
    perimetro: { casi: righe.length, censimento: cens },
    controllo_verita_indipendente: controlloVerita,
    neutralizzazione_incrocio: crossReg,
    copertura: { entrambi: entrambi.length, solo_vecchio: soloV.length, solo_nuovo: soloN.length, nessuno: nessuno.length,
                 muti_vecchio: righe.length - righe.filter((r) => r.vOk).length,
                 muti_nuovo: righe.length - righe.filter((r) => r.nOk).length,
                 motivi_muti_vecchio: motiviMuti(muti.vecchio), motivi_muti_nuovo: motiviMuti(muti.nuovo) },
    integrita,
    popolazioni,
    appaiati: { n: entrambi.length, letturaA: A, letturaB: B, letturaB2: B2 },
    copertura_piena: Aproprio,
    verdetto: { letturaA: verdettoM1(A), letturaB: verdettoM1(B), letturaB2: verdettoM1(B2) },
    testa_a_testa: { letturaA: t2t('errAV', 'errAN'), letturaB: t2t('errBV', 'errBN'), letturaB2: t2t('errB2V', 'errB2N') },
    per_gara: perGara,
    regimi,
  };

  if (json) { console.log(JSON.stringify(out, null, 1)); return; }

  console.log('M1b — ERRORE DI POSIZIONE AL RIENTRO SULLE SOSTE VERE (seconda misura indipendente)\n');
  console.log(`PERIMETRO: ${righe.length} casi su ${cens.soste_reali_trovate} soste reali trovate.`);
  console.log(`  escluse: ${Object.entries(cens.esclusi).map(([k, v]) => `${k}=${v}`).join(' · ')}`);

  console.log(`\nCONTROLLO INDIPENDENTE DELLA VERITA' (ricalcolata da demo/data/<gara>.json con codice mio)`);
  console.log(`  casi ricalcolati ${controlloVerita.confrontati} · divergenze di posizione ${controlloVerita.divergenze_pos} · divergenze di ampiezza campo ${controlloVerita.divergenze_su}`);
  if (controlloVerita.esempi.length) console.log(`  esempi: ${JSON.stringify(controlloVerita.esempi)}`);

  console.log(`\nCOPERTURA (un caso muto NON si scarta per l'altro motore)`);
  console.log(`  rispondono entrambi : ${entrambi.length}`);
  console.log(`  solo il vecchio     : ${soloV.length}`);
  console.log(`  solo il nuovo       : ${soloN.length}`);
  console.log(`  muti tutti e due    : ${nessuno.length}`);
  console.log(`  MUTI vecchio ${out.copertura.muti_vecchio} · motivi: ${JSON.stringify(out.copertura.motivi_muti_vecchio)}`);
  console.log(`  MUTI nuovo   ${out.copertura.muti_nuovo} · motivi: ${JSON.stringify(out.copertura.motivi_muti_nuovo)}`);

  console.log(`\nINTEGRITA' (il \`pos\` dichiarato e' il rango nel proprio \`ordine\`?)`);
  console.log(`  vecchio: pos incoerenti ${integrita.vecchio_pos_incoerente} · su incoerenti ${integrita.vecchio_su_incoerente} · senza ordine ${integrita.vecchio_senza_ordine}`);
  console.log(`  nuovo  : pos incoerenti ${integrita.nuovo_pos_incoerente} · su incoerenti ${integrita.nuovo_su_incoerente} · senza ordine ${integrita.nuovo_senza_ordine}`);
  if (integrita.esempi.length) console.log(`  esempi: ${JSON.stringify(integrita.esempi)}`);

  console.log(`\nLE POPOLAZIONI NON COINCIDONO (per questo servono due letture)`);
  console.log(`  ampiezza mediana del campo: verita' ${popolazioni.mediana_su_vero} · vecchio ${popolazioni.mediana_su_vecchio} · nuovo ${popolazioni.mediana_su_nuovo}`);
  console.log(`  su(vecchio) != su(vero): ${popolazioni.su_vecchio_diverso_da_vero}/${entrambi.length} (scarto mediano ${popolazioni.mediana_scarto_su_vecchio})`);
  console.log(`  su(nuovo)   != su(vero): ${popolazioni.su_nuovo_diverso_da_vero}/${entrambi.length} (scarto mediano ${popolazioni.mediana_scarto_su_nuovo})`);
  console.log(`  tutti e tre uguali     : ${popolazioni.tutti_e_tre_uguali}/${entrambi.length}`);
  console.log(`  ampiezza mediana della popolazione comune: B vecchio ${popolazioni.mediana_popolazione_B_vecchio} · B nuovo ${popolazioni.mediana_popolazione_B_nuovo} · B2 ${popolazioni.mediana_popolazione_B2}`);

  console.log(`\n═══ M1 SUI ${entrambi.length} CASI IN CUI RISPONDONO ENTRAMBI (pool su 11 gare) ═══`);
  tabella("LETTURA A — |pos − posizioneVera|, i campi come li da' il banco", A);
  tabella('LETTURA B — previsione e verita\' ri-classificate sulla popolazione comune motore∩verita\'', B);
  tabella('LETTURA B2 — ri-classificate sulla terna comune verita\'∩vecchio∩nuovo', B2);

  console.log(`\n  CANCELLO M1 (mediana_nuovo <= mediana_vecchio  E  esatti%_nuovo >= esatti%_vecchio)`);
  for (const [k, v] of Object.entries(out.verdetto)) {
    console.log(`    ${k.padEnd(9)} mediana ${v.cond_mediana ? 'OK ' : 'NO '} · esatti ${v.cond_esatti ? 'OK ' : 'NO '} → ${v.passa ? 'IL NUOVO PASSA' : 'IL NUOVO NON PASSA'}`);
  }

  console.log(`\n  TESTA A TESTA, caso per caso (|errore| piu' piccolo)`);
  for (const [k, v] of Object.entries(out.testa_a_testa)) {
    console.log(`    ${k.padEnd(9)} n=${v.n}  vince nuovo ${v.vince_nuovo} · vince vecchio ${v.vince_vecchio} · pari ${v.pari} (di cui errore identico ${v.identici})`);
  }

  console.log(`\n═══ COPERTURA PIENA: ogni motore sul PROPRIO insieme di risposta (lettura A) ═══`);
  tabella(`vecchio n=${Aproprio.vecchio.n} · nuovo n=${Aproprio.nuovo.n}`, Aproprio);

  console.log(`\n═══ PER GARA (blocchi: nessuna media che le mescoli in silenzio) ═══`);
  console.log(`  gara              casi  mutiV mutiN  app | A: medV medN  esattiV%  esattiN% | B: medV medN  esattiV%  esattiN%`);
  let vinceNuovoGare = 0, vinceVecchioGare = 0, pariGare = 0;
  let vinceNuovoGareB = 0, vinceVecchioGareB = 0, pariGareB = 0;
  for (const g of gareOrdinate) {
    const p = perGara[g];
    const a = p.A, b = p.B;
    const dA = a.nuovo.mediana_assoluto - a.vecchio.mediana_assoluto;
    if (dA < 0) vinceNuovoGare += 1; else if (dA > 0) vinceVecchioGare += 1; else pariGare += 1;
    const dB = b.nuovo.mediana_assoluto - b.vecchio.mediana_assoluto;
    if (dB < 0) vinceNuovoGareB += 1; else if (dB > 0) vinceVecchioGareB += 1; else pariGareB += 1;
    console.log(`  ${g.padEnd(16)} ${String(p.casi).padStart(4)} ${String(p.muti_vecchio).padStart(6)} ${String(p.muti_nuovo).padStart(5)} ${String(p.appaiati).padStart(4)} |`
      + ` ${f1(a.vecchio.mediana_assoluto).padStart(5)} ${f1(a.nuovo.mediana_assoluto).padStart(5)}`
      + ` ${f1(a.vecchio.quota_esatti).padStart(7)}% ${f1(a.nuovo.quota_esatti).padStart(8)}% |`
      + ` ${f1(b.vecchio.mediana_assoluto).padStart(5)} ${f1(b.nuovo.mediana_assoluto).padStart(5)}`
      + ` ${f1(b.vecchio.quota_esatti).padStart(7)}% ${f1(b.nuovo.quota_esatti).padStart(8)}%`);
  }
  console.log(`  → gare vinte (mediana piu' bassa) lettura A: nuovo ${vinceNuovoGare} · vecchio ${vinceVecchioGare} · pari ${pariGare}`);
  console.log(`  → gare vinte (mediana piu' bassa) lettura B: nuovo ${vinceNuovoGareB} · vecchio ${vinceVecchioGareB} · pari ${pariGareB}`);

  console.log(`\n═══ IL TAGLIO: SOTTO NEUTRALIZZAZIONE contro VERDE ═══`);
  console.log(`  (regime al CONGELAMENTO, informazione <= L: e' quella che il nuovo usa e che`);
  console.log(`   il vecchio col byLap troncato NON ha piu'. E' il ramo dove le assunzioni sui`);
  console.log(`   rivali divergono di piu'.)`);
  console.log(`\n  INCROCIO: cosa si sa al congelamento contro cosa succede DAVVERO al giro della sosta`);
  console.log(`    regime al congelamento SI' → sosta neutralizzata ${crossReg.con_regime_al_congelamento_e_pit_neutro} · sosta in verde ${crossReg.con_regime_al_congelamento_e_pit_verde}`);
  console.log(`    regime al congelamento NO  → sosta neutralizzata ${crossReg.senza_regime_al_congelamento_e_pit_neutro} · sosta in verde ${crossReg.senza_regime_al_congelamento_e_pit_verde}`);
  for (const [k, v] of Object.entries(regimi)) {
    if (!v.n) { console.log(`\n  ${k}: 0 casi`); continue; }
    console.log('');
    tabella(`${k} (n=${v.n}) — lettura A`, v.A);
    tabella(`${k} (n=${v.n}) — lettura B`, v.B);
  }

  // ————————————————————————————————————— quanto e' solido lo scarto? —————————
  // Due prove, entrambe calcolate qui e non citate da altrove:
  //  1. TEST DEI SEGNI sul testa a testa (binomiale esatto, due code): la differenza fra
  //     «vince nuovo» e «vince vecchio» e' distinguibile da una moneta?
  //  2. BOOTSTRAP A BLOCCHI con le GARE come unita' (10.000 ricampionamenti, seme fisso):
  //     e' l'unico ricampionamento coerente con «blocchi = gare» della PREREG. Se lo scarto
  //     sparisce ricampionando le gare, e' il campione di UNA gara a portarlo, non il motore.
  const logFatt = (() => { const t = [0]; for (let i = 1; i <= 4000; i += 1) t[i] = t[i - 1] + Math.log(i); return t; })();
  function binomialeDueCode(k, n) {
    if (!n) return null;
    const lp = (i) => logFatt[n] - logFatt[i] - logFatt[n - i] - n * Math.log(2);
    const p0 = lp(k) + 1e-12;
    let s = 0;
    for (let i = 0; i <= n; i += 1) { const p = lp(i); if (p <= p0) s += Math.exp(p); }
    return Math.min(1, s);
  }
  const segni = {};
  for (const [k, v] of Object.entries(out.testa_a_testa)) {
    const n = v.vince_nuovo + v.vince_vecchio;
    segni[k] = { n_discordi: n, nuovo: v.vince_nuovo, vecchio: v.vince_vecchio, p_due_code: binomialeDueCode(v.vince_nuovo, n) };
  }

  let seme = 20260731 >>> 0;
  const rnd = () => { seme ^= seme << 13; seme >>>= 0; seme ^= seme >> 17; seme ^= seme << 5; seme >>>= 0; return seme / 4294967296; };
  function bootstrapGare(campoV, campoN, B = 10000) {
    const perG = gareOrdinate.map((g) => entrambi.filter((r) => r.gara === g && r[campoV] !== null && r[campoN] !== null));
    const usate = perG.filter((x) => x.length);
    const stat = (righeSel) => {
      const eV = righeSel.map((r) => Math.abs(r[campoV])), eN = righeSel.map((r) => Math.abs(r[campoN]));
      return {
        d_media: media(eN) - media(eV),
        d_esatti: pct(eN.filter((e) => e === 0).length, eN.length) - pct(eV.filter((e) => e === 0).length, eV.length),
        d_mediana: mediana(eN) - mediana(eV),
      };
    };
    const oss = stat(usate.flat());
    const dm = [], de = [], dmed = [];
    for (let b = 0; b < B; b += 1) {
      const sel = [];
      for (let i = 0; i < usate.length; i += 1) sel.push(...usate[Math.floor(rnd() * usate.length)]);
      const s = stat(sel);
      dm.push(s.d_media); de.push(s.d_esatti); dmed.push(s.d_mediana);
    }
    const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
    return {
      osservato: oss,
      IC95_d_media: [q(dm, 0.025), q(dm, 0.975)],
      IC95_d_esatti_punti: [q(de, 0.025), q(de, 0.975)],
      IC95_d_mediana: [q(dmed, 0.025), q(dmed, 0.975)],
      quota_bootstrap_in_cui_il_nuovo_ha_media_minore: pct(dm.filter((x) => x < 0).length, dm.length),
      quota_bootstrap_in_cui_il_nuovo_ha_piu_esatti: pct(de.filter((x) => x > 0).length, de.length),
    };
  }
  const boot = { letturaA: bootstrapGare('errAV', 'errAN'), letturaB: bootstrapGare('errBV', 'errBN'), letturaB2: bootstrapGare('errB2V', 'errB2N') };
  out.solidita = { test_dei_segni: segni, bootstrap_a_blocchi_gare: boot };

  console.log(`\n═══ QUANTO E' SOLIDO LO SCARTO? ═══`);
  console.log(`  TEST DEI SEGNI sui casi discordi (binomiale esatto, due code)`);
  for (const [k, v] of Object.entries(segni)) {
    console.log(`    ${k.padEnd(9)} nuovo ${String(v.nuovo).padStart(3)} · vecchio ${String(v.vecchio).padStart(3)} su ${String(v.n_discordi).padStart(3)} discordi → p = ${v.p_due_code === null ? '—' : v.p_due_code.toFixed(4)}`);
  }
  console.log(`  BOOTSTRAP A BLOCCHI, 11 gare ricampionate con reimmissione, 10.000 giri (seme fisso)`);
  for (const [k, v] of Object.entries(boot)) {
    console.log(`    ${k}`);
    console.log(`      Δmedia|err| (nuovo−vecchio) ${f3(v.osservato.d_media)}  IC95 [${f3(v.IC95_d_media[0])}, ${f3(v.IC95_d_media[1])}]  · il nuovo e' migliore nel ${f1(v.quota_bootstrap_in_cui_il_nuovo_ha_media_minore)}% dei ricampionamenti`);
    console.log(`      Δesatti (punti %)           ${f2(v.osservato.d_esatti)}  IC95 [${f2(v.IC95_d_esatti_punti[0])}, ${f2(v.IC95_d_esatti_punti[1])}] · il nuovo ha piu' esatti nel ${f1(v.quota_bootstrap_in_cui_il_nuovo_ha_piu_esatti)}% dei ricampionamenti`);
    console.log(`      Δmediana|err|               ${f2(v.osservato.d_mediana)}  IC95 [${f2(v.IC95_d_mediana[0])}, ${f2(v.IC95_d_mediana[1])}]`);
  }

  // ————————————————————————————————————————————— i muti, gara per gara ———————
  console.log(`\n═══ I MUTI, GARA PER GARA (chi tace e dove) ═══`);
  const mutiPerGara = {};
  for (const g of gareOrdinate) {
    const t = righe.filter((r) => r.gara === g);
    mutiPerGara[g] = { casi: t.length, muti_vecchio: t.filter((r) => !r.vOk).length, muti_nuovo: t.filter((r) => !r.nOk).length };
    if (mutiPerGara[g].muti_vecchio || mutiPerGara[g].muti_nuovo) {
      console.log(`  ${g.padEnd(16)} casi ${String(t.length).padStart(3)} · muti vecchio ${String(mutiPerGara[g].muti_vecchio).padStart(3)} · muti nuovo ${String(mutiPerGara[g].muti_nuovo).padStart(2)}`);
    }
  }
  out.muti_per_gara = mutiPerGara;
  console.log(`  ATTENZIONE: 35 dei 39 muti del vecchio sono di UNA gara (Monaco), dove restano 10 casi appaiati su 47.`);
  console.log(`  Monaco e' anche la gara con gli errori piu' bassi di entrambi: il pool ne riceve solo i 10 casi in cui il vecchio parla.`);

  // ————————————————————————————————————— istogramma degli errori con segno ——
  console.log(`\n═══ ISTOGRAMMA DEGLI ERRORI CON SEGNO (223 casi appaiati) ═══`);
  const istog = (campo) => {
    const m = new Map();
    for (const r of entrambi) { const e = r[campo]; if (e === null) continue; m.set(e, (m.get(e) ?? 0) + 1); }
    return m;
  };
  const iAV = istog('errAV'), iAN = istog('errAN'), iBV = istog('errBV'), iBN = istog('errBN');
  const chiavi = [...new Set([...iAV.keys(), ...iAN.keys(), ...iBV.keys(), ...iBN.keys()])].sort((a, b) => a - b);
  console.log(`  err   A:vecchio  A:nuovo | B:vecchio  B:nuovo      (err<0 = previsto MIGLIORE del vero)`);
  for (const k of chiavi) {
    console.log(`  ${String(k >= 0 ? `+${k}` : k).padStart(4)} ${String(iAV.get(k) ?? 0).padStart(9)} ${String(iAN.get(k) ?? 0).padStart(8)} | ${String(iBV.get(k) ?? 0).padStart(9)} ${String(iBN.get(k) ?? 0).padStart(8)}`);
  }
  out.istogramma = { A_vecchio: Object.fromEntries(iAV), A_nuovo: Object.fromEntries(iAN), B_vecchio: Object.fromEntries(iBV), B_nuovo: Object.fromEntries(iBN) };

  console.log(`\nNOTE OBBLIGATORIE (asimmetrie note, non correggibili in questa misura)`);
  console.log(`  · i due motori ricevono PIT-LOSS DIVERSI (tabella demo/data/pitloss.json contro il prior del nuovo): una fetta di ogni scarto e' la tabella, non il motore.`);
  console.log(`  · pit-loss 'realizzato' del vecchio su Gran Bretagna e Miami = informazione di gara col senno di poi; modello_v2.json e banda_rientro.json del nuovo sono calibrati su queste stesse 11 gare (in-sample). Circolarita' da entrambe le parti.`);
  console.log(`  · byLap TRONCATO al congelamento: e' cio' che il confronto richiede, e COSTA al vecchio (il banco misura 75/235 esatti troncato contro 82/235 intero).`);
  console.log(`  · col byLap troncato il vecchio non ha piu' alcun meccanismo di neutralizzazione, il nuovo si': il taglio 'sotto neutralizzazione' va letto sapendolo.`);
  console.log(`  · il perimetro esclude 'doppiato al rientro', cioe' proprio le soste che costano un giro.`);
}

main();
