// cancello_rodaggio.mjs — il cancello di PREREG_rodaggio.md §6, eseguito.
//
//     node ai_lab/confronto/cancello_rodaggio.mjs           referto a schermo
//     node ai_lab/confronto/cancello_rodaggio.mjs --json    lo stesso, in JSON
//
// Non decide niente che non sia gia' scritto. Le quattro condizioni, le soglie e
// la lettura primaria stanno nella pre-registrazione, scritta prima della stima:
//
//   C1 mediana|err| <= 1,0        C2 esatti >= 45,29%
//   C3 troppo indietro < 47,53%   C4 |bias medio| < 0,8251
//
// tutte in LETTURA B2 (previsione e verita' ri-classificate sulla terna comune
// verita' ∩ vecchio ∩ nuovo), sugli stessi casi appaiati del confronto.
//
// LETTURA PRIMARIA = LEAVE-ONE-RACE-OUT: i casi di ogni gara sono valutati con i
// (c, tau) stimati sulle ALTRE dieci. La stima su tutte e 11 si riporta come
// lettura secondaria, etichettata dentro campione, e non decide.
//
// I parametri LORO non si ri-stimano qui: si leggono da `modello_v2.json`, dove
// `stima_rodaggio.mjs` li ha depositati con targhetta. Chi vuole rifarli esegue
// quello script, non questo.
//
// NON SCRIVE NIENTE su disco. Non tocca demo/, simulatore/, data/.

// I casi del banco portano il nome di SITO ("Gran Bretagna", con lo spazio); il
// modello indicizza i leave-one-race-out col nome del SIMULATORE
// ("GranBretagna"). Sono due vocabolari veri, non un refuso: si traduce con la
// funzione del banco invece di normalizzare a mano (E24).
import { casi, rispostaVecchio, rispostaNuovo, modelloDaDisco, garaSimDi } from './banco.mjs';

const sigleDi = (ordine) => (ordine ? ordine.map((x) => (Array.isArray(x) ? x[0] : x)) : null);
function rangoRistretto(sigle, dentro, pilota) {
  const f = sigle.filter((d) => dentro.has(d));
  const i = f.indexOf(pilota);
  return i < 0 ? null : { pos: i + 1, su: f.length };
}
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '  —  ' : x.toFixed(n));

// ───────────────────────────────────────── le soglie, dalla PREREG (non da qui)
const SOGLIE = {
  C1_mediana_max: 1.0,
  C2_esatti_min: 45.2914798206278,
  C3_troppo_indietro_max: 47.533632286995514,   // 106/223
  C4_bias_assoluto_max: 0.8251121076233184,
};

// ─────────────────────────────────────────────────────── le varianti di modello
const MODELLO = modelloDaDisco();
const R = MODELLO.rodaggio;
if (!R || typeof R.c !== 'number' || typeof R.tau !== 'number') {
  throw new Error('modello_v2.json non porta i parametri del rodaggio: eseguire prima ai_lab/confronto/stima_rodaggio.mjs');
}
const conRodaggio = (c, tau) => ({ ...MODELLO, rodaggio: { ...R, attivo: true, c, tau } });
const senzaRodaggio = { ...MODELLO, rodaggio: { ...R, attivo: false } };

