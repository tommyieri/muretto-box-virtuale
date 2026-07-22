// grossi.mjs — I CINQUE GROSSI, misurati dalla gara che sta correndo.
//
// Pit-loss scomposto · Degrado · Traffico al rientro · Undercut/overcut · Warm-up.
//
// REGOLA DELLA CASA, una sola: ogni numero esce con il suo STATO, e lo stato non e' un
// vezzo — e' la differenza fra un prodotto e una bugia.
//     MISURATO       questa gara, n osservazioni
//     PRIOR          non c'e' ancora materiale: e' il valore tipico, detto come tale
//     NON_MISURABILE non lo sappiamo, e lo diciamo. MAI zero al posto di null.
//     FUORI_DOMINIO  la domanda cade fuori dai casi osservati
//     SOSPESO        sotto SC/VSC: la fisica e' un'altra
//
// PERCHE' TUTTO DALLA GARA IN CORSO. Il prodotto ha un lusso che i modelli storici non
// hanno: la gara sta girando. Ogni sosta gia' avvenuta e' una misura vera di oggi — di
// questa pista, di queste gomme, di questo asfalto. Un prior storico serve solo finche'
// quel materiale non c'e'. Tutte le funzioni qui prendono `finoA` e usano SOLO cio' che
// e' successo prima: e' causale per costruzione, quindi funziona identica in replay e in
// diretta.
//
// ONESTA' SULLA PRECISIONE. Sbagliamo, e parecchio. Il pavimento di rumore del singolo
// pit stop e' 0,63 s; la banda del gradino e' 0,6-1,0 s/giro su un valore di 1,0-1,4.
// Nessuna riga di codice lo risolve. L'unica risposta e' non mostrare mai un numero nudo
// ma dentro la sua conseguenza ("serve che resti fuori fra 2 e 4 giri"), dove la larghezza
// si legge come una risposta e non come un'ammissione.
import { soste as sosteGrezze, misura as misuraSoste } from './gradino.mjs';

export const MISURATO = 'MISURATO';
export const PRIOR = 'PRIOR';
export const NON_MISURABILE = 'NON_MISURABILE';
export const FUORI_DOMINIO = 'FUORI_DOMINIO';
export const SOSPESO = 'SOSPESO';

const MIN_N = 3;                 // misurato: sotto 3 soste la misura viva e' peggio del prior
const ASCIUTTE = ['SOFT', 'MEDIUM', 'HARD'];

const mediana = v => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const q = (v, p) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
};

// ============================================================ 1. PIT-LOSS SCOMPOSTO
//
// Il PO lo chiede in tre pezzi: entry, tempo fermo, exit. Con i soli tempi sul giro i tre
// NON sono separabili — servirebbe la velocita' dell'auto in pit lane. Quello che invece
// si separa, e che e' esattamente la parte che si muove in modo indipendente, e':
//
//     perdita(pilota) = TRANSITO(circuito)  +  SCOSTAMENTO(squadra)
//
// dove il transito e' entry+exit+sosta tipica di questa pista oggi (la mediana della gara)
// e lo scostamento e' quanto quella squadra sta sopra o sotto la mediana. Una squadra lenta
// ai box non cambia l'entry del circuito: e' il punto del PO, e questa e' la forma minima
// che lo rispetta.
//
// LIMITE DICHIARATO, e va detto ogni volta: entry ed exit restano insieme. Separarli
// richiede il canale velocita', che il collettore registra ma non decodifica ancora.
export function pitLoss(byLap, nLaps, finoA = Infinity, prior = null) {
  const S = sosteGrezze(byLap, nLaps, finoA).filter(s => s.perdita != null);
  if (S.length < MIN_N) {
    return prior == null
      ? { stato: NON_MISURABILE, n: S.length,
          nota: `servono ${MIN_N} soste in gara e non c'e' un valore tipico per questa pista` }
      : { stato: PRIOR, valore: prior, n: S.length,
          nota: `valore tipico del circuito; da ${MIN_N} soste passa alla misura di oggi` };
  }
  const v = S.map(s => s.perdita);
  const transito = mediana(v);
  // scostamento per squadra: mediana dei residui sulla mediana di gara
  const perTeam = {};
  for (const s of S) {
    if (!s.team) continue;
    (perTeam[s.team] ||= []).push(s.perdita - transito);
  }
  const squadra = {};
  for (const [t, r] of Object.entries(perTeam)) {
    // una sosta sola non e' una tendenza: si dichiara, non si stima
    squadra[t] = { scostamento: mediana(r), n: r.length, affidabile: r.length >= 2 };
  }
  return {
    stato: MISURATO, valore: transito, n: S.length,
    transito, squadra,
    banda: [q(v, 0.25), q(v, 0.75)],
    // il pavimento: sotto questo non si migliora, e va detto invece di fingere decimali
    pavimento: 0.63,
    nota: `misurato su ${S.length} soste di questa gara`,
  };
}

