#!/usr/bin/env node
// qualita_della_base.mjs — LA SOGLIA E' UNA SCOMMESSA SULLA QUALITA': si verifica.
//
// MIN_GIRI_BASE = 8 dice «con meno di 8 giri verdi la base non e' affidabile». E'
// una proposizione FALSIFICABILE e nessuno l'ha mai misurata: l'8 arriva da
// banco/prereg/cancelli_banco.json, dove e' un criterio di AMMISSIONE del banco di
// misura, non una soglia di qualita' del prodotto.
//
// Qui la si misura sul bersaglio giusto: la base stimata su k giri quanto sbaglia a
// proiettare? Il campione non sono le 14 soste marginali — sono decine di migliaia
// di proiezioni, che e' l'unico modo di avere potenza sotto gli 8 giri.
//
// Grandezza: errore sul DISTACCO DAL LEADER a 3 giri, s/giro — la stessa di M2,
// perche' e' quella da cui dipende la posizione (M2: sul tempo assoluto i verdetti
// si ribaltano). Popolazione COMUNE fra le soglie a ogni confronto.
//
// Uso: node ai_lab/confronto/lente_copertura/qualita_della_base.mjs
import { garaNuova, gare } from '../banco.mjs';
import { osservazioniVerdi } from '../../../simulatore/provenienza/gare_indice.mjs';
import { stimaBasi, derivaPerGiro } from '../../../simulatore/engine/passo_v2.mjs';
import { regimeDiCella } from '../../../simulatore/provenienza/definizioni.mjs';
import { caricaGare2026 } from '../../../simulatore/provenienza/gare_2026.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../banco.mjs';

const modello = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = modello.rho.valore ?? modello.rho.stima ?? null;
const D70 = modello.delta_70.scelto;
console.log(`modello: rho=${RHO} delta70=${D70}`);

