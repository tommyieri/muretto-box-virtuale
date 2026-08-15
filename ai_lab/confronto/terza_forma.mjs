// terza_forma.mjs — I CANCELLI DI PREREG_terza_forma.md.
//
//     node ai_lab/confronto/terza_forma.mjs [--json] [--placebo N]
//
// La terza forma fa pagare la contrazione dei distacchi al CAPOFILA invece che agli
// inseguitori. Stessa legge, stesso kappa, stesso perimetro: cambia l'ancora.
//
// Sei cancelli, e T1 e' quello che i sei della riparazione precedente non avevano —
// misuravano cio' che il pavimento doveva togliere, non cio' che poteva rompere.
//
// NON SCRIVE NIENTE su disco e non accende niente: i numeri di produzione restano
// bit-identici finche' T4 non dice altro. I cancelli stanno nella prereg.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gare, garaNuova, RADICE } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, mediana } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const iPlac = process.argv.indexOf('--placebo');
const N_PLACEBO = iPlac >= 0 ? Number(process.argv[iPlac + 1]) : 0;
const SEME = 20260815;
const B_BOOT = 2000;

const pavimenti = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'pavimenti_2026.json'), 'utf8'));
const soffitti = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'soffitti_2026.json'), 'utf8'));
const limiti = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'priors', 'director_limiti.json'), 'utf8'));
const MARGINE = limiti.margine_pavimento_s.valore;

function rnd(seme) {
  let a = seme >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// test dei segni a due code, esatto (binomiale con p = 1/2 sui non pari)
function segni(a, b) {
  let piu = 0; let meno = 0;
  for (let i = 0; i < a.length; i += 1) { if (a[i] < b[i]) piu += 1; else if (a[i] > b[i]) meno += 1; }
  const n = piu + meno;
  if (n === 0) return { piu, meno, p: null };
  const logFat = (k) => { let s = 0; for (let i = 2; i <= k; i += 1) s += Math.log(i); return s; };
  let coda = 0;
  const k = Math.min(piu, meno);
  for (let i = 0; i <= k; i += 1) coda += Math.exp(logFat(n) - logFat(i) - logFat(n - i) - n * Math.LN2);
  return { piu, meno, p: Number(Math.min(1, 2 * coda).toFixed(6)) };
}

// ── il perimetro comune: le 11 gare, il regime VERO, e per ogni gara le finestre ──
const dati = [];
for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const giri = Object.keys(neutraVera).map(Number).sort((a, b) => a - b);
  if (!giri.length) continue;
  // L* = ultimo giro neutralizzato; L0 = primo giro della corsa consecutiva che finisce li'
  const stella = giri[giri.length - 1];
  let l0 = stella;
  while (neutraVera[l0 - 1]) l0 -= 1;
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  dati.push({ gara: nomeSito, gSim, neutraVera, giriNeutri: giri, stella, l0, ritiriVeri, piani: pianiVeriDi(nomeSito) });
}

// ── LARGHEZZA DEL CAMPO ──────────────────────────────────────────────────────
// W(L) = max(cum) − min(cum) fra le auto attive SIA nel motore SIA nella realta'.
// Il perimetro comune e' la meta' della definizione: su popolazioni diverse
// vincerebbe la piu' fortunata.
function larghezza(gSim, traccia, lap) {
  const veri = []; const motore = [];
  for (const [drv, passi] of Object.entries(traccia ?? {})) {
    if (!Array.isArray(passi)) continue;
    const m = passi.find((p) => p.lap === lap);
    const v = gSim.perPilota.get(drv)?.get(lap)?.cum_time;
    if (!m || !Number.isFinite(m.cum_time) || !Number.isFinite(v)) continue;
    veri.push(v); motore.push(m.cum_time);
  }
  if (veri.length < 3) return null;
  return { vero: Math.max(...veri) - Math.min(...veri), motore: Math.max(...motore) - Math.min(...motore), n: veri.length };
}

/** Un caso rappresentativo per gara, con traccia: il primo pilota giocabile. */
function casoConTraccia(d, opzioni) {
  for (const x of perGara(d.gara)) {
    const t = corri(d.gara, x.pilota, {
      pianiRivali: d.piani, ritiriRivali: d.ritiriVeri, neutralizzazioneVera: d.neutraVera,
      conTraccia: true, ...opzioni,
    });
    if (!t.saltato) return t;
  }
  return null;
}

