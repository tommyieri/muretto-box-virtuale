// migliora_strategia.mjs — LA GARA LORO, POI LA GARA MIGLIORE: il record chiesto dal PO.
//
//     node ai_lab/confronto/migliora_strategia.mjs [--json]
//
// Dieci gare (TUTTE tranne Monaco, richiesta esplicita del PO 07/08/2026), dieci team
// diversi, un pilota per team. Per ogni caso, DUE bracci sullo stesso congelamento:
//
//   A. LA LORO GARA NEL MOTORE — la strategia vera del soggetto, i rivali con le LORO
//      soste vere (informazione dal futuro SIMMETRICA, ingresso di laboratorio):
//      e' `corri` di bandiera.mjs con pianiRivali, cioe' la configurazione gia' usata
//      per misurare la fisica a strategia nota.
//
//   B. LA GARA MIGLIORE CHE IL MOTORE SA TROVARE — sapendo come e' andata a tutti
//      (stessi rivali veri), si cerca la strategia del soggetto che massimizza la
//      POSIZIONE alla bandiera (lessicografico: posizione, poi tempo). Ricerca
//      dichiarata: k in {0,1,2,3}, griglia grossa sui giri di sosta poi discesa per
//      coordinate (+-2, due passate); le mescole escono da mescolePerSoste (il
//      regolamento e' un vincolo, non una variabile di ricerca: con la vita mescola
//      accesa l'ordine deterministico HARD->MEDIUM->SOFT e' una scelta DICHIARATA,
//      non ottimizzata). k=0 e' ammesso solo se il soggetto ha gia' usato due slick
//      al congelamento (REG01). Durante la ricerca il Director non gira (come in
//      pianoOttimo); il piano VINCENTE passa da eseguiEValida, e se lo respinge si
//      scala al migliore approvato.
//
// QUESTO NON E' UN CANCELLO: e' un record descrittivo per la diagnosi (dove sbaglia il
// motore con la strategia vera; quanto PROMETTE il cambio di strategia — promessa
// motore-contro-motore, mai contro la realta'). Nessuna soglia, nessun verdetto.
// La fisica sta nel costruttore unico e nel kernel (E17): qui solo ricerca e conto.

import { gare, garaSimDi, garaNuova, contestoNuovo, riclassifica } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import {
  corri, pianiVeriDi, perGara, ordineVero, ordineAlGiro, ordinePrevisto, mediana,
} from './bandiera.mjs';
import { costruisciScenario, eseguiEValida } from '../../simulatore/scenario/costruttore.mjs';
import { simulate } from '../../simulatore/engine/kernel.mjs';
import { mescolePerSoste } from '../../simulatore/scenario/piano.mjs';

const JSON_OUT = process.argv.includes('--json');

// ── il perimetro, meccanico e cieco all'esito ────────────────────────────────
// Dieci team in ordine alfabetico X dieci gare in ordine alfabetico (senza Monaco).
const TEAM = ['Alpine', 'Aston Martin', 'Audi', 'Cadillac', 'Ferrari',
  'Haas F1 Team', 'McLaren', 'Mercedes', 'Racing Bulls', 'Red Bull Racing'];
const GARE = gare().filter((g) => g !== 'Monaco');

// ── un candidato: soste del soggetto -> posizione alla bandiera ──────────────
// Director SPENTO qui dentro (come pianoOttimo): la validazione tocca al vincitore.
function valuta(nomeSito, pilota, lf, soste, piani, contesto, gSim, nonClassificati = [], ritiriVeri = undefined, neutraVera = undefined) {
  let sc;
  try {
    // `rivaliNonClassificati`: i ritirati veri vengono proiettati lo stesso (il kernel
    // non fa sparire nessuno) ma REG01 non squalifica un arrivo mai successo — la
    // stessa tacca dichiarata usata dalla pagina «E se?», che l'ha scoperta.
    sc = costruisciScenario({
      gara: garaSimDi(nomeSito), freezeLap: lf, pilota, piano: soste,
      pianiRivali: piani, rivaliNonClassificati: nonClassificati,
      // i ritiri VERI (riparazione 2) e le neutralizzazioni VERE (riparazione 1):
      // a gara nota sono DATI, e il costruttore li dichiara come tali
      ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera,
    }, contesto);
  } catch { return null; }
  const ris = simulate({
    state: sc.state, pace: sc.pace, freezeLap: sc.freezeLap, steps: sc.steps,
    pits: sc.pits, neutralizzazione: sc.neutralizzazione ?? null, tetto: sc.tetto ?? null,
    ritiri: sc.ritiri ?? null, traccia: true,
  });
  const prev = ordinePrevisto(ris.traccia, gSim.nGiri);
  if (!prev || !prev.ordine.includes(pilota)) return null;
  return {
    soste,
    posizione: prev.ordine.indexOf(pilota) + 1,
    su: prev.ordine.length,
    cum: ris.cum[pilota],
    ordine: prev.ordine,
  };
}

