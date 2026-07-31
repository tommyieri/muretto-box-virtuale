// m2_bias_passo.mjs — M2: IL BIAS DEL PASSO, PRIMA DELLA POSIZIONE.
//
//     node ai_lab/confronto/m2_bias_passo.mjs            il referto
//     node ai_lab/confronto/m2_bias_passo.mjs --json     lo stesso, in JSON
//
// Vale la pre-registrazione ai_lab/confronto/PREREG_confronto_motori.md (M2).
// Non scrive niente su disco e non tocca demo/, simulatore/, data/.
//
// ============================================================================
// LA DOMANDA
// ============================================================================
// M2 non chiede «dove rientri»: chiede quanto sbaglia il motore a PROIETTARE,
// prima ancora che la posizione entri in gioco. Al congelamento L si prende il
// LEADER (chi ha il cum_time piu' basso al giro L, sul campo intero) e per ogni
// altro pilota d si confronta
//
//     distacco PREVISTO  = cum_previsto[d](L+H) − cum_previsto[leader](L+H)
//     distacco VERO      = cum_vero[d](L+H)     − cum_vero[leader](L+H)
//     errore             = previsto − vero        (secondi, su H giri)
//     errore per giro    = errore / H             (s/giro)
//
// PERCHE' IL DISTACCO E NON IL TEMPO ASSOLUTO. Al congelamento il distacco
// previsto coincide ESATTAMENTE con quello vero (tutti e tre i motori partono
// dal cum reale), quindi l'errore e' interamente accumulato nei H giri
// proiettati e la divisione per H e' legittima. In piu' il distacco e' la
// grandezza che decide la posizione, ed e' cieca a tutto cio' che e' comune al
// campo — il carburante che scende, l'asfalto che gomma. Un motore che sbaglia
// −1,8 s/giro su TUTTI allo stesso modo ordina la classifica benissimo. Il
// tempo assoluto e' un'altra misura, gia' fatta altrove (collaudo_motori.mjs e2):
// qui si misura cio' che il prodotto usa.
//
// ============================================================================
// I TRE MOTORI, E PERCHE' SONO TRE E NON DUE
// ============================================================================
// Il collaudo del banco (P1) ha stabilito che «il vecchio» non e' uno solo:
//   VECCHIO-BANCO       demo/engine.mjs::simulate — passo PIATTO (la mediana
//                       gia' pronta in demo/data/<gara>.json, campo `pace[L]`),
//                       ZONE = 0. E' cio' che chiama gen_hero.mjs, che il banco
//                       del confronto copia, e che evaluatePit esegue con
//                       `passo = null`.
//   VECCHIO-PANNELLO    demo/passo.mjs::passiBase + simulaSimmetrico — il
//                       modello v2 acceso in demo/muretto.mjs (PASSO_V2_ATTIVO
//                       = true dal 28/07), delta e rho da
//                       demo/data/modello_passo_2026.json, ZONE = 0. E' il
//                       motore che stava DAVVERO sulla pagina-gara fino a ieri.
//   NUOVO               simulatore/scenario/costruttore.mjs::costruisciScenario
//                       + simulatore/engine/kernel.mjs::simulate.
// Misurare un solo «vecchio» sarebbe scegliere l'avversario. Si misurano
// entrambi, con lo stesso metro, sugli stessi identici casi.
//
// PROIEZIONE PURA, SENZA SOSTE. Nessuno dei tre riceve un piano: `pit = null`
// per i vecchi, `soste = []` per il nuovo. Conseguenza da dichiarare: nel nuovo
// `regime = soste.length ? … : null`, quindi il suo meccanismo di
// neutralizzazione (fattore sul pit-loss, soste assunte dei rivali) e' INERTE
// qui; nei vecchi lo e' altrettanto (vive dentro evaluatePit, non nel kernel).
// In proiezione pura i tre motori sono tutti ciechi alla Safety Car: lo
// spacchettamento verde/neutralizzato qui sotto e' quindi DIAGNOSTICO — dice
// dove sbagliano, non come si comportano diversamente.
//
// `doveRientri` non serve e non servirebbe: cabla `giroFinale = giroPit + 1`
// e sovrascrive `contesto.giroFinale`, quindi a 3/5/10 giri non arriva. Si
// chiama `costruisciScenario` direttamente, che e' la via che il collaudo del
// banco indica esplicitamente.
//
// ============================================================================
// NIENTE FUTURO
// ============================================================================
// VECCHIO-BANCO: `pace[L]` di demo/data e' calcolato sui soli giri ≤ L
// (esporta_demo_gara.mjs::passoLegacy, parametro finoA). `simulate` riceve solo
// lo stato al giro L. Per scrupolo il byLap passato e' comunque TRONCATO a ≤ L.
// VECCHIO-PANNELLO: `passoBase` scandisce k = 1…L; `simulaSimmetrico` legge
// solo `byLap[freezeLap]`. byLap troncato lo stesso.
// NUOVO: `stimaBasi(..., { finoA: freezeLap })` scarta lap > finoA; lo stato e'
// la sola cella del congelamento.
// Nessuno dei tre percorsi ha il ramo che legge oltre L (quello vive in
// evaluatePit/gradino, e qui non si passa di li').
// L'unico uso del futuro e' la CLASSIFICAZIONE delle finestre (sotto), che non
// entra in nessun motore.
//
// ============================================================================
// LE POPOLAZIONI, CHE E' IL PUNTO DOVE M1 SI ERA FATTA TRUCCARE
// ============================================================================
// I tre motori tacciono su piloti diversi (soglie diverse: 3 giri verdi dello
// stint in corso per il pannello, 8 giri verdi complessivi per il nuovo, la
// mediana gia' pronta per il banco). Misurare ciascuno sulla propria
// popolazione confronterebbe anche i denominatori, non i motori — e' l'errore
// che il collaudo ha trovato su M1 (P2).
// Percio' il numero PRINCIPALE e' sulla POPOLAZIONE COMUNE: le coppie in cui
// tutti e tre proiettano il pilota E il leader, e la verita' esiste. La
// popolazione propria di ciascuno e' riportata a fianco, cosi' si vede se il
// restringimento sposta qualcosa.
//
// ============================================================================
// LE SOSTE DENTRO LA FINESTRA — IL CONTAMINANTE PIU' GROSSO
// ============================================================================
// Se il pilota (o il leader) entra ai box fra L e L+H, il distacco vero fa un
// salto di ~20 s che NESSUNO dei tre motori prevede: e' una proiezione pura,
// non c'e' nessun piano. Quel salto e' un errore di STRATEGIA NON DICHIARATA,
// non del passo, e su H = 3 vale da solo ~7 s/giro — cento volte il fenomeno
// che M2 vuole misurare.
// Quindi si riportano DUE letture, decise prima di guardare i numeri:
//   FINESTRA PULITA (principale): ne' il pilota ne' il leader hanno in_lap o
//     out_lap nei giri (L, L+H]. E' il bias del PASSO.
//   GRIGLIA INTERA: tutto, soste comprese. E' l'errore che il prodotto fa
//     davvero su un giro qualunque, ed e' la lettura piu' severa.
// Se le due letture dessero verdetti diversi, va detto.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  gare, datiVecchio, garaNuova, garaSimDi, contestoNuovo, RADICE,
} from './banco.mjs';

