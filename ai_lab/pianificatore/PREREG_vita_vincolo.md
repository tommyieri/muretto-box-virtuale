# Prereg — la vita della gomma come VINCOLO, non come penalità

**Data: 05/08/2026.** Scritta **prima** di aver valutato un solo piano col vincolo.

Esegue l'ultimo candidato rimasto da `ESITO_pitloss_causa.md`, dopo che le due strade della
forma chiusa — il ρ e il `P` — sono cadute entrambe.

---

## 1 · Perché questo e perché adesso

Le due strade sono finite:

| | |
|---|---|
| il ρ è basso per **selezione** | caduta: il placebo dice **curvatura**, p = 0,39 |
| il `P` è troppo **alto** | caduta: servirebbe **1,8× più piccolo** del minimo mai misurato |

Quindi, e non era mai stato messo così: **con la fisica misurata correttamente, la forma
chiusa dice davvero che una sosta è l'ottimo. Il motore non sbaglia il conto.** Sono i team a
fermarsi due, tre, quattro volte per ragioni che *minimizzare il tempo totale* non contiene.

E la spiegazione più semplice non è mai stata provata: **una gomma ha una vita, e oltre
quella non ci si va.** Non «costa di più»: non si fa.

Il modello conosce già quelle durate — SOFT 12, MEDIUM 19, HARD 22 — e le applica come
**penalità morbida**: oltre la vita ogni giro costa un ρ in più, cioè **0,031 s**. Nella
realtà quella soglia non è una tassa, è un muro. Questa prereg cambia **come entra** un
parametro che c'è già, non ne introduce uno nuovo. La deroga `PRIOR_COMPORTAMENTALE` è già
firmata e continua a valere.

## 2 · La forma, e la soglia scelta prima

Il vincolo è sul **piano**, non sul passo: un piano è **infattibile** se uno qualunque dei
suoi stint finisce a un'età superiore alla vita massima della sua mescola.

`creaPiano` calcola già `eta_finale` per ogni stint: il vincolo lo legge, non lo ricalcola.

**Quale soglia.** Non la mediana — quella è dove i team *tipicamente* si fermano, non il
muro. Si usa il **90° percentile delle durate osservate per mescola**: «più lungo di così
non l'ha praticamente mai fatto nessuno».

## 3 · Gli ingressi, misurati e dichiarati qui

| mescola | n | mediana | p75 | **p90 = il vincolo** | p95 | max |
|---|---|---|---|---|---|---|
| SOFT | 95 | 12 | 16 | **27,8** | 35 | 55 |
| MEDIUM | 202 | 19 | 24 | **30,9** | 40,8 | 67 |
| HARD | 130 | 22 | 26,8 | **34,0** | 46 | 58 |

E, misurato prima di scrivere i cancelli:

> **Un vincolo a p90 vieterebbe il 10,1 % degli stint che i team hanno davvero fatto**
> (43 su 427). A p75 ne vieterebbe il 24,4 %.

**Il p75 è escluso per questo**, e la scelta è qui e non dopo: un muro che proibisce un
quarto di ciò che è successo non è un muro, è una preferenza travestita.

**E va detto subito che il p90 potrebbe legare troppo poco.** Le code sono lunghissime — una
SOFT da 55 giri esiste — anche perché `SOFT/MEDIUM/HARD` sono **etichette relative**: la
«soft» di Suzuka è una C3. Il vincolo eredita quel limite, che è già dichiarato nel sigillo
della vita.

## 4 · Cosa succede se nessun piano è fattibile

Può capitare che il vincolo renda infattibili tutti i `k`. In quel caso il motore **non deve
restare senza risposta**: il vincolo si rilassa, il piano si restituisce, e il caso viene
**marcato e contato**. Un prodotto che non risponde è peggio di un prodotto che risponde
dichiarando di aver allentato un vincolo.

## 5 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **V1** | **cambia davvero qualcosa** | il piano scelto differisce da quello di oggi in almeno il **10 %** delle decisioni |
| **V2** | **riduce il bias a senso unico** | «troppo poche» da **114** a **≤ 90**, e «troppe» resta **≤ 20** |
| **V3** | **non peggiora la durata prevista** | errore mediano **≤ 7 giri** (quello di oggi) |
| **V4** | **raggiunge il pavimento** | errore mediano **≤ 5 giri** (la tabella di tre numeri) |
| **V5** | **non fa danno** | zero violazioni del regolamento; il Director non peggiora |

**V1 è il cancello contro il verde vuoto**, ed è la terza volta oggi che lo metto: senza,
V3 e V5 passerebbero per costruzione e accenderei un ornamento. Questa sessione ha già
trovato tre A/B diventati A/A in silenzio.

**V4 è la riserva resa misurabile.** L'avevo scritta come opinione — *«così facendo il
motore diventerebbe il pavimento che oggi lo batte»* — e un'opinione in un referto è un
difetto. Qui diventa un numero con una soglia.

## 6 · Le regole di decisione

- **V1 fallisce** → il vincolo non lega. E la lettura è forte: **nessun muro compatibile con
  ciò che i team hanno davvero fatto è abbastanza stretto da spostare il piano.** Chiuderebbe
  l'ultimo candidato, e la conclusione diventerebbe che il sotto-fermarsi non ha una causa
  dentro il modello del tempo sul giro.
- **V1 passa, V2 fallisce** → lega ma non cura il bias: si riporta, non si spedisce.
- **V2 passa, V3 fallisce** → cura il bias e costa accuratezza: **non si spedisce**. Il bias
  è una diagnosi, non il bersaglio del prodotto.
- **V3 passa, V4 fallisce** → migliora senza raggiungere il pavimento. **Si propone**, e si
  dichiara che il motore resta peggio di una tabella di tre numeri su questa domanda.
- **Tutti passano** → si propone al PO l'accensione.

In nessun ramo il motore in produzione cambia dentro questa sessione: il vincolo nasce
**spento**, dietro un ingresso dichiarato, con la sua sentinella che prova che spento è
spento.

## 7 · Cosa NON si fa

- Non si tocca il passo, il ρ, il pit-loss, il rodaggio, `kMax`, la forma chiusa.
- Non si ri-stimano le vite: sono quelle del sigillo, e il p90 esce dalle stesse 427
  decisioni.
- Non si prova il p75 «per vedere»: è escluso in §3, prima dei numeri.

---

**Sigillo.** Committata prima di aver valutato un solo piano col vincolo.
