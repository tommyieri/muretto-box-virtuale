// legge_compressione.mjs — LA LEGGE, PER FASCIA DI DISTACCO. Descrittivo.
//
//     node ai_lab/confronto/legge_compressione.mjs [--json]
//
// Il sigillo pubblica UN kappa per regime (SC 0,6971) misurato come mediana di
// gap(k+1)/gap(k) su tutte le coppie {pilota, capofila} con gap > 1 s. Il kernel lo
// applica a OGNI distacco, compreso quello di un'auto doppiata due volte.
//
// Prima di scrivere la terza forma serve sapere se quel numero unico e' la legge o
// una media di leggi diverse: un'auto a 3 s dal capofila e una a 240 s non stanno
// facendo la stessa cosa, e se le fasce alte non si comprimono, applicare 0,697 a
// tutto e' sbagliato in QUALUNQUE forma — sia togliendo tempo a chi insegue, sia
// aggiungendolo a chi precede.
//
// E' una misura DESCRITTIVA SULL'INGRESSO, non un cancello: non c'e' niente da
// validare, si guarda la forma di un dato che il progetto usa gia'. I cancelli
// stanno in PREREG_terza_forma.md e riguardano l'ESITO dell'intervento, che qui
// non esiste ancora.
//
// NON SCRIVE NIENTE su disco e non tocca il generatore del sigillo.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { regimeDiCella, statusVerde } from '../../simulatore/provenienza/definizioni.mjs';
import { MESCOLE_BAGNATO } from '../../simulatore/provenienza/vocabolario.mjs';
import { RADICE } from './banco.mjs';

const JSON_OUT = process.argv.includes('--json');
const QUOTA_CAMPO = 0.5;          // stesso perimetro del sigillo (PREREG-6)
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const base = path.join(RADICE, 'simulatore', 'data', 'fondo');
const coppie = { SC: [], VSC: [], VERDE: [] };
let nGare = 0;

for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
  for (const gara of readdirSync(path.join(base, anno)).sort()) {
    const f = path.join(base, anno, gara, 'Race.json.gz');
    if (!existsSync(f)) continue;
    let righe;
    try { ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` })); } catch { continue; }
    if (righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound))) continue;
    nGare += 1;

    const perGiro = new Map();
    for (const { drv, lap, cella } of righe) {
      if (typeof cella.cum_time !== 'number') continue;
      if (!perGiro.has(lap)) perGiro.set(lap, []);
      perGiro.get(lap).push({ drv, c: cella });
    }
    for (const k of [...perGiro.keys()].sort((a, b) => a - b)) {
      const a = perGiro.get(k); const b = perGiro.get(k + 1);
      if (!a || !b) continue;
      a.sort((x, y) => x.c.cum_time - y.c.cum_time);
      const lead = a[0];
      const leadB = b.find((x) => x.drv === lead.drv);
      if (!leadB || leadB.c.status == null) continue;
      let reg; try { reg = regimeDiCella(leadB.c); } catch { continue; }
      const eti = reg ?? (statusVerde(leadB.c) ? 'VERDE' : null);
      if (eti === null || !coppie[eti]) continue;
      if (reg !== null) {
        let neutri = 0;
        for (const { c: cc } of b) { if (cc.status == null) continue; let rr = null; try { rr = regimeDiCella(cc); } catch { rr = null; } if (rr !== null) neutri += 1; }
        if (neutri / b.length < QUOTA_CAMPO) continue;
      }
      if (lead.c.in_lap === true || lead.c.out_lap === true || leadB.c.in_lap === true || leadB.c.out_lap === true) continue;
      for (const { drv, c } of a) {
        if (drv === lead.drv) continue;
        const cB = b.find((x) => x.drv === drv);
        if (!cB) continue;
        if (c.in_lap === true || c.out_lap === true || cB.c.in_lap === true || cB.c.out_lap === true) continue;
        coppie[eti].push([c.cum_time - lead.c.cum_time, cB.c.cum_time - leadB.c.cum_time]);
      }
    }
  }
}

// FASCE FISSE in secondi, non decili: i decili si spostano col campione e non si
// leggono. I bordi sono quelli che contano per il motore — sotto i 5 s si duella,
// oltre i 90 s si e' doppiati.
const BORDI = [1, 3, 5, 10, 20, 40, 80, 160, Infinity];
const perFascia = (v) => {
  const out = [];
  for (let i = 0; i < BORDI.length - 1; i += 1) {
    const lo = BORDI[i]; const hi = BORDI[i + 1];
    const f = v.filter(([g0]) => g0 > lo && g0 <= hi);
    if (f.length < 20) { out.push({ da: lo, a: hi, n: f.length, kappa: null }); continue; }
    out.push({
      da: lo, a: hi, n: f.length,
      kappa: Number(mediana(f.map(([g0, g1]) => g1 / g0)).toFixed(4)),
      // il RAPPORTO DELLE MEDIANE: robusto anche dove il rapporto per coppia esplode
      kappa_mediane: Number((mediana(f.map(([, g1]) => g1)) / mediana(f.map(([g0]) => g0))).toFixed(4)),
      gap_mediano: Number(mediana(f.map(([g0]) => g0)).toFixed(1)),
      guadagno_mediano_s: Number(mediana(f.map(([g0, g1]) => g0 - g1)).toFixed(2)),
    });
  }
  return out;
};

const fuori = { n_gare: nGare, fasce: Object.fromEntries(Object.keys(coppie).map((r) => [r, perFascia(coppie[r])])) };

if (JSON_OUT) { console.log(JSON.stringify(fuori, null, 1)); } else {
  console.log('');
  console.log(`  LA LEGGE PER FASCIA DI DISTACCO — ${nGare} gare asciutte del fondo`);
  for (const reg of ['SC', 'VSC', 'VERDE']) {
    console.log('');
    console.log(`  ${reg}`);
    console.log('  fascia gap (s)        n    kappa   kappa(mediane)   gap mediano   recupero mediano');
    for (const f of fuori.fasce[reg]) {
      const et = `${f.da}-${f.a === Infinity ? '∞' : f.a}`;
      if (f.kappa === null) { console.log(`  ${et.padEnd(18)} ${String(f.n).padStart(5)}    (meno di 20)`); continue; }
      console.log(`  ${et.padEnd(18)} ${String(f.n).padStart(5)}   ${f.kappa.toFixed(4)}   ${f.kappa_mediane.toFixed(4).padStart(10)}       ${String(f.gap_mediano).padStart(7)}       ${String(f.guadagno_mediano_s).padStart(8)} s`);
    }
  }
  console.log('');
}
