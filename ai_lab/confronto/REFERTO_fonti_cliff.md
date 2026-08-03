# Referto — il cliff nelle fonti aperte, e quanta curvatura servirebbe davvero

**Data: 03/08/2026.** Ricognizione delle fonti fatta *dopo* aver sigillato
`PREREG_cliff_importato.md` e *prima* di far girare il motore anche una volta.
Non decide niente: riporta cosa c'è nelle fonti e un conto di fattibilità.

## 1 · La notizia scomoda: il cliff, come parametro pubblicato, non esiste

**TUMFTM/race-simulation** — la candidata primaria della prereg — ha quattro forme di
degrado e **nessun termine di fine vita**. Verificato due volte, indipendentemente, sul
sorgente (`helper_funcs/src/calc_tire_degradation.py`):

```
linear:      t_tire = k_0 + k_1_lin · age
quadratic:   t_tire = k_0 + k_1_quad · age + k_2_quad · age²
cubic:       t_tire = k_0 + k_1_cub · age + k_2_cub · age² + k_3_cub · age³
logarithmic: t_tire = k_0 + k_1_ln · ln(k_2_ln · age + 1)
```

Nessuna occorrenza di *cliff*, *wear limit*, *max age*, *threshold*. E c'è di peggio per
la nostra ipotesi: **nei 121 file di circuito del repo la forma usata è `lin` in 2.479
voci-pilota su 2.479**. I coefficienti `quad`/`cub`/`ln` esistono nel formato ma non sono
mai attivati; `k_1_cub`, `k_2_cub`, `k_3_cub`, `k_1_ln`, `k_2_ln` non compaiono con un
valore in nessun file di gara.

**Il colpo definitivo alla candidata A.** Il paper che documenta il modello (Heilmeier et
al., *Virtual Strategy Engineer*, Appl. Sci. 2020, 10(21), 7805) riporta in Table 8 i suoi
parametri di riferimento — hard k₀=1,2 k₁=0,016 · medium 0,5 / 0,05 · soft 0,0 / 0,09 — e
con quelli conclude che **la una-sosta batte la due e la tre soste** (5237,65 s contro
5240,95 e 5252,23). Cioè: il simulatore di riferimento della letteratura, coi suoi
parametri, **ha il nostro identico sintomo**. Il paper lo dice anche esplicitamente:
*«the linear degradation model is mostly used anyway, as it is the most robust model»*.

> Questo cambia la diagnosi della Fisica 5. «Il piano non propone mai due soste» non è un
> difetto rispetto allo stato dell'arte: è una **proprietà dei modelli a degrado lineare**,
> e lo stato dell'arte è a degrado lineare. Non siamo indietro rispetto alla letteratura;
> siamo indietro rispetto alla realtà, insieme a lei.

**Candidata B — Sulsters 2018.** La forma è quadratica con vincolo β₂ ≥ 0, ma i parametri
stimati **collassano sul lineare**: β₂ = 0,000 per tutti e 22 i piloti e tutte e 5 le
mescole (Table 19). Non c'è curvatura da importare. In più i suoi β₁ hanno segni misti
(spesso negativi) perché sono stimati sui residui dopo il modello carburante, che assorbe
la deriva: non sono trasportabili come «s/giro di degrado».

**La forma logaritmica è il contrario di un cliff**: è concava, satura. Scoraggia la
seconda sosta ancora più del lineare.

## 2 · Il conto di fattibilità, che ribalta la conclusione

Prima di chiudere la fase per mancanza di fonte, la domanda giusta non è «quale fonte
copiamo» ma **«quanta curvatura servirebbe, e la letteratura ne mostra mai tanta?»**.

Con degrado `t(η) = ρ·η + κ·η²` e stint uguali, il guadagno della seconda sosta acquista
un termine `κ·(R+a)³·(1/12 − 1/27)`. Invertendolo sui deficit già misurati dal censimento
si ottiene la curvatura richiesta (`curvatura_richiesta.mjs`, orizzonte 60 giri, il caso
più favorevole):

| gara | attesa Pirelli | deficit | κ\* richiesto | rispetto al p95 di TUM |
|---|---|---|---|---|
| **Austria** | 2 soste | +12,6 s | **0,00126** s/giro² | **0,1×** |
| **Spagna** | 2 soste | +15,1 s | **0,00151** s/giro² | **0,1×** |
| Ungheria | 1 e 2 alla pari | +13,3 s | 0,00133 | 0,1× |
| le altre otto | 1 sosta | +8,7 … +27,4 s | 0,00087 … 0,00274 | 0,1-0,2× |

