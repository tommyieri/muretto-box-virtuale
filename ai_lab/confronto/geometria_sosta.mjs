// geometria_sosta.mjs — IL MECCANISMO DIETRO B: perche' un secondo perso diventa
// piu' posizioni nel motore che nella realta'.
//
//     node ai_lab/confronto/geometria_sosta.mjs [--json]
//
// DA DOVE VIENE LA DOMANDA. `REFERTO_conversione_sosta.md` (14/08) separa la
// contraddizione 0,35/0,62 in due errori opposti:
//   A · il motore fa pagare TROPPO POCO tempo (SC 0,731 · VSC 0,814 del vero);
//   B · e converte quel tempo in TROPPE posizioni (VSC 1,6x).
// A e' quantificato e confermato due volte. B era un esito senza meccanismo, e questo
// banco lo cerca.
//
// L'IDENTITA' DA CUI SI PARTE, ed e' quasi una tautologia: chi perde Δt secondi scende
// di tante posizioni quante sono le auto che stanno **entro Δt dietro di lui**. Quindi
// «posizioni per secondo» non e' un parametro del modello: e' una proprieta' della
// GEOMETRIA del campo nel punto in cui uno si ferma.
//
// LA DECOMPOSIZIONE, dichiarata prima di guardare un numero. Per ogni sosta in finestra
// si contano le auto entro una finestra di secondi dietro il pilota, al giro L−1:
//
//   (1) campo del MOTORE, con il Δt del MOTORE      = quello che il motore fa
//   (2) campo del MOTORE, con il Δt VERO            = il CONTROFATTUALE
//   (3) campo VERO,       con il Δt VERO            = quello che succede davvero
//
// (1)→(2) e' l'effetto del TEMPO (A, gia' noto). (2)→(3) e' l'effetto della GEOMETRIA,
// cioe' B, isolato: stesso tempo, campi diversi. Se (2) e (3) coincidono, B non e'
// geometria e la spiegazione va cercata altrove — e lo si scrive.
//
// UNA SECONDA STRADA, misurata insieme perche' non costa niente: fra le auto che uno
// scavalca, quante si sono fermate NELLA STESSA finestra? Chi si ferma insieme perde lo
// stesso tempo e nella realta' non si scambia; se il motore le conta come sorpassi,
// il movimento in eccesso e' un artefatto di contabilita' e non di geometria.
//
// UNITA': la singola sosta in finestra. NON SCRIVE NIENTE su disco, non decide niente.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media, mediana } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');

/** quante auto stanno ENTRO `dt` secondi dietro a `d`, e chi sono */
function dietroEntro(cum, campo, d, dt) {
  const mio = cum[d];
  if (!Number.isFinite(mio) || !Number.isFinite(dt) || dt <= 0) return null;
  const chi = campo.filter((x) => x !== d && Number.isFinite(cum[x]) && cum[x] > mio && cum[x] - mio < dt);
  return chi;
}