// per-pilota: transito del circuito + scostamento della sua squadra, se lo conosciamo
export function pitLossPilota(pl, team) {
  if (pl.stato !== MISURATO) return { ...pl, per_pilota: null };
  const s = team && pl.squadra[team];
  if (!s || !s.affidabile) {
    return { ...pl, per_pilota: pl.transito,
             nota_squadra: team ? `${team}: una sola sosta, uso il valore della pista` : null };
  }
  return { ...pl, per_pilota: pl.transito + s.scostamento,
           nota_squadra: `${team} ${s.scostamento >= 0 ? '+' : ''}${s.scostamento.toFixed(2)} s su ${s.n} soste` };
}

// ============================================================ 2. DEGRADO
//
// Letto DALLA SOSTA, non dentro lo stint. Dentro lo stint degrado, carburante ed evoluzione
// pista sono confusi e il segno flippa fra le gare (Canada 24% di pendenze positive contro
// il 98% dell'Austria). La sosta invece e' una DISCONTINUITA': chi butta una gomma di 18
// giri guadagna piu' di chi ne butta una di 6, e quella differenza e' degrado quasi puro.
//
// Misurato sul 2026: -0,30 s/giro buttando gomme di 0-8 giri, -1,58 a 14-20. Monotono.
export function degrado(byLap, nLaps, finoA = Infinity) {
  const S = sosteGrezze(byLap, nLaps, finoA);
  const pts = [];
  for (const s of S) {
    const c = byLap[s.giro] && byLap[s.giro][s.drv];
    if (!c || c.tyre_age == null) continue;
    pts.push([c.tyre_age, s.gradino]);
  }
  if (pts.length < 6) {
    return { stato: NON_MISURABILE, n: pts.length,
             nota: 'servono almeno 6 soste con eta gomma per leggere il degrado dalla sosta' };
  }
  // pendenza del gradino contro l'eta buttata: piu' e' vecchia, piu' si guadagna a cambiarla
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  if (den <= 0) return { stato: NON_MISURABILE, n: pts.length, nota: 'eta tutte uguali' };
  const pend = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / den;
  const rho = -pend;                       // s/giro persi per ogni giro di vita gomma
  return {
    stato: MISURATO, valore: rho, n: pts.length,
    per_eta: [8, 14, 20].map(e => ({ eta: e, guadagno_cambiando: my + pend * (e - mx) })),
    nota: `letto da ${pts.length} soste di questa gara, dalla differenza fra chi butta gomme vecchie e chi nuove`,
    limite: 'e degrado + evoluzione pista insieme: la sosta li separa dal carburante, non fra loro',
  };
}

// ============================================================ 3. TRAFFICO AL RIENTRO
//
// MISURATO sulle soste vere 2026, ed e' un effetto RARO E TAGLIENTE, non diffuso:
//     < 0,5 s dall'auto davanti  ->  +0,70 s/giro   (n=6)
//     < 0,8 s                    ->  +0,44 s/giro   (n=11)
//     0,8 - 3,0 s                ->  nullo          (n=40)
// Solo il 7% delle soste esce entro 0,8 s. Ecco perche' un modello che spalma il traffico
// su tutti gli incontri perde contro il non-fare-niente: la maggior parte degli "incontri"
// non costa niente. Sopra 0,8 s il prodotto deve TACERE, non stimare.
const TRAFFICO = [
  { max: 0.5, costo: 0.70, n: 6 },
  { max: 0.8, costo: 0.44, n: 11 },
];
export function trafficoRientro(gapDavanti) {
  if (gapDavanti == null) return { stato: NON_MISURABILE, nota: 'nessun gap noto al rientro' };
  for (const f of TRAFFICO) {
    if (gapDavanti < f.max) {
      return { stato: MISURATO, valore: f.costo, n: f.n,
               nota: `esci a ${gapDavanti.toFixed(1)} s: ~${f.costo.toFixed(1)} s/giro finche non ti liberi`,
               limite: `misurato su ${f.n} soste soltanto` };
    }
  }
  return { stato: FUORI_DOMINIO, valore: 0,
           nota: `sopra 0,8 s il traffico al rientro non e misurabile: non lo contiamo` };
}