const meglio = (a, b) => {
  if (!a) return b; if (!b) return a;
  if (a.posizione !== b.posizione) return a.posizione < b.posizione ? a : b;
  return a.cum <= b.cum ? a : b;
};

/** Le slick gia' usate dal soggetto fino al congelamento (informazione <= Lf). */
function slickUsate(gSim, pilota, lf) {
  const usate = new Set();
  const celle = gSim.perPilota.get(pilota);
  if (!celle) return usate;
  for (let l = 1; l <= lf; l += 1) {
    const c = celle.get(l);
    if (c && ['SOFT', 'MEDIUM', 'HARD'].includes(c.compound)) usate.add(c.compound);
  }
  return usate;
}

/** La ricerca per un k fissato: griglia grossa + discesa per coordinate. */
function cercaK(k, { nomeSito, pilota, lf, piani, contesto, gSim, usate, nonClassificati, ritiriVeri, neutraVera }) {
  const nGiri = gSim.nGiri;
  const mescole = mescolePerSoste(k, [...usate]);
  const conMescole = (giri) => giri.map((g, i) => ({ giro: g, mescola: mescole[i] ?? mescole[mescole.length - 1] ?? 'MEDIUM' }));
  const prova = (giri) => {
    for (let i = 1; i < giri.length; i += 1) if (giri[i] <= giri[i - 1]) return null;
    if (giri[0] <= lf || giri[giri.length - 1] >= nGiri) return null;
    return valuta(nomeSito, pilota, lf, conMescole(giri), piani, contesto, gSim, nonClassificati, ritiriVeri, neutraVera);
  };
  let migliore = null;
  let valutati = 0;
  if (k === 0) return { migliore: prova([]), valutati: 1 };

  // griglia grossa: passo scelto per tenere la combinatoria sotto le ~100 valutazioni
  const passo = k === 1 ? 3 : k === 2 ? 4 : 6;
  const grid = [];
  for (let g = lf + 1; g <= nGiri - 1; g += passo) grid.push(g);
  const combina = (resto, da, acc) => {
    if (resto === 0) { const e = prova(acc); valutati += 1; migliore = meglio(migliore, e); return; }
    for (let i = da; i < grid.length; i += 1) combina(resto - 1, i + 1, [...acc, grid[i]]);
  };
  combina(k, 0, []);
  if (!migliore) return { migliore: null, valutati };

  // discesa per coordinate, due passate, raggio 2 (come la restrizione dichiarata
  // di pianoOttimo: si accetta un ottimo locale, e lo si dice)
  for (let passata = 0; passata < 2; passata += 1) {
    for (let i = 0; i < k; i += 1) {
      for (const d of [-2, -1, 1, 2]) {
        const giri = migliore.soste.map((s) => s.giro);
        giri[i] += d;
        const e = prova(giri);
        valutati += 1;
        migliore = meglio(migliore, e);
      }
    }
  }
  return { migliore, valutati };
}

