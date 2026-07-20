// pitbande.mjs — FASE A: i tre scenari di degrado nel pannello pit (SCENARI, non previsioni).
//
// CHIAMA il gancio v1.5 (degrado_hook.mjs::treScenari, mai modificato) con le bande
// climatologiche del circuito e riporta, per ciascuno dei tre scenari (ottimistico =
// meno degrado, centrale, pessimistico = piu' degrado), dove il pilota rientra e i gap.
// Riusa stessoGiroReale da pitscenario.mjs (stessa definizione dei rivali a pari giro
// del pannello base): nessuna logica duplicata, nessun campo del golden toccato.
//
// Interruttore di sicurezza (dichiarato):
//   - bande assenti per il circuito (Monaco escluso, o circuito non informativo) -> ok:false
//     -> il pannello mostra solo la risposta base a pace piatta;
//   - compound senza banda informativa -> [0,0,0] -> quel pilota non degrada (scenario che
//     collassa sul run singolo): onesto, non inventato;
//   - sotto SC/VSC il degrado e' sospeso (mandato): il chiamante non invoca gli scenari.
import { treScenari } from './degrado_hook.mjs';
import { stessoGiroReale } from './pitscenario.mjs';

const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'];

// FASE B — correzione della magnitudine (M1, validata in replay: BIAS +0.42 -> +0.05).
// pace_base e' la MEDIANA di stint, non la pace a gomma nuova: sommare rate*(eta-1)
// (gancio M0) raddoppia il degrado gia' dentro pace_base. Fix = proiettare l'incremento
// dal riferimento di pace_base A0 = mediana(life) del suo window. Si realizza come ADAPTER
// dell'eta' passata al gancio (gancio NON toccato): tyreAge0' = tyreAge0 - A0 + 1, cosi'
// la penalita' del gancio rate*(tyreAge0'+s-1) diventa rate*((tyreAge0+s) - A0) = rate*(A-A0).
// A0 si ricostruisce dal replay in-pagina (stesso window della pace_base del kernel).
function eta0PaceBase(byLap, L, drv, stint) {
  const eta = [];
  for (let k = 1; k <= L; k++) {
    const c = byLap[k] && byLap[k][drv];
    if (!c || c.stint !== stint) continue;
    if (c.lap_time == null || c.tyre_age == null) continue;
    if (c.neutralized || c.in_lap || c.out_lap) continue;
    if (!COMPOUNDS.includes(c.compound)) continue;
    eta.push(c.tyre_age);
  }
  if (!eta.length) return null;
  eta.sort((a, b) => a - b);
  const m = eta.length >> 1;
  return eta.length % 2 ? eta[m] : (eta[m - 1] + eta[m]) / 2;   // mediana
}

// banda completa per il circuito: compound assente -> [0,0,0] (nessun degrado).
export function bandaCircuito(bandeJson, gara) {
  const cid = bandeJson?.gara2cid?.[gara];
  const per = cid ? bandeJson?.per_cid?.[cid] : null;
  if (!per) return null;                                  // nessuna banda informativa -> niente scenari
  const banda = {};
  let almenoUna = false;
  for (const c of COMPOUNDS) {
    if (per[c]) { banda[c] = per[c]; almenoUna = true; }
    else banda[c] = [0, 0, 0];                            // interruttore per-compound
  }
  return almenoUna ? { cid, banda } : null;
}

export function treScenariPit({ byLap, nLaps, pace, driver, freezeLap, pitLap, pitLoss, present, banda }) {
  const L = freezeLap;
  present = present.filter(d => typeof byLap[L][d].cum_time === 'number' && pace[d] != null);
  if (!present.includes(driver)) return { ok: false, reason: 'pilota non simulabile' };
  const state = {}, tyreAge0 = {}, compound = {};
  for (const d of present) {
    state[d] = { cum_time: byLap[L][d].cum_time };
    compound[d] = byLap[L][d].compound;
    // FASE B: eta' ADATTATA (M1) — proietta l'incremento da A0=mediana(life) del window
    // pace_base, non dal fresh. tyreAge0' = tyreAge0 - A0 + 1 (gancio invariato).
    const rawAge = byLap[L][d].tyre_age;
    const a0 = eta0PaceBase(byLap, L, d, byLap[L][d].stint);
    tyreAge0[d] = (rawAge != null && a0 != null) ? (rawAge - a0 + 1) : rawAge;
  }
  const steps = (pitLap - L) + 1;
  const pit = { driver, lap: pitLap, loss: pitLoss };
  const sc = treScenari({ state, pace, tyreAge0, compound, banda, freezeLap: L, steps, pit });
  const same = stessoGiroReale(byLap, L, nLaps, driver, present);
  const esito = (cum) => {
    const ord = same.filter(d => cum[d] != null).map(d => [d, cum[d]])
      .sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
    const idx = ord.findIndex(([d]) => d === driver);
    if (idx < 0) return null;
    const me = ord[idx][1], ahead = idx > 0 ? ord[idx - 1] : null, behind = idx < ord.length - 1 ? ord[idx + 1] : null;
    return {
      rientro_pos: idx + 1, su_totale: ord.length,
      davanti_ho: ahead ? ahead[0] : null, gap_ahead: ahead ? me - ahead[1] : null,
      dietro_esco: behind ? behind[0] : null, gap_behind: behind ? behind[1] - me : null,
    };
  };
  const ott = esito(sc.ottimistico), cen = esito(sc.centrale), pes = esito(sc.pessimistico);
  if (!ott || !cen || !pes) return { ok: false, reason: 'scenario non calcolabile' };
  // il pilota degrada solo se la SUA mescola ha una banda non-nulla
  const cmp = compound[driver];
  const degrada = cmp && banda[cmp] && (banda[cmp][2] > 0);
  return { ok: true, compound: cmp, degrada, ottimistico: ott, centrale: cen, pessimistico: pes };
}
