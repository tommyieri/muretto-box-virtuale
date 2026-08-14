// movimento_neutralizzazione.mjs — QUANTO MOVIMENTO AVVIENE SOTTO SAFETY CAR,
// e quanto ne produce il motore.
//
//     node ai_lab/confronto/movimento_neutralizzazione.mjs [--json]
//
// PERCHE'. `ESITO_tetto_sottotarato.md` (14/08) chiude il tetto al movimento come NULL e
// indica l'unico pezzo che il tetto NON copre: il tetto gira solo sui giri VERDI
// (`if (tetto !== null && !comprime)`), quindi dentro le finestre SC/VSC il movimento lo
// governa la compressione — e la compressione ha una proprieta' che va detta prima di
// misurare qualunque cosa:
//
//     m.c_dopo = capofila.c_dopo + gap_prima * kappa
//
// e' una moltiplicazione per un numero POSITIVO, quindi conserva l'ordine ESATTAMENTE.
// Verificato eseguendo il kernel: otto giri compressi con passi da 89 a 94 s lasciano
// l'ordine identico a quello del congelamento, mentre gli stessi otto giri in verde lo
// rimescolano completamente. **Sotto neutralizzazione il motore non puo' produrre un
// sorpasso**: le sole cose che spostano qualcuno li' dentro sono le soste (escluse dalla
// compressione per contratto) e i ritiri.
//
// LA MISURA, dichiarata prima di eseguirla:
//
//  · UNITA': la GARA, non il caso. In questo banco ogni caso di una stessa gara e' la
//    stessa gara con un soggetto diverso, quindi contare 193 casi sarebbe pseudo-replica.
//    Si prende UN caso per gara (il primo utilizzabile, deterministico): 11 unita'.
//  · PERIMETRO: i giri da freeze+1 alla bandiera, cioe' quelli che il motore proietta.
//    Confrontare il motore su 50 giri con la realta' su 60 sarebbe un confronto fra due
//    popolazioni (E16).
//  · REGIME: `regimePerGiroDiCampo`, la definizione DI CAMPO gia' usata dal costruttore.
//    Non lo status per-auto: una gialla su una macchina sola non e' una Safety Car.
//  · MOVIMENTO: `cambiDiPosizione` del kernel — QUANTI cambiano posizione, non QUALI — fra
//    l'ordine all'inizio e alla fine di ogni tratto omogeneo, sul campo COMUNE ai due.
//  · SI RIPORTA anche quanti dei cambi del motore sotto neutralizzazione cadono in un
//    tratto in cui qualcuno si e' fermato: e' l'unica sorgente che gli resta, e se il conto
//    non torna vuol dire che questo commento e' sbagliato.
//
// NON SCRIVE NIENTE su disco, non decide niente: e' un referto descrittivo.

import { gare, garaNuova, contestoNuovo } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { cambiDiPosizione } from '../../simulatore/engine/kernel.mjs';
import { corri, pianiVeriDi, perGara, media } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
// S1 di PREREG_sosta_neutralizzazione.md: il fattore MISURATO in casa al posto del prior
// esterno. Ingresso di laboratorio, mai in produzione (`promosso` resta false nel sigillo).
const FATTORI_INTERNI = process.argv.includes('--fattori-interni');
const FORZATO = (() => { const a = process.argv.find((x) => x.startsWith('--fattore=')); return a ? Number(a.split('=')[1]) : null; })();

// ordine per cum a un dato giro, sul campo passato
const ordineDa = (cumAlGiro, campo) => campo.filter((d) => cumAlGiro[d] != null)
  .sort((a, b) => cumAlGiro[a] - cumAlGiro[b]);

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

  // UN caso per gara: il primo utilizzabile
  let e = null;
  for (const x of perGara(nomeSito)) {
    const t = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
      fattoriInterni: FATTORI_INTERNI, fattoreForzato: FORZATO,
    });
    if (!t.saltato) { e = t; break; }
  }
  if (!e) { righe.push({ gara: nomeSito, saltata: 'nessun caso utilizzabile' }); continue; }

  const lf = e.congelamento; const nGiri = e.n_giri;
  // il campo comune: chi ha una traccia nel motore E celle vere
  const conTraccia = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d);
  const campo = conTraccia.filter((d) => gSim.perPilota.get(d)?.size);

  const cumMotore = {}; const cumVero = {};
  for (const d of campo) {
    cumMotore[d] = {}; for (const p of e.traccia[d]) cumMotore[d][p.lap] = p.cum_time;
    cumVero[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumVero[d][L] = c.cum_time;
  }
  const alGiro = (fonte, L) => Object.fromEntries(campo.map((d) => [d, fonte[d]?.[L] ?? null]));

  // i tratti omogenei di regime, dentro il perimetro proiettato
  const tratti = [];
  let corr = null;
  for (let L = lf + 1; L <= nGiri; L += 1) {
    const neutro = !!neutraVera[L];
    if (corr === null || corr.neutro !== neutro) { corr = { neutro, da: L, a: L }; tratti.push(corr); } else corr.a = L;
  }

  // le soste VERE di chiunque, per gara: servono a spiegare i cambi del motore in finestra
  const sosteDi = {};
  for (const r of perGara(nomeSito)) for (const s of r.soste_piano) (sosteDi[s.giro] ||= []).push(r.pilota);

  const conta = { verde: { giri: 0, vero: 0, motore: 0 },
    neutro: { giri: 0, vero: 0, motore: 0, conSosta: 0, senzaSosta: 0,
      // IL PUNTO CIECO STRUTTURALE: i tratti neutralizzati in cui NESSUNO si ferma. Li' il
      // motore non ha nessuna sorgente di movimento — la compressione conserva l'ordine —
      // quindi produce ZERO per costruzione. Quanto ne produce la REALTA' li' dentro e' la
      // misura esatta di cio' che il motore non puo' fare, non di cio' che fa male.
      giriSenzaSosta: 0, veroSenzaSosta: 0, veroConSosta: 0 } };
  for (const t of tratti) {
    const k = t.neutro ? 'neutro' : 'verde';
    conta[k].giri += t.a - t.da + 1;
    const primaM = ordineDa(alGiro(cumMotore, t.da - 1), campo);
    const dopoM = ordineDa(alGiro(cumMotore, t.a), campo);
    const primaV = ordineDa(alGiro(cumVero, t.da - 1), campo);
    const dopoV = ordineDa(alGiro(cumVero, t.a), campo);
    const cm = (primaM.length && dopoM.length) ? cambiDiPosizione(primaM, dopoM) : 0;
    const cv = (primaV.length && dopoV.length) ? cambiDiPosizione(primaV, dopoV) : 0;
    conta[k].vero += cv; conta[k].motore += cm;
    if (t.neutro) {
      let sosteQui = 0;
      for (let L = t.da; L <= t.a; L += 1) sosteQui += (sosteDi[L] || []).length;
      if (sosteQui > 0) { conta.neutro.conSosta += cm; conta.neutro.veroConSosta += cv; } else {
        conta.neutro.senzaSosta += cm; conta.neutro.veroSenzaSosta += cv;
        conta.neutro.giriSenzaSosta += t.a - t.da + 1;
      }
    }
  }
  righe.push({ gara: nomeSito, pilota: e.pilota ?? '—', congelamento: lf, n_giri: nGiri, campo: campo.length, ...conta });
}

