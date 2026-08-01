// cancello_soglia_base.mjs — le tre condizioni di PREREG_soglia_base.md.
//
//     node ai_lab/confronto/cancello_soglia_base.mjs [--json]
//
//   A  la copertura sale
//   B  gli esatti sulle risposte che c'erano gia' non calano di piu' di 2 punti
//   C  lo scarto appaiato dell'errore di base fra 4-7 e 8+ ha IC95 che contiene lo zero
//
// NON SCRIVE NIENTE su disco.

import { casi, rispostaVecchio, rispostaNuovo, modelloDaDisco, garaSimDi, garaNuova } from './banco.mjs';
import { stimaBasi, derivaPerGiro } from '../../simulatore/engine/passo_v2.mjs';
import { osservazioniVerdi } from '../../simulatore/provenienza/gare_indice.mjs';
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';

const MODELLO = modelloDaDisco();
const conSoglia = (n) => ({ ...MODELLO, min_giri_base: { ...MODELLO.min_giri_base, valore: n } });
const sigleDi = (o) => (o ? o.map((x) => (Array.isArray(x) ? x[0] : x)) : null);
const rango = (sigle, dentro, pil) => { const f = sigle.filter((d) => dentro.has(d)); const i = f.indexOf(pil); return i < 0 ? null : i + 1; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, n = 3) => (x === null || !Number.isFinite(x) ? '  —  ' : x.toFixed(n));

// ═══════════════════════════════════════════════ A e B — sulle soste vere
const righe = [];
for (const c of casi()) {
  const V = rispostaVecchio(c);
  const a8 = rispostaNuovo(c, { modello: conSoglia(8) });
  const a4 = rispostaNuovo(c, { modello: conSoglia(4) });
  const vero = c.ordineVero; const sV = sigleDi(V.ordine);
  const errB2 = (N) => {
    const sN = sigleDi(N.ordine);
    if (!(V.ok && N.ok && sV && sN)) return null;
    const sSV = new Set(sV); const sSN = new Set(sN);
    const dentro = new Set(vero.filter((d) => sSV.has(d) && sSN.has(d)));
    const t = rango(vero, dentro, c.pilota); const p = rango(sN, dentro, c.pilota);
    return t && p ? p - t : null;
  };
  righe.push({ gara: c.gara, ok8: a8.ok, ok4: a4.ok, su8: a8.su, su4: a4.su, e8: errB2(a8), e4: errB2(a4) });
}

const cop8 = righe.filter((r) => r.ok8).length;
const cop4 = righe.filter((r) => r.ok4).length;
const A = cop4 > cop8;

// B — SOLO le risposte che c'erano gia': quelle che il motore dava con soglia 8
const preesistenti = righe.filter((r) => r.e8 !== null && r.e4 !== null);
const es = (v, k) => 100 * v.filter((r) => r[k] === 0).length / v.length;
const esattiPrima = es(preesistenti, 'e8');
const esattiDopo = es(preesistenti, 'e4');
const B = esattiDopo >= esattiPrima - 2;

// quante risposte gia' pubblicate CAMBIANO (il campo cresce, quindi qualcuna cambia)
const campoCresciuto = preesistenti.filter((r) => r.su4 !== r.su8).length;
const posizioneCambiata = preesistenti.filter((r) => r.e4 !== r.e8).length;
const migliorate = preesistenti.filter((r) => Math.abs(r.e4) < Math.abs(r.e8)).length;
const peggiorate = preesistenti.filter((r) => Math.abs(r.e4) > Math.abs(r.e8)).length;

// le risposte NUOVE: quelle che prima non c'erano
const nuove = righe.filter((r) => !r.ok8 && r.ok4 && r.e4 !== null);

