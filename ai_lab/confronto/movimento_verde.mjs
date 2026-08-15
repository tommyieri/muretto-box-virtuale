// movimento_verde.mjs — DOVE SUCCEDE IL MOVIMENTO IN VERDE, e quale pezzo manca al motore.
//
//     node ai_lab/confronto/movimento_verde.mjs [--json]
//
// PERCHE'. Il collo di bottiglia del prodotto e' li': in verde il motore produce 111 cambi
// di posizione contro i 224 veri (resa 49,6%), e il 71,8% dello scarto sugli arrivi sta in
// casi dove il motore muove meno del vero (`REFERTO_provenienza_errori.md`).
//
// E DOPO CINQUE IPOTESI CADUTE IN CINQUE GIORNI, questo banco non ne propone nessuna.
// Fa una cosa sola, e la fa CONTANDO: divide il movimento verde in tre secchi che non si
// sovrappongono, e guarda in quale secchio il motore perde. Nessun modello, quindi niente
// da validare — solo un'identita' contabile, e i tre secchi devono sommare al totale.
//
// LA DIVISIONE, dichiarata prima di eseguire:
//
//   · IL SUO CICLO DI SOSTA   — il giro cade entro ±1 dalla SUA sosta. E' l'undercut e
//                               l'overcut: il pezzo su cui il prodotto vive.
//   · IL CICLO ALTRUI          — entro ±1 dalla sosta di QUALCUN ALTRO, non la sua. E' il
//                               rimescolamento che uno subisce mentre i rivali si fermano.
//   · PISTA PURA               — nessuna sosta di nessuno entro ±1 giro. E' il sorpasso in
//                               pista, cioe' il duello — un ramo che il progetto ha gia'
//                               chiuso fuori campione su 78 gare.
//
// PERCHE' QUESTA DIVISIONE E NON UN'ALTRA: perche' separa un ramo CHIUSO (il duello) da
// due rami APERTI (il ciclo di sosta, che e' letteralmente cio' che il gioco chiede di
// simulare). Se il movimento che manca fosse tutto in pista pura, non ci sarebbe niente da
// fare e andrebbe scritto. Se fosse nel ciclo di sosta, sarebbe il bersaglio piu' utile del
// progetto. La divisione e' scelta PRIMA di vedere da che parte cade.
//
// UNITA': la GARA (un caso per gara, il primo utilizzabile), come negli altri banchi di
// questa serie — i casi di una stessa gara sono la stessa gara con un soggetto diverso.
// PERIMETRO: i giri VERDI da freeze+1 alla bandiera, sul campo comune.
//
// NON SCRIVE NIENTE su disco, non decide niente: e' un referto descrittivo.

import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { cambiDiPosizione } from '../../simulatore/engine/kernel.mjs';
import { corri, pianiVeriDi, perGara, media } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');