const righe = [];
for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  const piani = pianiVeriDi(nomeSito);
  let e = null;
  for (const x of perGara(nomeSito)) {
    const t = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
    });
    if (!t.saltato) { e = t; break; }
  }
  if (!e) continue;

  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  const cumM = {}; const cumV = {};
  for (const d of campo) {
    cumM[d] = {}; for (const p of e.traccia[d]) cumM[d][p.lap] = p.cum_time;
    cumV[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumV[d][L] = c.cum_time;
  }
  const al = (f, L) => Object.fromEntries(campo.map((d) => [d, f[d]?.[L] ?? null]));

  const fermiAl = {};
  for (const r of perGara(nomeSito)) for (const s of r.soste_piano) (fermiAl[s.giro] ||= new Set()).add(r.pilota);
  // chi si ferma dentro la STESSA finestra di neutralizzazione (non solo lo stesso giro)
  const finestraDi = (L) => {
    let a = L; let b = L;
    while (neutraVera[a - 1]) a -= 1;
    while (neutraVera[b + 1]) b += 1;
    return [a, b];
  };

  for (const [lapS, chi] of Object.entries(fermiAl)) {
    const L = Number(lapS);
    if (!neutraVera[L] || L <= e.congelamento) continue;
    const [fa, fb] = finestraDi(L);
    const coFermi = new Set();
    for (let x = fa; x <= fb; x += 1) for (const p of (fermiAl[x] || [])) coFermi.add(p);

    const nonFermi = campo.filter((d) => !chi.has(d));
    const passoM = mediana(nonFermi.map((d) => (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) / 2 : null).filter((x) => x != null));
    const passoV = mediana(nonFermi.map((d) => (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) / 2 : null).filter((x) => x != null));
    if (passoM == null || passoV == null) continue;
    const primaM = al(cumM, L - 1); const primaV = al(cumV, L - 1);
    const dopoM = al(cumM, L + 1); const dopoV = al(cumV, L + 1);
    const rango = (cum, d) => { const v = campo.filter((x) => Number.isFinite(cum[x])).sort((a, b) => cum[a] - cum[b]); const i = v.indexOf(d); return i < 0 ? null : i + 1; };

    for (const d of chi) {
      if (!campo.includes(d)) continue;
      const tm = (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) - 2 * passoM : null;
      const tv = (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) - 2 * passoV : null;
      if (tm == null || tv == null || tv <= 1 || tm <= 1) continue;

      const a1 = dietroEntro(primaM, campo, d, tm);   // motore, tempo del motore
      const a2 = dietroEntro(primaM, campo, d, tv);   // motore, tempo VERO  ← controfattuale
      const a3 = dietroEntro(primaV, campo, d, tv);   // vero,   tempo vero
      if (!a1 || !a2 || !a3) continue;
      // CHI HA DAVVERO SCAVALCATO CHI. Nessun modello: era dietro a L−1 ed e' davanti a
      // L+1. Serve perche' il conteggio statico qui sopra NON predice le posizioni perse
      // (validazione fallita, scarto medio 1,3 su un effetto da 0,4): il campo non sta
      // fermo mentre uno e' ai box. Questo invece e' osservato.
      const passanti = (prima, dopo) => campo.filter((x) => x !== d
        && Number.isFinite(prima[x]) && Number.isFinite(dopo[x])
        && Number.isFinite(prima[d]) && Number.isFinite(dopo[d])
        && prima[x] > prima[d] && dopo[x] < dopo[d]);
      const pasM = passanti(primaM, dopoM);
      const pasV = passanti(primaV, dopoV);
      // VALIDAZIONE del modello statico: il conteggio «quante auto entro Δt dietro» deve
      // predire le posizioni davvero perse. Se non lo facesse, la decomposizione sopra
      // sarebbe un'aritmetica su una grandezza che non descrive la corsa.
      const persoM = rango(dopoM, d) - rango(primaM, d);
      const persoV = rango(dopoV, d) - rango(primaV, d);
      righe.push({
        gara: nomeSito, pilota: d, lap: L, regime: neutraVera[L], tm, tv,
        persoM, persoV,
        n1: a1.length, n2: a2.length, n3: a3.length,
        // quanti degli scavalcati si erano fermati nella stessa finestra
        co1: a1.filter((x) => coFermi.has(x)).length,
        co3: a3.filter((x) => coFermi.has(x)).length,
        // osservati, non modellati
        pasM: pasM.length, pasV: pasV.length,
        pasM_co: pasM.filter((x) => coFermi.has(x)).length,
        pasV_co: pasV.filter((x) => coFermi.has(x)).length,
      });
    }
  }
}

const perRegime = { TUTTE: righe };
for (const r of righe) (perRegime[r.regime] ||= []).push(r);

