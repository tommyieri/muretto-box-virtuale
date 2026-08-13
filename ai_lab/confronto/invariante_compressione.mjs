// invariante_compressione.mjs — D3(a) DI PREREG_compressione_pavimento_2.
//
//     node ai_lab/confronto/invariante_compressione.mjs
//
// DUE STRUMENTI INDIPENDENTI CHE DEVONO DIRE LO STESSO NUMERO.
//
// Il kernel conta quante volte il pavimento ha legato (`clampPavimento`). Qui si
// conta, da FUORI e senza guardare il contatore, su quanti giri compressi il
// rapporto NON vale esattamente `gap_dopo = gap_prima * kappa`.
//
// Se i due numeri coincidono caso per caso, allora ogni giro in cui il clamp NON
// ha legato ha il rapporto esatto: e' D3(a). Non e' circolare, perche' i due conti
// vengono da posti diversi — uno dall'interno del ramo, l'altro dai cumulati.
import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara } from './bandiera.mjs';

let casi = 0; let concordi = 0; const discordi = []; let esatti = 0; let nonEsatti = 0; let peggioreScarto = 0;

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
  for (const x of perGara(nomeSito)) {
    const e = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
    });
    if (e.saltato) continue;
    casi += 1;
    const cella = {};
    for (const [drv, passi] of Object.entries(e.traccia ?? {})) {
      if (!Array.isArray(passi) || !passi.length) continue;
      cella[drv] = {}; for (const p of passi) cella[drv][p.lap] = p;
    }
    // IL PRIMO GIRO COMPRESSO non ha un "prima" nella traccia: il distacco di partenza
    // e' quello dello STATO al congelamento. Senza questa riga il controllo salta in
    // silenzio l'intero giro freezeLap+1 — ed e' esattamente il buco che faceva
    // discordare i due strumenti su Miami (24 contro 34), dove la compressione parte
    // proprio li'. Una cecita' dello strumento, non del kernel.
    for (const [drv, celleVere] of gSim.perPilota) {
      const c = celleVere.get(e.congelamento);
      if (!c || !Number.isFinite(c.cum_time)) continue;
      if (!cella[drv]) continue;
      cella[drv][e.congelamento] = { lap: e.congelamento, cum_time: c.cum_time, in_lap: false };
    }
    const drivers = Object.keys(cella);
    let fuori = 0;
    for (const [lapS, kappa] of Object.entries(e.neutra_perGiro ?? {})) {
      const L = Number(lapS);
      const vivi = drivers.filter((d) => cella[d][L] && cella[d][L - 1]);
      if (vivi.length < 2) continue;
      let capo = null;
      for (const d of vivi) if (capo === null || cella[d][L - 1].cum_time < cella[capo][L - 1].cum_time) capo = d;
      if (cella[capo][L].in_lap) continue;
      for (const d of vivi) {
        if (d === capo || cella[d][L].in_lap) continue;
        const g0 = cella[d][L - 1].cum_time - cella[capo][L - 1].cum_time;
        const g1 = cella[d][L].cum_time - cella[capo][L].cum_time;
        const scarto = Math.abs(g1 - g0 * kappa);
        if (scarto < 1e-9) esatti += 1;
        else { nonEsatti += 1; fuori += 1; if (scarto > peggioreScarto) peggioreScarto = scarto; }
      }
    }
    const dalKernel = e.clamp_pavimento ?? 0;
    if (fuori === dalKernel) concordi += 1;
    else discordi.push(`${nomeSito}/${x.pilota}: fuori=${fuori} kernel=${dalKernel}`);
  }
}

console.log(JSON.stringify({
  casi, concordi, n_discordi: discordi.length, discordi: discordi.slice(0, 10),
  giri_col_rapporto_esatto: esatti, giri_col_rapporto_diverso: nonEsatti, peggiore_scarto_s: peggioreScarto,
}, null, 1));
