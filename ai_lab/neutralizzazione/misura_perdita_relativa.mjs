// misura_perdita_relativa.mjs — V4 di PREREG_perdita_relativa.md: il metro relativo.
//
//     node ai_lab/neutralizzazione/misura_perdita_relativa.mjs
//
// perdita_relativa = (cum_d(L+1) − cum_d(L−1)) − mediana sui NON fermati dello
// stesso intervallo. La lentezza del giro si annulla per costruzione. Sanita'
// V4b VINCOLANTE e PRIMA del confronto V4a (la lezione di V3, cablata).
// Scrive ESITO_perdita_relativa.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const F = JSON.parse(readFileSync(path.join(QUI, 'frazioni_vsc_2026.json'), 'utf8'));
const PRIOR_VSC = 0.65;
const MIN_RIFERIMENTO = 6;
const RANGE_VERDE_S = [10, 35];

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const giudicabile = (c) => c && c.status !== null && c.del !== null;

const inFinestra = [];         // casi VSC: {gara, f, f_in, perdita}
const verdiPerGara = {};       // gara -> [perdite relative delle soste verdi]
let nonGiudicabili = 0;

for (const nome of gare()) {
  const fg = F.gare[nome];
  if (!fg) continue;
  const g = garaNuova(nome);
  const cumDi = (drv, lap) => {
    const c = g.perPilota.get(drv)?.get(lap);
    return (giudicabile(c) && Number.isFinite(c.cum_time)) ? c.cum_time : null;
  };
  const pittaIn = (drv, L) => {
    for (const lap of [L, L + 1]) {
      const c = g.perPilota.get(drv)?.get(lap);
      if (c && (c.in_lap === true || c.out_lap === true)) return true;
    }
    return false;
  };
  for (const [drv, celle] of g.perPilota) {
    for (const [lap, c] of celle) {
      if (c?.in_lap !== true) continue;
      const prima = cumDi(drv, lap - 1);
      const dopo = cumDi(drv, lap + 1);
      if (prima === null || dopo === null) continue;
      const fIn = fg.piloti[drv]?.[lap];
      const fOut = fg.piloti[drv]?.[lap + 1];
      if (!fIn) continue;
      const fVsc = ((fIn.f_vsc ?? 0) + (fOut?.f_vsc ?? 0)) / 2;
      const fSc = ((fIn.f_sc ?? 0) + (fOut?.f_sc ?? 0)) / 2;
      if (fSc > 0) continue;                                   // contaminazione SC: fuori
      // il riferimento: chi NON pitta nello stesso intervallo
      const rif = [];
      for (const [altro] of g.perPilota) {
        if (altro === drv || pittaIn(altro, lap)) continue;
        const p = cumDi(altro, lap - 1); const d = cumDi(altro, lap + 1);
        if (p !== null && d !== null) rif.push(d - p);
      }
      if (rif.length < MIN_RIFERIMENTO) { nonGiudicabili += 1; continue; }
      const perdita = (dopo - prima) - mediana(rif);
      if (fVsc > 0) inFinestra.push({ gara: nome, drv, lap, f: fVsc, f_in: fIn.f_vsc ?? 0, perdita: Number(perdita.toFixed(3)) });
      else (verdiPerGara[nome] ??= []).push(perdita);
    }
  }
}

const rifVerde = Object.fromEntries(Object.entries(verdiPerGara).map(([g, v]) => [g, { n: v.length, perdita: mediana(v) }]));

// ── V4b · LA SANITA' DEL METRO, vincolante e PRIMA del confronto ────────────
const gareUsate = [...new Set(inFinestra.map((c) => c.gara))];
const verdiFuoriOrdine = gareUsate.filter((g) => {
  const r = rifVerde[g];
  return !r || r.perdita === null || r.perdita < RANGE_VERDE_S[0] || r.perdita > RANGE_VERDE_S[1];
});
const casi = inFinestra.flatMap((s) => {
  const r = rifVerde[s.gara];
  if (!r || r.perdita === null || !(r.perdita > 0)) return [];
  const ratio = s.perdita / r.perdita;
  const pesato = 1 - (1 - PRIOR_VSC) * s.f;
  const binario = s.f_in > 0 ? PRIOR_VSC : 1;
  return [{ ...s, ratio: Number(ratio.toFixed(4)), att_pesato: Number(pesato.toFixed(4)), att_binario: binario,
    err_pesato: Number(Math.abs(ratio - pesato).toFixed(4)), err_binario: Number(Math.abs(ratio - binario).toFixed(4)) }];
});
const binDi = (f) => (f >= 0.9 ? 'pieni' : f >= 0.5 ? 'alti' : 'bassi');
const perBin = {};
for (const c of casi) (perBin[binDi(c.f)] ??= []).push(c.ratio);
const binMediane = Object.fromEntries(Object.entries(perBin).map(([k, v]) => [k, { n: v.length, ratio: mediana(v) }]));
const ratioMediano = mediana(casi.map((c) => c.ratio));

