# Deroga — il prior comportamentale, e il cancello che prende il posto della regola vecchia

**Data: 04/08/2026. Decisione del PO**, presa in sessione dopo aver visto la diagnosi e
prima che un solo numero del nuovo modello esistesse.

Questa pagina **non riscrive** `CLAUDE.md`: dichiara una **deroga nominata** a una delle
condizioni di ammissibilità, dice cosa la sostituisce, e fissa il perimetro entro cui vale.
Fuori da quel perimetro la regola vecchia resta intera.

---

## 1 · La regola a cui si deroga

> «Ogni parametro nuovo è **importato con targhetta** e non stimato dai nostri dati.»

È una regola giusta e ha protetto il progetto per mesi: impedisce di tarare un modello sul
campione su cui poi lo si giudica. Ma applicata a **un parametro che nessuna fonte esterna
pubblica**, non produce prudenza: produce **assenza**.

## 2 · Il costo che la regola sta producendo, misurato

Nel motore la mescola **non fa niente**. Non è una svista: è la conseguenza corretta di aver
cercato l'effetto della mescola dentro il degrado del tempo sul giro, dove non si trova
(ρ SOFT − HARD, p = 0,209). Con la mescola inerte:

- premere BOX NOW **non permette di scegliere la gomma**, perché sceglierla non cambierebbe
  una sola cifra della risposta. Il selettore è un display, e lo è per una ragione onesta —
  un bottone che risponde sempre la stessa cosa è peggio di un bottone che non c'è;
- il piano non propone **mai due soste** (F4 mancato, 0 gare su 2), e la ragione aritmetica
  è che senza differenze fra mescole il guadagno della seconda sosta non arriva mai a
  pagare il pit-loss;
- **il simulatore non simula la scelta che definisce lo sport.**

## 3 · Perché il segnale c'è, e perché non è dove lo cercavamo

Le stesse gare, guardate sulle **decisioni** invece che sui tempi — 427 stint conclusi da una
sosta nel 2026:

| mescola | stint | durata mediana | interquartile |
|---|---|---|---|
| SOFT | 95 | **12 giri** | 7 – 16 |
| MEDIUM | 202 | **19 giri** | 14 – 24 |
| HARD | 130 | **22 giri** | 18 – 26 |

Dieci giri fra soft e hard, e gli interquartili di soft e hard **non si sovrappongono**.

La ragione per cui questo non compare nei tempi sul giro è strutturale, non statistica:
**i team si fermano prima che la gomma mostri la differenza.** Una soft portata a 12 giri e
una hard portata a 22 vengono staccate a prestazione residua simile, quindi le pendenze
osservate si assomigliano — **perché sono i team a pareggiarle, scegliendo quando smettere.**
Cercare la mescola dentro ρ significa cercarla esattamente dove è stata rimossa.

## 4 · La deroga

Si introduce una **natura nuova** per le targhette, accanto a `MISURATO_FONDO`,
`MISURATO_QUESTA_GARA`, `MODELLO_DICHIARATO` e `PRIOR_ESTERNO`:

> ### `PRIOR_COMPORTAMENTALE`
> Un parametro ricavato dalle **decisioni osservate degli attori** — non dalla fisica
> misurata e non da una fonte esterna. Porta obbligatoriamente: **quante decisioni** ci
> sono dietro, **su quale perimetro**, e la frase che dice cosa NON è.

**Cosa NON è, e va sulla targhetta:** un prior comportamentale descrive **ciò che i team
decidono**, non ciò che è fisicamente ottimo. Se sbagliano tutti allo stesso modo, il
modello sbaglia con loro. Questo limite va **sul pannello**, non in un README.

**Dove vale la deroga:** solo per la **vita della mescola** e per i parametri della famiglia
del degrado che questa pagina apre. Ogni altro parametro resta sotto la regola vecchia.

## 5 · Cosa prende il posto della regola, e non è niente

La regola vecchia serviva a impedire di tarare un modello sul campione che poi lo giudica.
Tolta quella, serve una protezione **almeno altrettanto stretta**, e non può essere una
promessa: è un cancello.

> **Un parametro con natura `PRIOR_COMPORTAMENTALE` è ammesso solo se il modello che lo usa
> riproduce, FUORI CAMPIONE, la grandezza da cui è stato ricavato — e batte due nulli.**

Concretamente, per la vita della mescola:

- **fuori campione**: leave-one-race-out sulle 427 decisioni. La vita si calcola sulle altre
  dieci gare, la previsione si legge sulla gara tenuta fuori;
- **nullo 1 — il motore di oggi**: stessa procedura, senza il termine di vita. Non distingue
  le mescole, quindi è il metro di «la mescola non serve»;
- **nullo 2 — il pavimento descrittivo**: prevedere direttamente la mediana per mescola,
  senza fisica. Serve a impedire la circolarità: se il modello non batte la sua stessa
  statistica descrittiva, la fisica non sta aggiungendo niente e va detto.

**Battere UNO solo dei due non basta.** È la stessa congiunzione con cui è stato registrato
F1, e per la stessa ragione: i due nulli sbagliano in verso opposto, e batterne uno solo
sfrutterebbe la debolezza strutturale di quello.

## 6 · Cosa questa deroga NON autorizza

- **Non autorizza a stimare ρ, δ o la banda dai nostri dati** con questa natura: quelli sono
  già misurati con le loro regole, e restano dove sono.
- **Non autorizza a scegliere la forma del modello dopo aver visto i numeri.** La forma si
  pre-registra come sempre; la deroga riguarda la **provenienza del parametro**, non il
  metodo.
- **Non autorizza ad accendere niente in produzione.** L'accensione resta una decisione del
  PO, come per ogni cambio di fisica.
- **Non retroagisce.** Nessun numero già pubblicato cambia natura per effetto di questa
  pagina.

## 7 · Firma

- [x] **Tommi (PO)** — accetta la deroga sapendo che (a) sostituisce una regola con un
      cancello, non con un'assunzione, e (b) il modello che ne nasce riprodurrà le decisioni
      dei team, che non sono la verità fisica.
- Data: **04/08/2026**, prima che il modello producesse un solo numero.