// ============================================================ 4. UNDERCUT / OVERCUT
//
// Il cuore della domanda. NON si restituisce un verdetto ("riesce"): si restituisce la
// QUANTITA' — quanti giri di vantaggio servono — e il tasso storico a quel gap. Su un
// problema sbilanciato 76/24 l'accuratezza e' la metrica sbagliata: quella giusta e' che
// dicendo RIESCE si becca il 57% contro un 24% di base.
const DOMINIO = { gapMax: 6.0, kMax: 6 };
const STORICO = { tutti: 0.24, n: 71, sotto1: 0.71, n1: 7, sopra45: 0.00, n45: 17,
                  perimetro: 'gap ≤ 6 s, 1-6 giri di overlap, gare asciutte 2026' };

export function undercut({ gap0, gradino, rivale = null }) {
  if (gradino == null) return { stato: NON_MISURABILE, nota: 'il guadagno da gomma nuova non e ancora misurabile in questa gara' };
  if (gap0 == null) return { stato: NON_MISURABILE, nota: 'nessun rivale davanti a pari giro' };
  const perGiro = Math.max(0, -gradino);
  if (perGiro < 0.05) {
    return { stato: MISURATO, riesce_mai: false, valore: 0,
             nota: 'oggi la gomma nuova non rende: qui decide la track position, non la sosta' };
  }
  if (gap0 > DOMINIO.gapMax) {
    return { stato: FUORI_DOMINIO,
             nota: `${rivale ?? 'il rivale'} e a ${gap0.toFixed(1)} s: fuori dai casi osservati (max ${DOMINIO.gapMax} s)` };
  }
  const giri = Math.ceil(gap0 / perGiro);
  if (giri > DOMINIO.kMax) {
    return { stato: FUORI_DOMINIO,
             nota: `servirebbero piu di ${DOMINIO.kMax} giri di vantaggio: fuori dominio` };
  }
  const tasso = gap0 < 1.0 ? { p: STORICO.sotto1, n: STORICO.n1, testo: 'sotto 1 s' }
    : gap0 > 4.5 ? { p: STORICO.sopra45, n: STORICO.n45, testo: 'sopra 4,5 s' }
    : { p: STORICO.tutti, n: STORICO.n, testo: 'in generale' };
  return {
    stato: MISURATO, valore: perGiro, giri_necessari: giri, gap0,
    margine_per_giro: perGiro, storico: { ...tasso, perimetro: STORICO.perimetro },
    // l'overcut e' la stessa funzione letta al contrario: se A non ce la fa, B guadagna
    // restando fuori esattamente quello che A non recupera
    overcut_di_chi_resta_fuori: perGiro * Math.min(giri, DOMINIO.kMax),
    nota: `serve che ${rivale ?? 'il rivale'} resti fuori ${giri} ${giri === 1 ? 'giro' : 'giri'} in piu`,
  };
}

