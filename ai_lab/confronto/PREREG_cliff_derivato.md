# PREREG 2 — il cliff a parametro DERIVATO da un insieme pubblicato

**Scritta e sigillata il 03/08/2026.** È una prereg **nuova**, non una riscrittura di
`PREREG_cliff_importato.md`: quella resta com'è, e questa dichiara **cosa cambia e
perché** (regola 3, catalogo E08).

Decisione del PO del 03/08: aprire una seconda prereg che autorizzi parametri **derivati**
da una fonte esterna, tenendo i cancelli invariati.

Riferimenti: `PREREG_cliff_importato.md` (prima prereg, sigillata) ·
`REFERTO_fonti_cliff.md` (perché la prima non è eseguibile) ·
`ESITO_curvatura_richiesta.json` · KPI F4 firmato il 03/08.

---

## 1 · Cosa cambia rispetto alla prima prereg

La prima diceva: *«i parametri sono quelli della fonte, trascritti con {valore, fonte,
url, data}»*. La ricognizione ha stabilito che **nessuna fonte aperta pubblica un
coefficiente di curvatura scelto e difeso**: TUM ha quattro forme e nessun cliff, usa il
lineare in 2.479 voci su 2.479, e col suo stesso modello conclude che la una-sosta batte
la due; Sulsters ha la quadratica ma i suoi β₂ stimati sono 0,000 ovunque.

**Cambia una sola cosa: la provenienza ammessa del parametro.** Non cambia nessun
cancello, nessuna soglia, nessuna metrica. E resta invariato il divieto che conta: **nessun
numero del muretto entra nella scelta di κ.**

## 2 · La strada che ho dovuto scartare, e va scritta

L'idea naturale era ancorare una quadratica sui tre numeri pubblicati da f1metrics: option
0,7 s/giro più veloce da nuova, tasso di degrado doppio, incrocio a 14 giri.

**Non funziona, ed è dimostrabile.** Quei tre vincoli sono soddisfatti da **qualunque**
curvatura, zero compresa: con `k₁ᵒ = 2k₁ᵖ` e `k₂ᵒ = 2k₂ᵖ`, l'incrocio a 14 giri impone
`14·k₁ᵖ + 196·k₂ᵖ = 0,7`, che è **una equazione in due incognite**. La soluzione puramente
lineare (`k₂ = 0`, `k₁ᵖ = 0,05`) le soddisfa tutte e tre esattamente, e così ogni κ
positivo con il k₁ corrispondente. Verificato numericamente prima di scrivere questa riga.

> Ancorare una quadratica su f1metrics significherebbe **scegliere κ noi** e chiamarlo
> import. È la cosa che questa prereg esiste per impedire, quindi f1metrics è escluso.

Stesso destino per le àncore ETH (arXiv 2512.21570): la forma convessa è pubblicata, i
coefficienti sono dichiarati riservati, e le tre àncore leggibili non determinano la
curvatura più di quanto facciano quelle di f1metrics.

## 3 · La fonte ammessa, e la regola di derivazione — fissata PRIMA

**Fonte: TUMFTM/race-simulation**, i 121 file `racesim/input/parameters/pars_*.ini`, campo
`k_2_quad`. Sono coefficienti di curvatura **fittati e pubblicati** per pilota, per gara e
per mescola. Il simulatore non li usa (dichiara `lin` ovunque), ma esistono e sono numeri
di qualcuno, non nostri.

**Regola di derivazione, dichiarata qui e non modificabile dopo:**

1. Si leggono tutte le voci `k_2_quad` dei file `pars_*.ini` (mescole `A1`…`A7`).
2. Si **scartano le voci al pavimento numerico** (`k_2_quad ≤ 0,0001`): sono fit non
   convergenti, non fisica. Su 6.206 voci ne cadono **3.456 (55,7%)**.
3. Sui **2.750 convergenti** si prendono tre quantili dichiarati: **p25, mediana, p75**.
4. **UNO κ per tutte le mescole.** Le mediane per mescola non ordinano
   (A1 0,00235 · A2 0,00110 · A3 0,00120 · A4 0,00110 · A5 0,00070 · A6 0,00075 ·
   A7 0,00480): è rumore, non una scala. E il progetto ha già un NULL sulla separazione
   del degrado per mescola.

