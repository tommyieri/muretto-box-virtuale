// misura_fattore_vsc.mjs — V3 di PREREG_fattore_vsc_frazione.md: pesato contro binario.
//
//     node ai_lab/neutralizzazione/misura_fattore_vsc.mjs
//
// Perdita realizzata di ogni sosta 2026 in finestra VSC (f > 0, niente SC),
// rapportata al riferimento verde della stessa gara; il modello PESATO
// (1 − 0,35·f, zero parametri liberi) contro il BINARIO attuale (0,65 se
// l'in-lap e' in finestra, 1 altrimenti), appaiato caso per caso.
// Scrive ESITO_fattore_vsc.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const F = JSON.parse(readFileSync(path.join(QUI, 'frazioni_vsc_2026.json'), 'utf8'));
const PRIOR_VSC = 0.65;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const giudicabile = (c) => c && c.status !== null && c.del !== null;

// il filtro verde per la BASE del passo (stesso di misura_vsc_*): import pigro per
// non duplicare la definizione
const { verde } = await import('../../simulatore/provenienza/definizioni.mjs');

const inFinestra = [];   // {gara, drv, lap, f, ratio}
const verdi = {};        // gara -> [perdite realizzate delle soste in verde pieno]
for (const nome of gare()) {
  const fg = F.gare[nome];
  if (!fg) continue;
  const g = garaNuova(nome);
  for (const [drv, celle] of g.perPilota) {
    const puliti = [];
    for (const [, c] of celle) if (giudicabile(c) && verde(c) && Number.isFinite(c.lap_time)) puliti.push(c.lap_time);
    const base = mediana(puliti);
    if (base === null || !(base > 0)) continue;
    for (const [lap, c] of celle) {
      if (c?.in_lap !== true) continue;
      const dopo = celle.get(lap + 1);
      if (!giudicabile(c) || !dopo || !giudicabile(dopo)) continue;
      if (!Number.isFinite(c.lap_time) || !Number.isFinite(dopo.lap_time)) continue;
      const fIn = fg.piloti[drv]?.[lap];
      const fOut = fg.piloti[drv]?.[lap + 1];
      if (!fIn) continue;
      const fVsc = ((fIn.f_vsc ?? 0) + (fOut?.f_vsc ?? 0)) / 2;
      const fSc = ((fIn.f_sc ?? 0) + (fOut?.f_sc ?? 0)) / 2;
      if (fSc > 0) continue;                       // contaminazione SC: fuori (dichiarato)
      const perdita = c.lap_time + dopo.lap_time - 2 * base;
      if (!(perdita > 0)) continue;                // una perdita negativa non e' una sosta misurabile
      if (fVsc > 0) inFinestra.push({ gara: nome, drv, lap, f: fVsc, f_in: fIn.f_vsc ?? 0, perdita });
      else (verdi[nome] ??= []).push(perdita);
    }
  }
}

const rifVerde = Object.fromEntries(Object.entries(verdi).map(([g, v]) => [g, { n: v.length, perdita: mediana(v) }]));

const casi = [];
for (const s of inFinestra) {
  const rif = rifVerde[s.gara];
  if (!rif || rif.perdita === null || !(rif.perdita > 0)) continue;
  const ratio = s.perdita / rif.perdita;
  const pesato = 1 - (1 - PRIOR_VSC) * s.f;
  // il binario ATTUALE del laboratorio: sconta se l'IN-LAP tocca la finestra
  const binario = s.f_in > 0 ? PRIOR_VSC : 1;
  casi.push({
    ...s,
    ratio: Number(ratio.toFixed(4)),
    att_pesato: Number(pesato.toFixed(4)),
    att_binario: binario,
    err_pesato: Number(Math.abs(ratio - pesato).toFixed(4)),
    err_binario: Number(Math.abs(ratio - binario).toFixed(4)),
  });
}

const vinte = casi.filter((c) => c.err_pesato < c.err_binario).length;
const perse = casi.filter((c) => c.err_pesato > c.err_binario).length;
const medPesato = mediana(casi.map((c) => c.err_pesato));
const medBinario = mediana(casi.map((c) => c.err_binario));
const V3 = medPesato !== null && medBinario !== null && medPesato < medBinario && vinte > perse;

const binDi = (f) => (f >= 0.9 ? 'pieni' : f >= 0.5 ? 'alti' : 'bassi');
const perBin = {};
for (const c of casi) (perBin[binDi(c.f)] ??= []).push(c.ratio);
const binMediane = Object.fromEntries(Object.entries(perBin).map(([k, v]) => [k, { n: v.length, ratio: mediana(v) }]));

const esito = {
  _cosa_e: 'V3 di PREREG_fattore_vsc_frazione.md — il fattore pesato per frazione contro il binario attuale.',
  _data: '2026-08-07',
  perimetro: {
    casi_in_finestra: casi.length,
    riferimenti_verdi: Object.fromEntries(Object.entries(rifVerde).map(([g, v]) => [g, { n: v.n, perdita_s: Number(v.perdita?.toFixed(2)) }])),
  },
  appaiato: { vinte_pesato: vinte, perse: perse, pari: casi.length - vinte - perse },
  mediane_errore: { pesato: medPesato, binario: medBinario },
  V3_passa: V3,
  sanita_bin: binMediane,
  casi,
};
writeFileSync(path.join(QUI, 'ESITO_fattore_vsc.json'), `${JSON.stringify(esito, null, 1)}\n`);

console.log('══ IL FATTORE VSC PESATO — V3 di PREREG_fattore_vsc_frazione.md ════════════');
console.log(`   casi in finestra ${casi.length} · mediana |err| PESATO ${medPesato?.toFixed(4)} vs BINARIO ${medBinario?.toFixed(4)}`);
console.log(`   appaiato: pesato vince ${vinte}, perde ${perse}, pari ${casi.length - vinte - perse}`);
console.log(`   sanita' (ratio osservato per bin, non decide): ${JSON.stringify(binMediane)}`);
console.log(`   V3 ${V3 ? 'PASSA' : 'NON PASSA'}`);