// ============================================================ 5. WARM-UP GOMMA
//
// Il primo giro lanciato su gomma nuova rende meno del potenziale, e mangia una parte
// dell'undercut. Qui si misura DALLA GARA: primo giro verde dopo l'out-lap contro la
// mediana del resto dello stint. Prior storico noto (SOFT/MEDIUM +0,2/+0,4 s, HARD
// leggermente negativo) MAI validato sul 2026: se la gara non ha materiale si dice.
export function warmup(byLap, nLaps, finoA = Infinity) {
  const per = {};
  for (let L = 2; L <= nLaps && L < finoA; L++) {
    const cars = byLap[L];
    if (!cars) continue;
    for (const drv of Object.keys(cars)) {
      const o = cars[drv];
      if (!o || !o.out_lap) continue;
      const primo = byLap[L + 1] && byLap[L + 1][drv];
      if (!primo || primo.lap_time == null || primo.neutralized
          || primo.in_lap || primo.out_lap) continue;
      if (!ASCIUTTE.includes(primo.compound)) continue;
      const resto = [];
      for (let k = L + 2; k <= Math.min(nLaps, L + 7); k++) {
        const x = byLap[k] && byLap[k][drv];
        if (x && x.lap_time != null && !x.neutralized && !x.in_lap && !x.out_lap
            && x.stint === primo.stint) resto.push(x.lap_time);
      }
      if (resto.length < 3) continue;
      (per[primo.compound] ||= []).push(primo.lap_time - mediana(resto));
    }
  }
  const out = {};
  let tot = 0;
  for (const c of ASCIUTTE) {
    const v = per[c] || [];
    tot += v.length;
    out[c] = v.length >= MIN_N
      ? { stato: MISURATO, valore: mediana(v), n: v.length }
      : { stato: NON_MISURABILE, n: v.length };
  }
  return { stato: tot >= MIN_N ? MISURATO : NON_MISURABILE, n: tot, per_mescola: out,
           nota: 'primo giro lanciato contro il resto dello stint, misurato in questa gara' };
}

// ============================================================ 6. LA DERIVA DEL CAMPO
//
// Discende dal modo in cui il prodotto e' fatto: il sistema instrada UNA macchina dentro la
// gara che sta succedendo, e il resto del campo resta com'e' stato davvero. Quindi
// evoluzione pista e carburante bruciato sono GIA' DENTRO i tempi veri degli altri. Non
// vanno modellati — va evitato che la mia auto, tenuta a passo piatto, DERIVI contro un
// campo che accelera.
//
// Si misura dal campo stesso: mediana dei giri verdi di chi non e' ai box, pendenza sugli
// ultimi W giri. Non separa carburante da evoluzione: non serve separarli, serve la loro
// SOMMA, e quella e' osservabile. Misurato sul 2026: -0,049 s/giro per giro (piu' forte nel
// primo terzo, -0,10; quasi nulla nell'ultimo).
const W_DERIVA = 12;
const DERIVA_MAX = 0.25;         // oltre questo non e' deriva, e' una gara che sta succedendo altro

export function deriva(byLap, nLaps, finoA = Infinity, W = W_DERIVA) {
  const pts = [];
  const fino = Math.min(nLaps, finoA);
  for (let L = Math.max(1, fino - W); L <= fino; L++) {
    const cars = byLap[L];
    if (!cars) continue;
    const v = Object.values(cars)
      .filter(c => c && c.lap_time != null && !c.neutralized && !c.in_lap && !c.out_lap
                   && ASCIUTTE.includes(c.compound))
      .map(c => c.lap_time);
    if (v.length >= 6) pts.push([L, mediana(v)]);
  }
  if (pts.length < 6) {
    return { stato: NON_MISURABILE, n: pts.length,
             nota: 'servono almeno 6 giri con il campo in pista per leggere come scorre la gara' };
  }
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  if (den <= 0) return { stato: NON_MISURABILE, n: pts.length, nota: 'giri tutti uguali' };
  const d = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / den;
  if (Math.abs(d) > DERIVA_MAX) {
    return { stato: FUORI_DOMINIO, valore: 0, n: pts.length,
             nota: `il campo si muove di ${d.toFixed(2)} s/giro: non e deriva, sta succedendo altro` };
  }
  return { stato: MISURATO, valore: d, n: pts.length,
           nota: d < 0 ? `il campo va ${Math.abs(d).toFixed(3)} s/giro piu forte a ogni giro`
                       : `il campo sta rallentando di ${d.toFixed(3)} s/giro` };
}