import { simulate as simulaVecchioPiatto } from '../../demo/engine.mjs';
import { passiBase, simulaSimmetrico } from '../../demo/passo.mjs';
import { costruisciScenario } from '../../simulatore/scenario/costruttore.mjs';
import { simulate as simulaNuovo } from '../../simulatore/engine/kernel.mjs';

// ————————————————————————————————————————————————————————— parametri, dichiarati
const ORIZZONTI = [3, 5, 10];
const H_MAX = Math.max(...ORIZZONTI);
const PRIMO_CONGELAMENTO = 5;   // sotto, nessuno dei tre ha ancora dati
// un congelamento ogni PASSO_GRIGLIA giri. Il default e' 2; `--passo=1` prende
// OGNI giro ed e' il controllo di stabilita': se i numeri si muovono, la griglia
// stava scegliendo il risultato.
const PASSO_GRIGLIA = Number((process.argv.find((a) => a.startsWith('--passo=')) ?? '--passo=2').split('=')[1]);
const ZONE = 0;                 // CAP_TRAFFICO = false, com'e' in produzione (demo/muretto.mjs)

const MOTORI = ['vecchio-banco', 'vecchio-pannello', 'nuovo'];

const MODELLO_PASSO = JSON.parse(
  readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'),
);
const V2 = { delta: MODELLO_PASSO.deriva.delta_gara_s, rho: MODELLO_PASSO.degrado.rho_s_giro };

// ————————————————————————————————————————————————————————————————— statistica
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f = (x, n = 3) => (x === null || x === undefined ? '   —   ' : x.toFixed(n));

/** Il riassunto di un mucchio di errori per giro. */
function riassunto(err) {
  if (!err.length) return { n: 0, bias_mediano: null, bias_medio: null, err_ass_mediano: null, p90_ass: null };
  const ass = err.map(Math.abs).sort((a, b) => a - b);
  return {
    n: err.length,
    bias_mediano: mediana(err),
    bias_medio: media(err),
    err_ass_mediano: mediana(ass),
    p90_ass: ass[Math.min(ass.length - 1, Math.floor(0.9 * ass.length))],
  };
}

// ═══════════════════════════════════════════════════════════ le tre proiezioni
/**
 * Proiezione del VECCHIO-BANCO: passo piatto dalla tabella `pace[L]` gia' nel
 * file del sito, kernel demo/engine.mjs. E' il percorso `passo = null` di
 * evaluatePit, che e' quello che chiama gen_hero.mjs.
 * @returns { [drv]: cum al giro L+H }  — solo per chi il motore proietta
 */
function proiettaVecchioBanco({ byLapT, L, pace, H }) {
  const present = Object.keys(byLapT[L] ?? {})
    .filter((d) => typeof byLapT[L][d].cum_time === 'number' && pace[d] != null);
  const state = {};
  for (const d of present) state[d] = { cum_time: byLapT[L][d].cum_time };
  const cum = simulaVecchioPiatto({ state, pace, steps: H, freezeLap: L, ZONE });
  const out = {};
  for (const d of present) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) out[d] = cum[d];
  return out;
}

