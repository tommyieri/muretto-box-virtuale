# Passo vero — pre-registrazione

**Direttiva del PO (10/08/2026):** il motore deve essere orientato al **passo vero di quella
macchina in gara**, in live come nelle gare corse. Metro, chiesto e risposto: *«entrambe —
prevedere meglio i tempi dei prossimi giri, e azzeccare più spesso la posizione d'arrivo;
la prima aiuta la seconda ad avverarsi.»*

Quindi due cancelli, **in serie**: se il primo è NULL il secondo non si apre, perché senza
tempi migliori una posizione migliore sarebbe fortuna.

Questo file è scritto **prima** di misurare. Non si tocca dopo aver visto i numeri: se le
soglie vanno cambiate, si dichiara qui perché, con la data.

---

## Cosa si vuole battere (il nullo)

`pace[giro][pilota]` in `demo/data/<Gara>.json`: il passo della macchina stimato dai suoi
**giri verdi recenti**. È quello che il kernel proietta in avanti (`demo/engine.mjs`), ed è
già un buon stimatore quando la macchina ha girato pulita.

## L'alternativa

Il **controllo naturale** (misurato il 10/08, vedi la nota in memoria): stesso giro,
squadre diverse, stessa mescola, entrambi in aria libera, età gomma entro 3 giri.
12.370 casi sulle 11 gare. Il divario fra due squadre è stabile in 35 coppie su 43, con
scarto tipico fra gare di **0,51 s/giro** — ed è **inutile fra le squadre vicine**, che
sono quelle che decidono la gara.

Per questo l'alternativa **non** è «sostituisci il passo col prior»: è **una media pesata
sull'affidabilità**, dove il peso del prior è tanto maggiore quanto (a) il divario della
coppia è grande rispetto al suo scarto, e (b) il campione proprio della macchina è magro.

## IPOTESI, dichiarata prima

> Il controllo naturale **non** migliora il passo di una macchina che ha già girato pulita:
> lì il suo stesso cronometro è la fonte migliore. Migliora dove il campione proprio è
> **magro** — poche tornate verdi in aria libera al momento del congelamento.

Se il guadagno comparisse anche dove il campione è ricco, è più probabile un errore di
costruzione che un segnale: da guardare, non da spedire.

## Fuori campione, obbligatorio

**Leave-one-race-out.** Per la gara R, i divari fra coppie di squadre si stimano SOLO
dalle altre 10 gare. Nessun numero della gara R entra nel suo stesso prior. In-sample qui
sarebbe circolare, ed è un errore che questo progetto ha già commesso.

## CANCELLO A — i tempi dei prossimi giri

Per ogni gara, ogni pilota, e i giri di congelamento L ∈ {10, 20, 30, 40, 50}:

- **verità**: mediana dei tempi sul giro *puliti* del pilota nei giri L+1..L+5 (stessi
  filtri del censimento: no in/out-lap, no neutralizzazione, no cancellati);
- **errore**: |previsione − verità|, in secondi al giro;
- confronto **appaiato** sugli stessi casi: nullo vs alternativa.

**Si apre se, tutte e tre:**
1. nello strato **campione magro** (≤ 4 giri verdi in aria libera nei 10 giri prima di L)
   l'errore mediano scende di **almeno il 15%**;
2. nello strato **campione ricco** non peggiora di più del **2%**;
3. il **placebo** fallisce: rifacendo tutto con le etichette di squadra **rimescolate**
   nell'apprendimento del prior, il guadagno dello strato magro scende sotto un terzo.

**È NULL se** una qualunque delle tre non regge. In quel caso si scrive il referto e non
si spedisce niente: la direzione resta chiusa finché non arriva un dato o una fonte nuova.

## CANCELLO B — la posizione d'arrivo

Si apre **solo** se A si apre. Stesso disegno fuori campione, ma la previsione passa per il
motore intero (`rigioca`) e si guarda la posizione finale del pilota contro l'arrivo vero.

**Si apre se:** le gare in cui la posizione migliora superano quelle in cui peggiora, con
test dei segni **p < 0,05**, e la mediana dell'errore in posizioni non peggiora.

**Attenzione dichiarata:** A e B possono divergere. Coi rivali comportamentali i segni
vincevano 46-26 e la mediana non si muoveva. Se A si apre e B no, il risultato si scrive
così com'è — «migliora i tempi, non sposta gli arrivi» — e la decisione di spedire o no è
del PO, non mia.

## Cosa NON è in questa pre-registrazione

Le altre due strade proposte dal PO restano **non misurate**, e non vanno spacciate per
verificate:
- **le libere**: carichi di benzina e mappe motore ignoti (già a referto nel progetto);
- **il delta dura-morbida storico per circuito**: i delta per-mescola Pirelli non sono
  pubblicati, e le gomme 2026 si spostano per-circuito.