Il confronto è con `k_2_quad` dei file TUM: **mediana 0,0001, p95 fra 0,0035 e 0,0115**.

**La curvatura che serve sta dentro ciò che la letteratura misura.** È circa dodici volte
la mediana, ma **un decimo del p95**. Tradotta in secondi, con κ = 0,00126 il termine
quadratico vale +0,50 s/giro a 20 giri di gomma, **+1,13 s/giro a 30**, +2,02 s/giro a 40:
esattamente la forma e l'ordine di grandezza di un cliff vero.

Quindi la strada **non è morta per magnitudine**. È bloccata su un punto diverso e più
stretto: *non esiste un valore pubblicato, pronto da trascrivere, che qualcuno abbia
scelto e difeso*. I `k_2_quad` nei file TUM esistono ma sono fit per-pilota-per-gara mai
usati dal simulatore, con dal 50 al 62% delle voci schiacciate su un pavimento numerico —
cioè «fit fallito», non fisica. Usarne la mediana come prior sarebbe importare rumore
con una targhetta.

## 3 · Cosa resta, e cosa costa

Due forme in letteratura producono davvero un cliff, ed entrambe hanno **àncore numeriche
pubblicate ma non coefficienti**:

- **f1metrics (2014)**, quadratica convessa motivata proprio dal cliff, con tre vincoli
  pubblicati: option 0,7 s/giro più veloce da nuova, tasso di degrado doppio, **incrocio a
  14 giri**. Da questi tre numeri una quadratica si ancora.
- **Fieni et al. (ETH, arXiv 2512.21570)**, mappa convessa usura→tempo con tre àncore
  leggibili: hard nuova +2 s/giro, la hard ripaga **dopo 18 giri**, ~12 s/giro a usura
  piena. I coefficienti sono dichiarati riservati.

**Il costo di prenderle: non è più trascrizione, è derivazione.** La prereg sigillata dice
che i parametri devono essere «quelli della fonte, trascritti con {valore, fonte, url,
data}». Ancorare una quadratica su tre vincoli pubblicati **non è trascrivere**: è
risolvere. Resta interamente esterno — nessun dato del muretto entra nel conto — ma è una
base più debole, e la prereg com'è scritta non la autorizza.

## 4 · Il punto di decisione, che è del PO

Tre strade, e non sono equivalenti:

**(a) Chiudere qui, NULL onorato.** «Nelle fonti aperte non esiste un parametro di cliff
pubblicato e trasferibile: la fase si chiude.» È coerente con la prereg alla lettera, costa
zero, e lascia scritto il numero utile — la curvatura necessaria è un decimo del p95 della
letteratura, quindi chi tornerà su questa strada saprà che non era un muro di magnitudine.

**(b) Una prereg nuova e datata** che autorizzi parametri **derivati da àncore pubblicate**
(f1metrics: 0,7 s, ×2, incrocio a 14 giri), dichiarando la base più debole e tenendo i
quattro cancelli invariati. Non è riscrivere quella vecchia — è aprirne una seconda che
dice cosa cambia e perché, come la casa prescrive.

**(c) Rimandare** finché non compare una fonte con coefficienti pubblicati.

**Non scelgo io.** (b) è la sola che tiene viva la fase, ma allarga cosa conta come
«importato», e allargare una definizione dopo aver visto che quella stretta non basta è
esattamente il movimento che questo progetto ha imparato a diffidare. La differenza —
e il motivo per cui (b) resta difendibile — è che l'allargamento riguarda **la provenienza
dei parametri, non la soglia di giudizio**: i quattro cancelli restano quelli, e nessun
numero del muretto entra nella scelta di κ.

## 5 · Un difetto trovato nella fonte, da non replicare

Nel ramo cubico di `calc_tire_degradation.py` (stint > 1 giro) TUM usa i coefficienti
sbagliati: `k_1_quad` al posto di `k_1_cub`, e `k_2_quad` due volte invece di
`k_2_cub`/`k_3_cub`. Il ramo a giro singolo è corretto. Verificato su due letture
indipendenti del file. Se un giorno si importasse la forma cubica, si importerebbe anche
questo — quindi sta scritto qui.