const sanita = {
  verdi_nel_range: verdiFuoriOrdine.length === 0,
  gare_verdi_fuori: verdiFuoriOrdine,
  ratio_mediano_in_finestra: ratioMediano,
  ratio_in_fascia: ratioMediano !== null && ratioMediano > 0 && ratioMediano <= 1.2,
  pieni_sotto_bassi: (binMediane.pieni?.ratio ?? null) !== null && (binMediane.bassi?.ratio ?? null) !== null
    && binMediane.pieni.ratio < binMediane.bassi.ratio,
};
const V4b = sanita.verdi_nel_range && sanita.ratio_in_fascia && sanita.pieni_sotto_bassi;

// ── V4a · il confronto, SOLO con V4b verde ──────────────────────────────────
let V4a = null; let appaiato = null; let medie = null;
if (V4b) {
  const vinte = casi.filter((c) => c.err_pesato < c.err_binario).length;
  const perse = casi.filter((c) => c.err_pesato > c.err_binario).length;
  const mp = mediana(casi.map((c) => c.err_pesato));
  const mb = mediana(casi.map((c) => c.err_binario));
  appaiato = { vinte_pesato: vinte, perse, pari: casi.length - vinte - perse };
  medie = { pesato: mp, binario: mb };
  V4a = mp !== null && mb !== null && mp < mb && vinte > perse;
}

const esito = {
  _cosa_e: 'V4 di PREREG_perdita_relativa.md — il fattore VSC misurato col metro RELATIVO.',
  _data: '2026-08-07',
  perimetro: { casi_in_finestra: casi.length, non_giudicabili_riferimento_scarso: nonGiudicabili,
    riferimenti_verdi: Object.fromEntries(Object.entries(rifVerde).map(([g, v]) => [g, { n: v.n, perdita_s: Number(v.perdita?.toFixed(2)) }])) },
  V4b_sanita: { ...sanita, passa: V4b },
  V4a_confronto: V4b ? { ...appaiato, mediane_errore: medie, passa: V4a } : 'NON LETTO (V4b rossa: il metro non e\' sano)',
  bin: binMediane,
  V4_passa: V4b && V4a === true,
  casi,
};
writeFileSync(path.join(QUI, 'ESITO_perdita_relativa.json'), `${JSON.stringify(esito, null, 1)}\n`);

console.log('══ LA PERDITA RELATIVA — V4 di PREREG_perdita_relativa.md ══════════════════');
console.log(`   casi in finestra ${casi.length} (${nonGiudicabili} non giudicabili per riferimento scarso)`);
console.log(`   riferimenti verdi (s): ${Object.entries(rifVerde).map(([g, v]) => `${g} ${v.perdita?.toFixed(1)}`).join(' · ')}`);
console.log(`   V4b SANITA': verdi nel range ${sanita.verdi_nel_range ? '✓' : '✗ ' + verdiFuoriOrdine}; ratio mediano ${ratioMediano?.toFixed(3)} ∈ (0, 1,2] ${sanita.ratio_in_fascia ? '✓' : '✗'}; pieni<bassi ${sanita.pieni_sotto_bassi ? '✓' : '✗'}  → ${V4b ? 'VERDE' : 'ROSSA'}`);
console.log(`   bin: ${JSON.stringify(binMediane)}`);
if (V4b) console.log(`   V4a: |err| pesato ${medie.pesato?.toFixed(4)} vs binario ${medie.binario?.toFixed(4)} · appaiato ${appaiato.vinte_pesato}-${appaiato.perse}  → ${V4a ? 'PASSA' : 'NON PASSA'}`);
console.log(`   V4 ${V4b && V4a === true ? 'PASSA' : (V4b ? 'NON PASSA' : 'NON GIUDICABILE (metro non sano)')}`);
