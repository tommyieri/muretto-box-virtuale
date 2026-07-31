// lente_causale_e_fattore.mjs — DUE controlli sulla lente della neutralizzazione.
//
// A) IL CAMPO E' DAVVERO PASSATO? La cella al giro L di un rivale che mi sta DIETRO
//    viene chiusa DOPO la mia: usarla sarebbe futuro di orologio, anche se l'indice
//    di giro dice "<= L". Qui la regola si restringe ai soli rivali che hanno chiuso
//    il giro L PRIMA di me (cum_time <= il mio), e si rimisura tutto.
//
// B) IL FATTORE DI NEUTRALIZZAZIONE. Il prior lo dichiara come BANDA (SC 0,40-0,60 ·
//    VSC 0,60-0,70) e il motore ne usa il centro (0,50 / 0,65). Qui si spazza la
//    banda, e oltre, sui casi in cui il regime al congelamento c'e' davvero.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_causale_e_fattore.mjs

import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { doveRientri } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';
import { regimeDiCella, regimeDelCampo } from './lente_neutralizzazione.mjs';
import { rispostaConRegime, erroreComune } from './lente_regime_dal_campo.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const riass = (errs) => ({
  n: errs.length, medAss: mediana(errs.map(Math.abs)),
  mediaAss: errs.length ? errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length : null,
  esatti: errs.filter((e) => e === 0).length, entro1: errs.filter((e) => Math.abs(e) <= 1).length,
  biasMed: mediana(errs), biasMedio: errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null,
});
const riga = (et, r) => `  ${et.padEnd(30)} n=${String(r.n).padStart(3)} · |e| med ${r.medAss?.toFixed(1)} media ${r.mediaAss?.toFixed(2)} · esatti ${String(r.esatti).padStart(3)} (${((100 * r.esatti) / r.n).toFixed(1)}%) · entro1 ${((100 * r.entro1) / r.n).toFixed(1)}% · bias med ${r.biasMed?.toFixed(1)} medio ${r.biasMedio?.toFixed(2)}`;

/** Il campo al giro L, ristretto a chi ha chiuso quel giro PRIMA di me. */
function campoCausale(g, L, pilota) {
  const mio = g.perPilota.get(pilota)?.get(L)?.cum_time;
  if (typeof mio !== 'number') return { n: 0, tot: 0, frazione: 0, prevalente: 'SC' };
  let n = 0, tot = 0, sc = 0, vsc = 0;
  for (const [drv, celle] of g.perPilota) {
    if (drv === pilota) continue;
    const c = celle.get(L);
    if (!c || typeof c.cum_time !== 'number' || c.cum_time > mio) continue;
    tot += 1;
    const r = regimeDiCella(c);
    if (r === null) continue;
    n += 1; if (r === 'SC') sc += 1; else vsc += 1;
  }
  return { n, tot, frazione: tot ? n / tot : 0, prevalente: sc >= vsc ? 'SC' : 'VSC' };
}

// ── B) il fattore ───────────────────────────────────────────────────────────
/** doveRientri con il fattore di neutralizzazione forzato (perdita mia E dei rivali). */
function rispostaConFattore(caso, fattore) {
  const g = garaNuova(caso.gara);
  const mescola = mescolaAlGiro(g, caso.freezeLap, caso.pilota);
  if (mescola === null) return { muto: true };
  const base = contestoNuovo(caso.gara);
  const prior = { ...base.prior, fattori_neutralizzazione: { ...base.prior.fattori_neutralizzazione, SC: fattore.SC, VSC: fattore.VSC } };
  let r;
  try {
    r = doveRientri({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota,
                      giroPit: caso.pitLap, mescola }, { ...base, prior });
  } catch { return { muto: true }; }
  if (!r || r.approvato !== true || r.posizione == null) return { muto: true };
  const cum = {};
  for (const [drv, passi] of Object.entries(r.traccia ?? {})) {
    const p = passi?.find((x) => x.lap === caso.rientroLap);
    if (p) cum[drv] = p.cum_time;
  }
  const ordine = Object.keys(cum).sort((a, b) => (cum[a] - cum[b]) || (a < b ? -1 : 1));
  return { muto: false, pos: r.posizione, ordine, banda: r.banda_posizione,
           rivali: Object.keys(r.pits).length - 1 };
}