// ── T1 · la larghezza del campo ──────────────────────────────────────────────
const T1 = [];
for (const d of dati) {
  const seconda = casoConTraccia(d, {});
  const terza = casoConTraccia(d, { formaCompressione: 'leader' });
  if (!seconda || !terza) continue;
  const a = larghezza(d.gSim, seconda.traccia, d.stella);
  const b = larghezza(d.gSim, terza.traccia, d.stella);
  const prima = larghezza(d.gSim, seconda.traccia, d.l0 - 1);
  if (!a || !b) continue;
  // il criterio «la realta' COMPATTA» e' definito sui SOLI dati veri: non e' spostabile
  const compatta = prima && a.vero > 0 ? prima.vero / a.vero >= 3 : false;
  T1.push({
    gara: d.gara, l0: d.l0, stella: d.stella, n_auto: a.n,
    vero_prima: prima ? Number(prima.vero.toFixed(1)) : null,
    vero: Number(a.vero.toFixed(1)),
    seconda: Number(a.motore.toFixed(1)), terza: Number(b.motore.toFixed(1)),
    r_seconda: Number((a.motore / a.vero).toFixed(2)), r_terza: Number((b.motore / a.vero).toFixed(2)),
    compatta,
  });
}
// LA POPOLAZIONE DI T1a. La prereg dichiara DUE cose che qui divergono: un criterio
// meccanico (W_vero(L0-1)/W_vero(L*) >= 3) e l'elenco esplicito delle cinque gare
// dell'autopsia. Divergono su MIAMI, la cui finestra comincia al giro 1: non esiste un
// «giro prima», quindi il criterio non puo' valutarla. Vince l'elenco esplicito — e' la
// dichiarazione piu' specifica — e si riportano ENTRAMBE le letture, perche' spostare
// una popolazione dopo aver visto i numeri e' esattamente cio' che la regola 3 vieta.
const NOMINATE = new Set(['Monaco', 'Gran Bretagna', 'Cina', 'Giappone', 'Miami']);
const compattanti = T1.filter((x) => NOMINATE.has(x.gara));
const ferme = T1.filter((x) => !NOMINATE.has(x.gara));
const compattantiCriterio = T1.filter((x) => x.compatta);
const T1a = {
  gare: compattanti.map((x) => x.gara),
  sotto_2: compattanti.filter((x) => x.r_terza < 2).length, su: compattanti.length,
  meglio_di_seconda: compattanti.filter((x) => x.r_terza < x.r_seconda).length,
  esito: null,
};
T1a.esito = (T1a.sotto_2 >= 3 && T1a.meglio_di_seconda === T1a.su) ? 'VERDE' : 'ROSSO';
T1a.lettura_criterio = {
  gare: compattantiCriterio.map((x) => x.gara),
  sotto_2: compattantiCriterio.filter((x) => x.r_terza < 2).length, su: compattantiCriterio.length,
  meglio_di_seconda: compattantiCriterio.filter((x) => x.r_terza < x.r_seconda).length,
};
T1a.guadagno_mediano = Number((mediana(compattanti.map((x) => x.r_seconda / x.r_terza))).toFixed(2));
const T1b = {
  gare: ferme.map((x) => x.gara),
  oltre_1_5: ferme.filter((x) => x.r_terza > 1.5).map((x) => `${x.gara} ${x.r_terza}`),
  esito: null,
};
T1b.esito = T1b.oltre_1_5.length === 0 ? 'VERDE' : 'ROSSO';