const H = 3;                      // orizzonte di proiezione, come M2
const LF_MIN = 5, LF_MAX = 40;
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// per ogni (gara, Lf, pilota): base stimata sui giri verdi <= Lf, proiezione del cum a
// Lf+H, errore sul distacco dal leader diviso H.
const righe = [];
for (const nomeSito of gare()) {
  const g = garaNuova(nomeSito);
  const oss = osservazioniVerdi(g.righe);
  const delta70 = D70, rho = RHO;
  const deriva = derivaPerGiro(delta70, g.nGiri);
  const verdiPer = new Map();
  for (const { drv, lap } of oss) { if (!verdiPer.has(drv)) verdiPer.set(drv, []); verdiPer.get(drv).push(lap); }

  for (let Lf = LF_MIN; Lf <= Math.min(LF_MAX, g.nGiri - H - 1); Lf += 1) {
    // base con soglia 1 (tutti quelli che hanno almeno 1 giro): la soglia la applico dopo,
    // filtrando per numero di giri, cosi' la base e' LA STESSA e cambia solo chi la usa.
    const basi = stimaBasi(oss, { delta70, rho, nGiri: g.nGiri, finoA: Lf, minGiri: 1 });
    const cella = (drv, lap) => { const c = g.perPilota.get(drv); return c ? (c.get ? c.get(lap) : c[lap]) : null; };

    // proiezione: cum(Lf) + somma dei passi previsti sui giri Lf+1..Lf+H
    const previsto = {}, reale = {};
    for (const drv of g.perPilota.keys()) {
      const cLf = cella(drv, Lf), cFin = cella(drv, Lf + H);
      if (!cLf || !cFin) continue;
      if (typeof cLf.cum_time !== 'number' || typeof cFin.cum_time !== 'number') continue;
      const base = basi[drv];
      if (base === null || base === undefined) continue;
      const eta0 = cLf.tyre_age;
      if (typeof eta0 !== 'number') continue;
      let cum = cLf.cum_time;
      for (let k = 1; k <= H; k += 1) cum += base + deriva * (Lf + k - 1) + rho * (eta0 + k);
      previsto[drv] = cum; reale[drv] = cFin.cum_time;
    }
    const piloti = Object.keys(previsto);
    if (piloti.length < 5) continue;
    // il leader al giro Lf (per riferimento del distacco), fra quelli proiettabili
    const leader = piloti.reduce((a, b) => (cella(a, Lf).cum_time <= cella(b, Lf).cum_time ? a : b));
    // FINESTRA PULITA, come M2: nessuna sosta del pilota o del leader in (Lf, Lf+H].
    // Senza questo filtro si misura la frequenza delle soste, non la base: M2 ha
    // misurato |err| mediano 5,69 s/giro nelle finestre con una sosta dentro.
    const sostaDentro = (drv) => {
      for (let k = Lf + 1; k <= Lf + H; k += 1) {
        const c = cella(drv, k);
        if (c && (c.in_lap === true || c.out_lap === true)) return true;
      }
      return false;
    };
    // ...E NEMMENO UNA NEUTRALIZZAZIONE. Il filtro escludeva le soste ma lasciava
    // dentro le finestre in cui il campo viaggiava sotto Safety Car o VSC: li' il
    // distacco non evolve dal passo — si comprime del 30% a giro, misurato — quindi
    // l'errore che si legge NON e' l'errore della base. Sono 502 finestre su 5.186,
    // e fabbricano tutta la coda della distribuzione: il p90 del secchio critico
    // passa da 4,600 a 0,839 s/giro togliendole. Misurare la qualita' della base su
    // giri in cui la base non governa il distacco e' misurare un'altra cosa (E16).
    const neutraDentro = (drv) => {
      for (let k = Lf; k <= Lf + H; k += 1) {
        const c = cella(drv, k);
        if (!c) continue;
        let r = null; try { r = regimeDiCella(c); } catch { r = null; }
        if (r !== null) return true;
      }
      return false;
    };
    const leaderSporco = sostaDentro(leader);
    const leaderNeutro = neutraDentro(leader);
    for (const drv of piloti) {
      if (drv === leader) continue;
      const gapPrev = previsto[drv] - previsto[leader];
      const gapReale = reale[drv] - reale[leader];
      const nVerdi = (verdiPer.get(drv) ?? []).filter((l) => l <= Lf).length;
      const senzaSoste = !leaderSporco && !sostaDentro(drv);
      const senzaNeutra = !leaderNeutro && !neutraDentro(drv);
      righe.push({ gara: nomeSito, Lf, drv, nVerdi, pulita: senzaSoste && senzaNeutra,
                   solo_senza_soste: senzaSoste, err: (gapPrev - gapReale) / H });
    }
  }
}
const TUTTE = righe;
const SOLO_SOSTE = righe.filter((r) => r.solo_senza_soste);
const PULITE = righe.filter((r) => r.pulita);
const p90qb = (v) => { const s2 = [...v].sort((a, b) => a - b); return s2[Math.floor(s2.length * 0.9)]; };
console.log(`proiezioni: ${TUTTE.length} totali`);
console.log(`  senza SOSTE dentro           : ${SOLO_SOSTE.length}`);
console.log(`  senza soste NE' NEUTRALIZZAZIONI: ${PULITE.length}   <- da qui in poi si legge questa`);
{
  const a = SOLO_SOSTE.map((r) => Math.abs(r.err));
  const b = PULITE.map((r) => Math.abs(r.err));
  console.log(`  effetto di togliere le neutralizzazioni (${SOLO_SOSTE.length - PULITE.length} finestre):`);
  console.log(`    |err| mediano ${mediana(a).toFixed(3)} -> ${mediana(b).toFixed(3)} s/giro · p90 ${p90qb(a).toFixed(3)} -> ${p90qb(b).toFixed(3)}`);
}
// da qui in poi si legge SOLO la finestra pulita: la sporca misura le soste, non la base
righe.length = 0; righe.push(...PULITE);

// ── per numero di giri verdi su cui poggia la base ──
console.log('\n═══ ERRORE SUL DISTACCO A 3 GIRI, PER GIRI VERDI DELLA BASE (s/giro) ═══');
console.log('  giri     n   |err| mediano   |err| medio   bias mediano   p90 |err|');
const fasce = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 10], [11, 14], [15, 20], [21, 99]];
const perFascia = [];
for (const [lo, hi] of fasce) {
  const sub = righe.filter((r) => r.nVerdi >= lo && r.nVerdi <= hi);
  if (!sub.length) continue;
  const e = sub.map((r) => r.err), a = e.map(Math.abs).sort((x, y) => x - y);
  const p90 = a[Math.floor(0.9 * (a.length - 1))];
  perFascia.push({ et: `${lo}${hi > lo ? '-' + hi : ''}`, n: sub.length, m: mediana(a), mu: media(a), b: mediana(e), p90 });
  console.log(`  ${(lo + (hi > lo ? '-' + hi : '')).padEnd(6)} ${String(sub.length).padStart(5)}      ${mediana(a).toFixed(3)}         ${media(a).toFixed(3)}        ${mediana(e).toFixed(3)}       ${p90.toFixed(3)}`);
}