**I tre valori, calcolati il 03/08/2026 prima di far girare il motore:**

| | κ (s/giro²) | cosa vale a 30 giri di gomma |
|---|---|---|
| p25 | **0,00050** | +0,45 s/giro |
| **mediana** | **0,00110** | **+0,99 s/giro** |
| p75 | **0,00280** | +2,52 s/giro |

**Perché tre e non uno, e questa è la parte che mi accusa.** La regola «mediana dei
convergenti» l'ho scelta su basi di principio — le voci al pavimento sono fit falliti, la
mediana è la statistica robusta — ma l'ho calcolata **dopo** aver saputo che all'Austria
serve κ\* = 0,00126. Un singolo numero scelto in quelle condizioni è indistinguibile da un
numero scelto perché funziona. Con tre quantili dichiarati e **tutti e tre eseguiti e
riportati**, il risultato è una banda di sensibilità e non una scelta: se passa solo al
p75, si legge che serve la coda alta della letteratura, e si scrive così.

## 4 · Dove entra, e la conseguenza già accettata

Invariata dalla prima prereg: il termine `q(η) = κ·η²` entra in
`simulatore/engine/passo_v2.mjs` accanto al rodaggio, il kernel non si tocca, e **la
regola 10 impone che `stimaBasi` sottragga ciò che `creaPasso` ri-aggiunge** — quindi le
basi si ri-misurano col termine nuovo sottratto. Non è un fit: κ è fisso. Il modello
risultante vive in un file con targhetta propria e **non sovrascrive** `modello_v2.json`.
`q` assente o null ⇒ numeri bit-identici a prima.

La forma chiusa del piano non vale più con un termine non lineare: resta come punto di
partenza della discesa locale, e il costo dei piani si valuta numericamente.

## 5 · I cancelli — **identici alla prima prereg**

**C1 · il bersaglio.** Il piano propone **due soste in almeno una fra Austria e Spagna**,
per >50% dei pannelli con piano di quella gara.

**C2 · nessun danno dove il motore aveva ragione.** Nelle **otto gare in cui Pirelli si
aspettava una sosta**, la quota di pannelli con k≥2 resta **sotto il 10%**.

**C3 · la fisica non peggiora dove è validata.** Banco unico, metrica a due giri (n=235
tarato): nessun peggioramento significativo contro il motore senza cliff, `p ≥ 0,05`.

**C4 · la bandiera non peggiora.** Banco unico, metrica alla bandiera in configurazione
oracolo: saldo contro il nullo `≥ +1` (oggi +2).

Tutti e quattro, **per lo stesso κ**. Non è ammesso passare C1 con un κ e C3 con un altro.

## 6 · L'esito, comunque vada

Si riportano **tutti e tre i κ**, ciascuno coi quattro cancelli. Poi:

- **Se nessuno passa**: NULL onorato per iscritto, col deficit residuo su Austria e Spagna
  dichiarato per ciascun κ. L'arco del cliff si chiude come si è chiuso quello del degrado
  stimato, e nessuna terza forma si prova sullo stesso bersaglio.
- **Se passa solo al p75**: si scrive che **serve la coda alta** della letteratura, e che
  il risultato dipende da un valore che tre quarti dei fit pubblicati non raggiungono.
  Non è una promozione: è un indizio con la sua condizione attaccata.
- **Se passa alla mediana**: resta comunque un indizio su **una gara sola** (il denominatore
  di F4 è due), e va detto con queste parole nel referto d'esito.

**In nessun caso** questa prereg autorizza ad accendere il termine in produzione:
l'accensione è una decisione del PO e arriva dopo i cancelli, non insieme.

## 7 · Cosa resta vietato

- Stimare o ricentrare κ sui nostri dati, per qualunque gara.
- Provare un quarto κ, o una statistica diversa dalle tre dichiarate.
- Muovere una soglia di questo documento dopo aver visto un numero.
- Trattare il superamento di C1 come prova che il modello delle gomme è giusto.