const rango = (cum, campo) => {
  const v = campo.filter((d) => Number.isFinite(cum[d])).sort((a, b) => cum[a] - cum[b]);
  return Object.fromEntries(v.map((d, i) => [d, i + 1]));
};

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

  // le soste VERE: chi, e a che giro
  const sueSoste = {};
  const sosteAlGiro = {};
  for (const r of perGara(nomeSito)) {
    for (const s of r.soste_piano) {
      (sueSoste[r.pilota] ||= new Set()).add(s.giro);
      (sosteAlGiro[s.giro] ||= new Set()).add(r.pilota);
    }
  }
  const vicinoAUnaSosta = (L, chi) => {
    for (let x = L - 1; x <= L + 1; x += 1) if (sosteAlGiro[x]?.size) {
      if (chi === null) return true;
      if (sosteAlGiro[x].has(chi)) return 'sua';
    }
    return false;
  };

  // DUE METRICHE NELLO STESSO BANCO, e la ragione e' un errore che ho gia' fatto una volta:
  // il 14/08 ho confrontato una perdita ai box misurata su un giro con una misurata su due,
  // e il verso ne usciva rovesciato. Qui il rischio e' identico — «cambi per giro» e «cambi
  // netti su un tratto» sono grandezze diverse, e il banco precedente usava la seconda.
  // Si calcolano ENTRAMBE sullo stesso perimetro, cosi' il confronto e' interno.
  //   RIMESCOLAMENTO = somma dei cambi di rango giro per giro (quanto si agita il campo)
  //   NETTO          = cambi fra l'inizio e la fine di ogni tratto verde (quanto RESTA)
  const conta = { motore: { sua: 0, altrui: 0, pista: 0 }, vero: { sua: 0, altrui: 0, pista: 0 } };
  const netto = { motore: 0, vero: 0, motoreDaMeno1: 0, veroDaMeno1: 0 };
  {
    let da = null;
    for (let L = e.congelamento + 1; L <= e.n_giri + 1; L += 1) {
      const verde = L <= e.n_giri && !neutraVera[L];
      if (verde && da === null) da = L;
      if ((!verde || L === e.n_giri) && da !== null) {
        const a = verde ? L : L - 1;
        if (a > da) {
          const ord = (f, x) => campo.filter((d) => Number.isFinite(f[d]?.[x])).sort((p, q) => f[p][x] - f[q][x]);
          netto.motore += cambiDiPosizione(ord(cumM, da), ord(cumM, a));
          netto.vero += cambiDiPosizione(ord(cumV, da), ord(cumV, a));
          // LA STESSA COSA CON IL CONFINE DELL'ALTRO BANCO (da−1 invece di da): il
          // `movimento_neutralizzazione.mjs` parte dal giro PRIMA del tratto, quindi in
          // verde include la transizione dalla neutralizzazione. Le due definizioni si
          // calcolano qui insieme, perche' un numero mio non tornava con un numero mio.
          if (cumM[campo[0]]?.[da - 1] !== undefined || true) {
            netto.motoreDaMeno1 += cambiDiPosizione(ord(cumM, da - 1), ord(cumM, a));
            netto.veroDaMeno1 += cambiDiPosizione(ord(cumV, da - 1), ord(cumV, a));
          }
        }
        da = null;
      }
    }
  }
  // IL GIRO DI TRANSIZIONE: il primo verde dopo una neutralizzazione. E' l'unico giro che
  // separa le due definizioni di «netto» (188 contro 105 sul motore), quindi va contato da
  // solo invece di essere spiegato a parole.
  const transizione = { motore: 0, vero: 0, giri: 0 };
  for (let L = e.congelamento + 2; L <= e.n_giri; L += 1) {
    if (neutraVera[L] || !neutraVera[L - 1]) continue;
    transizione.giri += 1;
    const rM = rango(al(cumM, L), campo); const rMp = rango(al(cumM, L - 1), campo);
    const rV = rango(al(cumV, L), campo); const rVp = rango(al(cumV, L - 1), campo);
    for (const d of campo) {
      if (rM[d] != null && rMp[d] != null && rM[d] !== rMp[d]) transizione.motore += 1;
      if (rV[d] != null && rVp[d] != null && rV[d] !== rVp[d]) transizione.vero += 1;
    }
  }
  for (let L = e.congelamento + 2; L <= e.n_giri; L += 1) {
    if (neutraVera[L]) continue;                       // solo i giri VERDI
    const rM = rango(al(cumM, L), campo); const rMp = rango(al(cumM, L - 1), campo);
    const rV = rango(al(cumV, L), campo); const rVp = rango(al(cumV, L - 1), campo);
    for (const d of campo) {
      const secchio = vicinoAUnaSosta(L, d) === 'sua' ? 'sua'
        : (vicinoAUnaSosta(L, null) ? 'altrui' : 'pista');
      if (rM[d] != null && rMp[d] != null && rM[d] !== rMp[d]) conta.motore[secchio] += 1;
      if (rV[d] != null && rVp[d] != null && rV[d] !== rVp[d]) conta.vero[secchio] += 1;
    }
  }
  righe.push({ gara: nomeSito, ...conta, netto, transizione });
}

const s = (chi, k) => righe.reduce((a, r) => a + r[chi][k], 0);
const tot = {
  vero: { sua: s('vero', 'sua'), altrui: s('vero', 'altrui'), pista: s('vero', 'pista') },
  motore: { sua: s('motore', 'sua'), altrui: s('motore', 'altrui'), pista: s('motore', 'pista') },
};
tot.vero.tot = tot.vero.sua + tot.vero.altrui + tot.vero.pista;
tot.motore.tot = tot.motore.sua + tot.motore.altrui + tot.motore.pista;
tot.netto = { vero: righe.reduce((a, r) => a + r.netto.vero, 0), motore: righe.reduce((a, r) => a + r.netto.motore, 0),
  veroDaMeno1: righe.reduce((a, r) => a + r.netto.veroDaMeno1, 0), motoreDaMeno1: righe.reduce((a, r) => a + r.netto.motoreDaMeno1, 0) };
tot.netto.resa = tot.netto.vero ? Number((tot.netto.motore / tot.netto.vero * 100).toFixed(1)) : null;
tot.transizione = { vero: righe.reduce((a, r) => a + r.transizione.vero, 0),
  motore: righe.reduce((a, r) => a + r.transizione.motore, 0),
  giri: righe.reduce((a, r) => a + r.transizione.giri, 0) };