/**
 * Proiezione del VECCHIO-PANNELLO: modello v2 di demo/passo.mjs con delta e rho
 * di demo/data/modello_passo_2026.json — cioe' esattamente cio' che
 * demo/muretto.mjs passa a evaluatePit come `passo` (PASSO_V2_ATTIVO = true).
 * Nessun gradino e nessuna deriva separata: col passo v2 il pannello li spegne
 * entrambi (li conterebbe due volte).
 */
function proiettaVecchioPannello({ byLapT, L, nLaps, H, base }) {
  const cum = simulaSimmetrico({
    base, byLap: byLapT, nLaps, freezeLap: L, steps: H, pits: [],
    delta: V2.delta, rho: V2.rho, gradino: null, ZONE,
  });
  const out = {};
  for (const d of Object.keys(cum)) if (typeof cum[d] === 'number' && Number.isFinite(cum[d])) out[d] = cum[d];
  return out;
}

/** Proiezione del NUOVO: lo scenario senza soste, eseguito dal suo kernel. */
function proiettaNuovo({ scenario, H }) {
  const r = simulaNuovo({
    state: scenario.state, pace: scenario.pace, freezeLap: scenario.freezeLap,
    steps: H, pits: scenario.pits,
  });
  const out = {};
  for (const d of Object.keys(r.cum)) {
    if (typeof r.cum[d] === 'number' && Number.isFinite(r.cum[d])) out[d] = r.cum[d];
  }
  return out;
}