// ── un caso completo ─────────────────────────────────────────────────────────
function caso(team, nomeSito) {
  const duo = perGara(nomeSito).filter((x) => x.team === team).map((x) => x.pilota).sort();
  const piani = pianiVeriDi(nomeSito);

  const gSimPerRitiri = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSimPerRitiri.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSimPerRitiri.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }

  let base = null; let pilota = null; const saltati = [];
  for (const p of duo) {
    const e = corri(nomeSito, p, { pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera });
    if (e.saltato) { saltati.push(`${p}: ${e.saltato}`); continue; }
    base = e; pilota = p; break;
  }
  if (!base) return { team, gara: nomeSito, pilota: duo.join('/') || '—', saltato: saltati.join(' · ') || 'nessun pilota del team' };

  const gSim = garaNuova(nomeSito);
  const contesto = contestoNuovo(nomeSito);
  const lf = base.congelamento;
  const usate = slickUsate(gSim, pilota, lf);
  const nonClassificati = perGara(nomeSito).filter((x) => !x.classificato).map((x) => x.pilota);

  // il braccio A rivalutato con la MIA valuta(): stessa strada del braccio B, cosi'
  // il confronto A/B e' motore-contro-motore senza nessuna differenza di montaggio
  const r = perGara(nomeSito).find((x) => x.pilota === pilota);
  const sosteVere = r.soste_piano.filter((s) => s.giro > lf && ['SOFT', 'MEDIUM', 'HARD'].includes(s.mescola));
  const bracciA = valuta(nomeSito, pilota, lf, sosteVere, piani, contesto, gSim, nonClassificati, ritiriVeri, neutraVera);

  // il braccio B: la ricerca su k = 0..3. LA STRATEGIA VERA E' UN CANDIDATO:
  // «migliorare» non puo' mai restituire un piano peggiore di quello che il
  // pilota ha corso davvero — senza questa riga, su un plateau di posizioni la
  // discesa per coordinate puo' fermarsi su un ottimo locale piu' lento del vero
  // (successo a Spa: P11 pari e 9,5 s piu' lento).
  const perK = [];
  let migliore = bracciA && sosteVere.length ? { ...bracciA, k: sosteVere.length } : null;
  let valutatiTot = 0;
  for (const k of [0, 1, 2, 3]) {
    if (k === 0 && usate.size < 2) { perK.push({ k, posizione: null, nota: 'illegale (una sola slick usata al congelamento, REG01)' }); continue; }
    const { migliore: mk, valutati } = cercaK(k, { nomeSito, pilota, lf, piani, contesto, gSim, usate, nonClassificati, ritiriVeri, neutraVera });
    valutatiTot += valutati;
    perK.push(mk
      ? { k, posizione: mk.posizione, cum: Number(mk.cum.toFixed(3)), soste: mk.soste }
      : { k, posizione: null, nota: 'nessun piano valutabile' });
    migliore = meglio(migliore, mk);
  }

  // il vincitore passa dal Director; se respinto si scala al migliore approvato
  let vincitore = migliore; let directorFatal = null; let scalati = 0;
  const candidatiOrdinati = [
    ...perK.filter((x) => x.posizione !== null),
    ...(bracciA && sosteVere.length ? [{ k: sosteVere.length, posizione: bracciA.posizione, cum: bracciA.cum, soste: sosteVere }] : []),
  ].sort((a, b) => (a.posizione - b.posizione) || (a.cum - b.cum));
  for (const c of candidatiOrdinati) {
    try {
      const sc = costruisciScenario({ gara: garaSimDi(nomeSito), freezeLap: lf, pilota, piano: c.soste, pianiRivali: piani, rivaliNonClassificati: nonClassificati, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera }, contesto);
      const { direttore } = eseguiEValida(sc, contesto.costantiDirector);
      const fatal = (direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
      if (fatal.length === 0) { vincitore = { ...c, ordine: null }; directorFatal = 0; break; }
      directorFatal = fatal.length; scalati += 1;
    } catch { scalati += 1; }
  }
  // la posizione del vincitore ri-classificata sulla stessa popolazione del braccio A
  const vero = ordineVero(nomeSito);
  const nullo = ordineAlGiro(gSim, lf);
  const evalVincitore = vincitore?.soste !== undefined
    ? valuta(nomeSito, pilota, lf, vincitore.soste, piani, contesto, gSim, nonClassificati, ritiriVeri, neutraVera) : null;
  const mB = evalVincitore ? riclassifica(evalVincitore.ordine, vero, pilota, nullo) : null;
  const mA = bracciA ? riclassifica(bracciA.ordine, vero, pilota, nullo) : null;

  return {
    team, gara: nomeSito, pilota,
    congelamento: lf, proiettati: base.proiettati, n_giri: base.n_giri,
    reale: { posizione: base.vero, tipo_arrivo: base.tipo_arrivo, partenza: base.partenza },
    strategia_vera: base.strategia,
    motore_strategia_vera: {
      posizione_riclassificata: base.previsto, su: base.su, errore_vs_reale: base.errore,
      posizione_campo_pieno: bracciA?.posizione ?? null, su_campo: bracciA?.su ?? null,
      cum: bracciA ? Number(bracciA.cum.toFixed(3)) : null,
    },
    nullo: { posizione: base.nullo, errore_vs_reale: base.errore_nullo },
    migliore_trovata: evalVincitore ? {
      k: vincitore.k,
      soste: vincitore.soste.map((s) => `${s.giro}:${s.mescola}`).join(' '),
      posizione_campo_pieno: evalVincitore.posizione,
      posizione_riclassificata: mB?.pos ?? null,
      cum: Number(evalVincitore.cum.toFixed(3)),
      guadagno_posizioni_motore: bracciA && evalVincitore ? bracciA.posizione - evalVincitore.posizione : null,
      guadagno_cum_s: bracciA && evalVincitore ? Number((bracciA.cum - evalVincitore.cum).toFixed(3)) : null,
      director: directorFatal === 0 ? 'approvato' : `respinto x${scalati}, fatal ${directorFatal}`,
    } : null,
    per_k: perK.map((x) => ({ ...x, soste: x.soste ? x.soste.map((s) => `${s.giro}:${s.mescola}`).join(' ') : undefined })),
    slick_usate_al_congelamento: [...usate].join('+') || 'nessuna',
    ritiri_veri_applicati: Object.keys(ritiriVeri).length,
    giri_neutralizzati_veri: Object.keys(neutraVera).length,
    ricerca_valutazioni: valutatiTot,
    controllo_A: mA ? { riclassificata: mA.pos, coincide_con_corri: mA.pos === base.previsto } : null,
  };
}