// ── il confronto che conta: sotto la soglia contro sopra la soglia ──
console.log('\n═══ IL CONFRONTO SECCO: SOTTO 8 GIRI CONTRO 8+ ═══');
for (const [et, f] of [['< 8 giri (oggi MUTO)', (r) => r.nVerdi < 8], ['>= 8 giri (oggi PARLA)', (r) => r.nVerdi >= 8],
                       ['4-7 giri', (r) => r.nVerdi >= 4 && r.nVerdi <= 7], ['8-11 giri', (r) => r.nVerdi >= 8 && r.nVerdi <= 11]]) {
  const sub = righe.filter(f), e = sub.map((r) => r.err), a = e.map(Math.abs).sort((x, y) => x - y);
  console.log(`  ${et.padEnd(24)} n=${String(sub.length).padStart(5)} · |err| mediano ${mediana(a).toFixed(3)} · medio ${media(a).toFixed(3)} · bias mediano ${mediana(e).toFixed(3)} · p90 ${a[Math.floor(0.9 * (a.length - 1))].toFixed(3)}`);
}

// ── A PARITA' DI GIRO DI CONGELAMENTO: chi ha pochi giri verdi e' anche "presto in gara".
// Se non si separa il confronto e' confuso: sotto controllo Lf, la soglia discrimina ancora?
console.log('\n═══ A PARITA\' DI GIRO DI CONGELAMENTO (Lf 9-16: sotto e sopra soglia convivono) ═══');
console.log('  Lf    n(<8)  |err| med   n(>=8)  |err| med   scarto');
for (let Lf = 9; Lf <= 16; Lf += 1) {
  const s1 = righe.filter((r) => r.Lf === Lf && r.nVerdi < 8), s2 = righe.filter((r) => r.Lf === Lf && r.nVerdi >= 8);
  if (s1.length < 20 || s2.length < 20) continue;
  const m1 = mediana(s1.map((r) => Math.abs(r.err))), m2 = mediana(s2.map((r) => Math.abs(r.err)));
  console.log(`  ${String(Lf).padStart(2)}   ${String(s1.length).padStart(5)}    ${m1.toFixed(3)}    ${String(s2.length).padStart(5)}     ${m2.toFixed(3)}    ${(m1 - m2 >= 0 ? '+' : '') + (m1 - m2).toFixed(3)}`);
}

// ── bootstrap a blocchi = gare sullo scarto fra i due gruppi (E11) ──
console.log('\n═══ BOOTSTRAP A BLOCCHI = GARE (10.000 ricampionamenti, seme fisso) ═══');
let seed = 20260801;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296); };
const perGara = new Map();
for (const r of righe) { if (!perGara.has(r.gara)) perGara.set(r.gara, []); perGara.get(r.gara).push(r); }
const blocchi = [...perGara.values()];
const scarti = [];
for (let b = 0; b < 10000; b += 1) {
  const camp = [];
  for (let i = 0; i < blocchi.length; i += 1) camp.push(...blocchi[Math.floor(rnd() * blocchi.length)]);
  const s1 = camp.filter((r) => r.nVerdi >= 4 && r.nVerdi < 8).map((r) => Math.abs(r.err));
  const s2 = camp.filter((r) => r.nVerdi >= 8).map((r) => Math.abs(r.err));
  if (s1.length < 10 || s2.length < 10) continue;
  scarti.push(mediana(s1) - mediana(s2));
}
scarti.sort((a, b) => a - b);
const q = (p) => scarti[Math.floor(p * (scarti.length - 1))];
const s1 = righe.filter((r) => r.nVerdi >= 4 && r.nVerdi < 8).map((r) => Math.abs(r.err));
const s2 = righe.filter((r) => r.nVerdi >= 8).map((r) => Math.abs(r.err));
console.log(`  scarto |err| mediano  (4-7 giri) − (8+ giri) = ${(mediana(s1) - mediana(s2)).toFixed(4)} s/giro`);
console.log(`  IC95 [${q(0.025).toFixed(4)} ; ${q(0.975).toFixed(4)}] · P(scarto <= 0) = ${(scarti.filter((x) => x <= 0).length / scarti.length).toFixed(3)}`);
console.log(`  (positivo = la base con pochi giri sbaglia DI PIU')`);