// ────────────────────────────────────────────────────────────────── la misura
// Tre risposte per caso: vecchio, nuovo SPENTO (la linea di base), nuovo ACCESO
// coi parametri della lettura richiesta. Il vecchio non dipende dal rodaggio ed
// e' calcolato una volta sola.
function misura(parametriDiGara) {
  const righe = [];
  let appaiatiDiversi = 0;
  for (const c of casi()) {
    const V = rispostaVecchio(c);
    const S = rispostaNuovo(c, { modello: senzaRodaggio });
    const p = parametriDiGara(c.gara);
    const A = rispostaNuovo(c, { modello: conRodaggio(p.c, p.tau) });

    // Il rodaggio non deve cambiare CHI risponde: la mutezza dipende dal numero
    // di giri verdi, non dal passo. Se cambiasse, il confronto non sarebbe piu'
    // sugli stessi casi e il cancello andrebbe riscritto — quindi si conta.
    if (S.ok !== A.ok) appaiatiDiversi += 1;

    const sV = sigleDi(V.ordine);
    const vero = c.ordineVero;
    const riga = { id: c.id, gara: c.gara, vOk: V.ok, sOk: S.ok, aOk: A.ok, errS: null, errA: null, errV: null };

    // LETTURA B2 su ciascuna variante, contro lo STESSO vecchio: la terna comune
    // e' verita' ∩ vecchio ∩ (variante in esame).
    for (const [chiave, N] of [['errS', S], ['errA', A]]) {
      const sN = sigleDi(N.ordine);
      if (!(V.ok && N.ok && sV && sN)) continue;
      const sSV = new Set(sV); const sSN = new Set(sN);
      const dentro = new Set(vero.filter((d) => sSV.has(d) && sSN.has(d)));
      const t = rangoRistretto(vero, dentro, c.pilota);
      const pv = rangoRistretto(sV, dentro, c.pilota);
      const pn = rangoRistretto(sN, dentro, c.pilota);
      if (t && pv && pn) { riga[chiave] = pn.pos - t.pos; if (chiave === 'errS') riga.errV = pv.pos - t.pos; }
    }
    righe.push(riga);
  }
  return { righe, appaiatiDiversi };
}

function blocco(errori) {
  const n = errori.length;
  const ass = errori.map(Math.abs);
  return {
    n,
    mediana_assoluto: mediana(ass),
    media_assoluto: media(ass),
    quota_esatti: 100 * errori.filter((e) => e === 0).length / n,
    quota_entro1: 100 * ass.filter((e) => e <= 1).length / n,
    media_segno: media(errori),
    mediana_segno: mediana(errori),
    quota_troppo_indietro: 100 * errori.filter((e) => e > 0).length / n,
    quota_troppo_avanti: 100 * errori.filter((e) => e < 0).length / n,
    max_assoluto: Math.max(...ass),
  };
}

function verdetto(b) {
  const c1 = b.mediana_assoluto <= SOGLIE.C1_mediana_max;
  const c2 = b.quota_esatti >= SOGLIE.C2_esatti_min;
  const c3 = b.quota_troppo_indietro < SOGLIE.C3_troppo_indietro_max;
  const c4 = Math.abs(b.media_segno) < SOGLIE.C4_bias_assoluto_max;
  return { C1: c1, C2: c2, C3: c3, C4: c4, passa: c1 && c2 && c3 && c4 };
}

// ══════════════════════════════════════════════════════════════════ esecuzione
// primaria: leave-one-race-out — ogni gara valutata coi parametri delle altre 10
const loro = R.leave_one_race_out ?? {};
const mancanti = [...new Set(casi().map((c) => garaSimDi(c.gara)))].filter((g) => !loro[g]);
if (mancanti.length) throw new Error(`il modello non ha parametri leave-one-race-out per: ${mancanti.join(', ')}`);

const primaria = misura((gara) => loro[garaSimDi(gara)]);
const secondaria = misura(() => ({ c: R.c, tau: R.tau }));

// appaiati: solo dove rispondono vecchio E entrambe le varianti del nuovo
const appaiate = primaria.righe.filter((r) => r.errS !== null && r.errA !== null);
const appaiateSec = secondaria.righe.filter((r) => r.errS !== null && r.errA !== null);

const base = blocco(appaiate.map((r) => r.errS));
const vecchio = blocco(appaiate.map((r) => r.errV));
const acceso = blocco(appaiate.map((r) => r.errA));
const accesoSec = blocco(appaiateSec.map((r) => r.errA));

const v = verdetto(acceso);
const vSec = verdetto(accesoSec);

