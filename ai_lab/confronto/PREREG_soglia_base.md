# PREREG — `MIN_GIRI_BASE` da 8 a 4

*Scritta il 01/08/2026 PRIMA di cambiare la costante e PRIMA di misurare qualunque
variante. Voce 4 di `PIANO_CORREZIONE.md`.*

## Perché

`MIN_GIRI_BASE = 8` (`simulatore/scenario/costruttore.mjs:31`) è nata come **criterio di
ammissione del banco** — «sotto otto giri non ti misuro» — ed è migrata nel motore come
costante muta, senza targhetta. Come soglia di **qualità** non regge: misurato, una base
su 4-7 giri sbaglia **0,314 s/giro** contro **0,386** delle basi su 8 o più. La soglia
esclude basi che sono, se qualcosa, leggermente *migliori*.

Il prezzo è grosso e si vede in pagina: **il 10,2% delle caselle non ha risposta**, e ai
giri 5-7 la copertura è **zero per costruzione**, proprio dove il muretto guarda per primo.

## Cosa cambia

Un numero solo: la soglia passa da 8 a 4, e diventa **dichiarata nel modello** con
targhetta invece che cablata in un sorgente. `min_giri_base` in `banco/prereg/` **non si
tocca**: quello è il criterio del banco, ed è giusto che resti severo.

**4 è un pavimento, non un'opinione:** sotto i 4 giri la base è una mediana di due o tre
numeri, e il degrado dentro uno stint così corto non si distingue dal rumore.

## Il cancello — tre condizioni, tutte e tre

| | condizione |
|---|---|
| **A** | la **copertura sale**: più casi con risposta di prima |
| **B** | gli **esatti sulle risposte che c'erano già** non calano di più di **2 punti** (lettura B2, i casi che il motore rispondeva anche con soglia 8) |
| **C** | lo scarto appaiato dell'**errore di base** fra le finestre 4-7 e 8+ ha **IC95 che contiene lo zero** (blocchi = gare, E11): cioè le basi corte non sono peggiori di quelle lunghe |

B è la condizione che conta: aggiungere mille risposte non vale niente se peggiora quelle
che il prodotto già dava.

## Cosa fa dichiarare NULL

- una fra A, B, C non regge;
- la suite del banco perde una sentinella oggi verde;
- le **risposte nuove** risultano sistematicamente peggiori delle vecchie di oltre 5 punti
  di esatti — non è una delle tre condizioni, ma sarebbe una sorpresa da guardare prima di
  spedire, non dopo.

## Cosa NON dimostra

- **La qualità delle risposte nuove non è certificata**: solo una parte dei casi nuovi ha
  una verità con cui confrontarsi, ed è un campione piccolo. Si riporta, non decide.
- Non è additivo: il **campo** su cui si calcola la posizione cresce, quindi qualche
  risposta già pubblicata **cambierà**. Il conto di quante va riportato per intero — se
  fosse zero, la modifica non starebbe facendo niente.
- Resta dentro campione come tutto il resto.

## Poi, non prima

Sostituire il pannello muto con «servono k giri verdi, ne hai j — la prima risposta è al
giro N». Farlo *al posto* dell'abbassamento sarebbe un cartello educato davanti a mille
caselle che potevano essere piene.