// ── T2/T3/T4 · la corsa completa, tutti i piloti giocabili, le due forme ─────
const casi = [];
for (const d of dati) {
  const pav = pavimenti.gares?.[d.gara] ?? pavimenti.gare[d.gara];
  const sof = soffitti.gare[d.gara];
  const pavimento = pav?.pavimento_s == null ? null : pav.pavimento_s - MARGINE;
  const soffitto = sof?.soffitto_s ?? null;
  for (const x of perGara(d.gara)) {
    const base = { pianiRivali: d.piani, ritiriRivali: d.ritiriVeri, neutralizzazioneVera: d.neutraVera, conTraccia: true };
    const a = corri(d.gara, x.pilota, base);
    if (a.saltato) continue;
    const b = corri(d.gara, x.pilota, { ...base, formaCompressione: 'leader' });
    if (b.saltato) continue;          // STESSI casi per le due forme, sempre
    const conta = (t) => {
      let sotto = 0; let sopra = 0; let sopraNeutri = 0; let neg = 0; let n = 0;
      for (const passi of Object.values(t.traccia ?? {})) {
        if (!Array.isArray(passi)) continue;   // un ritirato porta null, non un elenco
        for (const p of passi) {
          if (!Number.isFinite(p.lap_time)) continue;
          n += 1;
          if (p.lap_time < 0) neg += 1;
          if (pavimento !== null && p.lap_time < pavimento) sotto += 1;
          if (soffitto !== null && p.lap_time > soffitto) {
            sopra += 1;
            // LA SOTTO-CONTA CHE IL CANCELLO AVREBBE DOVUTO CHIEDERE. Il soffitto e' il
            // giro piu' lento sotto NEUTRALIZZAZIONE e il kernel lo applica solo li':
            // T3 l'ho scritto su tutta la gara, quindi conta anche gli in-lap in verde
            // (Ungheria: 86 s di verde + 20 di sosta contro un soffitto di 106,9). Il
            // cancello resta com'e' — non si riscrive dopo averne visto l'esito — e
            // questa riga dice qual e' il numero che rispondeva alla domanda.
            if (d.neutraVera[p.lap]) sopraNeutri += 1;
          }
        }
      }
      return { sotto, sopra, sopraNeutri, neg, n };
    };
    casi.push({
      gara: d.gara, pilota: x.pilota,
      err_seconda: a.errore, err_terza: b.errore, err_nullo: a.errore_nullo,
      c2: conta(a), c3: conta(b),
      clamp_pav_2: a.clamp_pavimento, clamp_pav_3: b.clamp_pavimento,
      clamp_sof_3: b.clamp_soffitto, coppie_3: b.coppie_compresse,
    });
  }
}

const somma = (f) => casi.reduce((s, c) => s + f(c), 0);
const T2 = {
  giri_sotto_pavimento_seconda: somma((c) => c.c2.sotto),
  giri_sotto_pavimento_terza: somma((c) => c.c3.sotto),
  giri_negativi_terza: somma((c) => c.c3.neg),
  clamp_pavimento_terza: somma((c) => c.clamp_pav_3 ?? 0),
  esito: null,
};
T2.esito = (T2.giri_sotto_pavimento_terza === 0 && T2.giri_negativi_terza === 0 && T2.clamp_pavimento_terza === 0) ? 'VERDE' : 'ROSSO';
const coppieTot = somma((c) => c.coppie_3 ?? 0);
const clampSof = somma((c) => c.clamp_sof_3 ?? 0);
const T3 = {
  // L'ATTRIBUZIONE, e senza di lei il cancello non si legge: un giro gia' oltre il
  // soffitto nella SECONDA forma non e' un danno della terza.
  giri_sopra_soffitto_seconda: somma((c) => c.c2.sopra),
  giri_sopra_soffitto_terza: somma((c) => c.c3.sopra),
  sui_soli_giri_compressi: { seconda: somma((c) => c.c2.sopraNeutri), terza: somma((c) => c.c3.sopraNeutri) },
  coppie_compresse: coppieTot, clamp_soffitto: clampSof,
  quota_clamp: coppieTot ? Number((clampSof / coppieTot * 100).toFixed(1)) : null,
  esito: null, trattenuto: null,
};
T3.giri_sopra_soffitto_nuovi = T3.giri_sopra_soffitto_terza - T3.giri_sopra_soffitto_seconda;
T3.esito = T3.giri_sopra_soffitto_terza === 0 ? 'VERDE' : 'ROSSO';
T3.trattenuto = T3.quota_clamp !== null && T3.quota_clamp > 20;