const num = (x) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(3)));
const riga = (v) => ({
  n: v.length,
  tempo_motore: num(mediana(v.map((x) => x.tm))),
  tempo_vero: num(mediana(v.map((x) => x.tv))),
  n1_motore_tempo_motore: num(media(v.map((x) => x.n1))),
  n2_motore_tempo_vero: num(media(v.map((x) => x.n2))),
  n3_vero_tempo_vero: num(media(v.map((x) => x.n3))),
  effetto_tempo: num(media(v.map((x) => x.n1 - x.n2))),
  effetto_geometria: num(media(v.map((x) => x.n2 - x.n3))),
  co_fermi_motore: num(media(v.map((x) => x.co1))),
  co_fermi_vero: num(media(v.map((x) => x.co3))),
  // la validazione: previsto contro osservato, e lo scarto medio assoluto
  perso_motore: num(media(v.map((x) => x.persoM))),
  perso_vero: num(media(v.map((x) => x.persoV))),
  scarto_modello_motore: num(media(v.map((x) => Math.abs(x.n1 - x.persoM)))),
  scarto_modello_vero: num(media(v.map((x) => Math.abs(x.n3 - x.persoV)))),
  // OSSERVATI: chi ha davvero scavalcato chi si e' fermato
  passanti_motore: num(media(v.map((x) => x.pasM))),
  passanti_vero: num(media(v.map((x) => x.pasV))),
  passanti_motore_giaAiBox: num(media(v.map((x) => x.pasM_co))),
  passanti_vero_giaAiBox: num(media(v.map((x) => x.pasV_co))),
  passanti_motore_restati: num(media(v.map((x) => x.pasM - x.pasM_co))),
  passanti_vero_restati: num(media(v.map((x) => x.pasV - x.pasV_co))),
});

const fuori = Object.fromEntries(Object.entries(perRegime).map(([k, v]) => [k, riga(v)]));

if (JSON_OUT) { console.log(JSON.stringify({ per_regime: fuori, righe }, null, 1)); } else {
  console.log('');
  console.log('  IL MECCANISMO DIETRO B — quante auto stanno entro Δt dietro chi si ferma');
  console.log('');
  for (const [k, r] of Object.entries(fuori)) {
    if (!r.n) continue;
    console.log(`  ${k}  (n = ${r.n})   Δt motore ${r.tempo_motore} s · Δt vero ${r.tempo_vero} s`);
    console.log(`    (1) campo MOTORE, Δt motore   ${String(r.n1_motore_tempo_motore).padStart(6)} auto  ← quello che il motore fa`);
    console.log(`    (2) campo MOTORE, Δt VERO     ${String(r.n2_motore_tempo_vero).padStart(6)} auto  ← controfattuale`);
    console.log(`    (3) campo VERO,   Δt vero     ${String(r.n3_vero_tempo_vero).padStart(6)} auto  ← la realta'`);
    console.log(`        effetto TEMPO (1)−(2)     ${String(r.effetto_tempo).padStart(6)}`);
    console.log(`        effetto GEOMETRIA (2)−(3) ${String(r.effetto_geometria).padStart(6)}`);
    console.log(`        di cui gia' ai box: motore ${r.co_fermi_motore} · vero ${r.co_fermi_vero}`);
    console.log(`    validazione: posizioni PERSE davvero  motore ${r.perso_motore} · vero ${r.perso_vero}`);
    console.log(`                 scarto medio |modello − osservato|  motore ${r.scarto_modello_motore} · vero ${r.scarto_modello_vero}`);
    console.log(`    OSSERVATO: chi lo scavalca   motore ${r.passanti_motore} · vero ${r.passanti_vero}`);
    console.log(`               di cui gia' ai box  motore ${r.passanti_motore_giaAiBox} · vero ${r.passanti_vero_giaAiBox}`);
    console.log(`               rimasti in pista    motore ${r.passanti_motore_restati} · vero ${r.passanti_vero_restati}`);
    console.log('');
  }
}
