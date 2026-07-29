# PREREG — il traffico, secondo ingresso: l'INTENSITÀ governata dalla PISTA

Terzo giro dell'**agente autonomo a compito**. Branch `ai-lab/autonomo-traffico-pista`,
21/07/2026. Scritto **prima** di misurare.

## 0. Una correzione alla premessa, prima di cominciare

Il brief descrive `data/difficolta_sorpasso.csv` come «esiste, è pre-validato, mai
agganciato». **Il repo dice il contrario, e lo dice per iscritto.** In
`data/SORPASSO_NOTA.txt`:

> *«Il vecchio data/difficolta_sorpasso.csv (orfano, senza generatore) resta NON fidato e
> non è stato usato in alcun modo.»*

E il suo successore — l'indice v1 con generatore committato (`gen_difficolta_sorpasso.py`)
— ha ricevuto **VERDETTO NO-GO**: G2 (stabilità cross-stagione) **FAIL** con inversioni
radicali (Suzuka 86 % → 17 %, Miami 64/23/75, Baku 18 → 54) e G3 (ground truth) **FAIL**.
La sua tabella è marcata *«RECORD DELLA MISURA, non dato cablabile»*.

Quindi non ho **un** imputato ma **due**, e li processo entrambi:
- **imputato A**: il CSV orfano (24 piste, `difficolta_0_1`) — senza generatore, non fidato;
- **imputato B**: l'indice v1 NO-GO (23 circuiti, `indice%`) — con generatore, bocciato.

**E una distinzione che cambia il senso del confronto**: l'indice v1 misura la
**convertibilità dell'attacco** — `P(sorpasso completato | attacco sostenuto)` — cioè il
canale **durata/risoluzione**. Stanotte io misuro l'**intensità**: quanto costa ogni giro
che sei bloccato. **Sono due grandezze diverse.** Se correlano è un fatto interessante; se
non correlano non è una smentita di nessuno dei due. Lo dichiaro adesso per non poterlo
usare dopo come vittoria.

## 1. Che cos'è l'intensità, e come la isolo tenendo fisso il delta-passo

**Incontro**: una successione massimale di giri consecutivi in cui `d` sta entro 5 s dallo
**stesso** leader (stessa definizione della notte scorsa). Ogni incontro ha una durata, un
delta-passo mediano e un costo.

**Il modello, per giro**:

```
r = θ_pista · a·e^(−gap/λ)  +  b_pista  +  c·max(0, −Δ)
```

- `a`, `λ`, `c` sono **globali**, stimati sulle gare di calibrazione;
- `θ_pista` è **la difficoltà-pista**: quanto quella pista moltiplica la penalità
  aerodinamica. `θ = 1` è la pista media;
- `b_pista` è un **intercetta di pista**.

**Perché `b_pista` è la difesa contro l'artefatto gemello**: una pista dove il modello di
passo è distorto avrebbe un residuo medio diverso da zero, e senza intercetta quella
distorsione finirebbe dentro `θ`. Con `b_pista` dentro, **`θ` è identificato dalla FORMA
(quanto il residuo sale mentre il gap si stringe), non dal LIVELLO**. È lo stesso
accorgimento con cui la notte scorsa il delta-passo è stato isolato tenendo fisso il gap.

## 2. Il placebo-pista, dichiarato PRIMA (obbligatorio)

L'artefatto che può fabbricare il segno: `θ` è stimato su pochi incontri per pista, e la
dispersione fra piste **esiste sempre**, anche se le piste sono identiche.

**Placebo**: si **permutano le etichette-pista** fra gli incontri e si ricalcola la
dispersione dei `θ`. Se la dispersione vera sta dentro la distribuzione permutata, la
difficoltà-pista è rumore e il coefficiente non si crede.