// ============================================================ 7. DELTA-PASSO
//
// Con questo prodotto NON e' un modello: e' una sottrazione. La mia auto e' simulata, il
// rivale ha tempi VERI e gia' noti. Il delta-passo governa quanto DURA l'incontro.
//
// LA U ROVESCIATA, misurata su 46 gare e mai smentita: i piu' intrappolati non sono le auto
// pari ne' le lente, ma quelle APPENA piu' veloci. Chi ha oltre 0,8 s di vantaggio passa in
// un giro; chi ne ha due decimi resta li' per quattro. E' contro-intuitivo e va detto,
// perche' e' esattamente la situazione in cui il muretto crede di essere a posto.
export function deltaPasso({ paceIo, paceRivale, gap = null, rivale = null }) {
  if (paceIo == null || paceRivale == null) {
    return { stato: NON_MISURABILE, nota: 'passo non ancora misurabile per uno dei due' };
  }
  const d = paceRivale - paceIo;          // >0 = sono piu veloce io
  const out = { stato: MISURATO, valore: d, rivale };
  if (d <= 0.02) {
    return { ...out, durata: null,
             lettura: `stesso passo di ${rivale ?? 'chi hai davanti'}: non lo raggiungi` };
  }
  // quanti giri per annullare il gap, se il gap lo conosciamo
  const giri = (gap != null && gap > 0) ? Math.ceil(gap / d) : null;
  // la U rovesciata: il pericolo e' proprio la fascia "appena piu veloce"
  const intrappolato = d > 0.02 && d < 0.8;
  return {
    ...out, durata: giri, intrappolato,
    lettura: `sei ${d.toFixed(2)} s/giro piu veloce di ${rivale ?? 'chi hai davanti'}`
      + (giri != null ? `: lo raggiungi in ${giri} ${giri === 1 ? 'giro' : 'giri'}` : '')
      + (intrappolato ? ' — ma sotto 0,8 s/giro di vantaggio si resta dietro a lungo'
                      : ' — vantaggio pieno, passa in fretta'),
  };
}

// ============================================================ 8. NEUTRALIZZAZIONE
//
// La Safety Car NON va prevista: quando arriva la vedo nei tempi veri degli altri, perche'
// il campo e' reale. Quello che il muretto deve sapere PRIMA e' quanto vale l'OPZIONE:
// «fermarti ora costa X; se arriva una neutralizzazione ne costerebbe Y, e qui succede nel
// P% delle gare».
//
// IL RIFERIMENTO E' TUTTO, e prenderlo sbagliato ribalta il verdetto. Misurato su 3.573
// soste verdi e 629 neutralizzate, 2018-2026:
//     contro il PROPRIO passo verde      rapporto 2,19  -> "sotto SC costa il doppio"
//     contro il CAMPO che non si e fermato rapporto 0,79 -> "costa il 20% in meno"
// Il secondo e' cio' che la strategia significa: si perde tempo CONTRO GLI ALTRI, e sotto
// neutralizzazione anche gli altri vanno piano. Il primo misura la Safety Car, non la sosta.
//
// E NON E' UNA REGOLA: conviene nel 75% delle gare, non sempre. Silverstone sta a 1,05
// (nessun risparmio) e MONACO a 2,33 — li' sotto SC ci si tuffa tutti insieme, la pit lane
// si accoda, e fermarsi costa piu' del doppio. Un moltiplicatore unico (il 0,42 orfano di
// casa, lo 0,45 della letteratura, lo 0,59-0,64 delle preview) direbbe il contrario proprio
// dove la risposta conta.
// ⚠ NON MOSTRATA NEL PRODOTTO dal 22/07/2026, e resta qui apposta.
// Il rapporto SC/verde per circuito poggia su 3-4 gare, e su un caso reale di Silverstone
// ha dato la risposta ROVESCIATA: diceva "il leader resta davanti di 6 s" dove l'esito
// osservato su 286 casi dice che chi insegue passa nel 61%. La funzione resta perche' la
// misura e' onesta e servira' quando le gare saranno abbastanza; quello che non regge e'
// MOSTRARLA accanto a un numero dieci volte piu' solido. Chi la riaccende deve prima
// guardare rapporto_n_gare, non il rapporto.
export function neutralizzazione(cid, tabella, pitLossVerde) {
  const t = tabella?.per_circuito?.[cid];
  const g = tabella?.globale;
  if (!g) return { stato: NON_MISURABILE, nota: 'tabella neutralizzazione assente' };
  const prob = t?.probabilita ?? null;
  // il rapporto per-circuito solo se poggia su almeno due gare; altrimenti il globale,
  // dichiarato come tale. Mai un rapporto costruito su una gara sola.
  const perCircuito = (t?.rapporto != null && (t.rapporto_n_gare ?? 0) >= 2);
  const rap = perCircuito ? t.rapporto : g.rapporto;
  if (rap == null || pitLossVerde == null) {
    return { stato: NON_MISURABILE, probabilita: prob,
             nota: 'non abbiamo abbastanza soste sotto neutralizzazione per questa pista' };
  }
  const sotto = pitLossVerde * rap;
  const conviene = rap < 1;
  return {
    stato: MISURATO, probabilita: prob, rapporto: rap, per_circuito: perCircuito,
    costo_verde: pitLossVerde, costo_sotto: sotto,
    risparmio: pitLossVerde - sotto,
    nota: conviene
      ? `se arriva una neutralizzazione la sosta costa ~${sotto.toFixed(1)} s invece di `
        + `${pitLossVerde.toFixed(1)} (${(pitLossVerde - sotto).toFixed(1)} s risparmiati)`
      : `⚠ qui sotto neutralizzazione la sosta costa DI PIU: ~${sotto.toFixed(1)} s contro `
        + `${pitLossVerde.toFixed(1)} — ci si tuffa tutti insieme e la pit lane si accoda`,
    contesto: prob != null
      ? `su questa pista almeno una neutralizzazione arriva nel ${Math.round(prob * 100)}% delle gare`
      : 'quante volte arrivi su questa pista non lo sappiamo: troppo poche gare',
    limite: perCircuito ? `misurato su ${t.rapporto_n_gare} gare di questa pista`
                        : `valore generale (${Math.round((g.quota_gare_in_cui_conviene ?? 0) * 100)}% delle gare conviene): questa pista ha troppe poche soste sotto neutralizzazione`,
  };
}