// ═══════════════════════════════════ incertezza: bootstrap a BLOCCHI = GARE (E11)
// Le coppie della stessa gara non sono indipendenti (stesso asfalto, stessa Safety
// Car, gli stessi venti piloti). Ricampionare le COPPIE darebbe un intervallo
// finto-stretto. Si ricampionano le GARE con reimmissione — 11 blocchi — e si
// ricalcola la statistica sull'unione. E' l'unico modo onesto di dire se uno
// scarto di 0,05 s/giro e' un fenomeno o l'undicesima cifra del rumore.
const SEMI = 20260731;
function generatore(seme) {
  let s = seme >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function bootstrapBlocchi(perBlocco, statistica, { B = 2000, seme = SEMI } = {}) {
  const blocchi = Object.keys(perBlocco).filter((k) => perBlocco[k].length > 0);
  if (blocchi.length < 2) return null;
  const rnd = generatore(seme);
  const valori = [];
  for (let b = 0; b < B; b += 1) {
    const unione = [];
    for (let i = 0; i < blocchi.length; i += 1) {
      unione.push(...perBlocco[blocchi[Math.floor(rnd() * blocchi.length)]]);
    }
    const v = statistica(unione);
    if (v !== null && Number.isFinite(v)) valori.push(v);
  }
  if (valori.length < B / 2) return null;
  valori.sort((a, b) => a - b);
  const q = (p) => valori[Math.min(valori.length - 1, Math.max(0, Math.floor(p * valori.length)))];
  return { ic95: [q(0.025), q(0.975)], n_blocchi: blocchi.length };
}

// ═══════════════════════════════════════════════════════════════ la raccolta
function raccogli() {
  const righe = [];            // una per (gara, L, pilota, H) con tutto dentro
  const diag = {
    congelamenti: 0, congelamenti_senza_leader_comune: 0,
    coppie_esaminate: 0,
    scenario_nuovo_fallito: 0,
    leader_scartato_perche: { verita_assente: 0, muto_vecchio_banco: 0, muto_vecchio_pannello: 0, muto_nuovo: 0 },
    copertura_incondizionata: { piloti: 0, 'vecchio-banco': 0, 'vecchio-pannello': 0, nuovo: 0 },
    congelamenti_per_giro: {},
    scartati_per_giro: {},
    per_gara: {},
  };

  for (const nomeSito of gare()) {
    const { G, byLap, byLapTroncato, nLaps } = datiVecchio(nomeSito);
    const garaSim = garaSimDi(nomeSito);
    const ctx = contestoNuovo(nomeSito);
    const rigaG = { congelamenti: 0, coppie: 0, nGiri: nLaps };

    for (let L = PRIMO_CONGELAMENTO; L + H_MAX <= nLaps; L += PASSO_GRIGLIA) {
      if (!byLap[L]) continue;
      const byLapT = byLapTroncato(L);
      const pace = G.pace[String(L)] || {};

      // il LEADER al congelamento: cum_time minimo sul campo INTERO al giro L
      const conCum = Object.keys(byLap[L]).filter((d) => typeof byLap[L][d].cum_time === 'number');
      if (!conCum.length) continue;
      const leader = conCum.reduce((m, d) => (byLap[L][d].cum_time < byLap[L][m].cum_time ? d : m), conCum[0]);
      diag.congelamenti += 1; rigaG.congelamenti += 1;

      // — le tre proiezioni, una volta sola per (gara, L), a tutti gli orizzonti —
      const base = passiBase(byLapT, nLaps, L, conCum, { delta: V2.delta, rho: V2.rho, eta0: 0 });
      let scenario = null;
      try {
        scenario = costruisciScenario(
          { gara: garaSim, freezeLap: L, pilota: leader },
          { ...ctx, giroFinale: L + H_MAX },
        );
      } catch (e) {
        // il leader potrebbe non avere cella nel grezzo del simulatore: si prova
        // con un altro pilota, che tanto senza soste lo scenario non dipende da lui
        for (const alt of conCum) {
          if (alt === leader) continue;
          try {
            scenario = costruisciScenario(
              { gara: garaSim, freezeLap: L, pilota: alt },
              { ...ctx, giroFinale: L + H_MAX },
            );
            break;
          } catch { /* si prova il prossimo */ }
        }
      }
      if (!scenario) diag.scenario_nuovo_fallito += 1;

      const proiezioni = {};
      for (const H of ORIZZONTI) {
        proiezioni[H] = {
          'vecchio-banco': proiettaVecchioBanco({ byLapT, L, pace, H }),
          'vecchio-pannello': proiettaVecchioPannello({ byLapT, L, nLaps, H, base }),
          nuovo: scenario ? proiettaNuovo({ scenario, H }) : {},
        };
      }

      // COPERTURA INCONDIZIONATA, contata PRIMA del filtro sul leader: quanti
      // piloti ciascun motore proietta, su tutti i congelamenti della griglia.
      // Quella nella tabella piu' sotto e' invece condizionata (il congelamento
      // entra solo se il leader e' proiettato da tutti e tre), e le due cose non
      // vanno confuse.
      for (const m of MOTORI) {
        diag.copertura_incondizionata[m] += conCum.filter((d) => proiezioni[3][m][d] !== undefined).length;
      }
      diag.copertura_incondizionata.piloti += conCum.length;
      diag.congelamenti_per_giro[L] = (diag.congelamenti_per_giro[L] ?? 0) + 1;

      // — regime al CONGELAMENTO (informazione ≤ L, e' cio' che si saprebbe in diretta) —
      const neutroAlFreeze = (d) => byLap[L]?.[d]?.neutralized === true;

      for (const H of ORIZZONTI) {
        const Lf = L + H;
        const cumVeroLeader = byLap[Lf]?.[leader]?.cum_time;
        const veroLeaderOk = typeof cumVeroLeader === 'number';

        // il leader deve essere proiettato da TUTTI, o il riferimento non e' comune
        const leaderOvunque = MOTORI.every((m) => proiezioni[H][m][leader] !== undefined);
        if (!leaderOvunque || !veroLeaderOk) {
          diag.congelamenti_senza_leader_comune += 1;
          diag.scartati_per_giro[L] = (diag.scartati_per_giro[L] ?? 0) + 1;
          if (!veroLeaderOk) diag.leader_scartato_perche.verita_assente += 1;
          for (const m of MOTORI) {
            if (proiezioni[H][m][leader] === undefined) {
              diag.leader_scartato_perche[`muto_${m.replace(/-/g, '_')}`] += 1;
            }
          }
          continue;
        }

        for (const d of conCum) {
          if (d === leader) continue;   // il distacco da se stessi e' zero per costruzione
          const cumVero = byLap[Lf]?.[d]?.cum_time;
          if (typeof cumVero !== 'number') continue;   // ritirato / non arrivato a Lf
          diag.coppie_esaminate += 1; rigaG.coppie += 1;

          const gapVero = cumVero - cumVeroLeader;

          // soste dentro la finestra (FUTURO — solo per classificare, mai per i motori)
          let sostaInFinestra = false;
          let neutroInFinestra = false;
          for (let k = L + 1; k <= Lf; k += 1) {
            for (const x of [d, leader]) {
              const c = byLap[k]?.[x];
              if (!c) continue;
              if (c.in_lap === true || c.out_lap === true) sostaInFinestra = true;
              if (c.neutralized === true) neutroInFinestra = true;
            }
          }

          const err = {};
          const errAssoluto = {};     // CONTROLLO: errore sul TEMPO, non sul distacco
          for (const m of MOTORI) {
            const p = proiezioni[H][m];
            err[m] = (p[d] === undefined) ? null : ((p[d] - p[leader]) - gapVero) / H;
            errAssoluto[m] = (p[d] === undefined) ? null : (p[d] - cumVero) / H;
          }

          righe.push({
            gara: nomeSito, L, H, pilota: d, leader,
            gap_vero: gapVero,
            err,                       // s/giro, con segno, per motore (null = muto)
            err_assoluto: errAssoluto, // s/giro, sul tempo di sessione: il controllo
            comune: MOTORI.every((m) => err[m] !== null),
            sosta_in_finestra: sostaInFinestra,
            neutro_al_congelamento: neutroAlFreeze(d) || neutroAlFreeze(leader),
            neutro_in_finestra: neutroInFinestra,
          });
        }
      }
    }
    diag.per_gara[nomeSito] = rigaG;
  }
  return { righe, diag };
}

// ═══════════════════════════════════════════════════════════════ le aggregazioni
function perMotore(righe, filtro, { soloComune = true } = {}) {
  const out = {};
  for (const H of ORIZZONTI) {
    out[H] = {};
    for (const m of MOTORI) {
      const err = righe
        .filter((r) => r.H === H && filtro(r) && (soloComune ? r.comune : true) && r.err[m] !== null)
        .map((r) => r.err[m]);
      out[H][m] = riassunto(err);
    }
  }
  return out;
}

function perGara(righe, filtro) {
  const out = {};
  for (const H of ORIZZONTI) {
    out[H] = {};
    for (const g of gare()) {
      out[H][g] = {};
      for (const m of MOTORI) {
        const err = righe
          .filter((r) => r.H === H && r.gara === g && filtro(r) && r.comune && r.err[m] !== null)
          .map((r) => r.err[m]);
        out[H][g][m] = riassunto(err);
      }
    }
  }
  return out;
}

/**
 * L'incertezza del bias e dello SCARTO fra due motori, a blocchi = gare.
 * Lo scarto si calcola APPAIATO (stesse coppie, stesso ricampionamento), che e'
 * l'unico modo di non far entrare nell'intervallo la varianza comune ai due.
 */
function incertezza(righe, filtro) {
  const out = {};
  for (const H of ORIZZONTI) {
    const usabili = righe.filter((r) => r.H === H && filtro(r) && r.comune);
    const perGaraRighe = {};
    for (const g of gare()) perGaraRighe[g] = usabili.filter((r) => r.gara === g);
    out[H] = { bias: {}, scarto_assoluto: {} };
    for (const m of MOTORI) {
      const blocchi = {};
      for (const g of gare()) blocchi[g] = perGaraRighe[g].map((r) => r.err[m]);
      out[H].bias[m] = bootstrapBlocchi(blocchi, mediana);
    }
    // |bias| del nuovo meno |bias| del vecchio: negativo = il nuovo e' meno biased
    for (const v of ['vecchio-banco', 'vecchio-pannello']) {
      const blocchi = {};
      for (const g of gare()) blocchi[g] = perGaraRighe[g].map((r) => [r.err.nuovo, r.err[v]]);
      out[H].scarto_assoluto[v] = bootstrapBlocchi(blocchi,
        (u) => Math.abs(mediana(u.map((x) => x[0]))) - Math.abs(mediana(u.map((x) => x[1]))));
    }
  }
  return out;
}

/**
 * Confronto APPAIATO coppia per coppia: su ogni singolo (congelamento, pilota) chi
 * finisce piu' vicino alla verita'? Il bias mediano e' una statistica del mucchio e
 * puo' passare da un compenso fra errori opposti; questo no.
 */
function appaiato(righe, filtro) {
  const out = {};
  for (const H of ORIZZONTI) {
    out[H] = {};
    const usabili = righe.filter((r) => r.H === H && filtro(r) && r.comune);
    for (const v of ['vecchio-banco', 'vecchio-pannello']) {
      const diffs = usabili.map((r) => Math.abs(r.err.nuovo) - Math.abs(r.err[v]));
      const vinceNuovo = diffs.filter((x) => x < 0).length;
      const pari = diffs.filter((x) => x === 0).length;
      const gareVinte = gare().filter((g) => {
        const d = usabili.filter((r) => r.gara === g).map((r) => Math.abs(r.err.nuovo) - Math.abs(r.err[v]));
        return d.length > 0 && mediana(d) < 0;
      }).length;
      const gareConDati = gare().filter((g) => usabili.some((r) => r.gara === g)).length;
      out[H][v] = {
        n: diffs.length, vince_nuovo: vinceNuovo, pari,
        quota_nuovo: diffs.length ? vinceNuovo / diffs.length : null,
        mediana_diff: mediana(diffs),
        gare_vinte_dal_nuovo: gareVinte, gare_con_dati: gareConDati,
      };
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════ il referto
function tabella(titolo, agg) {
  console.log(`\n${titolo}`);
  console.log('  oriz  motore              n      bias mediano  bias medio   |err| mediano  p90 |err|');
  console.log('  ' + '-'.repeat(80));
  for (const H of ORIZZONTI) {
    for (const m of MOTORI) {
      const r = agg[H][m];
      console.log(`  ${String(H).padStart(4)}  ${m.padEnd(18)} ${String(r.n).padStart(5)}`
        + `   ${f(r.bias_mediano).padStart(11)}  ${f(r.bias_medio).padStart(10)}`
        + `   ${f(r.err_ass_mediano).padStart(12)}  ${f(r.p90_ass).padStart(9)}`);
    }
    if (H !== ORIZZONTI[ORIZZONTI.length - 1]) console.log('  ' + '·'.repeat(80));
  }
  console.log('  (s/giro · bias = previsto − vero: NEGATIVO = il motore prevede il pilota PIU\' VICINO al leader di quanto sia)');
}

function tabellaGare(titolo, agg, campo) {
  console.log(`\n${titolo}`);
  const larghezza = 16;
  for (const H of ORIZZONTI) {
    console.log(`\n  orizzonte ${H} giri`);
    console.log('    ' + 'gara'.padEnd(larghezza) + MOTORI.map((m) => m.padStart(18)).join('') + '      n');
    for (const g of gare()) {
      const c = agg[H][g];
      const n = c[MOTORI[0]].n;
      console.log('    ' + g.padEnd(larghezza)
        + MOTORI.map((m) => f(c[m][campo]).padStart(18)).join('')
        + String(n).padStart(7));
    }
    // riassunto che rispetta i blocchi: mediana delle mediane di gara
    const perM = {};
    for (const m of MOTORI) {
      const v = gare().map((g) => agg[H][g][m][campo]).filter((x) => x !== null);
      perM[m] = mediana(v);
    }
    console.log('    ' + 'MEDIANA fra gare'.padEnd(larghezza)
      + MOTORI.map((m) => f(perM[m]).padStart(18)).join(''));
  }
}

function main() {
  const json = process.argv.includes('--json');
  const { righe, diag } = raccogli();

  const pulita = (r) => !r.sosta_in_finestra;
  const tutte = () => true;

  const aggPulita = perMotore(righe, pulita);
  const aggIntera = perMotore(righe, tutte);
  const aggPulitaPropria = perMotore(righe, pulita, { soloComune: false });

  // spacchettamenti
  const aggVerdeFreeze = perMotore(righe, (r) => pulita(r) && !r.neutro_al_congelamento);
  const aggNeutroFreeze = perMotore(righe, (r) => pulita(r) && r.neutro_al_congelamento);
  const aggVerdeFin = perMotore(righe, (r) => pulita(r) && !r.neutro_in_finestra);
  const aggNeutroFin = perMotore(righe, (r) => pulita(r) && r.neutro_in_finestra);
  const aggSoloSoste = perMotore(righe, (r) => r.sosta_in_finestra);

  const garePulita = perGara(righe, pulita);

  // copertura: quante coppie ciascun motore proietta
  const copertura = {};
  for (const H of ORIZZONTI) {
    copertura[H] = { esaminate: righe.filter((r) => r.H === H).length, comuni: righe.filter((r) => r.H === H && r.comune).length };
    for (const m of MOTORI) copertura[H][m] = righe.filter((r) => r.H === H && r.err[m] !== null).length;
  }

  // il cancello M2, letto su entrambe le letture e contro entrambi i vecchi
  const cancello = {};
  for (const lettura of [['finestra_pulita', aggPulita], ['griglia_intera', aggIntera]]) {
    const [nome, agg] = lettura;
    cancello[nome] = {};
    for (const vecchio of ['vecchio-banco', 'vecchio-pannello']) {
      const dettaglio = ORIZZONTI.map((H) => ({
        H,
        nuovo: Math.abs(agg[H].nuovo.bias_mediano),
        vecchio: Math.abs(agg[H][vecchio].bias_mediano),
        passa: Math.abs(agg[H].nuovo.bias_mediano) <= Math.abs(agg[H][vecchio].bias_mediano),
      }));
      cancello[nome][vecchio] = { passa: dettaglio.every((x) => x.passa), dettaglio };
    }
  }

  const ic = incertezza(righe, pulita);
  const icIntera = incertezza(righe, tutte);
  const app = appaiato(righe, pulita);

  if (json) {
    console.log(JSON.stringify({
      parametri: { ORIZZONTI, PRIMO_CONGELAMENTO, PASSO_GRIGLIA, ZONE, V2 },
      diagnostica: diag, copertura,
      incertezza_finestra_pulita: ic, incertezza_griglia_intera: icIntera, appaiato: app,
      finestra_pulita: aggPulita, griglia_intera: aggIntera, popolazione_propria: aggPulitaPropria,
      verde_al_congelamento: aggVerdeFreeze, neutralizzato_al_congelamento: aggNeutroFreeze,
      verde_in_finestra: aggVerdeFin, neutralizzato_in_finestra: aggNeutroFin,
      solo_finestre_con_sosta: aggSoloSoste,
      per_gara_finestra_pulita: garePulita,
      cancello,
    }, null, 1));
    return;
  }

  console.log('M2 — BIAS DEL PASSO. Distacco dal leader del congelamento, a 3/5/10 giri.');
  console.log('Tre motori: vecchio-banco (passo piatto, gen_hero) · vecchio-pannello (v2, muretto.mjs) · nuovo.');

  console.log('\nGRIGLIA');
  console.log(`  congelamenti (L da ${PRIMO_CONGELAMENTO}, passo ${PASSO_GRIGLIA}, L+${H_MAX} ≤ nGiri) : ${diag.congelamenti}`);
  console.log(`  coppie (congelamento, pilota, orizzonte) esaminate     : ${diag.coppie_esaminate}`);
  console.log(`  coppie per orizzonte                                  : ${ORIZZONTI.map((H) => `${H}g ${copertura[H].esaminate}`).join(' · ')}`);
  console.log(`  scenari del nuovo non costruibili                     : ${diag.scenario_nuovo_fallito}`);
  console.log(`  (congelamento, orizzonte) scartati: leader non comune  : ${diag.congelamenti_senza_leader_comune} su ${diag.congelamenti * ORIZZONTI.length}`);
  for (const [k, v] of Object.entries(diag.leader_scartato_perche)) console.log(`      ${k.padEnd(26)}: ${v}`);

  const ci = diag.copertura_incondizionata;
  console.log('\nCOPERTURA INCONDIZIONATA (tutti i congelamenti della griglia, prima del filtro sul leader)');
  console.log(`  coppie (congelamento, pilota) con cum_time al giro L : ${ci.piloti}`);
  for (const m of MOTORI) {
    console.log(`    proiettate da ${m.padEnd(18)}: ${String(ci[m]).padStart(6)}  (${(100 * ci[m] / ci.piloti).toFixed(1)}%)`);
  }
  const scartiPrimi = Object.entries(diag.scartati_per_giro).sort((a, b) => a[0] - b[0]).slice(0, 8);
  console.log(`  i giri dove il leader cade piu' spesso (L: scarti / congelamenti): `
    + scartiPrimi.map(([L, n]) => `${L}: ${n}/${(diag.congelamenti_per_giro[L] ?? 0) * ORIZZONTI.length}`).join(' · '));

  console.log('\nCOPERTURA CONDIZIONATA (solo i congelamenti in cui il leader e\' proiettato da tutti e tre)');
  console.log('  oriz  esaminate   vecchio-banco  vecchio-pannello   nuovo    COMUNI');
  for (const H of ORIZZONTI) {
    const c = copertura[H];
    console.log(`  ${String(H).padStart(4)}  ${String(c.esaminate).padStart(9)}   ${String(c['vecchio-banco']).padStart(13)}  ${String(c['vecchio-pannello']).padStart(16)}  ${String(c.nuovo).padStart(6)}  ${String(c.comuni).padStart(8)}`);
  }

  tabella('╔═ LETTURA PRINCIPALE — FINESTRA PULITA (nessuna sosta di pilota o leader fra L e L+H), popolazione COMUNE', aggPulita);
  tabella('╔═ LETTURA SEVERA — GRIGLIA INTERA (soste comprese), popolazione COMUNE', aggIntera);
  tabella('   controprova — finestra pulita, ciascuno sulla PROPRIA popolazione (denominatori diversi)', aggPulitaPropria);

  console.log('\n\n══ SPACCHETTAMENTO VERDE / NEUTRALIZZATO (finestra pulita, popolazione comune) ══');
  tabella('  A) regime AL CONGELAMENTO — informazione ≤ L, quella che il prodotto ha. VERDE:', aggVerdeFreeze);
  tabella('  A) regime AL CONGELAMENTO — NEUTRALIZZATO:', aggNeutroFreeze);
  tabella('  B) neutralizzazione DENTRO la finestra (futuro, solo per classificare). VERDE:', aggVerdeFin);
  tabella('  B) neutralizzazione DENTRO la finestra — NEUTRALIZZATO:', aggNeutroFin);

  tabella('╔═ IL CONTAMINANTE, misurato: SOLO le finestre con una sosta dentro (popolazione comune)', aggSoloSoste);

  tabellaGare('══ PER GARA — bias mediano con segno, s/giro (finestra pulita, popolazione comune) ══', garePulita, 'bias_mediano');
  tabellaGare('══ PER GARA — errore assoluto mediano, s/giro (finestra pulita, popolazione comune) ══', garePulita, 'err_ass_mediano');

  console.log('\n\n══ INCERTEZZA — bootstrap a blocchi = GARE, 2000 ricampionamenti (finestra pulita) ══');
  console.log('  IC95 del bias mediano, s/giro');
  console.log('  oriz  motore              bias      IC95');
  for (const H of ORIZZONTI) {
    for (const m of MOTORI) {
      const b = ic[H].bias[m];
      console.log(`  ${String(H).padStart(4)}  ${m.padEnd(18)} ${f(aggPulita[H][m].bias_mediano).padStart(7)}   [${f(b?.ic95[0])}; ${f(b?.ic95[1])}]`);
    }
  }
  console.log('\n  IC95 dello SCARTO appaiato  |bias(nuovo)| − |bias(vecchio)|   (negativo = il nuovo e\' meno biased)');
  console.log('  oriz  contro                scarto    IC95                 contiene lo zero?');
  for (const H of ORIZZONTI) {
    for (const v of ['vecchio-banco', 'vecchio-pannello']) {
      const s = ic[H].scarto_assoluto[v];
      const punto = Math.abs(aggPulita[H].nuovo.bias_mediano) - Math.abs(aggPulita[H][v].bias_mediano);
      const zero = s && s.ic95[0] <= 0 && s.ic95[1] >= 0;
      console.log(`  ${String(H).padStart(4)}  ${v.padEnd(18)} ${f(punto).padStart(8)}   [${f(s?.ic95[0])}; ${f(s?.ic95[1])}]        ${zero ? 'SI — indistinguibile' : 'no'}`);
    }
  }

  console.log('\n\n══ CONFRONTO APPAIATO, coppia per coppia (finestra pulita) ══');
  console.log('  chi finisce piu\' vicino alla verita\' sullo STESSO caso');
  console.log('  oriz  contro                  n   nuovo vince   quota   mediana Δ|err|   gare vinte dal nuovo');
  for (const H of ORIZZONTI) {
    for (const v of ['vecchio-banco', 'vecchio-pannello']) {
      const a = app[H][v];
      console.log(`  ${String(H).padStart(4)}  ${v.padEnd(18)} ${String(a.n).padStart(5)}   ${String(a.vince_nuovo).padStart(11)}  ${(a.quota_nuovo * 100).toFixed(1).padStart(6)}%  ${f(a.mediana_diff).padStart(14)}   ${a.gare_vinte_dal_nuovo}/${a.gare_con_dati}`);
    }
  }

  // ── CONTROLLI ────────────────────────────────────────────────────────────
  console.log('\n\n══ CONTROLLI ══');

  // C1 — l'errore sul TEMPO ASSOLUTO, non sul distacco. Serve a due cose: a
  // verificare che questo banco riproduca una misura gia' fatta da un altro
  // (collaudo_motori.mjs e2: −3,9/−4,1/−3,6 s/giro col passo piatto contro
  // −1,2/−2,1/−1,8 col v2, sui casi delle soste), e a rendere visibile che le
  // due grandezze non sono la stessa cosa.
  console.log('\n  C1 · errore sul TEMPO ASSOLUTO di sessione (finestra pulita, popolazione comune), s/giro');
  console.log('     oriz  motore              bias mediano   |err| mediano');
  for (const H of ORIZZONTI) {
    for (const m of MOTORI) {
      const e = righe.filter((r) => r.H === H && pulita(r) && r.comune && r.err_assoluto[m] !== null)
        .map((r) => r.err_assoluto[m]);
      const s = riassunto(e);
      console.log(`     ${String(H).padStart(4)}  ${m.padEnd(18)} ${f(s.bias_mediano).padStart(12)}   ${f(s.err_ass_mediano).padStart(13)}`);
    }
  }
  console.log('     → il distacco NON e\' il tempo: cio\' che e\' comune al campo (carburante, evoluzione pista)');
  console.log('       sparisce dalla differenza. E\' il motivo per cui M2 letta sul distacco da numeri cento volte');
  console.log('       piu\' piccoli di M2 letta sul tempo — e per cui la posizione, che dal distacco dipende,');
  console.log('       puo\' essere giusta con un tempo assoluto sbagliato di secondi.');

  // C2 — i due vecchi si distinguono, su questa misura?
  console.log('\n  C2 · quanto distano fra loro i DUE vecchi sul distacco (mediana di |err_banco − err_pannello|), s/giro');
  for (const H of ORIZZONTI) {
    const d = righe.filter((r) => r.H === H && pulita(r) && r.comune)
      .map((r) => Math.abs(r.err['vecchio-banco'] - r.err['vecchio-pannello']));
    const dn = righe.filter((r) => r.H === H && pulita(r) && r.comune)
      .map((r) => Math.abs(r.err.nuovo - r.err['vecchio-pannello']));
    console.log(`     ${String(H).padStart(4)}g  banco↔pannello ${f(mediana(d))}   ·  nuovo↔pannello ${f(mediana(dn))}`);
  }

  // C3 — il riferimento e' il leader. E se fosse un altro?
  console.log('\n  C3 · robustezza del riferimento: distacco dalla MEDIA del campo invece che dal leader');
  console.log('     oriz  motore              bias mediano   |err| mediano');
  for (const H of ORIZZONTI) {
    // ricostruito dagli stessi numeri: err_riferimentoMedio = err_leader − media(err_leader del congelamento)
    const perFreeze = new Map();
    for (const r of righe) {
      if (r.H !== H || !pulita(r) || !r.comune) continue;
      const k = `${r.gara}|${r.L}`;
      if (!perFreeze.has(k)) perFreeze.set(k, []);
      perFreeze.get(k).push(r);
    }
    for (const m of MOTORI) {
      const e = [];
      for (const gruppo of perFreeze.values()) {
        const mu = media(gruppo.map((r) => r.err[m]));
        for (const r of gruppo) e.push(r.err[m] - mu);
      }
      const s = riassunto(e);
      console.log(`     ${String(H).padStart(4)}  ${m.padEnd(18)} ${f(s.bias_mediano).padStart(12)}   ${f(s.err_ass_mediano).padStart(13)}`);
    }
  }

  // Il cancello e' un confronto POOLED. Ma blocchi = gare (E11): lo stesso
  // confronto, gara per gara, dice se il verdetto e' un fenomeno o una media.
  console.log('\n\n══ IL CANCELLO, GARA PER GARA (finestra pulita) ══');
  console.log('  in quante gare il nuovo ha |bias| ≤ quello del vecchio');
  console.log('  oriz  contro               gare vinte dal nuovo');
  for (const H of ORIZZONTI) {
    for (const v of ['vecchio-banco', 'vecchio-pannello']) {
      const vinte = gare().filter((g) => {
        const a = garePulita[H][g].nuovo.bias_mediano;
        const b = garePulita[H][g][v].bias_mediano;
        return a !== null && b !== null && Math.abs(a) <= Math.abs(b);
      });
      const conDati = gare().filter((g) => garePulita[H][g].nuovo.bias_mediano !== null).length;
      console.log(`  ${String(H).padStart(4)}  ${v.padEnd(18)}  ${vinte.length}/${conDati}   [${vinte.join(', ')}]`);
    }
  }

  console.log('\n\n══ IL CANCELLO M2 ══');
  console.log('  «|bias| ≤ quello del vecchio su tutti e tre gli orizzonti»');
  for (const [nome, perVecchio] of Object.entries(cancello)) {
    for (const [vecchio, esito] of Object.entries(perVecchio)) {
      console.log(`\n  ${nome} · contro ${vecchio}: ${esito.passa ? 'PASSA' : 'NON PASSA'}`);
      for (const d of esito.dettaglio) {
        console.log(`     ${String(d.H).padStart(2)}g  |bias| nuovo ${f(d.nuovo)}  vs vecchio ${f(d.vecchio)}   → ${d.passa ? 'ok' : 'FALLITO'}`);
      }
    }
  }
}

main();
