# Passo vero — referto del cancello A

**Esito: NULL.** Il cancello A non si apre, quindi il cancello B non si apre.
Non si spedisce niente.

Disegno e soglie: `PREREG.md`, scritto prima della misura. Codice: `cancello_a.py`.
Fuori campione: leave-one-race-out sui divari fra squadre, 410 casi.

## I numeri

Errore mediano nel prevedere il passo del pilota nei 5 giri successivi al congelamento
(giri 10, 20, 30, 40, 50 di ognuna delle 11 gare):

| | tutti | campione magro | campione ricco |
|---|---|---|---|
| **nullo** (`pace` + benzina) | **0,271 s** | 0,337 s | 0,261 s |
| alternativa (miscela col controllo naturale) | 0,301 s | 0,431 s | 0,283 s |
| | −11,1% | **−27,9%** | −8,5% |
| placebo (squadre rimescolate) | 0,447 s | 0,846 s | 0,387 s |
| solo il prior, senza miscela | 0,510 s | 0,537 s | 0,507 s |

Soglia 1 (magro migliora ≥ 15%): **NO**, −27,9%.
Soglia 2 (ricco non peggiora > 2%): **NO**, −8,5%.
Meglio del nullo in 206 casi su 410: una moneta.

## Cosa dicono, letti bene

**Il segnale ESISTE.** L'alternativa vera (0,301 s) batte nettamente il proprio placebo
con le squadre rimescolate (0,447 s): l'identità della squadra porta informazione, non è
un artefatto. La premessa del PO — «se tutto l'anno Ferrari va più forte di Cadillac non
possono andare uguali» — è vera, e misurata: Cadillac vs Ferrari +3,19 s/giro, segno
giusto in 6 gare su 6.

**Ma è più grossolano di ciò che vorrebbe migliorare.** Il cronometro della macchina
stessa sbaglia di **0,271 s**; il controllo naturale ha un pavimento di rumore di
**0,51 s/giro** fra una gara e l'altra — misurato PRIMA, nel censimento di fattibilità.
Un attrezzo con il doppio dell'errore di quello che deve correggere non può correggerlo.
**Il numero che chiudeva la questione era già nella misura di fattibilità: non l'avevo
letto come una previsione di fallimento, e avrei potuto.**

**E non aiuta nemmeno dove il campione è magro** (−27,9%), che era l'unica ipotesi
sopravvissuta. «Magro» qui vuol dire ≤ 4 giri verdi in aria libera negli ultimi 10: pochi,
ma della macchina giusta — e battono comunque una stima presa da un'altra macchina.

## Un errore commesso e corretto, che vale più del risultato

La **prima** esecuzione dava **+32,9%** in favore dell'alternativa. Era falso: `pace` è il
passo a **serbatoio vuoto**, non un tempo sul giro. Misurato: il tempo reale lo supera di
+2,79 s al giro 10 e di +1,10 s al giro 50 — la benzina che si consuma. Confrontarlo
grezzo coi tempi veri regalava al nullo un handicap di due secondi, e tutto il «guadagno»
era lì.

A far scattare il sospetto è stata la pre-registrazione, non l'occhio: l'ipotesi diceva
che il guadagno doveva comparire SOLO dove il campione è magro, e invece compariva anche
dove è ricco (+24,1%). Scritto prima, quel dettaglio era un allarme; scritto dopo, sarebbe
stato una conferma.

## Cosa resta aperto

Le altre due strade proposte dal PO restano **non misurate**: le libere (benzina e mappe
motore ignoti) e il delta dura-morbida storico per circuito (delta Pirelli non pubblicati,
gomme 2026 che si spostano per-circuito).

Una riapertura di QUESTA strada richiede una pre-registrazione nuova e una ragione nuova —
non una miscela ri-tarata su questi stessi numeri, che sarebbe scegliere la soglia dopo
aver visto il risultato.