// T4 — l'errore di posizione alla bandiera, sugli STESSI casi
// L'ERRORE E' IL VALORE ASSOLUTO, ed e' la convenzione di tutto il repo (`errore` e'
// `pos - posVera`, segnato: gara_intera.mjs e banco_regole.mjs lo prendono in modulo).
// La prima scrittura di questo banco usava il segnato e dava mediana 0 su tutte e tre
// le colonne: e' la famiglia E08, una metrica mal specificata che non fallisce mai.
const e2 = casi.map((c) => Math.abs(c.err_seconda));
const e3 = casi.map((c) => Math.abs(c.err_terza));
const s4 = segni(e3, e2);          // «+» = la terza sbaglia meno
const r4 = rnd(SEME);
const perGaraCasi = {};
for (const c of casi) (perGaraCasi[c.gara] ??= []).push(c);
const chiavi = Object.keys(perGaraCasi);
const boot = [];
for (let i = 0; i < B_BOOT; i += 1) {
  const u = [];
  for (let j = 0; j < chiavi.length; j += 1) u.push(...perGaraCasi[chiavi[Math.floor(r4() * chiavi.length)]]);
  boot.push(mediana(u.map((c) => Math.abs(c.err_terza) - Math.abs(c.err_seconda))));
}
boot.sort((a, b) => a - b);
const at = (p) => boot[Math.min(boot.length - 1, Math.max(0, Math.floor(p * boot.length)))];
const T4 = {
  n_casi: casi.length,
  mediana_seconda: mediana(e2), mediana_terza: mediana(e3), mediana_nullo: mediana(casi.map((c) => Math.abs(c.err_nullo))),
  bias_seconda: Number((casi.reduce((a, c) => a + c.err_seconda, 0) / casi.length).toFixed(3)),
  bias_terza: Number((casi.reduce((a, c) => a + c.err_terza, 0) / casi.length).toFixed(3)),
  media_seconda: Number((e2.reduce((a, b) => a + b, 0) / e2.length).toFixed(3)),
  media_terza: Number((e3.reduce((a, b) => a + b, 0) / e3.length).toFixed(3)),
  segni_terza_meglio: s4.piu, segni_seconda_meglio: s4.meno, p: s4.p,
  ic95_differenza_mediana: [Number(at(0.025).toFixed(3)), Number(at(0.975).toFixed(3))],
  casi_che_cambiano: casi.filter((c) => c.err_terza !== c.err_seconda).length,
  non_inferiore: null, superiore: null,
};
T4.non_inferiore = T4.mediana_terza <= T4.mediana_seconda && !(s4.meno > s4.piu && s4.p !== null && s4.p < 0.05);
T4.superiore = s4.piu > s4.meno && s4.p !== null && s4.p < 0.05;

// ── T5 · il placebo: la stessa forma su giri VERDI a caso ────────────────────
// Tiene costante QUANTO tempo si aggiunge e muove solo DOVE. Se il placebo riproduce
// il guadagno, l'effetto e' «aggiungere tempo», non «compattare sotto Safety Car».
let T5 = { n: 0, nota: 'non eseguito (--placebo N)' };
if (N_PLACEBO > 0) {
  const r5 = rnd(SEME);
  const finteT1 = [];
  for (let i = 0; i < N_PLACEBO; i += 1) {
    const rapporti = [];
    for (const d of dati) {
      if (!T1.find((x) => x.gara === d.gara && x.compatta)) continue;
      const regimi = d.giriNeutri.map((g) => d.neutraVera[g]);
      const verdi = [];
      for (let l = 1; l <= d.gSim.nGiri; l += 1) if (!d.neutraVera[l]) verdi.push(l);
      if (verdi.length < regimi.length) continue;
      for (let k = verdi.length - 1; k > 0; k -= 1) { const q = Math.floor(r5() * (k + 1)); [verdi[k], verdi[q]] = [verdi[q], verdi[k]]; }
      const finta = {};
      verdi.slice(0, regimi.length).forEach((l, k) => { finta[l] = regimi[k]; });
      const t = casoConTraccia({ ...d, neutraVera: finta }, { formaCompressione: 'leader' });
      if (!t) continue;
      const w = larghezza(d.gSim, t.traccia, d.stella);
      if (!w || !(w.vero > 0)) continue;
      rapporti.push(w.motore / w.vero);
    }
    if (rapporti.length) finteT1.push(mediana(rapporti));
  }
  finteT1.sort((a, b) => a - b);
  const veroT1 = mediana(compattanti.map((x) => x.r_terza));
  T5 = {
    n: finteT1.length,
    T1a_vero: Number(veroT1.toFixed(2)),
    T1a_finte_p05: finteT1.length ? Number(finteT1[Math.floor(0.05 * finteT1.length)].toFixed(2)) : null,
    T1a_finte_mediana: finteT1.length ? Number(mediana(finteT1).toFixed(2)) : null,
    esito: null,
  };
  // il rapporto va verso 1 dal basso o dall'alto: il vero deve essere PIU' VICINO a 1
  const dist = (x) => Math.abs(Math.log(x));
  const finteDist = finteT1.map(dist).sort((a, b) => a - b);
  T5.T1a_vero_distanza = Number(dist(veroT1).toFixed(3));
  T5.T1a_finte_p05_distanza = finteDist.length ? Number(finteDist[Math.floor(0.05 * finteDist.length)].toFixed(3)) : null;
  T5.esito = (T5.T1a_finte_p05_distanza !== null && T5.T1a_vero_distanza < T5.T1a_finte_p05_distanza) ? 'PULITO' : 'SPORCO';
}