const resa = (k) => (tot.vero[k] ? Number((tot.motore[k] / tot.vero[k] * 100).toFixed(1)) : null);
tot.resa = { sua: resa('sua'), altrui: resa('altrui'), pista: resa('pista'), tot: resa('tot') };
tot.mancante = { sua: tot.vero.sua - tot.motore.sua, altrui: tot.vero.altrui - tot.motore.altrui, pista: tot.vero.pista - tot.motore.pista };
const mTot = tot.vero.tot - tot.motore.tot;
tot.quota_del_mancante = { sua: Number((tot.mancante.sua / mTot * 100).toFixed(1)),
  altrui: Number((tot.mancante.altrui / mTot * 100).toFixed(1)),
  pista: Number((tot.mancante.pista / mTot * 100).toFixed(1)) };

if (JSON_OUT) { console.log(JSON.stringify({ per_gara: righe, totale: tot }, null, 1)); } else {
  console.log('');
  console.log('  IL MOVIMENTO IN VERDE, diviso in tre secchi che non si sovrappongono');
  console.log('');
  console.log('  gara              suo ciclo      ciclo altrui      pista pura');
  console.log('                   vero/motore     vero/motore      vero/motore');
  for (const r of righe) {
    console.log(`  ${r.gara.padEnd(15)} ${String(r.vero.sua).padStart(4)}/${String(r.motore.sua).padEnd(4)}    `
      + `${String(r.vero.altrui).padStart(5)}/${String(r.motore.altrui).padEnd(5)}   `
      + `${String(r.vero.pista).padStart(5)}/${String(r.motore.pista).padEnd(5)}`);
  }
  console.log('');
  console.log(`  TOTALE  vero   ${String(tot.vero.sua).padStart(4)}  ${String(tot.vero.altrui).padStart(6)}  ${String(tot.vero.pista).padStart(6)}   = ${tot.vero.tot}`);
  console.log(`          motore ${String(tot.motore.sua).padStart(4)}  ${String(tot.motore.altrui).padStart(6)}  ${String(tot.motore.pista).padStart(6)}   = ${tot.motore.tot}`);
  console.log(`          resa   ${String(tot.resa.sua).padStart(4)}% ${String(tot.resa.altrui).padStart(6)}% ${String(tot.resa.pista).padStart(6)}%  = ${tot.resa.tot}%`);
  console.log('');
  console.log(`  LE DUE METRICHE, sullo stesso perimetro:`);
  console.log(`     RIMESCOLAMENTO (cambi giro per giro)  vero ${tot.vero.tot} · motore ${tot.motore.tot} · resa ${tot.resa.tot}%`);
  console.log(`     NETTO (cambi fra inizio e fine tratto) vero ${tot.netto.vero} · motore ${tot.netto.motore} · resa ${tot.netto.resa}%`);
  console.log(`     NETTO col confine dell'altro banco (da−1) vero ${tot.netto.veroDaMeno1} · motore ${tot.netto.motoreDaMeno1} · resa ${(tot.netto.motoreDaMeno1 / tot.netto.veroDaMeno1 * 100).toFixed(1)}%`);
  const t = tot.transizione;
  console.log('');
  console.log(`  IL GIRO DI TRANSIZIONE (il primo verde dopo una neutralizzazione), ${t.giri} giri in tutto:`);
  console.log(`     cambi di rango su quei giri:  motore ${t.motore} · vero ${t.vero}   → il motore ne fa ${(t.motore / t.vero).toFixed(2)}x`);
  console.log(`     per giro:                     motore ${(t.motore / t.giri).toFixed(2)} · vero ${(t.vero / t.giri).toFixed(2)}`);
  const altriGiri = righe.reduce((a, r) => a + 0, 0);
  console.log(`     per confronto, un giro verde qualunque: motore ${(tot.motore.tot / 1).toFixed(0)} cambi su tutti i verdi`);
  console.log('');
  console.log(`  IL MOVIMENTO CHE MANCA (${mTot} cambi di rimescolamento) sta:`);
  console.log(`     nel SUO ciclo di sosta   ${String(tot.mancante.sua).padStart(4)}  = ${tot.quota_del_mancante.sua}%`);
  console.log(`     nel ciclo ALTRUI         ${String(tot.mancante.altrui).padStart(4)}  = ${tot.quota_del_mancante.altrui}%`);
  console.log(`     in PISTA PURA            ${String(tot.mancante.pista).padStart(4)}  = ${tot.quota_del_mancante.pista}%   ← il duello, ramo chiuso`);
  console.log('');
}
