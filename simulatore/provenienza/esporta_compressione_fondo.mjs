#!/usr/bin/env node
// esporta_compressione_fondo.mjs — quanto costa DAVVERO una sosta sotto
// neutralizzazione, misurato sul fondo invece che preso da un prior esterno.
//
//     node provenienza/esporta_compressione_fondo.mjs [--write]
//
// PERCHE' ESISTE. Il motore prezza la sosta neutralizzata come
// `perdita_verde x fattore`, con fattore da un PRIOR ESTERNO (SC 0,50 · VSC 0,65,
// bande 0,40-0,60 e 0,60-0,70) mai validato in casa — mentre la parte VERDE e'
// gia' stata promossa a misura interna su 26 Gran Premi (`pitloss_interno.json`).
// Il dato per misurare anche l'altra meta' c'e' sempre stato ed e' buttato via:
// `esporta_soste_fondo.mjs` scarta esplicitamente le soste non verdi.
//
// IL METODO, e perche' NON e' quello di esporta_soste_fondo.mjs. Li' la perdita e'
// `t(in-lap) + t(out-lap) - 2 x passo pulito del pilota`. Sotto Safety Car quel
// "passo pulito adiacente" non esiste: i giri intorno alla sosta sono neutralizzati
// e lenti, quindi la baseline sarebbe sbagliata proprio dove serve. Qui si misura
// RISPETTO AL CAMPO:
//
//   perdita_realizzata = (cum[Lo] - cum[L]) mia
//                      - mediana degli stessi due giri per chi NON si e' fermato
//   fattore            = perdita_realizzata / perdita_verde del circuito
//
// che e' il tempo perso rispetto agli altri, cioe' esattamente cio' che sposta la
// posizione — l'unica cosa che il prodotto deve indovinare. Nessun kernel, nessun
// passo, nessun modello: solo `cum_time` del grezzo. E' lo stesso metodo con cui
// `ai_lab/confronto/lente_perdita_reale.mjs` ha misurato il 2026; qui si estende
// al fondo, che e' dove vive il campione.
//
// IL CONTROLLO CHE VALIDA IL METODO, e senza il quale i numeri non si guardano:
// le soste in VERDE devono dare un fattore vicino a 1. Se non lo danno, il metodo
// e' rotto e i fattori neutralizzati non significano niente.
//
// NON PROMUOVE NIENTE. Scrive una vista; la promozione a modello e' un altro atto,
// con il suo cancello (ai_lab/confronto/PREREG_neutralizzazione.md, voce N3).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { regimeDiCella, statusVerde } from './definizioni.mjs';
import { MESCOLE_BAGNATO } from './vocabolario.mjs';
import { caricaPrior } from './pitloss_dati.mjs';
import { perditaBox } from './pitloss.mjs';

// IL NOME NON E' CASUALE, ed e' stata la sentinella s07 a insegnarmelo. La prima
// versione di questa vista si chiamava come un file che sta nella cartella di
// QUARANTENA dell'archivio: materiale costruito a gara finita e usato come se
// fosse live, cioe' l'errore E14 in persona. Due file quasi omonimi, uno onesto e
// uno avvelenato, sono un incidente che aspetta il prossimo lettore. Qui il nome
// dice cosa c'e' dentro e non somiglia a niente di proibito — e s07 vieta anche
// solo di NOMINARE quel materiale in un sorgente, che e' il motivo per cui questo
// commento gira intorno alla parola invece di scriverla.
export const PERCORSO = 'data/viste/compressione_e_fattori_fondo.json';
const MIN_RIFERIMENTI = 5;   // sotto questo, la mediana del campo e' un aneddoto
const MAX_PERSISTENZA = 8;
const QUOTA_CAMPO = 0.5;     // PREREG-6: sotto meta' del campo non e' una neutralizzazione di campo
const SOGLIA_GAP = 1.0;      // sotto 1 s il rapporto gap(k+1)/gap(k) e' rumore di cronometraggio   // oltre 8 giri la domanda non interessa nessuno scenario
const SEME = 20260801;
const B_BOOT = 2000;

