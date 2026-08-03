# PREREG — la curva dell'orizzonte: dove finisce davvero il motore

**Scritta e sigillata il 03/08/2026**, prima di produrre un solo numero.

Riferimenti: KPI **F1** firmato il 03/08 (*«l'orizzonte a cui il motore batte il
non-fare-niente si estende da 2 a ≥ 6 giri, p < 0,05»*) · banco unico `banco_regole.mjs`
(tarato 8/8) · `ESITO_cliff.md` e `ESITO_tetto_movimento.md` (i due rami chiusi oggi).

---

## 1 · La domanda, e perché adesso

Di F1 conosciamo **due punti isolati e nulla in mezzo**:

- a **2 giri** il motore nuovo batte il vecchio 36-12 (p = 0,0007), e la banda è calibrata
  a ±2 posizioni con copertura 88,2% fuori campione;
- alla **bandiera** nessun motore batte il non-fare-niente (57-55, p = 0,92).

Fra 2 e ~50 giri non è mai stato misurato niente. Quindi non sappiamo se F1 abbia un
bersaglio raggiungibile o se ci sia **un precipizio subito dopo i due giri**.

**Perché adesso e non dopo.** Il 23 agosto qualcuno guarderà questa pagina per la prima
volta su una gara mai vista. Se l'orizzonte utile finisce a 3 giri, va scritto **prima**:
una pagina che promette un orizzonte che non ha è il difetto che questo progetto ha
passato due giorni a togliere dal prodotto.

**Questa prereg NON prova a estendere l'orizzonte.** Misura dove finisce. È diagnostica:
non accende niente, non tocca il motore, non ha un esito «desiderato».

## 2 · La griglia, fissata qui

Orizzonti in giri dal congelamento: **2, 3, 4, 5, 6, 8, 10**.

Il 2 è il punto noto e serve da **controllo**: se il banco non riproduce lì il 36-12 già
tarato, la curva non si legge affatto e ci si ferma.

## 3 · La definizione di verità a ogni orizzonte — il punto che decide tutto

A orizzonte `h` dal congelamento `Lf`, la verità è il **rango per `cum_time` al giro
`Lf + h`** nel byLap pinnato, ri-classificato sulla popolazione comune (la stessa
`letturaComune` che il banco usa a 2 giri). Nessuna verità diversa, nessuna scorciatoia.

**IL LIMITE, dichiarato prima e non dopo.** Oltre ~4 giri dal congelamento le **soste vere
dei rivali** entrano nella finestra: il motore proietta un campo che nella realtà si è
fermato, e la differenza smette di misurare la fisica del passo per misurare la
non-conoscenza della strategia altrui. La verità resta la stessa, ma **misura una cosa
diversa**.

Quindi si dichiara qui, prima di guardare:

> Per ogni orizzonte si riporta anche **quante soste vere di rivali cadono nella
> finestra**. Se a `h` la mediana di soste-rivali-nella-finestra è **≥ 1**, il punto è
> marcato **CONTAMINATO** e non concorre a stabilire dove finisce la fisica del passo —
> resta pubblicato, con la sua etichetta.

Non è una scappatoia: è la ragione per cui una curva del genere non era mai stata fatta,
ed è meglio dichiararla che scoprirla a posteriori come spiegazione di un risultato brutto.

## 4 · Cosa si misura, a ogni punto

1. **motore nuovo contro il nullo** (l'ordine al congelamento): test dei segni bilaterale
   sui discordanti. È la forma di F1.
2. **motore nuovo contro il motore vecchio** (configurazione pannello): è la forma del
   36-12, e serve al controllo a h = 2.
3. `n` del perimetro, discordanti, pari, e **soste-rivali-nella-finestra** (§3).

Popolazione: i casi del banco (`casi()`), gli stessi 274 ammessi da cui esce il 235 a due
giri. Un caso entra a `h` solo se **entrambi** i confronti hanno una risposta e la
popolazione comune contiene il pilota — e il perimetro di ogni `h` si dichiara, perché
cala con l'orizzonte (chi finisce la gara prima esce).

## 5 · Le regole di lettura, fissate prima

- **Si pubblicano TUTTI i punti**, non il migliore. Una curva di cui si mostra il massimo
  è un massimo scelto dopo aver visto i dati (E08).
- **Nessuna soglia nuova.** Questa prereg non promuove e non boccia niente: F1 resta come
  firmato, e questa misura dice soltanto **dove cade oggi la sua frontiera**.
- **Il perimetro cambia con h e va detto**: confrontare p-value calcolati su popolazioni
  diverse senza dichiararlo è il modo in cui una curva mente.

## 6 · Cosa si scrive, nei tre casi possibili

- **La frontiera è ≥ 6 giri**: F1 ha un bersaglio raggiungibile, e si scrive quale
  meccanismo lo sostiene.
- **La frontiera è fra 3 e 5 giri**: F1 come firmato **non è raggiungibile per estensione
  continua** — e va scritto prima del 23/08, insieme alla riga di prodotto che smette di
  promettere di più.
- **La frontiera è a 2 giri (precipizio)**: il motore risponde bene a una domanda sola e
  finisce lì. È il caso peggiore per il KPI e il migliore per l'onestà della pagina, e va
  detto con queste parole.

In tutti e tre i casi la curva finisce nel referto **con tutti i suoi punti**, contaminati
compresi ed etichettati.

## 7 · Cosa questa prereg NON autorizza

- Non autorizza a **cambiare F1** né alcuna soglia: un KPI mancato si scrive.
- Non autorizza a **scegliere l'orizzonte** che dà il risultato migliore.
- Non autorizza modifiche al motore: è di **sola lettura**.