// ═══════════════════════════════ C — la QUALITA' della base, 4-7 contro 8+
// Errore della base: |base stimata a Lf − passo verde effettivo nei giri successivi|.
// Appaiato per (gara, pilota, Lf): la stessa cella entra in una sola fascia.
const rho = MODELLO.rho.valore; const d70 = MODELLO.delta_70.scelto;
const rodaggio = MODELLO.rodaggio?.attivo === true ? { c: MODELLO.rodaggio.c, tau: MODELLO.rodaggio.tau } : null;
const perFascia = { corta: [], lunga: [] };
const perGara = {};
for (const nomeSito of [...new Set(casi().map((c) => c.gara))]) {
  const g = garaNuova(nomeSito);
  const oss = osservazioniVerdi(g.righe);
  const deriva = derivaPerGiro(d70, g.nGiri);
  for (let Lf = 5; Lf <= g.nGiri - 6; Lf += 3) {
    const basi = stimaBasi(oss, { delta70: d70, rho, nGiri: g.nGiri, finoA: Lf, minGiri: 1, rodaggio });
    for (const [drv, celle] of g.perPilota) {
      let verdiPrima = 0;
      for (const [l, c] of celle) if (l <= Lf && passoUtilizzabile(c) && c.tyre_age !== null) verdiPrima += 1;
      if (verdiPrima < 4 || basi[drv] === null || basi[drv] === undefined) continue;
      // il vero: i residui dei 5 giri verdi successivi, stessa equazione
      const dopo = [];
      for (let l = Lf + 1; l <= Lf + 5; l += 1) {
        const c = celle.get(l);
        if (!c || !passoUtilizzabile(c) || c.tyre_age === null) continue;
        let w = 0;
        if (rodaggio) w = -rodaggio.c * Math.exp(-c.tyre_age / rodaggio.tau);
        dopo.push(c.lap_time - deriva * (l - 1) - rho * c.tyre_age - w);
      }
      if (dopo.length < 3) continue;
      const err = Math.abs(basi[drv] - mediana(dopo));
      const fascia = verdiPrima <= 7 ? 'corta' : 'lunga';
      perFascia[fascia].push(err);
      ((perGara[nomeSito] ??= { corta: [], lunga: [] })[fascia]).push(err);
    }
  }
}
function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const chiavi = Object.keys(perGara);
const r = rng(20260801); const boot = [];
for (let b = 0; b < 2000; b += 1) {
  const cc = []; const ll = [];
  for (let i = 0; i < chiavi.length; i += 1) { const k = chiavi[Math.floor(r() * chiavi.length)]; cc.push(...perGara[k].corta); ll.push(...perGara[k].lunga); }
  if (cc.length && ll.length) boot.push(mediana(cc) - mediana(ll));
}
boot.sort((a, b) => a - b);
const q = (p) => boot[Math.min(boot.length - 1, Math.max(0, Math.floor(p * boot.length)))];
const ic = boot.length > 20 ? [q(0.025), q(0.975)] : null;
const scarto = mediana(perFascia.corta) - mediana(perFascia.lunga);
const C = ic !== null && ic[0] <= 0 && ic[1] >= 0;

const esito = {
  targhetta: { protocollo: 'ai_lab/confronto/PREREG_soglia_base.md', data: '2026-08-01' },
  A: { copertura_8: cop8, copertura_4: cop4, su: righe.length, passa: A },
  B: { n_preesistenti: preesistenti.length, esatti_prima: esattiPrima, esatti_dopo: esattiDopo, passa: B,
       campo_cresciuto: campoCresciuto, posizione_cambiata: posizioneCambiata, migliorate, peggiorate },
  C: { n_corta: perFascia.corta.length, n_lunga: perFascia.lunga.length,
       errore_corta: mediana(perFascia.corta), errore_lunga: mediana(perFascia.lunga), scarto, ic95: ic, passa: C },
  risposte_nuove: { n: nuove.length, esatti: nuove.length ? es(nuove, 'e4') : null },
  verdetto: A && B && C,
};
if (process.argv.includes('--json')) { console.log(JSON.stringify(esito, null, 2)); process.exit(esito.verdetto ? 0 : 1); }

console.log('CANCELLO DELLA SOGLIA DI BASE — PREREG_soglia_base.md');
console.log(`\n  A · copertura sulle soste vere: ${cop8} -> ${cop4} su ${righe.length}   ${A ? 'PASSA' : 'FALLISCE'}`);
console.log(`\n  B · esatti sulle risposte che c'erano gia' (n=${preesistenti.length}, lettura B2)`);
console.log(`      ${f(esattiPrima, 2)}% -> ${f(esattiDopo, 2)}%  (limite: non piu' di 2 punti sotto)   ${B ? 'PASSA' : 'FALLISCE'}`);
console.log(`      il campo cresce in ${campoCresciuto} casi · la posizione cambia in ${posizioneCambiata} (${migliorate} meglio, ${peggiorate} peggio)`);
console.log(`\n  C · qualita' della base: errore mediano  4-7 giri ${f(mediana(perFascia.corta))} (n=${perFascia.corta.length})  ·  8+ giri ${f(mediana(perFascia.lunga))} (n=${perFascia.lunga.length})`);
console.log(`      scarto ${f(scarto)} s/giro  IC95 a blocchi=gare [${f(ic?.[0])}; ${f(ic?.[1])}]   ${C ? 'PASSA (contiene lo zero)' : 'FALLISCE'}`);
console.log(`\n  risposte NUOVE: ${nuove.length}, esatti ${nuove.length ? f(es(nuove, 'e4'), 1) + '%' : '—'} (si riporta, non decide)`);
console.log(`\n  → LA SOGLIA ${esito.verdetto ? 'SCENDE a 4' : 'RESTA a 8'}`);
process.exit(esito.verdetto ? 0 : 1);
