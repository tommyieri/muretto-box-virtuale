// conversione_sosta.mjs — DA DOVE VIENE LA CONTRADDIZIONE FRA 0,35 E 0,62.
//
//     node ai_lab/confronto/conversione_sosta.mjs [--json]
//
// I DUE NUMERI NON MISURANO LA STESSA COSA, ed e' il primo passo per capirli:
//
//   0,6227  e' un TEMPO — la perdita realizzata da una sosta sotto SC rispetto al campo,
//           in frazione della perdita verde. Misurata sui soli cum_time, 147 gare, 3.911
//           soste, controllo in verde 1,011.
//   0,35    e' un CONTEGGIO DI POSIZIONI risolto all'indietro: il fattore che, dentro il
//           motore, riproduce i 122 cambi di posizione veri nelle finestre.
//
// Quindi il motore puo' sbagliare in due punti diversi, e questo banco li separa.
//
// LE TRE STRADE, dichiarate prima di guardare un numero:
//
//   A · IL TEMPO. Il motore applica a una sosta in finestra un tempo diverso da quello
//       che quella sosta e' costata davvero. Se e' questo, il rapporto fra il tempo perso
//       dal motore e quello vero e' lontano da 1.
//   B · LA CONVERSIONE. Il tempo e' giusto ma diventa troppe posizioni: dipende da quante
//       auto stanno dentro quella finestra di secondi attorno a chi si ferma, cioe' dalla
//       GEOMETRIA del campo, non dal prezzo. Se e' questo, le posizioni perse per secondo
//       perso sono piu' alte nel motore che nella realta'.
//   C · LA DISPERSIONE. Il motore usa una MEDIANA dove la realta' ha p25-p75 da 0,21 a
//       1,05 (dichiarato nella targhetta del sigillo). Una costante non e' una
//       distribuzione: se e' questo, i tempi del motore sono giusti in mediana e troppo
//       CONCENTRATI, e le posizioni perse hanno una varianza piu' bassa del vero.
//
// UNITA': la singola SOSTA che cade dentro una finestra di neutralizzazione, non il caso
// e non la gara. Perimetro: le soste oltre il congelamento, dove il motore ha una traccia.
//
// COME SI MISURA UNA SOSTA, e le due definizioni sono le stesse per motore e realta':
//   tempo perso  = (cum(L+1) − cum(L−1)) del pilota, meno DUE volte la mediana del giro
//                  di chi NON si ferma. DUE giri, non uno: la perdita ai box e' per
//                  convenzione di questo progetto «(in-lap + out-lap) meno due giri di
//                  passo pulito» (CLAUDE.md), e il kernel la applica INTERA sul giro della
//                  sosta. La prima scrittura di questo banco misurava un giro solo: sul
//                  lato VERO perdeva tutto l'out-lap e faceva sembrare che il motore
//                  addebitasse il doppio (rapporto 1,94, e 3,90 sotto SC). Era un difetto
//                  dello strumento, e lo si vedeva perche' contraddiceva una misura che il
//                  repo ha gia' sulle stesse gare.
//   posizioni    = rango a L−1 meno rango a L, sul campo comune ai due.
//
// NON SCRIVE NIENTE su disco, non decide niente: e' un referto descrittivo.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara, media, mediana } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');

const rango = (cum, campo, d) => {
  const v = campo.filter((x) => Number.isFinite(cum[x])).sort((a, b) => cum[a] - cum[b]);
  const i = v.indexOf(d);
  return i < 0 ? null : i + 1;
};

