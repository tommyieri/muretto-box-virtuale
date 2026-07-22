// live_bylap.mjs — DAL FLUSSO LIVE ALLA STESSA STRUTTURA CHE IL MOTORE GIA' SA LEGGERE.
//
// Il pannello del muretto (pitscenario.mjs, gradino.mjs, grossi.mjs) parla una lingua
// sola: byLap[giro][sigla] = {cum_time, lap_time, team, compound, tyre_age, stint,
// in_lap, out_lap, neutralized, lap}. Le gare gia' svolte quella struttura ce l'hanno
// gia' pronta nel JSON. La gara IN CORSO no: arriva un flusso di eventi.
//
// Questo modulo e' il traduttore, e non tocca il motore. Se traduce bene, il pannello
// live e il pannello sulle gare vecchie sono LO STESSO CODICE — che e' l'unico modo
// per non ritrovarsi con due muretti che dicono due cose diverse.
//
// ---------------------------------------------------------------- il nodo: cum_time
// Il feed NON manda il tempo cumulato di gara. Manda il gap dal leader. Si ricostruisce:
//
//     cum_time[pilota][L] = cum_leader[L] + gap[pilota][L]
//
// e qui c'e' una proprieta' che vale la pena scrivere, perche' toglie di mezzo il dubbio
// piu' ovvio ("ma cum_leader e' preciso?"):
//
//     UN ERRORE SU cum_leader NON CAMBIA NIENTE.
//
// E' un termine COMUNE a tutti i piloti dello stesso giro. Il pannello confronta piloti
// fra loro al giro di congelamento, e il motore fa avanzare tutti sommando il passo: una
// costante aggiunta a tutti si semplifica in ogni differenza. cum_leader serve solo a
// essere monotono. Percio' non lo si insegue: si somma il giro di chi e' primo, e basta.
//
// Il gap invece NON e' semplificabile, ed e' li' che si sta attenti. Il feed lo aggiorna
// ~25 volte per giro, anche a meta' giro. Se si tenesse "l'ultimo gap visto" si finirebbe
// per scrivere nel giro L un gap misurato dentro il giro L+1. MISURATO sulla registrazione
// di Spa (gara, 19/07/2026): l'ultimo aggiornamento prima del traguardo arriva a −0,2 s,
// il primo dopo a +4,5 s, e fra i due il gap si muove di 3 decimi. Quindi la riga del giro
// L si CHIUDE nell'istante in cui il contagiri passa a L, e da li' non si tocca piu'.
//
// ------------------------------------------------------------------- cosa NON si sa
// Tre limiti dichiarati, che restano null e non zero:
//   - i DOPPIATI non hanno un gap in secondi (il feed manda "1L"): cum_time = null.
//     Spariscono dal pannello. Meglio assenti che incollati al leader.
//   - chi si collega a META' GARA non ha i giri passati: la struttura parte da li'.
//     Il passo-base vuole 3 giri verdi, quindi il pannello resta muto per qualche giro
//     e lo dice.
//   - in-lap e out-lap si deducono dal passaggio di InPit. Dove l'ingresso ai box e'
//     prima della linea il giro attribuito puo' sfasare di uno: e' un giro escluso dal
//     passo, non un numero inventato.

// il vocabolario di Fase 1 per il track status; neutralizzato = campo fermo per tutti
const NEUTRO = new Set(['SCDeployed', 'SCEnding', 'VSCDeployed', 'VSCEnding', 'Red']);

const FUEL = 3.0 / 70.0;   // stesso coefficiente del kernel (engine/engine.py)

