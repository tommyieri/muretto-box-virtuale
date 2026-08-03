# Prereg — il tetto UNIFORME: il pezzo che funziona, separato da quello inerte

**Data: 03/08/2026.** Scritta **prima** di eseguire una sola misura della variante uniforme.
Nessun numero di questa variante esiste al momento della firma.

Domanda nuova, non una rilettura: `ESITO_tetto_movimento.md` chiude NULL il tetto a soglie
**per circuito** e dichiara esplicitamente che *«un vincolo di solo-pavimento è una domanda
diversa da quella che questa prereg ha giudicato, e richiederebbe la sua — non si prova
adesso riusando questi numeri, che sarebbe scegliere l'ipotesi dopo aver visto i dati
(E08)»*. Questa è quella prereg.

---

## 1 · Perché questa domanda, e cosa la distingue dalla precedente

L'esito del 03/08 ha separato due pezzi che erano stati provati insieme:

- il **pavimento uniforme** (`min_t_dist`, 0,50 s, **costante su tutti e 121 i file** della
  fonte) — è ciò che produce il guadagno: l'eccesso di movimento crolla da 2,04 a 0,32 e la
  popolazione ferita si raddrizza di 19 punti;
- la **soglia per circuito** (`t_gap_overtake`, l'unico parametro che varia) — il placebo a
  200 permutazioni l'ha dichiarata **inerte**: il valore vero (+4) sta dentro la
  distribuzione dei tetti finti (mediana +2, p95 +8).

La domanda di oggi è quindi **una sola**, e non è quella di ieri:

> **Il vincolo di duello, con TUTTI i parametri costanti — cioè privato dell'unica parte che
> il placebo ha mostrato inerte — danneggia ancora la popolazione sana e la risposta a due
> giri?**

È una domanda a cui ieri non si poteva rispondere: il danno misurato (basso+medio da +11 a
−3, due giri 16-33) era prodotto da una configurazione che conteneva anche il pezzo inerte,
e non si sa quanta parte del danno venga da lì.

## 2 · I parametri — tutti importati, nessuna scelta libera

Fonte: `ai_lab/confronto/duello_tum_2026.json`, estratto da
`github.com/TUMFTM/race-simulation`, `racesim/input/parameters/pars_<Circuito>_<Anno>.ini`
(LGPL). Nessun parametro è stimato dai nostri dati.

| parametro del kernel | valore | provenienza |
|---|---|---|
| `minGap` | **0,50 s** | `min_t_dist`, **costante su tutti e 121 i file** |
| `costoDuello` | **0,30 s** | `t_duel`, **costante su tutti e 121 i file** |
| `costoSubito` | **0,30 s** | `t_overtake_loser`, **costante su tutti e 121 i file** |
| `sogliaSorpasso` | **2,025 s** | **mediana dei `t_gap_overtake` sui 121 file** della fonte |

**Perché 2,025 e non 2,16.** 2,16 è la mediana dei dieci circuiti del calendario 2026 che
esistono in TUM; 2,025 è la mediana **della fonte intera**, già scritta nella targhetta di
`duello_tum_2026.json` prima di oggi. Si usa la seconda: la prima condizionerebbe il
parametro al nostro perimetro, che è una forma leggera di stimarlo in casa. Questa scelta è
fatta **adesso**, prima di sapere quale delle due dia numeri migliori.

**Conseguenza sul perimetro, e va detta perché è un guadagno.** La variante per circuito
escludeva **Miami**, che in TUM non esiste. Un parametro uniforme non ha bisogno del file di
Miami: il perimetro torna a essere quello **intero, undici gare**, che è esattamente il
perimetro su cui F2 e F3 sono firmati. Non è una comodità scelta dopo: è la conseguenza
diretta di aver tolto la parte per circuito.

## 3 · Il difetto di misura che questa prereg corregge, e perché non è E08

Nei cancelli di ieri i terzili erano ricalcolati **sulla configurazione trattata**: il
terzile è definito da `cambi_motore − cambi_reali`, e il vincolo cambia `cambi_motore`.
«Il terzile alto col tetto» e «il terzile alto senza tetto» sono quindi **insiemi di casi
diversi**, e confrontarli confronta due popolazioni, non due trattamenti.

Qui la **lettura primaria congela gli strati sulla configurazione NON trattata**: i terzili
si calcolano una volta sola, senza vincolo, e i due bracci si leggono sugli stessi casi.

Questo **non riscrive** un cancello di ieri: quei cancelli hanno già dato il loro esito e
restano. È la specifica di una misura **nuova**, decisa prima di vederne i numeri.
La lettura a strati auto-definiti si riporta come **secondaria e diagnostica**.

## 4 · I cancelli, con le soglie scritte adesso

Perimetro: **undici gare**, configurazione **oracolo** (ogni rivale riceve le sue soste
vere) — la stessa in cui F2 e F3 sono firmati, e senza la quale le linee di base non sono
confrontabili. Strati **congelati** sulla configurazione senza vincolo.

| | cancello | soglia | linea di base |
|---|---|---|---|
| **U1** | terzile alto (la ferita di F2) | **p ≥ 0,05** *e* saldo (vince−perde) **≥ −15** | 13-28, saldo −15, p = 0,027 |
| **U2** | due terzili bassi (F3) | saldo **≥ +17** *e* **p ≤ 0,0568** | 44-27, saldo +17, p = 0,0568 |
| **U3** | risposta a due giri | test dei segni **appaiato**, col vincolo contro senza: **non deve essere peggiore con p < 0,05** | è il cancello che ha ucciso la variante per circuito (16-33, p = 0,0213) |
| U4 | eccesso di movimento nel terzile alto | *diagnostico, non un cancello* | 2,04 senza vincolo |
| **U5** | invarianza a vincolo spento | con `tetto = null` i numeri devono restare **bit-identici** ai pubblicati | garantito da `s34`, si ri-verifica qui |

**U1 e U2 sono i cancelli dei KPI**, e le loro soglie sono copiate alla lettera da
`KPI_5_4_4.md`: non sono scelte oggi, sono la definizione firmata il mattino del 03/08.
**U3 è il cancello di questa prereg**, ed è quello che conta di più: un vincolo che
raddrizzi la bandiera rompendo la risposta a due giri — l'unica che il prodotto pubblica e
l'unica validata fuori campione — non è un miglioramento, è uno scambio in perdita.

### La regola di decisione, scritta prima

- **F2 si dichiara raggiunto solo se U1 passa E U3 passa.** Se U1 passa e U3 no, l'esito è
  NULL e si scrive che il guadagno sulla bandiera si paga sulla risposta validata.
- **F3 si dichiara raggiunto solo se U2 passa.**
- Se U1 fallisce, U2 e U3 si eseguono lo stesso e si riportano: servono a sapere *dove* il
  vincolo uniforme cade rispetto a quello per circuito.

## 5 · Il limite dichiarato — nessun placebo nuovo, e cosa questo vieta di concludere

`KPI_5_4_4.md` §F5 impone a ogni regola di battere un placebo. **F5 è scritto per le regole
di reazione dei rivali** («una regola finta che fermi gli stessi rivali lo stesso numero di
volte, ma a giri scelti a caso») e non si applica a un vincolo di duello.

Il placebo che si applicherebbe qui — permutare le soglie per circuito — **ha già girato
ieri e ha già dato il suo verdetto**: quella parte è inerte. Ed è precisamente la parte che
questa variante **non contiene più**: non resta nessuna affermazione per circuito da
falsificare.

Un placebo per il pavimento uniforme richiederebbe di applicare lo stesso tempo a coppie
**scelte a caso** invece che alle coppie in contatto, cioè di aprire il kernel per una
modalità che esiste solo per il placebo. **Non si fa**, e la conseguenza si scrive adesso:

> **Questa prereg può concludere al massimo che il vincolo uniforme NON DANNEGGIA. Non può
> concludere che il meccanismo sia reale.** Qualunque esito positivo va letto come «non
> costa», mai come «funziona perché le auto non si attraversano».

## 6 · Cosa NON si prova, e perché

- **Non si prova una versione «più leggera»** (costi di duello azzerati, pavimento ridotto):
  l'esito di ieri la suggerisce, ma azzerare un parametro non è importarlo — sarebbe una
  scelta nostra travestita da fonte. Se U3 fallisce anche qui, la variante leggera diventa
  una domanda con la sua prereg, e la sua soglia si scrive senza aver visto questi numeri.
- **Non si prova più di un candidato.** Uno solo, dichiarato qui: niente da correggere per
  molteplicità, e niente «la migliore delle N».
- **Non si tocca il kernel.** Il blocco `tetto` esiste già dal 03/08 ed è coperto da `s34`.
  Questa prereg cambia solo *quali quattro numeri* gli si passano.
- **Non si accende niente in produzione.** Qualunque esito, il vincolo resta spento
  (`tetto: null` nel contesto): l'accensione è una decisione del PO, e non è in questa
  pagina.

## 7 · Come si esegue

`ai_lab/confronto/cancelli_tetto_uniforme.mjs`, che riusa la macchina di
`cancelli_tetto.mjs` cambiando due cose e nessun'altra: i parametri (§2) e gli strati
congelati (§3). Artefatto: `ESITO_cancelli_tetto_uniforme.json`, con targhetta.

## 8 · Cosa si scrive se è NULL

Che il pezzo che riduce il movimento inventato **non è separabile dal suo costo**: frenare
le auto raddrizza la popolazione che inventa movimento e danneggia quella che non ne
inventa, e lo fa anche quando il parametro per circuito — l'unico sospettato di essere
arbitrario — è stato tolto. Sarebbe il **nono** risultato indipendente della stessa
famiglia, e chiuderebbe il tetto al movimento come strada, non come parametrizzazione.
