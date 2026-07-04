import { simulate } from './engine.mjs';
import NEUTRAL from './neutralizzazione.json' with { type: 'json' };
// --- helper additivi: leggono FATTI GREZZI, non modificano il calcolo del rientro ---
function neutralizzazioneGara(gara, pitLap) {
  const g = NEUTRAL[gara];
  if (!g) return { finestra_attiva:false, tipo:null, nota:'nessun dato neutralizzazione per questa gara' };
  const dentro = (fin) => fin.find(([a,b]) => pitLap>=a && pitLap<=b);
  const sc = dentro(g.sc), vsc = dentro(g.vsc);
  if (sc)  return { finestra_attiva:true, tipo:'SC',  finestra:sc,  durata_tipica:g.durata_sc,
    nota:'finestra reale di QUESTA gara, non un prior' };
  if (vsc) return { finestra_attiva:true, tipo:'VSC', finestra:vsc, durata_tipica:g.durata_vsc,
    nota:'finestra reale di QUESTA gara, non un prior' };
  return { finestra_attiva:false, tipo:null };
}
// PitScenarioEvaluator v1 — kernel congelato, letto SOLO per-giro.
// davanti/dietro = solo tra piloti sullo STESSO GIRO REALE (determinato al freeze, ancora giri+cum).
function stessoGiroReale(byLap, L, nLaps, drv, present) {
  const leaderCumAt = {};
  for (let k=L; k<=Math.min(L+3,nLaps); k++) if (byLap[k]) {
    const o = present.filter(d=>byLap[k][d] && typeof byLap[k][d].cum_time==='number')
      .sort((a,b)=>byLap[k][a].cum_time-byLap[k][b].cum_time);
    if (o.length) leaderCumAt[k] = byLap[k][o[0]].cum_time;
  }
  const lapsDown = d => { const c=byLap[L][d].cum_time; let n=0;
    for (const k in leaderCumAt) if (+k>L && c>leaderCumAt[k]) n=+k-L; return n; };
  const mine = lapsDown(drv);
  return present.filter(d => lapsDown(d)===mine);
}
export function evaluatePit({ byLap, nLaps, pace, driver, freezeLap, pitLap, pitLoss, present, gara=null, laps=null, ZONE = 1.5 }) {
  const L = freezeLap;
  // solo piloti SIMULABILI: hanno cum_time e un pace-base al freeze (chi ha appena pittato non ne ha)
  present = present.filter(d => typeof byLap[L][d].cum_time==='number' && pace[d]!=null);
  const state = {}; for (const d of present) state[d]={cum_time:byLap[L][d].cum_time};
  if (!(driver in state)) return { ok:false, reason:'pilota non in pista al giro scelto' };
  const steps = (pitLap - L) + 1;
  const giroNeutralizzato = !!(byLap[pitLap] && byLap[pitLap][driver] && byLap[pitLap][driver].neutralized);
  const fin = simulate({ state, pace, freezeLap:L, steps, pit:{ driver, lap:pitLap, loss:pitLoss } });
  if (fin[driver] == null) return { ok:false, reason:'pilota non simulabile' };
  const same = stessoGiroReale(byLap, L, nLaps, driver, present).filter(d => fin[d] != null);
  const ord = same.map(d=>[d,fin[d]]).sort((a,b)=>(a[1]-b[1])||(a[0]<b[0]?-1:1));
  const idx = ord.findIndex(([d])=>d===driver);
  const me = ord[idx][1];
  const ahead = idx>0?ord[idx-1]:null, behind = idx<ord.length-1?ord[idx+1]:null;
  const gapA = ahead?(me-ahead[1]):null, gapB = behind?(behind[1]-me):null;

  // --- SOPPRESSIONE GAP SOTTO NEUTRALIZZAZIONE ---
  // Se il pit cade in una finestra SC/VSC reale, i gap in secondi sono affetti da DUE bias
  // che spingono nella stessa direzione (pit-loss verde sovrastima la perdita reale; il gruppo
  // si ricompatta) di grandezza nota nel segno ma ignota nel valore. Coerente col precedente
  // aria_libera/traffico: null onesto, non numero-biased con cerotto testuale.
  // Restano: nomi davanti/dietro, posizione di rientro, ordine (meno biased dei secondi).
  const ng = neutralizzazioneGara(gara, pitLap);
  const sotto_neutralizzazione = ng.finestra_attiva === true;
  const gap_ahead_out  = sotto_neutralizzazione ? null : gapA;
  const gap_behind_out = sotto_neutralizzazione ? null : gapB;

  return { ok:true, rientro_pos:idx+1, su_totale:ord.length,
    davanti_ho:ahead?ahead[0]:null, gap_ahead:gap_ahead_out, dietro_esco:behind?behind[0]:null, gap_behind:gap_behind_out,
    // gap soppressi sotto SC/VSC: flag esplicito perché la UI sappia distinguere "nessun rivale" da "non quantificabile"
    sotto_neutralizzazione,
    nota_gap: sotto_neutralizzazione ? 'gap non quantificabile sotto '+ng.tipo+' — il pit-loss verde sovrastima la perdita reale' : null,
    // campi che richiedono DEGRADO / difficolta-sorpasso: dichiarati, non calcolati
    giro_neutralizzato:giroNeutralizzato,
    aria_libera:null, perdita_primi3:null, undercut:null, overcut:null, delta_strategia:null, pit_exit_offset:null,
    // --- FATTI GREZZI ADDITIVI (non toccano rientro_pos/davanti/dietro) ---
    neutralizzazione_gara: ng };
}