function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// "1:50.651" / "50.651" -> secondi. Il feed usa entrambe le forme.
export function tempoInSecondi(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  const p = s.split(':');
  let n;
  if (p.length === 2) n = parseInt(p[0], 10) * 60 + parseFloat(p[1]);
  else if (p.length === 3) n = parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseFloat(p[2]);
  else n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function creaByLapLive() {
  let piloti = new Map();     // num -> {sigla, team, colore}
  let cur = new Map();        // num -> stato corrente dal feed
  let byLap = {};             // L -> {sigla -> cella}
  let cumLeader = {};         // L -> tempo cumulato di riferimento
  let inLapDi = new Map();    // num -> giro di in-lap (dedotto da InPit)
  let sporco = new Map();     // num -> il giro in corso ha visto neutralizzazione
  let stato = 'AllClear';
  let giro = null, nLaps = null;
  let memoPace = {};

  const sigla = num => (piloti.get(num) || {}).sigla || `#${num}`;

  function voce(num) {
    let v = cur.get(num);
    if (!v) {
      v = { lap: null, gap_s: null, pos: null, last_lap: null, in_pit: false,
            compound: null, tyre_age: null, pit_stops: null, retired: false };
      cur.set(num, v);
    }
    return v;
  }

  // Il tempo di riferimento del giro L. Vale la nota in testa: conta che cresca, non
  // quanto valga. Si prende il giro di chi e' primo; se manca, la mediana del campo —
  // e se manca anche quella, un giro non si inventa e la catena si ferma.
  function avanzaRiferimento(L) {
    if (cumLeader[L] != null) return cumLeader[L];
    if (L <= 1) { cumLeader[1] = 0; return 0; }
    const prec = avanzaRiferimento(L - 1);
    if (prec == null) return null;
    let t = null;
    for (const [num, v] of cur) if (v.pos === 1 && v.lap === L) t = tempoInSecondi(v.last_lap);
    if (t == null) {
      const tutti = [];
      for (const [num, v] of cur) if (v.lap === L) {
        const x = tempoInSecondi(v.last_lap);
        if (x != null) tutti.push(x);
      }
      t = mediana(tutti);
    }
    if (t == null) return null;
    return (cumLeader[L] = prec + t);
  }

  // CHIUSURA DELLA RIGA. Chiamata nell'istante esatto in cui il contagiri passa a L:
  // da qui in poi la riga del giro L non si tocca piu' (vedi la nota sul gap in testa).
  function chiudiGiro(num, L) {
    const v = voce(num);
    const rif = avanzaRiferimento(L);
    // il leader non ha gap da se stesso: il feed manda "" e _secondi restituisce null.
    // Qui pos===1 significa gap zero, ed e' un fatto, non una stima.
    const gap = v.pos === 1 ? 0 : v.gap_s;
    const s = sigla(num);
    const tg = tempoInSecondi(v.last_lap);
    const inLap = inLapDi.get(num) === L;
    let cum = (rif != null && gap != null) ? rif + gap : null;
    // L'ECCEZIONE DELL'IN-LAP, misurata: entrando in pit lane il feed SMETTE di
    // aggiornare il gap (l'ultimo punto di cronometraggio e' prima dell'ingresso), e
    // quello congelato non contiene ancora la corsia box. Sulla gara di Spa questo
    // produceva 23 errori sopra il secondo — TUTTI e soli sull'in-lap, fino a 10,8 s
    // su HUL al giro 20. Non e' rumore: e' il gap che manca di un pezzo di giro.
    // Sul giro di rientro il tempo sul giro invece c'e', ed e' esatto (789 giri su 789
    // identici al vero): si somma quello al cumulato del giro prima. Il giro dopo si
    // torna al gap, quindi l'errore non si accumula.
    if (inLap && tg != null) {
      const prec = byLap[L - 1]?.[s]?.cum_time;
      if (typeof prec === 'number') cum = prec + tg;
    }
    (byLap[L] ||= {})[s] = {
      lap: L,
      cum_time: cum,                          // null per i doppiati: dichiarato
      lap_time: tg,
      team: (piloti.get(num) || {}).team || null,
      compound: v.compound || null,
      tyre_age: v.tyre_age != null ? v.tyre_age : null,
      stint: (v.pit_stops || 0) + 1,
      in_lap: inLap,
      out_lap: inLapDi.get(num) === L - 1,
      neutralized: !!sporco.get(num),
    };
    // il giro nuovo ricomincia pulito, e il suo stato di pista e' quello di adesso
    sporco.set(num, NEUTRO.has(stato));
    memoPace = {};
  }

  function fondi(num, d) {
    const v = voce(num);
    const giroPrima = v.lap;
    for (const k of ['gap_s', 'pos', 'last_lap', 'compound', 'tyre_age',
                     'pit_stops', 'retired']) {
      if (k in d) v[k] = d[k];
    }
    if ('in_pit' in d) {
      const era = v.in_pit;
      v.in_pit = !!d.in_pit;
      // entra ai box: il giro IN CORSO (quello dopo l'ultimo completato) e' l'in-lap
      if (!era && v.in_pit) inLapDi.set(num, (v.lap != null ? v.lap : 0) + 1);
    }
    if ('lap' in d) v.lap = d.lap;
    // la riga si chiude QUI, con il gap di un attimo fa — non con quello del giro dopo
    if (v.lap != null && v.lap !== giroPrima) chiudiGiro(num, v.lap);
  }

  function applica(e) {
    if (!e || !e.type) return;
    if (e.type === 'snapshot') {
      // riallineamento completo (riconnessione o arrivo a meta' sessione)
      piloti = new Map(); cur = new Map(); inLapDi = new Map(); sporco = new Map();
      byLap = {}; cumLeader = {}; memoPace = {};
      for (const [num, d] of Object.entries(e.driver_list || {})) piloti.set(num, { ...d });
      stato = e.track_status || 'AllClear';
      if (e.giro != null) giro = e.giro;
      if (e.giri_totali != null) nLaps = e.giri_totali;
      // lo snapshot NON e' un giro completato: popola solo lo stato corrente. La prima
      // riga di byLap nascera' al primo passaggio sul traguardo, e sara' vera.
      for (const [num, c] of Object.entries(e.cars || {})) {
        const v = voce(num);
        for (const k of ['gap_s', 'pos', 'last_lap', 'in_pit', 'compound',
                         'tyre_age', 'pit_stops', 'retired', 'lap']) {
          if (k in c) v[k] = c[k];
        }
        sporco.set(num, NEUTRO.has(stato));
      }
    } else if (e.type === 'driver_list') {
      for (const [num, d] of Object.entries(e.cars || {}))
        piloti.set(num, { ...(piloti.get(num) || {}), ...d });
    } else if (e.type === 'timing_update') {
      for (const [num, d] of Object.entries(e.cars || {})) fondi(num, d);
    } else if (e.type === 'track_status') {
      stato = e.status || stato;
      // una neutralizzazione sporca il giro IN CORSO di tutti: se ne accorgera' la
      // chiusura. Non si torna indietro a sporcare i giri gia' chiusi.
      if (NEUTRO.has(stato)) for (const num of cur.keys()) sporco.set(num, true);
    } else if (e.type === 'lap_count') {
      giro = e.giro != null ? e.giro : giro;
      if (e.giri_totali != null) nLaps = e.giri_totali;
    }
  }

  // PASSO-BASE, la stessa formula del kernel (engine/engine.py::pace_base): mediana dei
  // giri VERDI dello stint in corso, corretti del carburante, minimo 3. Non e' una
  // riscrittura libera: se qui divergesse, il pannello live direbbe numeri diversi dal
  // pannello sulle gare vecchie a parita' di situazione.
  function pace(L) {
    if (memoPace[L]) return memoPace[L];
    const N = nLaps || L;
    const fpl = 70.0 / N;
    const out = {};
    const sigle = new Set();
    for (let k = 1; k <= L; k++) for (const s in (byLap[k] || {})) sigle.add(s);
    for (const s of sigle) {
      let stintCorr = null;
      for (let k = L; k >= 1; k--) { const c = byLap[k]?.[s]; if (c) { stintCorr = c.stint; break; } }
      if (stintCorr == null) continue;
      const seg = [];
      for (let k = 1; k <= L; k++) {
        const c = byLap[k]?.[s];
        if (c && c.stint === stintCorr && c.lap_time != null
            && !c.neutralized && !c.in_lap && !c.out_lap) seg.push(c);
      }
      if (seg.length < 3) continue;
      const m = mediana(seg.map(c => c.lap_time - Math.max(0, 70.0 - fpl * (c.lap - 1)) * FUEL));
      if (m != null) out[s] = m;
    }
    return (memoPace[L] = out);
  }

  return {
    applica,
    // l'ultimo giro per cui esiste una riga chiusa: e' quello su cui si puo' congelare
    ultimoGiroChiuso() {
      const k = Object.keys(byLap).map(Number);
      return k.length ? Math.max(...k) : null;
    },
    byLap: () => byLap,
    nLaps: () => nLaps,
    giro: () => giro,
    pace,
    piloti: () => piloti,
    stato: () => stato,
    // chi ha una riga utilizzabile al giro L (cum_time vero, non doppiato)
    presenti(L) {
      return Object.entries(byLap[L] || {})
        .filter(([, c]) => typeof c.cum_time === 'number').map(([s]) => s);
    },
    // Perche' il pannello non parla ancora. Un motivo scritto vale piu' di un pannello
    // vuoto: chi guarda deve sapere se manca un dato o se e' rotto qualcosa.
    diagnosi(L) {
      if (L == null) return { pronto: false, motivo: 'nessun giro ancora completato' };
      const p = pace(L), n = Object.keys(p).length;
      if (n < 6) return { pronto: false, n,
        motivo: `passo-base disponibile per ${n} piloti su ${Object.keys(byLap[L] || {}).length}:`
              + ' servono 3 giri verdi a testa' };
      return { pronto: true, n, motivo: null };
    },
  };
}