// ============================================================ 9. IL RAGGRUPPAMENTO
//
// Il pezzo che mancava, e che decideva la risposta. Quando esce la Safety Car il gruppo si
// ACCODA in ordine di pista e i distacchi in tempo evaporano: chi si e' appena fermato in
// verde perde il vantaggio che aveva pagato, e chi si ferma DOPO, sotto SC, lo incassa.
//
// SC E VSC SONO OPPOSTI e trattarli insieme li cancella entrambi:
//     SC   distacchi fra auto consecutive  x0,66   il gruppo si accoda
//     VSC                                  x1,37   ognuno rallenta per conto suo
//
// QUANTO RESTA di un distacco quando esce la SC (10.092 coppie): 5-10 s -> 83%,
// 10-20 s -> 53%. Un vantaggio grosso si DIMEZZA.
//
// MA IL PRODOTTO NON RICOSTRUISCE: mostra l'ESITO OSSERVATO. Sommare pit-loss verde,
// pit-loss sotto SC e compressione dava la risposta ROVESCIATA, perche' il rapporto
// SC/verde di un singolo circuito poggia su tre o quattro gare. Il tasso di base poggia
// su 286 casi reali e non ha pezzi da sommare.
// Dove si puo' misurare la risposta invece dei suoi ingredienti, si misura la risposta.
export function raggruppamento(gapDietro, tab) {
  const e = tab?.esito_A_verde_B_sotto_SC;
  if (!e || gapDietro == null) {
    return { stato: NON_MISURABILE, nota: 'tabella del raggruppamento assente' };
  }
  const fascia = Object.entries(e).find(([k]) => {
    const [lo, hi] = k.split('-').map(Number);
    return gapDietro >= lo && gapDietro < hi;
  });
  if (!fascia) {
    return { stato: FUORI_DOMINIO,
             nota: `${gapDietro.toFixed(1)} s: fuori dalle distanze osservate (0-25 s)` };
  }
  const [k, v] = fascia;
  const c = tab.compressione || {};
  return {
    stato: MISURATO, quota: v.quota_B_passa, n: v.n, fascia: k,
    nota: `chi ti insegue a ${gapDietro.toFixed(1)} s, fermandosi sotto Safety Car, `
        + `ti passa nel ${Math.round(v.quota_B_passa * 100)}% dei casi`,
    contesto: `esito osservato su ${v.n} casi veri (2018-2026), non una ricostruzione`,
    limite: `sotto Safety Car i distacchi si comprimono (x${(c.SC?.mediana ?? 0).toFixed(2)}); `
          + `sotto Virtual SC no (x${(c.VSC?.mediana ?? 0).toFixed(2)}): sono due cose diverse`,
  };
}