const vive = righe.filter((r) => !r.saltata);
const somma = (k, s) => vive.reduce((a, r) => a + r[k][s], 0);
const tot = {
  giri_verdi: somma('verde', 'giri'), giri_neutri: somma('neutro', 'giri'),
  vero_verde: somma('verde', 'vero'), vero_neutro: somma('neutro', 'vero'),
  motore_verde: somma('verde', 'motore'), motore_neutro: somma('neutro', 'motore'),
  motore_neutro_con_sosta: somma('neutro', 'conSosta'),
  motore_neutro_senza_sosta: somma('neutro', 'senzaSosta'),
  giri_neutri_senza_sosta: somma('neutro', 'giriSenzaSosta'),
  vero_neutro_senza_sosta: somma('neutro', 'veroSenzaSosta'),
  vero_neutro_con_sosta: somma('neutro', 'veroConSosta'),
};
tot.quota_reale_in_neutro = tot.vero_verde + tot.vero_neutro
  ? Number((tot.vero_neutro / (tot.vero_verde + tot.vero_neutro) * 100).toFixed(1)) : null;
tot.quota_giri_neutri = Number((tot.giri_neutri / (tot.giri_verdi + tot.giri_neutri) * 100).toFixed(1));
tot.reso_verde = tot.vero_verde ? Number((tot.motore_verde / tot.vero_verde * 100).toFixed(1)) : null;
tot.reso_neutro = tot.vero_neutro ? Number((tot.motore_neutro / tot.vero_neutro * 100).toFixed(1)) : null;

if (JSON_OUT) { console.log(JSON.stringify({ per_gara: righe, totale: tot }, null, 1)); } else {
  console.log('');
  console.log('  IL MOVIMENTO DENTRO LE NEUTRALIZZAZIONI — una gara per riga, non un caso');
  console.log('');
  console.log('  gara            giri V/N     cambi VERI V/N     cambi MOTORE V/N');
  for (const r of righe) {
    if (r.saltata) { console.log(`  ${r.gara.padEnd(15)} ${r.saltata}`); continue; }
    console.log(`  ${r.gara.padEnd(15)} ${String(r.verde.giri).padStart(3)}/${String(r.neutro.giri).padEnd(3)}  `
      + `   ${String(r.verde.vero).padStart(3)}/${String(r.neutro.vero).padEnd(3)}   `
      + `        ${String(r.verde.motore).padStart(3)}/${String(r.neutro.motore).padEnd(3)}`);
  }
  console.log('');
  console.log(`  giri:   verdi ${tot.giri_verdi} · neutralizzati ${tot.giri_neutri} (${tot.quota_giri_neutri}% del percorso)`);
  console.log(`  VERI:   in verde ${tot.vero_verde} cambi · in neutralizzazione ${tot.vero_neutro} (${tot.quota_reale_in_neutro}% di tutto il movimento)`);
  console.log(`  MOTORE: in verde ${tot.motore_verde} cambi · in neutralizzazione ${tot.motore_neutro}`);
  console.log(`  resa:   verde ${tot.reso_verde}% · neutralizzazione ${tot.reso_neutro}%`);
  console.log(`  dei ${tot.motore_neutro} cambi del motore in finestra: ${tot.motore_neutro_con_sosta} in tratti CON soste · ${tot.motore_neutro_senza_sosta} senza`);
  console.log('');
  console.log(`  IL PUNTO CIECO — tratti neutralizzati SENZA nessuna sosta: ${tot.giri_neutri_senza_sosta} giri`);
  console.log(`     la realta' ci produce ${tot.vero_neutro_senza_sosta} cambi · il motore ${tot.motore_neutro_senza_sosta}, e non per un difetto: per costruzione`);
  console.log(`  dove invece qualcuno si ferma: reali ${tot.vero_neutro_con_sosta} · motore ${tot.motore_neutro_con_sosta}`);
  console.log('');
}
