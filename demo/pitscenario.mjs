import { simulate } from './engine.mjs';
import { simulaConSoste } from './gradino.mjs';
import NEUTRAL from './neutralizzazione.json' with { type: 'json' };

// SOSTE DEI RIVALI SOTTO SAFETY CAR — il difetto n.1 del banco della strategia.
// Acceso il 24/07/2026 su decisione PO. Reversibile da qui: a false il motore torna al
// campo interamente congelato anche sotto SC (comportamento fino al 24/07).
const SOSTE_RIVALI_SC = true;
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
export function stessoGiroReale(byLap, L, nLaps, drv, present) {
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
// ORIZZONTE e GRADINO — due parametri OPZIONALI, entrambi a default inerte.
//   orizzonte = 0  -> ci si ferma all'istante del rientro, come sempre (golden bit-identico)
//   orizzonte = K  -> si simulano K giri DOPO la sosta. Serve perche' tutto cio' che il
//                     prodotto promette "al rientro" (traffico, aria libera, undercut) prima
//                     era strutturalmente impossibile: la sosta cadeva sull'ULTIMO giro simulato.
//   gradino = null -> il pilota che si ferma prosegue col passo di prima, gomma che invecchia
//   gradino = g    -> dopo la sosta prende il passo misurato dalle soste GIA' avvenute in
//                     questa gara (demo/gradino.mjs::misura). Senza questo, fermarsi al giro
//                     12 o al giro 18 dava lo STESSO identico numero.
// ORIZZONTE COMUNE — perche' due risposte del pannello non erano sottraibili.
// evaluatePit usa steps = (pitLap - L) + 1: ogni posizione dello slider valuta un GIRO
// DIVERSO. Confrontare "pitto al 21" con "pitto al 27" significava confrontare il giro 21
// col giro 27, non due strategie. Qui i due mondi finiscono allo STESSO giro, quindi la
// differenza e' una quantita' vera.
//
// SALVAGUARDIA: a gradino nullo i due mondi sono identici PER COSTRUZIONE (il kernel non
// sa che fermarsi cambia qualcosa). La funzione lo DICHIARA invece di restituire uno zero
// che sembrerebbe un risultato. E' la stessa politica di ok:false e dei gap null sotto SC.
export function confrontaPit({ byLap, nLaps, pace, driver, freezeLap, pitLapA, pitLapB,
                               pitLoss, present, gara = null, ZONE = 1.5,
                               orizzonte = 5, gradino = null, rivale = null }) {
  const L = freezeLap;
  present = present.filter(d => typeof byLap[L][d].cum_time === 'number' && pace[d] != null);
  if (!present.includes(driver)) return { ok:false, reason:'pilota non simulabile' };
  if (rivale && !present.includes(rivale)) return { ok:false, reason:'rivale non simulabile' };
  const H = Math.max(pitLapA, pitLapB) + orizzonte;
  const steps = H - L;
  if (steps <= 0) return { ok:false, reason:'orizzonte non valido' };
  const state = {}; for (const d of present) state[d] = { cum_time: byLap[L][d].cum_time };
  const mondo = (pitLap) => simulaConSoste({ state, pace, freezeLap:L, steps, ZONE,
    pits:[{ driver, lap:pitLap, loss:pitLoss }], gradino });
  const A = mondo(pitLapA), B = mondo(pitLapB);
  const same = stessoGiroReale(byLap, L, nLaps, driver, present);
  const posIn = (cum) => {
    const ord = same.filter(d => cum[d] != null).sort((a,b)=>(cum[a]-cum[b])||(a<b?-1:1));
    const i = ord.indexOf(driver);
    return i < 0 ? null : { pos:i+1, su:ord.length,
      davanti: i>0 ? ord[i-1] : null, dietro: i<ord.length-1 ? ord[i+1] : null };
  };
  const identici = (gradino == null);
  const delta = (A[driver] != null && B[driver] != null) ? (A[driver] - B[driver]) : null;
  return {
    ok:true, orizzonte_giro:H, giro_a:pitLapA, giro_b:pitLapB,
    a: posIn(A), b: posIn(B),
    // < 0 = fermarsi al giro A conviene. null quando la domanda non ha ancora una risposta.
    delta_secondi: identici ? null : delta,
    delta_su_rivale: (identici || !rivale) ? null
      : ((A[driver]-A[rivale]) - (B[driver]-B[rivale])),
    identici_per_costruzione: identici,
    nota: identici
      ? 'senza il gradino di sosta il motore non distingue QUANDO ti fermi: la differenza sarebbe zero per costruzione, non per misura'
      : null,
  };
}

//   deriva = null  -> la macchina instradata resta a passo piatto (comportamento storico)
//   deriva = d     -> segue la deriva del campo, d s/giro per ogni giro che passa. Tocca
//                     SOLO lei: gli altri sono reali, la loro evoluzione e' gia' nei tempi.
export function evaluatePit({ byLap, nLaps, pace, driver, freezeLap, pitLap, pitLoss, present, gara=null, laps=null, ZONE = 1.5,
                              orizzonte = 0, gradino = null, deriva = null }) {
  const L = freezeLap;
  // solo piloti SIMULABILI: hanno cum_time e un pace-base al freeze (chi ha appena pittato non ne ha)
  present = present.filter(d => typeof byLap[L][d].cum_time==='number' && pace[d]!=null);
  const state = {}; for (const d of present) state[d]={cum_time:byLap[L][d].cum_time};
  if (!(driver in state)) return { ok:false, reason:'pilota non in pista al giro scelto' };
  const steps = (pitLap - L) + 1 + orizzonte;
  const giroNeutralizzato = !!(byLap[pitLap] && byLap[pitLap][driver] && byLap[pitLap][driver].neutralized);

  // --- LE SOSTE DEI RIVALI SOTTO SAFETY CAR (il difetto n.1 del banco, acceso 24/07/2026) ---
  //
  // Il campo congelato e' la promessa del prodotto — instrada UNA macchina e lascia gli altri
  // dov'e' — e regge finche' il mondo sta fermo. Ma sotto Safety Car il mondo NON sta fermo:
  // si ferma tutto insieme, ai box, ed e' proprio per questo che ci si ferma (la sosta costa
  // meno). Il motore pagava il pit-loss a te solo e lasciava i rivali a passo pieno, quindi
  // chi si fermava con te ti scavalcava nella simulazione ma non nella realta'. Misurato sul
  // banco della strategia: 145 soste, bias +1,41, in tutte e 10 le gare 2026.
  //
  // COSA SI PUO' SAPERE IN DIRETTA. Non chi si fermera' (quello e' il futuro), ma chi HA UN
  // MOTIVO di fermarsi adesso: sotto SC si ferma chi non ha ancora fatto la sosta, cioe' chi
  // e' ancora sul primo stint. E' un'ASSUNZIONE, non una certezza — e va dichiarata. MISURATO:
  // fermare con te i rivali a pari giro ancora sullo stint 1 porta il bias da +1,42 a +0,14,
  // 33 casi migliorati su 8 peggiorati, e il 67% di quelli che fermiamo si ferma davvero.
  //
  // Stessa perdita per tutti: sotto SC il costo relativo fra chi si ferma e' pari, e la
  // posizione e' una quantita' relativa. Il gradino lo prendono anche loro (montano gomma
  // nuova come te); la deriva resta solo tua. Si accende SOLO se il TUO giro di pit e'
  // neutralizzato: se ti fermi in verde, i rivali non si fermano con te e questa non scatta.
  let sosteRivaliAssunte = 0;
  const pits = [{ driver, lap: pitLap, loss: pitLoss }];
  if (SOSTE_RIVALI_SC && giroNeutralizzato) {
    const pariGiro = stessoGiroReale(byLap, L, nLaps, driver, present);
    for (const d of pariGiro) {
      if (d === driver) continue;
      if (byLap[L][d] && byLap[L][d].stint === 1) {   // non ha ancora fatto la sosta
        pits.push({ driver: d, lap: pitLap, loss: pitLoss });
        sosteRivaliAssunte++;
      }
    }
  }

  // simulaConSoste(gradino=null, un solo pit) e' bit-identico a simulate(steps) — test_gradino.mjs
  const fin = simulaConSoste({ state, pace, freezeLap:L, steps, ZONE,
                               pits, gradino,
                               deriva, instradato: driver });
  if (fin[driver] == null) return { ok:false, reason:'pilota non simulabile' };
  const same = stessoGiroReale(byLap, L, nLaps, driver, present).filter(d => fin[d] != null);
  const ord = same.map(d=>[d,fin[d]]).sort((a,b)=>(a[1]-b[1])||(a[0]<b[0]?-1:1));
  const idx = ord.findIndex(([d])=>d===driver);
  const me = ord[idx][1];
  const ahead = idx>0?ord[idx-1]:null, behind = idx<ord.length-1?ord[idx+1]:null;
  const gapA = ahead?(me-ahead[1]):null, gapB = behind?(behind[1]-me):null;

  // --- SOPPRESSIONE GAP SOTTO NEUTRALIZZAZIONE ---
  // Se la finestra e' neutralizzata i gap in secondi hanno DUE bias concordi (pit-loss verde
  // sovrastima la perdita; il gruppo si ricompatta): noti nel segno, ignoti nel valore. Si
  // sopprimono, come aria_libera/traffico. Restano nomi e posizione, meno biased.
  //
  // COSA GUARDA (riscritto 24/07/2026, banco della strategia).
  // Prima: la tabella demo/neutralizzazione.json (finestre della gara FINITA) O il flag del
  // pilota AL SOLO giro del pit. Due difetti misurati sulle 10 gare:
  //   - la tabella VIENE DAL FUTURO: e' costruita a gara conclusa, in diretta non esiste, e su
  //     Gran Bretagna dichiarava finestre dove il campo non era nemmeno neutralizzato.
  //   - guardava SOLO il giro del pit: con l'orizzonte la finestra e' [pit, pit+orizzonte+1],
  //     e se la Safety Car esce DOPO il pit il pannello dava gap quantificabili che non lo
  //     erano — 51 casi su 405, il pit verde con la risposta letta sotto SC.
  // Ora: la MAGGIORANZA DEL CAMPO col flag neutralized, scandita su TUTTA la finestra fino al
  // giro di verifica. E' osservabile in diretta (il flag arriva dal feed, giro per giro) e
  // copre l'orizzonte. MISURATO: riproduce il 100% dei casi che la tabella-futuro coglieva
  // (184/184, nessun falso negativo) e ne aggiunge 74 giusti. La soglia di maggioranza e' la
  // stessa del banco: sotto una gialla LOCALE poche auto hanno il flag, non il campo.
  const Lfin = L + steps;
  let sotto_neutralizzazione = false;
  for (let k = pitLap; k <= Math.min(nLaps, Lfin) && !sotto_neutralizzazione; k++) {
    if (byLap[k] && byLap[k][driver] && byLap[k][driver].neutralized) { sotto_neutralizzazione = true; break; }
    const celle = present.map(d => byLap[k] && byLap[k][d]).filter(Boolean);
    if (celle.length >= 6 && celle.filter(c => c.neutralized).length > celle.length / 2)
      sotto_neutralizzazione = true;
  }
  // ng resta come ARRICCHIMENTO diagnostico (la "durata tipica" della finestra), che vive solo
  // sulle gare gia' corse dove la tabella c'e'; in diretta e' semplicemente assente. NON guida
  // piu' sotto_neutralizzazione: quella deve funzionare live, e questa no.
  const ng = neutralizzazioneGara(gara, pitLap);
  const gap_ahead_out  = sotto_neutralizzazione ? null : gapA;
  const gap_behind_out = sotto_neutralizzazione ? null : gapB;

  return { ok:true, rientro_pos:idx+1, su_totale:ord.length,
    davanti_ho:ahead?ahead[0]:null, gap_ahead:gap_ahead_out, dietro_esco:behind?behind[0]:null, gap_behind:gap_behind_out,
    // gap soppressi sotto SC/VSC: flag esplicito perché la UI sappia distinguere "nessun rivale" da "non quantificabile"
    sotto_neutralizzazione,
    nota_gap: sotto_neutralizzazione ? 'gap non quantificabile sotto '+(ng.tipo ?? 'neutralizzazione')+' — il pit-loss verde sovrastima la perdita reale' : null,
    // campi che richiedono DEGRADO / difficolta-sorpasso: dichiarati, non calcolati
    giro_neutralizzato:giroNeutralizzato,
    // quanti rivali il motore ha assunto si fermino con te sotto SC (0 = campo tutto fermo).
    // La UI lo DICHIARA: e' un'assunzione, non una certezza, e chi guarda deve saperlo.
    soste_rivali_assunte: sosteRivaliAssunte,
    aria_libera:null, perdita_primi3:null, undercut:null, overcut:null, delta_strategia:null, pit_exit_offset:null,
    // --- FATTI GREZZI ADDITIVI (non toccano rientro_pos/davanti/dietro) ---
    neutralizzazione_gara: ng,
    // L'ORDINE PREVISTO PER INTERO: [sigla, tempo simulato a fine finestra], dal primo
    // all'ultimo. rientro_pos e' l'indice del pilota dentro questo, ma il backtest ne ha
    // bisogno TUTTO: la classifica vera si legge sui piloti ARRIVATI, e per confrontare le
    // due sulla stessa popolazione bisogna poter ri-classificare la previsione sullo stesso
    // insieme. Senza, un rivale che si ritira nella finestra sposta di +1 il rango previsto
    // di tutti quelli sotto di lui, e l'errore che ne esce e' del banco, non del motore.
    // Additivo: la UI non lo guarda, il golden non lo confronta.
    ordine_previsto: ord.map(([d, t]) => [d, t]) };
}