> ⚠️ **NULL NUOVO — non lo auto-sigillo.** `permuta_piste` è una funzione di
> ricampionamento nuova (i sigilli sono sette dopo il merge di `placebo_leader`). Il
> sigillo richiede `--attore`: **lo mette Tommi**. Non ho toccato nessuna delle sette
> sigillate.

## 3. La trappola che ha ucciso il v1: la STABILITÀ

Il v1 è morto sulla stabilità cross-stagione, non sulla dispersione. **Se non testo la
stessa cosa, ripeto l'errore.** Dichiaro quindi, prima dei numeri: `θ` si stima **per pista
e per stagione**, e si riporta la dispersione inter-annuale contro l'incertezza
intra-stagione. Una pista il cui `θ` balla fra stagioni **non è una cella promuovibile**,
per quanto bella sia la sua media.

## 4. La scala, e la barra

**Blocco naturale**: qui il blocco è **la PISTA**, non la gara — venti piste non sono venti
osservazioni indipendenti quando la grandezza è di pista. Aggregazioni e IC sui `θ` usano
il bootstrap **sulle piste**; il confronto out-of-sample dei modelli usa il bootstrap sulle
**gare** (è lì che si misura la previsione), e riporto entrambe le viste.

**Fuori campione**: gare di indice pari = calibrazione, dispari = verifica. `θ` stimato solo
sulle gare di calibrazione, applicato a gare mai viste **della stessa pista**.

**La scala dichiarata** (quattro modelli, nessun quinto):

| | modello |
|---|---|
| **M0** | `a·e^(−gap/λ)` — solo gap: il modello attuale |
| **M1** | `M0 + c·max(0,−Δ)` — col delta-passo (bocciato la notte scorsa: rientra come riferimento) |
| **Mp** | `θ_pista·a·e^(−gap/λ) + b_pista` — con la sola pista |
| **Mfull** | `θ_pista·a·e^(−gap/λ) + b_pista + c·max(0,−Δ)` — i due ingressi insieme |

> Una forma sopravvive solo se il **miglioramento della mediana per gara sulle gare di
> verifica** supera **M = semi-ampiezza dell'IC95 bootstrap-a-blocchi del modello di
> riferimento** sulle stesse gare, **e** l'IC95 del miglioramento appaiato esclude lo zero.
> Riferimenti: **M0** (il modello attuale) **e** **M1** (solo delta-passo), come chiede il
> brief. Entrambi riportati.

## 5. Il 2026 — nessun trapianto

La parte **geometrica** della difficoltà (curve, rettilinei, frenate) è cemento e non
cambia. Il **meccanismo di sorpasso** sì: il 2026 sostituisce il DRS con l'Overtake Mode a
batteria, spendibile ovunque e non legato a zone. **Non trapianto il valore storico sul
2026.** Stimo quel che il 2026 permette e, se non basta, **dichiaro il cieco** — come già
successo col degrado. Nessun transfer globale storico→2026.

## 6. Due ingressi, il secondo sopra il primo

Il delta-passo resta com'è. Se l'aggancio della pista lo rompe, **lo dichiaro**, non lo
aggiusto di nascosto. Se serve un terzo pezzo, è un **fronte dichiarato**, non un'aggiunta
silenziosa.

## 7. SC/VSC

Continuo con la finestra **K = 3** derivata la notte scorsa. Se aggiungendo la pista i
coefficienti normale-vs-post-restart divergono **più** di prima, è segnale che il traffico
post-restart è artificiale su certe piste, e lo dichiaro.

## 8. Il limite onesto, riscritto

Il traffico si calcola **solo contro il campo reale**, non contro un campo che reagisce. Le
altre auto non rallentano perché sei lì, non si difendono, non cambiano strategia. Il
modello dice *«Leclerc diverso dentro la gara che È successa»*, non *«la gara che SAREBBE
successa»*.

## 9. Vincoli

Solo il fondo · blocchi = piste (per `θ`) e gare (per la previsione) · kernel di produzione
non montato · targhetta su ogni numero · nessun push, PR, merge.