const soste = [];
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

  // chi si ferma a quale giro, dalla verita'
  const fermiAl = {};
  for (const r of perGara(nomeSito)) for (const s of r.soste_piano) (fermiAl[s.giro] ||= new Set()).add(r.pilota);

  for (const [lapS, chi] of Object.entries(fermiAl)) {
    const L = Number(lapS);
    if (!neutraVera[L] || L <= e.congelamento) continue;      // solo le soste in finestra
    const regime = neutraVera[L];
    // il passo del campo su quel giro: chi NON si ferma
    const nonFermi = campo.filter((d) => !chi.has(d));
    const passoM = mediana(nonFermi.map((d) => (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) / 2 : null).filter((x) => x != null));
    const passoV = mediana(nonFermi.map((d) => (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) / 2 : null).filter((x) => x != null));
    if (passoM == null || passoV == null) continue;
    const primaM = al(cumM, L - 1); const dopoM = al(cumM, L + 1);
    const primaV = al(cumV, L - 1); const dopoV = al(cumV, L + 1);
    for (const d of chi) {
      if (!campo.includes(d)) continue;
      const tm = (cumM[d]?.[L + 1] != null && cumM[d]?.[L - 1] != null) ? (cumM[d][L + 1] - cumM[d][L - 1]) - 2 * passoM : null;
      const tv = (cumV[d]?.[L + 1] != null && cumV[d]?.[L - 1] != null) ? (cumV[d][L + 1] - cumV[d][L - 1]) - 2 * passoV : null;
      if (tm == null || tv == null) continue;
      const pm = rango(dopoM, campo, d) - rango(primaM, campo, d);
      const pv = rango(dopoV, campo, d) - rango(primaV, campo, d);
      if (!Number.isFinite(pm) || !Number.isFinite(pv)) continue;
      soste.push({ gara: nomeSito, pilota: d, lap: L, regime, tm, tv, pm, pv });
    }
  }
}

const sd = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
const perRegime = {};
for (const s of soste) (perRegime[s.regime] ||= []).push(s);

const num = (x) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(4)));
const riga = (v) => ({
  n: v.length,
  tempo_motore: num(mediana(v.map((s) => s.tm))),
  tempo_vero: num(mediana(v.map((s) => s.tv))),
  rapporto_tempi: num(mediana(v.map((s) => s.tm)) / mediana(v.map((s) => s.tv))),
  posizioni_motore: num(mediana(v.map((s) => s.pm))),
  posizioni_vere: num(mediana(v.map((s) => s.pv))),
  // B: posizioni perse per SECONDO perso, solo dove il tempo perso e' positivo e non minuscolo
  conv_motore: num(mediana(v.filter((s) => s.tm > 1).map((s) => s.pm / s.tm))),
  conv_vero: num(mediana(v.filter((s) => s.tv > 1).map((s) => s.pv / s.tv))),
  n_conv_vero: v.filter((s) => s.tv > 1).length,
  // C: quanto sono concentrati i tempi
  sd_tempo_motore: num(sd(v.map((s) => s.tm))),
  sd_tempo_vero: num(sd(v.map((s) => s.tv))),
  sd_pos_motore: num(sd(v.map((s) => s.pm))),
  sd_pos_vere: num(sd(v.map((s) => s.pv))),
});

const fuori = { totale: riga(soste), per_regime: Object.fromEntries(Object.entries(perRegime).map(([k, v]) => [k, riga(v)])) };

if (JSON_OUT) { console.log(JSON.stringify({ ...fuori, soste }, null, 1)); } else {
  console.log('');
  console.log('  DA DOVE VIENE LA CONTRADDIZIONE — una riga per SOSTA in finestra');
  console.log('');
  const stampa = (nome, r) => {
    console.log(`  ${nome}  (n = ${r.n})`);
    console.log(`    A · IL TEMPO       motore ${String(r.tempo_motore).padStart(7)} s   vero ${String(r.tempo_vero).padStart(7)} s   rapporto ${r.rapporto_tempi}`);
    console.log(`    B · LA CONVERSIONE motore ${String(r.conv_motore).padStart(7)} pos/s  vero ${String(r.conv_vero).padStart(7)} pos/s  (n con perdita > 1 s: ${r.n_conv_vero})`);
    console.log(`        posizioni perse   motore ${r.posizioni_motore}   vero ${r.posizioni_vere}`);
    console.log(`    C · LA DISPERSIONE sd tempo  motore ${r.sd_tempo_motore} s  vero ${r.sd_tempo_vero} s`);
    console.log(`                       sd posiz. motore ${r.sd_pos_motore}    vero ${r.sd_pos_vere}`);
    console.log('');
  };
  stampa('TUTTE', fuori.totale);
  for (const [k, r] of Object.entries(fuori.per_regime)) stampa(k, r);
}
