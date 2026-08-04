# Prereg — il degrado dal campo: due effetti fissi, e l'evoluzione si toglie invece di modellarla

**Data: 04/08/2026.** Scritta **prima** di eseguire una sola stima. Nessun numero di questo
stimatore esiste al momento della firma.

Secondo strato del lavoro sul degrado, deciso dal PO insieme al primo
(`PREREG_vita_mescola.md`, esito NULL con diagnosi «il problema è l'obiettivo»).

---

## 1 · Il tentativo che è già fallito, e perché questo è un'altra cosa

Il cancello intra-gara del 2026 ha chiuso NULL, con una diagnosi precisa a registro:
*«primi-15-giri = degrado − evoluzione»*. Cioè: guardando come si alzano i tempi **dentro
uno stint, giro dopo giro**, il degrado e l'evoluzione della pista si sommano e non si
separano — la pista migliora mentre la gomma peggiora, e la loro differenza è tutto ciò che
si vede.

Quel tentativo era **longitudinale**: seguiva la stessa auto nel tempo. Questo è
**trasversale**, e la differenza non è di stile.

> **A un giro fissato, venti auto condividono lo stesso stato pista, lo stesso carburante
> bruciato e lo stesso meteo. Ciò che le distingue è l'età della gomma che hanno addosso.**

Quindi l'evoluzione non va **modellata**: va **tolta**, insieme a tutto il resto di ciò che
è comune a quel giro. Non serve nemmeno δ, il carburante: brucia allo stesso modo per tutti.

## 2 · Lo stimatore

Su ogni giro utilizzabile di ogni pilota:

```
t(pilota, giro) = α(pilota) + γ(giro) + ρ(mescola)·età + ε
```

- **`α(pilota)`** — un effetto fisso per pilota: assorbe auto, guida, e qualunque
  differenza di passo costante. Non si stima e non si interpreta: si toglie.
- **`γ(giro)`** — un effetto fisso per **giro**: assorbe carburante, evoluzione della pista,
  temperatura, meteo, neutralizzazioni, e ogni altra cosa comune a tutte le auto in quel
  momento. **È il pezzo che il tentativo longitudinale non poteva avere**, ed è
  non-parametrico: non si assume nessuna forma per l'evoluzione, la si elimina.
- **`ρ(mescola)`** — quello che si cerca: quanto costa un giro d'età, **per mescola**.

Si stima per **doppia sottrazione delle medie** (proiezioni alternate), senza librerie:
è la stessa cosa che farebbe una regressione con due insiemi di variabili indicatrici, e
questo repo non aggiunge dipendenze.

**Perimetro**: giri **verdi** secondo il filtro unico del progetto (`passoUtilizzabile`),
mescola slick, età nota. In-lap e out-lap sono già esclusi da quel filtro.

## 3 · Da dove viene l'identificazione, ed è la cosa che può ucciderlo

Se tutti si fermassero allo stesso giro, l'età sarebbe una funzione deterministica del giro,
`γ(giro)` la assorbirebbe **per intero** e ρ non esisterebbe. L'identificazione viene dal
fatto che i team si fermano a giri **diversi**.

Misurato in ricognizione, al 55 % della distanza: da **5 a 17 età distinte** su 17-22 auto,
in tutte e undici le gare (Ungheria 17, Spagna 14, Monaco 11, da 6 a 43 giri d'età).

**Non basta guardarla prima: va misurata dopo la doppia sottrazione**, perché è lì che
conta. Da qui il cancello D0.

## 4 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **D0** | *l'identificazione esiste* | dopo la doppia sottrazione, la deviazione standard residua dell'età ≥ **2,0 giri** in almeno **8 gare su 11**. Sotto quella soglia ρ non è identificato e **non si legge niente altro** |
| **D1** | *non contraddice il sigillo* | il ρ **comune** (mescole insieme) sta dentro l'IC95 già pubblicato, **[0,0108 ; 0,0527]** s/giro·giro |
| **D2** | *fuori campione, e nella forma del live* | ρ stimato sulla **prima metà** della gara prevede i tempi della **seconda metà** meglio del ρ comune sigillato: errore assoluto mediano più basso, test dei segni appaiato **p < 0,05** |
| **D3** | *placebo sulle etichette* | rimescolando le mescole **fra i piloti** (stessa auto, etichetta di un altro), la separazione fra ρ per mescola deve **sparire**: il divario vero deve stare **sopra il 95° percentile** di 200 rimescolamenti |
| D4 | *diagnostico* | ρ per mescola, con la loro banda, gara per gara |

**D0 viene prima di tutto.** È la clausola di validità che alla prima prereg di F5 mancava,
e questa volta è in cima: se l'età non varia abbastanza dopo aver tolto pilota e giro, ogni
numero sotto è rumore travestito.

**D3 è il cancello che decide se questo vale qualcosa.** La separazione fra mescole potrebbe
venire da *chi* monta cosa — se le squadre veloci usano più spesso la hard, la hard sembrerà
migliore senza esserlo. Il rimescolamento delle etichette fra piloti rompe esattamente
quell'associazione lasciando tutto il resto identico.

### La regola di decisione, scritta prima

- **D0 fallisce** → non si legge niente. Si scrive che a questi dati lo stimatore non è
  identificato, e la strada è chiusa qui.
- **D0 passa, D3 fallisce** → NULL: la separazione fra mescole è un artefatto di chi le
  monta. Si riporta il ρ comune e si dichiara che il per-mescola non regge.
- **D0, D1, D2, D3 passano** → lo stimatore è ammesso, e diventa la base dello strato live.
  L'accensione resta una decisione del PO.
- **D2 fallisce con D3 che passa** → il per-mescola è reale ma non predice: si riporta come
  misura descrittiva, **non** come modello, e non entra nel motore.

## 5 · Cosa NON fa questa prereg

- **Non tocca il motore.** Lo stimatore vive in `ai_lab/degrado/`, legge il grezzo pinnato e
  scrive un JSON con targhetta. Nessun percorso di produzione lo importa.
- **Non stima δ né lo usa.** `γ(giro)` assorbe il carburante: usarlo in più sarebbe contarlo
  due volte.
- **Non promette il live.** Questa è la prova sul **replay**, dove la verità è nota. Se passa,
  la decodifica di mescola ed età nel collettore diventa una domanda con una risposta che
  vale la pena — e resta una decisione del PO.
- **Non prova più di una forma.** Una sola, dichiarata al §2.

## 6 · Il modo in cui potrebbe essere sbagliato, dichiarato prima

**La sopravvivenza.** Le età alte esistono solo per chi ha scelto di restare fuori, e chi
resta fuori spesso lo fa perché la sua gomma va bene. Il campione a età alta è quindi
selezionato **verso il basso** del degrado, e ρ ne esce **sottostimato**. È lo stesso
meccanismo per cui la mescola non compare in ρ, visto da un'altra angolazione — e non lo
risolve nessun effetto fisso.

Non si corregge, si dichiara: **il ρ che esce da qui è un limite inferiore**, e va scritto
sulla targhetta insieme al numero.
