// orologio.mjs — L'ARITMETICA DEL TEMPO DI GARA, in un posto solo (regola 1).
//
// Rispondeva alle stesse due domande in DUE punti del repo, con la stessa identica logica
// e due sorgenti di cum diverse:
//   - gara.html (cum REALI dei dati gara): tempoReale(p) e giroDi(d, T);
//   - ghostplay.mjs (cum SIMULATI della scena): tempoReale(C, p) e giroDi(cumD, leadL0, T).
// Due copie della stessa ricerca binaria, dello stesso calcolo della frazione, dello stesso
// rifiuto dei buchi. E' il caso da manuale della regola 1, ed e' anche l'errore E12 del
// catalogo (due definizioni della stessa cosa: 37% di divergenza replay/live nel vecchio
// repo). Qui ce n'e' una.
//
// LE DUE DOMANDE
//   1. tempoDa(p)  — dove siamo nel TEMPO, dato il giro frazionario del battistrada.
//                    p in [L, L+1) = il battistrada percorre il giro L; il traguardo del
//                    giro L sta a p = L+1.
//   2. giroDi(cum, T) — dato il tempo T, in che giro e' un pilota e a che frazione, dai
//                    SUOI cum_time. Non e' la stessa cosa del battistrada: chi e' doppiato
//                    sta in un giro diverso nello stesso istante.
//
// LA DIFFERENZA CHE SEMBRAVA UN DETTAGLIO, e non lo era. Le due copie ancoravano il primo
// campione in modo diverso:
//   - gara.html: `{lap: 0, cum: leadCum[0]}` → un pilota il cui primo giro noto non e' l'1
//     restituisce null. E' voluto: «buco nei dati, non inventare».
//   - ghostplay: `{lap: fine.lap - 1, cum: leadL0}` → al primo campione passa sempre. E'
//     altrettanto voluto: la scena comincia al giro di CONGELAMENTO, e li' il giro 1 non
//     esiste per definizione.
// Fondere le due senza accorgersene avrebbe rotto l'una o l'altra in silenzio. Qui la
// differenza e' UN parametro dichiarato (`lapZero`), e demo/test_orologio.mjs verifica che
// ciascun chiamante ottenga esattamente il comportamento che aveva prima.
//
// COSA NON STA QUI: il playhead della mappa live (demo/live_mappa.mjs). Non e' la stessa
// cosa travestita — e' un problema diverso: consuma un flusso senza fine, con consegna a
// raffiche, e deve stimare il ritmo, tenere un buffer, riagganciarsi quando il feed salta
// e invecchiare i campioni. Qui invece la linea del tempo e' FINITA e nota in anticipo.
// Unificarli vorrebbe dire mettere insieme due domande diverse per far tornare un conto.

/** Ancora dell'animazione su una sequenza di tempi-battistrada per giro.
 *  @param lead   {Object} {giro: tempo di fine giro del battistrada}; lead[minLap-1] = partenza
 *  @param minLap {number} primo giro della linea del tempo (1 in gara, freezeLap nella scena)
 *  @param maxLap {number} ultimo giro */
export function creaAncora({ lead, minLap = 1, maxLap }) {
  return {
    /** p (giro frazionario) -> tempo. undefined se l'ancora non c'e'. */
    tempoDa(p) {
      const L = Math.max(minLap, Math.min(maxLap, Math.floor(p)));
      const f = Math.min(1, Math.max(0, p - L));
      const t0 = lead[L - 1], t1 = lead[L] ?? t0;
      if (t0 === undefined) return undefined;
      return t0 + f * (t1 - t0);
    },
    /** l'inverso: tempo -> p. Serve a fermarsi su un ISTANTE esatto (il rientro del
     *  fantasma) senza dipendere dal frame-rate. */
    pDaTempo(T) {
      for (let L = minLap; L <= maxLap; L++) {
        const a = lead[L - 1], b = lead[L];
        if (a == null || b == null) continue;
        if (T <= b) return L + (T - a) / ((b - a) || 1);
      }
      return maxLap + 1;
    },
  };
}

/** Al tempo T, in che giro e' questo pilota e a che frazione?
 *  @param cum  {Array}  [{lap, cum}] ORDINATI per giro (i cum_time del pilota)
 *  @param T    {number} tempo di gara
 *  @param tempoZero {number} istante prima del quale non si risponde (partenza / congelamento)
 *  @param lapZero   {number} numero di giro a cui corrisponde `tempoZero`. In gara e' 0
 *        (tempoZero = la partenza, cioe' la fine del «giro 0»), cosi' un pilota il cui primo
 *        giro noto non e' l'1 viene RESPINTO. Nella scena e' il giro prima del primo
 *        simulato, cosi' il primo campione passa.
 *  @param clamp {boolean} riporta fd in [0,1] (la scena lo faceva, la gara no; con dati
 *        monotoni e' un'operazione nulla in entrambi i casi).
 *  @returns {{lap:number, fd:number}|null} null quando il dato non basta — mai inventato. */
export function giroDi(cum, T, { tempoZero, lapZero, clamp = false } = {}) {
  if (!cum || !cum.length || !(T >= tempoZero)) return null;
  let lo = 0, hi = cum.length - 1, idx = cum.length;   // primo indice con cum > T
  if (cum[hi].cum > T) {
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m].cum > T) hi = m; else lo = m + 1; }
    idx = lo;
  }
  if (idx >= cum.length) return null;                  // oltre l'ultimo giro noto
  const fine = cum[idx];
  const inizio = idx > 0 ? cum[idx - 1] : { lap: lapZero, cum: tempoZero };
  if (fine.lap !== inizio.lap + 1) return null;        // buco nei dati: non inventare
  const fd = (T - inizio.cum) / ((fine.cum - inizio.cum) || 1);
  return { lap: fine.lap, fd: clamp ? Math.min(1, Math.max(0, fd)) : fd };
}