// testa a testa e ripartizione per gara (blocchi = gare, E11)
const t2t = { meglio: 0, peggio: 0, pari: 0 };
for (const r of appaiate) {
  const a = Math.abs(r.errA); const s = Math.abs(r.errS);
  if (a < s) t2t.meglio += 1; else if (a > s) t2t.peggio += 1; else t2t.pari += 1;
}
// Il cancello e' quattro condizioni, non un test di significativita': queste due
// misure NON decidono. Ma un margine di pochi casi senza la sua incertezza e'
// un numero che si legge male, e il referto le riporta ovunque — ometterle qui
// sarebbe scegliere il silenzio dove conviene.
function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const bootstrap = (() => {
  const gareElenco = [...new Set(appaiate.map((r) => r.gara))].sort();
  const per = Object.fromEntries(gareElenco.map((g) => [g, appaiate.filter((r) => r.gara === g)]));
  const r = rng(20260801);
  const dEsatti = []; const dMedia = [];
  for (let b = 0; b < 10000; b += 1) {
    const u = [];
    for (let i = 0; i < gareElenco.length; i += 1) u.push(...per[gareElenco[Math.floor(r() * gareElenco.length)]]);
    dEsatti.push(100 * (u.filter((x) => x.errA === 0).length - u.filter((x) => x.errS === 0).length) / u.length);
    dMedia.push(media(u.map((x) => Math.abs(x.errA))) - media(u.map((x) => Math.abs(x.errS))));
  }
  const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))]; };
  return {
    delta_esatti_punti: 100 * (acceso.quota_esatti - base.quota_esatti) / 100,
    delta_esatti_ic95: [q(dEsatti, 0.025), q(dEsatti, 0.975)],
    delta_media_assoluto: acceso.media_assoluto - base.media_assoluto,
    delta_media_ic95: [q(dMedia, 0.025), q(dMedia, 0.975)],
    quota_ricampionamenti_favorevoli: dEsatti.filter((x) => x > 0).length / dEsatti.length,
  };
})();

// test dei segni binomiale esatto a due code sui soli casi discordanti
const pSegni = (() => {
  const n = t2t.meglio + t2t.peggio;
  if (n === 0) return 1;
  const k = Math.min(t2t.meglio, t2t.peggio);
  let coda = 0;
  const logFatt = (m) => { let s = 0; for (let i = 2; i <= m; i += 1) s += Math.log(i); return s; };
  for (let i = 0; i <= k; i += 1) coda += Math.exp(logFatt(n) - logFatt(i) - logFatt(n - i) + n * Math.log(0.5));
  return Math.min(1, 2 * coda);
})();

const perGara = {};
for (const g of [...new Set(appaiate.map((r) => r.gara))].sort()) {
  const sel = appaiate.filter((r) => r.gara === g);
  perGara[g] = {
    n: sel.length,
    esatti_spento: 100 * sel.filter((r) => r.errS === 0).length / sel.length,
    esatti_acceso: 100 * sel.filter((r) => r.errA === 0).length / sel.length,
    bias_spento: media(sel.map((r) => r.errS)),
    bias_acceso: media(sel.map((r) => r.errA)),
    parametri: loro[garaSimDi(g)],
  };
}

const esito = {
  targhetta: {
    protocollo: 'ai_lab/confronto/PREREG_rodaggio.md §6 — cancello scritto prima della stima',
    lettura: 'B2 (terna comune verita\' ∩ vecchio ∩ nuovo)',
    lettura_primaria: 'leave-one-race-out sui parametri (c, tau)',
    soglie: SOGLIE,
    data: '2026-08-01',
  },
  integrita: {
    casi_appaiati: appaiate.length,
    varianti_con_mutezza_diversa: primaria.appaiatiDiversi,
    nota: 'se la mutezza cambiasse, il confronto non sarebbe piu\' sugli stessi casi',
  },
  vecchio_motore: vecchio,
  nuovo_spento: base,
  nuovo_acceso_LORO: acceso,
  nuovo_acceso_dentro_campione: accesoSec,
  verdetto_LORO: v,
  verdetto_dentro_campione: vSec,
  testa_a_testa_acceso_vs_spento: { ...t2t, p_test_dei_segni: pSegni },
  incertezza_non_decide: bootstrap,
  per_gara: perGara,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(esito, null, 2));
  process.exit(v.passa ? 0 : 1);
}