const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quant = (v, p) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function icBlocchi(perGara, stat) {
  const chiavi = Object.keys(perGara).filter((k) => perGara[k].length > 0);
  if (chiavi.length < 2) return null;
  const r = rng(SEME);
  const out = [];
  for (let b = 0; b < B_BOOT; b += 1) {
    const u = [];
    for (let i = 0; i < chiavi.length; i += 1) u.push(...perGara[chiavi[Math.floor(r() * chiavi.length)]]);
    const v = stat(u);
    if (v !== null && Number.isFinite(v)) out.push(v);
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return [q(0.025), q(0.975)];
}

/** Indicizza le righe per pilota e per giro (il fondo arriva colonnare). */
function indicizza(righe) {
  const perPilota = new Map();
  for (const { drv, lap, cella } of righe) {
    if (!perPilota.has(drv)) perPilota.set(drv, new Map());
    perPilota.get(drv).set(lap, cella);
  }
  return perPilota;
}

export function costruisci(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const prior = caricaPrior(radice);
  const soste = [];
  const scarti = {};
  const gareViste = [];
  const persistenza = { SC: {}, VSC: {} };
  const osservazioniRegime = { SC: 0, VSC: 0 };
  const durate = { SC: [], VSC: [] };
  const kappa = {};
  const kappaPerGara = {};
  const coppie = {};
  const coppiePerGara = {};
  for (const r of ['SC', 'VSC']) for (let k = 1; k <= MAX_PERSISTENZA; k += 1) persistenza[r][k] = 0;
  const scarta = (m) => { scarti[m] = (scarti[m] ?? 0) + 1; };

  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try {
        ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` }));
      } catch { continue; }

      // gara bagnata: il pit-loss verde di riferimento e' misurato sull'asciutto,
      // quindi un rapporto costruito su una gara bagnata non e' confrontabile.
      const asciutta = !righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound));
      if (!asciutta) { scarta('gara bagnata'); continue; }

      let verde;
      try { verde = perditaBox(prior, gara, null).perdita_verde; } catch { verde = null; }
      if (typeof verde !== 'number' || !(verde > 0)) { scarta('circuito senza perdita verde dichiarata'); continue; }

      const perPilota = indicizza(righe);
      const chiave = `${anno}/${gara}`;
      gareViste.push(chiave);

      // ── COMPRESSIONE DEI DISTACCHI (kappa), sullo stesso passaggio ────────
      // gap(k+1) / gap(k) rispetto al leader di quel giro. Sotto SC il campo si
      // compatta e i distacchi si contraggono: e' il fenomeno che il motore NON
      // ha, e che vale 1,964 s/giro di bias sotto regime contro 0,033 in verde.
      // Protocollo: PREREG_neutralizzazione.md, PREREG-2.
      {
        const perGiro = new Map();
        for (const [drv, celle] of perPilota) {
          for (const [lap, c] of celle) {
            if (typeof c.cum_time !== 'number') continue;
            if (!perGiro.has(lap)) perGiro.set(lap, []);
            perGiro.get(lap).push({ drv, c });
          }
        }
        const giri = [...perGiro.keys()].sort((a, b) => a - b);
        for (const k of giri) {
          const a = perGiro.get(k); const b = perGiro.get(k + 1);
          if (!a || !b) continue;
          a.sort((x, y) => x.c.cum_time - y.c.cum_time);
          const lead = a[0];
          const leadB = b.find((x) => x.drv === lead.drv);
          if (!leadB) continue;
          // il regime si legge sul giro di ARRIVO: e' li' che la compressione avviene
          if (leadB.c.status === null || leadB.c.status === undefined) continue;
          let reg;
          try { reg = regimeDiCella(leadB.c); } catch { continue; }
          const eti = reg ?? (statusVerde(leadB.c) ? 'VERDE' : null);
          if (eti === null) continue;
          // NEUTRALIZZAZIONE DI CAMPO (PREREG-6). `regimeDiCella` legge lo status
          // della SINGOLA auto: un 4 su una macchina sola non e' una Safety Car,
          // e' una gialla di settore. La compressione e' un fenomeno del campo
          // intero, quindi si misura solo dove il campo era neutralizzato — e si
          // applichera' solo li'. Misurare su una popolazione e predire su
          // un'altra e' la stessa famiglia di E16.
          if (reg !== null) {
            let neutri = 0;
            for (const { c: cc } of b) {
              if (cc.status === null || cc.status === undefined) continue;
              let rr = null; try { rr = regimeDiCella(cc); } catch { rr = null; }
              if (rr !== null) neutri += 1;
            }
            if (neutri / b.length < QUOTA_CAMPO) continue;
          }
          if (lead.c.in_lap === true || lead.c.out_lap === true || leadB.c.in_lap === true || leadB.c.out_lap === true) continue;
          for (const { drv, c } of a) {
            if (drv === lead.drv) continue;
            const cB = b.find((x) => x.drv === drv);
            if (!cB) continue;
            if (c.in_lap === true || c.out_lap === true || cB.c.in_lap === true || cB.c.out_lap === true) continue;
            const g0 = c.cum_time - lead.c.cum_time;
            const g1 = cB.c.cum_time - leadB.c.cum_time;
            // Le COPPIE si raccolgono sempre: servono alla forma con pavimento
            // (PREREG-3), dove i distacchi piccoli sono la regione che conta.
            (coppie[eti] ??= []).push([g0, g1]);
            (coppiePerGara[eti] ??= {});
            (coppiePerGara[eti][chiave] ??= []).push([g0, g1]);
            // Il RAPPORTO resta, ma solo sopra la soglia: vicino a zero esplode.
            // E' la stima della PREREG-2, che ha dato NULL e resta a referto.
            if (!(g0 > SOGLIA_GAP)) continue;
            (kappa[eti] ??= []).push(g1 / g0);
            (kappaPerGara[eti] ??= {});
            (kappaPerGara[eti][chiave] ??= []).push(g1 / g0);
          }
        }
      }

      // ── PERSISTENZA del regime, sullo stesso passaggio ────────────────────
      // Dato un regime osservato al giro L (informazione <= L, cioe' cio' che si
      // saprebbe in diretta), per quanti giri e' ancora in corso? Il costruttore
      // usa UNA costante = 1 per entrambi i regimi, senza targhetta. Misurarlo
      // qui costa zero perche' le celle sono gia' in memoria, e tiene UN
      // generatore per UN fenomeno invece di due che possono divergere.
      for (const [, celle] of perPilota) {
        for (const [lap, c] of celle) {
          if (c.status === null || c.status === undefined) continue;
          let reg;
          try { reg = regimeDiCella(c); } catch { continue; }
          if (reg !== 'SC' && reg !== 'VSC') continue;
          osservazioniRegime[reg] += 1;
          let consecutivi = 0;
          for (let k = 1; k <= MAX_PERSISTENZA; k += 1) {
            const cc = celle.get(lap + k);
            let ancora = false;
            if (cc && cc.status !== null && cc.status !== undefined) {
              try { ancora = regimeDiCella(cc) !== null; } catch { ancora = false; }
            }
            if (ancora) persistenza[reg][k] += 1;
            if (ancora && consecutivi === k - 1) consecutivi = k;
          }
          durate[reg].push(consecutivi);
        }
      }

      for (const [drv, celle] of perPilota) {
        for (const [lap, cella] of celle) {
          if (cella.in_lap !== true) continue;
          // SENZA STATUS NON SI DEDUCE (E13). Le stagioni piu' vecchie del fondo
          // non hanno lo status per-auto: li' il regime della sosta e' ignoto, e
          // ignoto non e' verde. Si scarta contando, cosi' il perimetro reale del
          // campione e' leggibile invece di essere un'impressione.
          if (cella.status === null || cella.status === undefined) { scarta('status per-auto assente sull\'in-lap'); continue; }
          const L = lap - 1;                 // ultimo giro prima della sosta
          const Lo = lap + 1;                // giro di rientro
          const mioL = celle.get(L)?.cum_time;
          const mioLo = celle.get(Lo)?.cum_time;
          if (typeof mioL !== 'number' || typeof mioLo !== 'number') { scarta('cum assente su L o Lo'); continue; }

          // IL CAMPO DI RIFERIMENTO: chi non e' entrato ai box nella finestra e ha
          // entrambi i cum. Chi si e' fermato dentro la finestra ha una perdita sua
          // e falserebbe la mediana proprio nel verso che si sta misurando.
          const rif = [];
          for (const [altro, sue] of perPilota) {
            if (altro === drv) continue;
            const a = sue.get(L)?.cum_time;
            const b = sue.get(Lo)?.cum_time;
            if (typeof a !== 'number' || typeof b !== 'number') continue;
            let pulito = true;
            for (let k = L; k <= Lo; k += 1) {
              const c = sue.get(k);
              if (!c || c.in_lap === true || c.out_lap === true) { pulito = false; break; }
            }
            if (!pulito) continue;
            rif.push(b - a);
          }
          if (rif.length < MIN_RIFERIMENTI) { scarta('meno di 5 riferimenti nel campo'); continue; }

          // Il REGIME si legge sull'in-lap: e' il giro in cui la sosta e' avvenuta,
          // ed e' cio' che ne ha determinato il prezzo. (Nel prodotto il regime si
          // legge al congelamento, che e' un'altra cosa e sta a valle: qui si misura
          // il FENOMENO, non l'informazione disponibile.)
          const regime = regimeDiCella(cella);
          const realizzata = (mioLo - mioL) - mediana(rif);
          soste.push({
            gara: chiave, anno: Number(anno), circuito: gara, drv, lap,
            regime: regime ?? (statusVerde(cella) ? 'VERDE' : 'ALTRO'),
            realizzata: Number(realizzata.toFixed(3)),
            verde: Number(verde.toFixed(3)),
            fattore: Number((realizzata / verde).toFixed(4)),
            n_riferimenti: rif.length,
          });
        }
      }
    }
  }

  // ── aggregazione per regime, blocchi = gare (E11) ────────────────────────
  const perRegime = {};
  for (const reg of ['VERDE', 'SC', 'VSC', 'ALTRO']) {
    const v = soste.filter((s) => s.regime === reg);
    if (!v.length) continue;
    const pg = {};
    for (const s of v) (pg[s.gara] ??= []).push(s.fattore);
    const f = v.map((s) => s.fattore);
    perRegime[reg] = {
      n: v.length,
      n_gare: Object.keys(pg).length,
      fattore_mediano: Number(mediana(f).toFixed(4)),
      p25: Number(quant(f, 0.25).toFixed(4)),
      p75: Number(quant(f, 0.75).toFixed(4)),
      ic95_mediana_blocchi_gare: icBlocchi(pg, mediana)?.map((x) => Number(x.toFixed(4))) ?? null,
      perdita_realizzata_mediana_s: Number(mediana(v.map((s) => s.realizzata)).toFixed(3)),
    };
  }

  return {
    _targhetta: {
      tipo: 'MISURATO sul fondo — fattore di neutralizzazione della sosta',
      metodo: 'perdita_realizzata = (cum[Lo] - cum[L]) mia - mediana degli stessi due giri per chi non si e\' fermato; fattore = realizzata / perdita_verde del circuito',
      perche_non_il_metodo_di_soste_fondo: 'sotto SC non esiste un "passo pulito adiacente": i giri intorno alla sosta sono neutralizzati. La baseline dev\'essere il CAMPO, non il pilota.',
      controllo: 'le soste in VERDE devono dare un fattore vicino a 1: se non lo danno il metodo e\' rotto e i numeri neutralizzati non significano niente',
      incertezza: `bootstrap ${B_BOOT}, blocchi = gare (E11), seme ${SEME}`,
      perimetro: 'gare asciutte del fondo con perdita verde di circuito dichiarata',
      min_riferimenti: MIN_RIFERIMENTI,
      prodotto_da: 'provenienza/esporta_compressione_fondo.mjs',
      non_promuove: 'questa e\' una VISTA. La promozione a modello ha il suo cancello: ai_lab/confronto/PREREG_neutralizzazione.md, voce N3',
    },
    n_gare: gareViste.length,
    n_soste: soste.length,
    // ── PREREG-3: gap(k+1) = g_inf + (gap(k) - g_inf) * kappa ────────────────
    // Dieci fasce a numerosita' uguale su gap(k), la mediana di gap(k+1) dentro
    // ognuna, e una retta ai minimi quadrati sui dieci punti. Le mediane reggono
    // alle code; dieci punti si guardano a occhio, 3.597 no.
    convergenza_distacchi: (() => {
      const retta = (punti) => {
        const n = punti.length;
        const mx = punti.reduce((a, p) => a + p[0], 0) / n;
        const my = punti.reduce((a, p) => a + p[1], 0) / n;
        let num = 0; let den = 0;
        for (const [x, y] of punti) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
        const b = den === 0 ? null : num / den;
        return b === null ? null : { kappa: b, intercetta: my - b * mx };
      };
      const fasce = (v) => {
        const s2 = [...v].sort((a, b) => a[0] - b[0]);
        const out = [];
        for (let i = 0; i < 10; i += 1) {
          const a = Math.floor(i * s2.length / 10);
          const b = Math.floor((i + 1) * s2.length / 10);
          if (b - a < 5) continue;
          const f2 = s2.slice(a, b);
          out.push([mediana(f2.map((x) => x[0])), mediana(f2.map((x) => x[1]))]);
        }
        return out;
      };
      const stima = (v) => {
        const punti = fasce(v);
        if (punti.length < 5) return null;
        const r = retta(punti);
        if (r === null) return null;
        const gInf = Math.abs(1 - r.kappa) < 1e-9 ? null : r.intercetta / (1 - r.kappa);
        return { kappa: r.kappa, intercetta: r.intercetta, g_inf: gInf, punti };
      };
      const o = {};
      for (const reg of ['VERDE', 'SC', 'VSC']) {
        const v = coppie[reg];
        if (!v || v.length < 200) continue;
        const s3 = stima(v);
        if (!s3) continue;
        const perG = coppiePerGara[reg] ?? {};
        const bootK = []; const bootG = [];
        const chiavi = Object.keys(perG);
        const r2 = rng(SEME);
        for (let b = 0; b < 500; b += 1) {
          const u = [];
          for (let i = 0; i < chiavi.length; i += 1) u.push(...perG[chiavi[Math.floor(r2() * chiavi.length)]]);
          const e = stima(u);
          if (e && Number.isFinite(e.kappa)) { bootK.push(e.kappa); if (Number.isFinite(e.g_inf)) bootG.push(e.g_inf); }
        }
        const ic = (arr) => { if (arr.length < 20) return null; const q = [...arr].sort((a, b) => a - b); const at = (p) => q[Math.min(q.length - 1, Math.max(0, Math.floor(p * q.length)))]; return [Number(at(0.025).toFixed(4)), Number(at(0.975).toFixed(4))]; };
        o[reg] = {
          n: v.length,
          n_gare: chiavi.length,
          kappa: Number(s3.kappa.toFixed(4)),
          g_inf: s3.g_inf === null ? null : Number(s3.g_inf.toFixed(3)),
          intercetta: Number(s3.intercetta.toFixed(4)),
          ic95_kappa: ic(bootK),
          ic95_g_inf: ic(bootG),
          punti_delle_fasce: s3.punti.map(([x, y]) => [Number(x.toFixed(3)), Number(y.toFixed(3))]),
        };
      }
      return o;
    })(),
    compressione_distacchi: (() => {
      const o = {};
      for (const reg of ['VERDE', 'SC', 'VSC']) {
        const v = kappa[reg];
        if (!v || v.length < 50) continue;
        o[reg] = {
          n: v.length,
          n_gare: Object.keys(kappaPerGara[reg] ?? {}).length,
          kappa_mediano: Number(mediana(v).toFixed(4)),
          p25: Number(quant(v, 0.25).toFixed(4)),
          p75: Number(quant(v, 0.75).toFixed(4)),
          ic95_mediana_blocchi_gare: icBlocchi(kappaPerGara[reg], mediana)?.map((x) => Number(x.toFixed(4))) ?? null,
        };
      }
      return o;
    })(),
    persistenza_regime: (() => {
      const o = {};
      for (const r of ['SC', 'VSC']) {
        if (!osservazioniRegime[r]) continue;
        const frazioni = {};
        for (let k = 1; k <= MAX_PERSISTENZA; k += 1) {
          frazioni[`L+${k}`] = Number((persistenza[r][k] / osservazioniRegime[r]).toFixed(4));
        }
        const d = durate[r];
        o[r] = {
          n_osservazioni: osservazioniRegime[r],
          giri_residui_mediani: mediana(d),
          giri_residui_p75: quant(d, 0.75),
          frazione_ancora_in_corso: frazioni,
          // Quanti giri estrapolare: il piu' grande k per cui il regime e' ancora
          // in corso in almeno META' dei casi. E' una REGOLA dichiarata, non un
          // numero scelto guardando la tabella.
          persistenza_meta: (() => {
            let k = 0;
            while (k < MAX_PERSISTENZA && persistenza[r][k + 1] / osservazioniRegime[r] >= 0.5) k += 1;
            return k;
          })(),
        };
      }
      return o;
    })(),
    scarti,
    per_regime: perRegime,
    per_gara_e_regime: (() => {
      const o = {};
      for (const s of soste) {
        if (s.regime !== 'SC' && s.regime !== 'VSC') continue;
        ((o[s.gara] ??= {})[s.regime] ??= []).push(s.fattore);
      }
      for (const g of Object.keys(o)) {
        for (const r of Object.keys(o[g])) {
          o[g][r] = { n: o[g][r].length, mediana: Number(mediana(o[g][r]).toFixed(4)) };
        }
      }
      return o;
    })(),
  };
}

function main() {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const v = costruisci(radice);
  console.log(`FATTORE DI NEUTRALIZZAZIONE, misurato sul fondo — ${v.n_gare} gare asciutte, ${v.n_soste} soste`);
  console.log('  scarti:', Object.entries(v.scarti).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nessuno');
  console.log('\n  regime     n    gare   fattore mediano   p25-p75          IC95 (blocchi=gare)   perdita mediana');
  for (const [reg, x] of Object.entries(v.per_regime)) {
    console.log(`  ${reg.padEnd(8)} ${String(x.n).padStart(5)}  ${String(x.n_gare).padStart(5)}   ${x.fattore_mediano.toFixed(3).padStart(13)}   `
      + `${x.p25.toFixed(3)}-${x.p75.toFixed(3)}   ${x.ic95_mediana_blocchi_gare ? `[${x.ic95_mediana_blocchi_gare[0].toFixed(3)}; ${x.ic95_mediana_blocchi_gare[1].toFixed(3)}]` : '—'}        ${x.perdita_realizzata_mediana_s.toFixed(2)} s`);
  }
  const verde = v.per_regime.VERDE?.fattore_mediano;
  console.log(`\n  CONTROLLO: le soste in verde danno ${verde?.toFixed(3) ?? '—'} — `
    + (verde !== undefined && Math.abs(verde - 1) <= 0.15
      ? 'vicino a 1, il metodo regge'
      : 'LONTANO da 1: il metodo NON regge e i fattori neutralizzati non si guardano'));
  if (process.argv.includes('--write')) {
    const dove = path.join(radice, PERCORSO);
    writeFileSync(dove, `${JSON.stringify(v, null, 1)}\n`);
    console.log(`\n  scritto: ${PERCORSO}`);
  } else {
    console.log('\n  (nessuna scrittura: --write per salvare la vista)');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