// --- QUANTO VANTAGGIO SERVE PER DIFENDERSI -----------------------------------
// La domanda che il muretto fa davvero: "se mi fermo adesso in verde ed esce la Safety
// Car, quanto devo avere di margine per non farmi passare?". Riferimento di dominio del
// PO: ~10 s su una pista media. Misurato sul fondo: 10,1 s globale, 11,1 s fra i primi due.
//
// SI USA IL VALORE GLOBALE PER TUTTI I CIRCUITI — decisione presa col PO il 22/07/2026,
// dopo che il suo occhio di dominio ha segnalato che alcune soglie per-pista non tornavano.
//
// E' stato messo alla prova invece di essere accettato o respinto. Test di permutazione:
// rimescolando 2000 volte gli EVENTI (non le coppie) in finti circuiti delle stesse taglie,
// l'escursione attesa PER CASO e' 8,3 s con IC90 [4,0 - 14,1]. Quella osservata fra i sette
// circuiti misurabili e' 11,1 s. p = 0,199.
//
// Cioe': Interlagos a 3,7 s e Silverstone a 14,8 non sono due piste diverse, sono due
// manciate di Safety Car diverse. Con 3-5 eventi a pista la dispersione che si vede e'
// quella che il caso produce comunque.
//
// I valori per-circuito RESTANO nel JSON come diagnostica: quando una pista avra' abbastanza
// eventi la domanda si riapre da sola guardando n_eventi, e il test di permutazione si
// rifa'. Quello che non si fa e' mostrarli adesso.
export function sogliaDifesa(cid, tab) {
  const sp = tab?.soglia_pareggio;
  if (!sp?.globale) return { stato: NON_MISURABILE, nota: 'soglia non disponibile' };
  const s = sp.globale;
  return {
    stato: MISURATO, valore: s.soglia_s, per_circuito: false, n_eventi: s.n_eventi,
    nota: `per restare davanti servono ~${s.soglia_s.toFixed(0)} s di vantaggio`,
    limite: `misurato su ${s.n_eventi} Safety Car, 2018-2026 &middot; le differenze fra piste `
          + `non si distinguono dal caso (p = 0,20)`,
  };
}

// ============================================================ 10. IL METEO — UN CANCELLO
//
// Misurato sul fondo: 21 gare bagnate su 177 (11,9%), ma il fenomeno che conta — l'ONDATA,
// cioe' il campo che cambia famiglia di mescola — tocca il 2,0% dei giri di gara. Rarissimo,
// e quando c'e' distrugge tutto: dentro un'ondata il delta fra asciutto e intermedia si
// muove di 3,1 s/giro (fino a 7,3). Il gradino di sosta al cambio famiglia vale +12,4 s/giro
// (asciutto->intermedia) contro il -1,0 dell'asciutto: mille volte fuori scala.
//
// E i tre pilastri del motore — pit-loss 22,5 s, degrado +0,039, gradino -1,04 — sono TUTTI
// misurati su gomma asciutta e NESSUNO e' mai stato validato sul bagnato.
//
// Quindi il meteo non e' un modello da aggiungere: e' un CANCELLO a due stati. E si accende
// dalla MESCOLA del campo, mai dal flag wR — verificato inaffidabile (Spa 2025 parte su
// intermedia con wR falso; su 80 gare i due criteri discordano 4 volte).
const BAGNATE = ['INTERMEDIATE', 'WET'];