// ── esecuzione ───────────────────────────────────────────────────────────────
const righe = [];
for (let i = 0; i < TEAM.length; i += 1) righe.push(caso(TEAM[i], GARE[i]));

if (JSON_OUT) {
  console.log(JSON.stringify({
    _cosa_e: 'Record descrittivo (NON un cancello): la gara vera nel motore, e la migliore che il motore sa trovare a rivali veri. Richiesta PO 07/08/2026.',
    _perimetro: 'dieci team alfabetici X dieci gare alfabetiche senza Monaco; per team il primo pilota non saltato',
    _obiettivo_ricerca: 'lessicografico (posizione, cum) alla bandiera; k 0-3; mescole deterministiche da mescolePerSoste; Director sul vincitore',
    casi: righe,
  }, null, 1));
} else {
  console.log('══ LA GARA LORO, POI LA MIGLIORE — record per la diagnosi (niente cancelli) ══');
  console.log('');
  console.log('  team            gara            pil  Lf   reale  motore(vera)  migliore  Δpos  Δs      piano migliore');
  for (const r of righe) {
    if (r.saltato) { console.log(`  ${r.team.padEnd(15)} ${r.gara.padEnd(15)} ${String(r.pilota).padEnd(8)} SALTATO: ${r.saltato}`); continue; }
    const m = r.migliore_trovata;
    console.log(`  ${r.team.padEnd(15)} ${r.gara.padEnd(15)} ${r.pilota.padEnd(4)} ${String(r.congelamento).padStart(2)}   P${String(r.reale.posizione).padEnd(5)} P${String(r.motore_strategia_vera.posizione_campo_pieno).padEnd(12)} P${String(m?.posizione_campo_pieno ?? '—').padEnd(8)} ${String(m?.guadagno_posizioni_motore ?? '—').padStart(3)}  ${String(m?.guadagno_cum_s ?? '—').padStart(7)} ${m?.soste ?? '—'}`);
  }
  console.log('');
  console.log('  «motore(vera)» e «migliore» sono POSIZIONI NEL CAMPO SIMULATO PIENO (rivali con');
  console.log('  soste vere): il guadagno e\' una promessa motore-contro-motore, mai contro la realta\'.');
  console.log('  Le colonne riclassificate (popolazione comune con la verita\') stanno nel --json.');
}
