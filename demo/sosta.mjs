// sosta.mjs — UNA definizione di sosta, in UN posto (regola 1).
//
// Nel repo convivevano tre segnali usati come se fossero «la sosta», e non lo erano:
//   - `in_lap` si accende su OGNI transito in corsia box, sfilate sotto Safety Car e
//     rientri per bandiera rossa compresi: 459 accensioni contro 382 cambi gomma veri;
//   - il contatore `stint` avanza su quei transiti anche quando non si monta niente;
//   - f1db elenca i pit stop di GARA, che sono un'altra grandezza — e sul 2026 gli
//     mancano otto soste (provate da FastF1).
// Il caso limite: Monaco/LIN, giri 56-72. `in_lap` si accende 4 volte, il contatore
// avanza 4 volte (stint 1→5), e un set nuovo viene montato UNA volta sola (giro 67).
// Una vista costruita sul contatore disegnerebbe cinque stint dove ce ne sono due.
//
// LA DEFINIZIONE, pre-registrata in data/SOSTA_PREREG3.md e promossa il 08/08/2026 con
// accordo ESATTO (precisione e richiamo 1,0000, 0 disaccordi su 382 cambi) contro un
// arbitro indipendente — la stessa regola applicata ai campi Compound/TyreLife di FastF1,
// che vengono da un fornitore diverso dai nostri dati gara:
//
//     c'e' una SOSTA al giro L  ⟺  fra L e L+1 il pilota monta un SET DIVERSO
//                               ⟺  compound[L+1] != compound[L]  oppure
//                                   tyre_age[L+1] < tyre_age[L]
//
// Servono entrambe le condizioni: la mescola da sola non vede un cambio SOFT→SOFT; l'eta'
// da sola non vede un set nuovo della stessa eta' (Belgio/BEA g1: MEDIUM 1 → HARD 1) ne'
// un set USATO piu' vecchio di quello smontato (Canada/SAI g2: INTERMEDIATE 2 → MEDIUM 9).
//
// DUE CONCETTI, DUE NOMI. Il transito in corsia resta `in_lap` ed e' giusto cosi': serve
// al pallino che passa dai box sulla mappa e al badge BOX. La sosta e' il cambio gomma, e
// serve alla vista stint, al conteggio delle soste e alla strategia. Non sono la stessa
// cosa e non devono avere lo stesso nome.
//
// L'ASSENZA E' NULL (regola 6): se una delle due celle manca, o manca la mescola, la
// risposta e' null — non «nessuna sosta». Un pilota senza dato non e' un pilota che non
// si e' fermato.

/** C'e' una sosta fra la cella del giro L e quella del giro L+1?
 *  @returns {boolean|null} null se il dato non basta per rispondere. */
export function sostaFra(cella, successiva) {
  if (!cella || !successiva) return null;
  const c0 = cella.compound, c1 = successiva.compound;
  if (c0 == null || c1 == null) return null;
  if (c1 !== c0) return true;
  const e0 = cella.tyre_age, e1 = successiva.tyre_age;
  if (e0 == null || e1 == null) return null;
  return e1 < e0;
}

/** I giri in cui un pilota ha cambiato gomma.
 *  @param perGiro {Object} {giro: cella} del pilota
 *  @returns {number[]} giri di sosta, crescenti (il giro L = l'in-lap della sosta) */
export function sosteDi(perGiro) {
  const giri = Object.keys(perGiro).map(Number).sort((a, b) => a - b);
  const out = [];
  for (const L of giri) {
    if (sostaFra(perGiro[L], perGiro[L + 1]) === true) out.push(L);
  }
  return out;
}

/** Gli STINT di un pilota: tratti continui sullo stesso set.
 *  Uno stint si chiude sul giro di sosta; il successivo comincia al giro dopo.
 *  @returns {Array<{da:number, a:number, giri:number, compound:string|null,
 *                   etaIniziale:number|null, nuovo:boolean|null, finito:boolean}>}
 *  `nuovo` = il set montato era nuovo (eta' iniziale 1); null se l'eta' manca.
 *  `finito` = lo stint si chiude con una sosta (false = e' arrivato alla bandiera,
 *  o al ritiro: NON e' uno stint troncato per mancanza di dati). */
export function stintDi(perGiro) {
  const giri = Object.keys(perGiro).map(Number).sort((a, b) => a - b);
  if (!giri.length) return [];
  const soste = new Set(sosteDi(perGiro));
  const out = [];
  let da = giri[0];
  for (let i = 0; i < giri.length; i++) {
    const L = giri[i];
    const ultimo = i === giri.length - 1;
    if (soste.has(L) || ultimo) {
      const c = perGiro[da];
      out.push({
        da, a: L, giri: L - da + 1,
        compound: c?.compound ?? null,
        etaIniziale: c?.tyre_age ?? null,
        nuovo: c?.tyre_age == null ? null : c.tyre_age <= 1,
        finito: soste.has(L),
      });
      da = L + 1;
    }
  }
  return out;
}

/** Il transito in corsia — l'ALTRA cosa. Qui solo per dare un nome anche a lei, cosi'
 *  chi legge il codice vede che sono due domande diverse e sceglie quella che gli serve. */
export function transitoInCorsia(cella) {
  return cella ? !!(cella.in_lap || cella.out_lap) : null;
}