export function meteo(byLap, nLaps, finoA = Infinity) {
  const L = Math.min(nLaps, finoA);
  const cars = byLap[L];
  if (!cars) return { stato: NON_MISURABILE, nota: 'nessun dato a questo giro' };
  const tot = Object.keys(cars).length;
  const suBagnato = Object.values(cars).filter(c => BAGNATE.includes(c?.compound)).length;
  // cambi di famiglia negli ultimi 3 giri: e' l'ONDATA, il momento in cui si decide tutto
  let cambi = 0;
  for (let k = Math.max(2, L - 2); k <= L; k++) {
    const a = byLap[k - 1], b = byLap[k];
    if (!a || !b) continue;
    for (const d of Object.keys(b)) {
      const pa = a[d]?.compound, pb = b[d]?.compound;
      if (!pa || !pb) continue;
      if (BAGNATE.includes(pa) !== BAGNATE.includes(pb)) cambi++;
    }
  }
  const fuori = cambi >= 2 || (tot > 0 && suBagnato / tot >= 0.25);
  if (!fuori) return { stato: MISURATO, asciutto: true, su_bagnato: suBagnato, nota: null };
  return {
    stato: FUORI_DOMINIO, asciutto: false, su_bagnato: suBagnato, cambi,
    nota: cambi >= 2
      ? `PASSAGGIO DI MESCOLA IN CORSO: ${cambi} cambi di famiglia negli ultimi 3 giri`
      : `${suBagnato} auto su ${tot} sono su gomma da bagnato`,
    limite: 'pit-loss, degrado e gomma nuova sono misurati su ASCIUTTO e non valgono qui: '
          + 'il cambio di famiglia sposta il passo di 3 s/giro, cento volte i numeri del pannello',
  };
}

// ============================================================ 11. PENALITA PENDENTE
//
// Misurato sul 2026: 22 penalita' di tempo in 10 gare, solo due tagli (5 s nel 77% dei casi,
// 10 s nel 23%). E il fatto che le rende utili: l'82% viene SCONTATO ALLA SOSTA SUCCESSIVA.
// Quindi non sono post-processing della classifica — sono un costo che si paga esattamente
// nel momento che il pannello sta simulando.
//
// Le penalita' POST-GARA restano fuori (4 su 22, cambiano l'ordine in 2 gare su 10 e le
// prime 5 in 0 su 10): quelle si mostrano, non si simulano. Race control livello 1 resta.
export function penalitaPendente(pen, giroOra, giroSosta) {
  // pendente = annunciata prima di adesso e non ancora scontata a una sosta
  const attive = (pen || []).filter(p => p.giro <= giroOra && p.secondi > 0);
  if (!attive.length) return { stato: MISURATO, secondi: 0, nota: null };
  const s = attive.reduce((a, p) => a + p.secondi, 0);
  const motivi = attive.map(p => p.motivo || 'penalita').filter(Boolean);
  return {
    stato: MISURATO, secondi: s, n: attive.length,
    nota: `+${s} s di penalita pendente` + (motivi.length ? ` (${motivi[0].toLowerCase()})` : ''),
    limite: 'si sconta alla prossima sosta: e gia dentro il costo mostrato',
  };
}

// ============================================================ TUTTI INSIEME
//
// Una chiamata sola, allo stato del giro `finoA`. E' quello che il pannello consuma, ed e'
// anche quello che lo shadow-run scrive su file durante una gara vera.
export function grossi(byLap, nLaps, finoA, { priorPitLoss = null, neutro = false } = {}) {
  if (neutro) {
    return { stato: SOSPESO,
             nota: 'sotto SC/VSC la fisica e un altra: pit-loss, degrado e undercut sono sospesi' };
  }
  const m = misuraSoste(byLap, nLaps, finoA);
  const pl = pitLoss(byLap, nLaps, finoA, priorPitLoss);
  return {
    stato: MISURATO,
    soste_viste: m.n_gradino,
    pit_loss: pl,
    gomma_nuova: (m.gradino != null && m.n_gradino >= MIN_N)
      ? { stato: MISURATO, valore: m.gradino, n: m.n_gradino }
      : { stato: NON_MISURABILE, n: m.n_gradino,
          nota: `servono ${MIN_N} soste: finora ${m.n_gradino}` },
    degrado: degrado(byLap, nLaps, finoA),
    warm_up: warmup(byLap, nLaps, finoA),
    deriva: deriva(byLap, nLaps, finoA),
  };
}