function main() {
  const elenco = casi();
  const arricchiti = elenco.map((k) => {
    const g = garaNuova(k.gara);
    const celle = g.perPilota.get(k.pilota);
    return {
      k, g,
      mioL: regimeDiCella(celle.get(k.freezeLap)),
      mioPit: regimeDiCella(celle.get(k.pitLap)),
      campo: regimeDelCampo(g, k.freezeLap),
      causale: campoCausale(g, k.freezeLap, k.pilota),
    };
  });

  // ═══ A · IL CAMPO CAUSALE ═══════════════════════════════════════════════
  console.log('═══ A · IL CAMPO RISTRETTO A CHI HA GIA\' CHIUSO IL GIRO L (niente futuro d\'orologio) ═══');
  const persi = arricchiti.filter((r) => r.mioPit !== null && r.mioL === null);
  console.log(`soste neutralizzate che il nuovo valuta in verde: ${persi.length}`);
  for (const s of [0.001, 0.25, 0.5]) {
    const largo = persi.filter((r) => r.campo.frazione >= s).length;
    const stretto = persi.filter((r) => r.causale.frazione >= s && r.causale.n >= 1).length;
    console.log(`  soglia ${(s * 100).toFixed(0).padStart(2)}% · campo intero ${String(largo).padStart(3)} recuperati · campo CAUSALE ${String(stretto).padStart(3)}`);
  }
  const eA = (k, v) => (v.muto ? null : v.pos - k.posizioneVera);
  const eB = (k, v) => (v.muto ? null : erroreComune(k, v.ordine));
  const copre = (k, v) => (v.muto || !v.banda ? null : k.posizioneVera >= v.banda.da && k.posizioneVera <= v.banda.a);

  for (const soglia of [0.25, 0.5]) {
    const accesi = arricchiti.filter((r) => r.mioL === null && r.causale.n >= 1 && r.causale.frazione >= soglia);
    const veri = accesi.filter((r) => r.mioPit !== null).length;
    const righe = [];
    for (const r of accesi) {
      const a = rispostaConRegime(r.k, null);
      const b = rispostaConRegime(r.k, r.causale.prevalente);
      if (a.muto || b.muto) continue;
      righe.push({ k: r.k, a, b });
    }
    console.log(`\nREGOLA CAUSALE, soglia ${(soglia * 100).toFixed(0)}%: accende ${accesi.length} casi · davvero neutralizzati ${veri} (${((100 * veri) / accesi.length).toFixed(1)}%) · misurabili ${righe.length}`);
    console.log(riga('  com\'e\' (lettura B)', riass(righe.map((x) => eB(x.k, x.a)).filter((v) => v !== null))));
    console.log(riga('  col campo causale (B)', riass(righe.map((x) => eB(x.k, x.b)).filter((v) => v !== null))));
    const ca = righe.map((x) => copre(x.k, x.a)).filter((v) => v !== null);
    const cb = righe.map((x) => copre(x.k, x.b)).filter((v) => v !== null);
    console.log(`  banda: ${ca.filter(Boolean).length}/${ca.length} -> ${cb.filter(Boolean).length}/${cb.length}`);
  }

  // il perimetro intero con la regola causale al 25%
  const tuttiA = [], tuttiB = [], copA = [], copB = [];
  let accesiTot = 0;
  for (const r of arricchiti) {
    const acceso = r.mioL === null && r.causale.n >= 1 && r.causale.frazione >= 0.25;
    if (acceso) accesiTot += 1;
    const a = rispostaConRegime(r.k, null);
    const b = acceso ? rispostaConRegime(r.k, r.causale.prevalente) : a;
    if (a.muto || b.muto) continue;
    tuttiA.push(eB(r.k, a)); tuttiB.push(eB(r.k, b));
    const x = copre(r.k, a), y = copre(r.k, b);
    if (x !== null) copA.push(x); if (y !== null) copB.push(y);
  }
  console.log(`\nPERIMETRO INTERO con la regola CAUSALE al 25% (accesi ${accesiTot}/${elenco.length})`);
  console.log(riga('com\'e\' (lettura B)', riass(tuttiA.filter((v) => v !== null))));
  console.log(riga('col campo causale (B)', riass(tuttiB.filter((v) => v !== null))));
  console.log(`  banda: ${copA.filter(Boolean).length}/${copA.length} (${((100 * copA.filter(Boolean).length) / copA.length).toFixed(1)}%) -> ${copB.filter(Boolean).length}/${copB.length} (${((100 * copB.filter(Boolean).length) / copB.length).toFixed(1)}%)`);

  // ═══ B · IL FATTORE ═════════════════════════════════════════════════════
  console.log('\n═══ B · IL FATTORE DI NEUTRALIZZAZIONE, SPAZZATO SULLA SUA BANDA ═══');
  const conRegime = arricchiti.filter((r) => r.mioL !== null);
  const sc = conRegime.filter((r) => r.mioL === 'SC').length;
  console.log(`casi col regime al congelamento: ${conRegime.length} (SC ${sc} · VSC ${conRegime.length - sc})`);
  const griglia = [
    { SC: 0.40, VSC: 0.60 }, { SC: 0.50, VSC: 0.65 }, { SC: 0.60, VSC: 0.70 },
    { SC: 0.75, VSC: 0.80 }, { SC: 0.90, VSC: 0.90 }, { SC: 1.00, VSC: 1.00 },
  ];
  for (const f of griglia) {
    const errsA = [], errsB = [], cop = [];
    for (const r of conRegime) {
      const v = rispostaConFattore(r.k, f);
      if (v.muto) continue;
      const a = eA(r.k, v), b = eB(r.k, v), c = copre(r.k, v);
      if (a !== null) errsA.push(a); if (b !== null) errsB.push(b); if (c !== null) cop.push(c);
    }
    const et = `SC ${f.SC.toFixed(2)} · VSC ${f.VSC.toFixed(2)}${f.SC === 0.5 ? '  <- in uso' : ''}`;
    console.log(riga(et, riass(errsB)) + ` · banda ${cop.filter(Boolean).length}/${cop.length}`);
  }

  // ═══ C · I RIVALI ASSUNTI ═══════════════════════════════════════════════
  console.log('\n═══ C · L\'ASSUNZIONE SULLE SOSTE DEI RIVALI, CONTATA CONTRO IL VERO ═══');
  let assunti = 0, assuntiVeri = 0, realiTot = 0, realiMancati = 0, casiConAssunzione = 0;
  for (const r of conRegime) {
    const v = rispostaConRegime(r.k, null);
    if (v.muto) continue;
    const miei = Object.keys(v.pits).filter((d) => d !== r.k.pilota);
    if (miei.length) casiConAssunzione += 1;
    assunti += miei.length;
    // chi si e' fermato DAVVERO al giro della sosta (in_lap al giro Li)
    const veri = new Set();
    for (const [drv, celle] of r.g.perPilota) {
      if (drv === r.k.pilota) continue;
      if (celle.get(r.k.pitLap)?.in_lap === true) veri.add(drv);
    }
    realiTot += veri.size;
    for (const d of miei) if (veri.has(d)) assuntiVeri += 1;
    for (const d of veri) if (!miei.includes(d)) realiMancati += 1;
  }
  console.log(`  casi col regime al congelamento e almeno un rivale assunto: ${casiConAssunzione}/${conRegime.length}`);
  console.log(`  rivali ASSUNTI in sosta: ${assunti} · di questi si sono fermati davvero ${assuntiVeri} (${((100 * assuntiVeri) / assunti).toFixed(1)}%)`);
  console.log(`  rivali che si sono fermati DAVVERO al giro della sosta: ${realiTot} · non assunti dal motore ${realiMancati} (${((100 * realiMancati) / realiTot).toFixed(1)}%)`);
}

main();
