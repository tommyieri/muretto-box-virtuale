// whatif_piano.mjs — che cosa si consegna al kernel quando l'utente sposta UNA sosta.
//
// PERCHE' STA IN UN FILE SUO. E' la parte della pagina What-If che si puo' mettere sotto
// banco: nessun DOM, nessun fetch, nessuna costante di fisica. `whatif.mjs` non e'
// importabile da Node (passa per muro.mjs, che al caricamento tocca `window`), quindi
// lasciare qui dentro questa logica avrebbe significato lasciarla senza sentinella — ed e'
// esattamente la logica che il 17/08/2026 ha sbagliato per prima.
//
// L'ERRORE CHE QUESTO FILE ESISTE PER NON RIFARE. La prima riparazione passava al motore
// `[{giro: scelto}]`, cioe' UNA sosta sola. Ma il braccio di riferimento gira la strategia
// VERA, che a Ungheria/NOR sono tre soste (17, 39, 56): il confronto misurava lo
// spostamento SOMMATO alla soppressione delle altre due, e col cursore fermo sul giro 17 —
// «non ho cambiato niente» — leggeva +12,98 s. Un numero che non e' sbagliato di poco: e'
// la risposta a un'altra domanda.
//
// L'INVARIANTE, che il banco verifica: cursore sul giro della sosta vera e mescola vera
// => il piano coincide con quello vero => delta 0,00 s. Se un giorno non e' piu' zero, o e'
// cambiato il kernel o e' tornato questo difetto.

import { MESCOLE_EDITOR } from './ese.mjs';

/** Le soste vere che l'editor sa rappresentare. E' LO STESSO filtro che ese_vista.mjs
 *  applica al braccio «strategia vera»: se i due bracci partissero da insiemi diversi, il
 *  delta misurerebbe anche quella differenza invece della sola scelta dell'utente. */
export function sosteEditabili(soste) {
  return (soste ?? []).filter((s) => MESCOLE_EDITOR.includes(s.mescola));
}

/**
 * La strategia vera con la PRIMA sosta dopo il congelamento spostata al giro scelto.
 * Le soste gia' avvenute stanno nello stato congelato e non si rimettono; le successive
 * alla prima si conservano, perche' l'utente non le ha toccate.
 *
 * @param soste  le soste vere del pilota, {giro, mescola}[]
 * @param freeze il giro di congelamento
 * @param giroAlt il giro scelto dall'utente
 * @param mescola la mescola scelta dall'utente
 * @returns {{giro:number, mescola:string}[]} piano crescente, tutto dopo il congelamento
 */
export function pianoWhatIf(soste, freeze, giroAlt, mescola) {
  const dopo = sosteEditabili(soste).filter((s) => s.giro > freeze);
  const resto = dopo.slice(1).filter((s) => s.giro !== giroAlt);
  return [{ giro: giroAlt, mescola }, ...resto]
    .filter((s) => s.giro > freeze)
    .sort((a, b) => a.giro - b.giro);
}