console.log('CANCELLO DEL RODAGGIO — PREREG_rodaggio.md §6, lettura B2');
console.log(`  casi appaiati: ${appaiate.length}  ·  varianti con mutezza diversa: ${primaria.appaiatiDiversi} (deve essere 0)`);
console.log(`  soglie pre-registrate: mediana <= ${SOGLIE.C1_mediana_max} · esatti >= ${f(SOGLIE.C2_esatti_min, 2)}% · troppo indietro < ${f(SOGLIE.C3_troppo_indietro_max, 2)}% · |bias| < ${f(SOGLIE.C4_bias_assoluto_max, 4)}`);
console.log('');
console.log('  motore                        n   med|e|  media|e|   esatti  entro1   bias medio  troppo indietro  troppo avanti');
const riga = (nome, b) => console.log(`  ${nome.padEnd(28)} ${String(b.n).padStart(3)}   ${f(b.mediana_assoluto, 1).padStart(6)}  ${f(b.media_assoluto).padStart(8)}   ${f(b.quota_esatti, 1).padStart(5)}%  ${f(b.quota_entro1, 1).padStart(5)}%   ${(b.media_segno >= 0 ? '+' : '') + f(b.media_segno, 4)}      ${f(b.quota_troppo_indietro, 1).padStart(6)}%         ${f(b.quota_troppo_avanti, 1).padStart(6)}%`);
riga('vecchio', vecchio);
riga('nuovo, rodaggio SPENTO', base);
riga('nuovo, rodaggio ACCESO (LORO)', acceso);
riga('nuovo, ACCESO dentro campione', accesoSec);
console.log('');
console.log('  LE QUATTRO CONDIZIONI, lettura primaria (leave-one-race-out)');
console.log(`    C1  mediana|err| ${f(acceso.mediana_assoluto, 1)} <= ${SOGLIE.C1_mediana_max}                     ${v.C1 ? 'PASSA' : 'FALLISCE'}`);
console.log(`    C2  esatti ${f(acceso.quota_esatti, 2)}% >= ${f(SOGLIE.C2_esatti_min, 2)}%                  ${v.C2 ? 'PASSA' : 'FALLISCE'}`);
console.log(`    C3  troppo indietro ${f(acceso.quota_troppo_indietro, 2)}% < ${f(SOGLIE.C3_troppo_indietro_max, 2)}%          ${v.C3 ? 'PASSA' : 'FALLISCE'}`);
console.log(`    C4  |bias medio| ${f(Math.abs(acceso.media_segno), 4)} < ${f(SOGLIE.C4_bias_assoluto_max, 4)}              ${v.C4 ? 'PASSA' : 'FALLISCE'}`);
console.log(`  → IL RODAGGIO ${v.passa ? 'PASSA il cancello: si accende' : 'NON PASSA: resta SPENTO e va a referto (PREREG §7, §9)'}`);
console.log(`    (dentro campione, che NON decide: ${vSec.passa ? 'passerebbe' : 'non passerebbe'})`);
console.log('');
console.log(`  TESTA A TESTA acceso vs spento: meglio ${t2t.meglio} · peggio ${t2t.peggio} · pari ${t2t.pari} → test dei segni p = ${f(pSegni, 4)}`);
console.log('  INCERTEZZA (non decide il cancello, ma il margine e\' piccolo e va letto con la sua banda)');
console.log(`    Δesatti ${(bootstrap.delta_esatti_punti >= 0 ? '+' : '') + f(bootstrap.delta_esatti_punti, 2)} punti  IC95 [${f(bootstrap.delta_esatti_ic95[0], 2)}; ${f(bootstrap.delta_esatti_ic95[1], 2)}]  ·  favorevole nel ${(100 * bootstrap.quota_ricampionamenti_favorevoli).toFixed(1)}% dei ricampionamenti a blocchi`);
console.log(`    Δmedia|err| ${(bootstrap.delta_media_assoluto >= 0 ? '+' : '') + f(bootstrap.delta_media_assoluto, 4)}  IC95 [${f(bootstrap.delta_media_ic95[0], 4)}; ${f(bootstrap.delta_media_ic95[1], 4)}]`);
console.log('');
console.log('  PER GARA (blocchi = gare, E11) — coi parametri stimati SENZA quella gara');
console.log('    gara              n    esatti spento→acceso     bias spento→acceso      c      tau');
for (const [g, x] of Object.entries(perGara)) {
  console.log(`    ${g.padEnd(15)} ${String(x.n).padStart(3)}    ${f(x.esatti_spento, 1).padStart(5)}% → ${f(x.esatti_acceso, 1).padStart(5)}%      ${(x.bias_spento >= 0 ? '+' : '') + f(x.bias_spento, 3)} → ${(x.bias_acceso >= 0 ? '+' : '') + f(x.bias_acceso, 3)}    ${f(x.parametri.c, 2)}   ${f(x.parametri.tau, 2)}`);
}
process.exit(v.passa ? 0 : 1);
