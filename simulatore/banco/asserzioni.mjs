// asserzioni.mjs — l'infrastruttura minima del banco. Nessuna dipendenza:
// il lockfile resta vuoto e il banco non ha da fidarsi di terze parti.
//
// `verifica` pretende ESATTAMENTE `true`: un valore truthy ma non booleano
// (una stringa, un oggetto, un `1`) è un test che non sa cosa sta chiedendo, e
// qui fallisce invece di passare per caso (E09).
// La potenza di fallire di questo helper è verificata da s03.

export function banco(nome) {
  let errori = 0;
  const rompi = (descr, dettaglio) => {
    errori += 1;
    console.error(`${nome} FALLITA — ${descr}${dettaglio ? `\n    ${dettaglio}` : ''}`);
  };
  return {
    verifica(descr, condizione) {
      if (condizione !== true) rompi(descr, `condizione = ${JSON.stringify(condizione)} (atteso true)`);
    },
    uguale(descr, reale, atteso) {
      const a = JSON.stringify(reale);
      const b = JSON.stringify(atteso);
      if (a !== b) rompi(descr, `reale  = ${a}\n    atteso = ${b}`);
    },
    esplode(descr, fn) {
      try {
        fn();
      } catch {
        return; // ha fallito rumorosamente: è ciò che si pretendeva
      }
      rompi(descr, 'non ha lanciato: il fallimento è silenzioso');
    },
    chiudi() {
      process.exit(errori === 0 ? 0 : 1);
    },
  };
}
