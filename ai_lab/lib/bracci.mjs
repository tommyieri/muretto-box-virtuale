// bracci.mjs — la guardia anti-A/A: un confronto A/B è giudicabile solo se i
// bracci si distinguono almeno una volta.
//
// Il difetto che questa definizione impedisce è stato pagato TRE volte nella
// stessa giornata (04/08): cancelli_vita.mjs confrontava il modello con se
// stesso (0-0 con 167 pari), il banco del tetto misurava il tetto contro il
// tetto (tetto: null in ENTRAMBI i bracci), e C4 passava perché non si muoveva
// niente. Due erano verdi e muti da giorni. Un cancello i cui bracci producono
// sempre lo stesso output non sta misurando la differenza che dichiara: è un
// termometro rotto che segna sempre la stessa temperatura, e il suo PASS è
// vuoto (famiglia E22: verde che non significa niente).
//
// La regola, in una riga: PRIMA di leggere l'esito di un A/B si conta quante
// volte i bracci hanno risposto diverso; zero volte = NON GIUDICABILE, mai
// PASS. Ogni banco A/B nuovo importa queste due funzioni invece di riscriverle
// (regola 1: una definizione, un posto). L'unico precedente che già vincolava
// era P4 in cancelli_obiettivo.mjs, ed è il modello di questa guardia.

/** Quante coppie [a, b] hanno risposto diverso. */
export const contaDistinti = (coppie) => coppie.filter(([a, b]) => a !== b).length;

/**
 * Un A/B è giudicabile se ha almeno una decisione E almeno una coppia in cui
 * i bracci si distinguono. `false` significa: l'esito del cancello non va
 * letto — va dichiarato NON GIUDICABILE, e il perché stampato accanto.
 */
export const abGiudicabile = (coppie) => coppie.length > 0 && contaDistinti(coppie) > 0;