const fuori = { T1: { righe: T1, T1a, T1b }, T2, T3, T4, T5 };

if (JSON_OUT) { console.log(JSON.stringify(fuori, null, 1)); } else {
  console.log('');
  console.log('  LA TERZA FORMA — PREREG_terza_forma.md');
  console.log('');
  console.log('  T1 · LA LARGHEZZA DEL CAMPO all\'ultimo giro neutralizzato');
  console.log('  gara            L*   vero prima → vero     seconda (×)      terza (×)');
  for (const x of [...T1].sort((a, b) => b.r_seconda - a.r_seconda)) {
    console.log(`  ${x.gara.padEnd(15)} ${String(x.stella).padStart(3)}  ${String(x.vero_prima).padStart(7)} → ${String(x.vero).padStart(6)}   ${String(x.seconda).padStart(7)} (${String(x.r_seconda).padStart(6)})  ${String(x.terza).padStart(7)} (${String(x.r_terza).padStart(6)})${x.compatta ? '   ← compatta' : ''}`);
  }
  console.log('');
  console.log(`  T1a  le cinque nominate: sotto 2,0 in ${T1a.sotto_2}/${T1a.su} · meglio della seconda in ${T1a.meglio_di_seconda}/${T1a.su} · guadagno mediano ${T1a.guadagno_mediano}×  → ${T1a.esito}`);
  console.log(`       (col criterio meccanico sono ${T1a.lettura_criterio.su} — Miami comincia al giro 1 e non ha un «giro prima»: sotto 2,0 in ${T1a.lettura_criterio.sotto_2}, meglio in ${T1a.lettura_criterio.meglio_di_seconda}/${T1a.lettura_criterio.su})`);
  console.log(`  T1b  dove NON compatta (${T1b.gare.length}): oltre 1,5 in ${T1b.oltre_1_5.length}${T1b.oltre_1_5.length ? ` (${T1b.oltre_1_5.join(' · ')})` : ''}  → ${T1b.esito}`);
  console.log('');
  console.log(`  T2  giri sotto il pavimento: seconda ${T2.giri_sotto_pavimento_seconda} · terza ${T2.giri_sotto_pavimento_terza} · negativi ${T2.giri_negativi_terza} · clamp ${T2.clamp_pavimento_terza}  → ${T2.esito}`);
  console.log(`  T3  giri sopra il soffitto: seconda ${T3.giri_sopra_soffitto_seconda} · terza ${T3.giri_sopra_soffitto_terza} (nuovi ${T3.giri_sopra_soffitto_nuovi}) · sui SOLI giri compressi: ${T3.sui_soli_giri_compressi.seconda} → ${T3.sui_soli_giri_compressi.terza} · il soffitto lega ${T3.clamp_soffitto}/${T3.coppie_compresse} (${T3.quota_clamp}%)  → ${T3.esito}${T3.trattenuto ? ' · TRATTENUTO DALLA GUARDIA' : ''}`);
  console.log('');
  console.log(`  T4  ${T4.n_casi} casi (la terza forma ne cambia l'arrivo in ${T4.casi_che_cambiano}) · errore mediano: nullo ${T4.mediana_nullo} · seconda ${T4.mediana_seconda} · terza ${T4.mediana_terza}`);
  console.log(`      media: seconda ${T4.media_seconda} · terza ${T4.media_terza} · bias segnato ${T4.bias_seconda} → ${T4.bias_terza}`);
  console.log(`      segni: terza meglio ${T4.segni_terza_meglio} · seconda meglio ${T4.segni_seconda_meglio} · p = ${T4.p}`);
  console.log(`      IC95 della differenza mediana (blocchi = gare): [${T4.ic95_differenza_mediana.join(' ; ')}]`);
  console.log(`      non-inferiorita' ${T4.non_inferiore ? 'SI' : 'NO'} · superiorita' ${T4.superiore ? 'SI' : 'NO'}`);
  if (T5.n) {
    console.log('');
    console.log(`  T5  placebo su ${T5.n} estrazioni: vero ${T5.T1a_vero}× (distanza da 1: ${T5.T1a_vero_distanza}) · finte mediana ${T5.T1a_finte_mediana}× (5° percentile della distanza: ${T5.T1a_finte_p05_distanza})  → ${T5.esito}`);
  }
  console.log('');
}
