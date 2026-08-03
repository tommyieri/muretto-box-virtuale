# PREREG — H1′, il cancello affiancato · pagina nuova e datata

**Scritta il 03/08/2026, venti giorni prima della gara.** Decisione del PO, presa dopo
aver letto `ESITO_prova_a_secco_holdout.md`.

Questa pagina **non modifica** `PREREG_holdout_Olanda.md`: H1…H5 restano esattamente come
sono firmati, e il 23 agosto verranno riportati tutti. Qui si **affianca** un cancello e si
correggono due cose che la prova a secco ha mostrato essere sbagliate — e si fa **prima**
della gara, che è l'unico momento in cui è lecito farlo.

---

## 1 · Perché

La prova a secco ha fatto girare il protocollo sulle undici gare che i modelli **hanno già
visto**. In campione, dove il motore dovrebbe andare al meglio, **H1 fallisce su 4 gare su
10 giudicabili**. Se Zandvoort fallisse H1, non si imparerebbe niente: lo stesso protocollo
boccia il 40% dei casi buoni.

La causa è aritmetica: le soglie sono scritte sull'aggregato (45,3% su 223 casi) e applicate
a **una gara sola**, dove con n ≈ 20 un singolo caso vale 5 punti percentuali.

## 2 · H1′, pre-registrato adesso

> **H1′.** Gli **esatti M1-B2** di Zandvoort non cadono **sotto il minimo** della
> distribuzione per-gara misurata in campione, congelata qui sotto. E la loro **posizione
> dentro quella distribuzione si riporta come percentile**, sempre, anche quando il
> cancello passa.

**La distribuzione di riferimento, congelata il 03/08/2026** (esatti M1-B2 per gara, gare
con ≥ 15 casi nella lettura B2 — vedi §4):

```
Cina 20,0 · Giappone 27,3 · Australia 33,3 · Belgio 35,0 · Spagna 41,4
Gran Bretagna 53,6 · Miami 55,6 · Austria 57,1 · Ungheria 67,7
```

**minimo 20,0% · mediana 41,4% · massimo 67,7% · n = 9 gare**

Soglia di H1′: **20,0%**.

### La proprietà statistica, e il suo limite

Se Zandvoort fosse **scambiabile** con le nove gare di riferimento, la probabilità che
cada sotto il minimo per solo effetto del caso è **1/10 = 10%**. È un test senza
distribuzione, e il suo tasso di falso allarme è noto per costruzione — contro il ~40%
misurato di H1.

**Ma le gare di riferimento NON sono scambiabili con un fuori campione**, e va detto: i
modelli sono stati tarati su quelle, quindi lì vanno meglio di quanto andrebbero altrove.
Una gara fuori campione onesta tenderà a stare **più in basso**. Quindi **H1′ è un cancello
indulgente**, e superarlo è un'affermazione debole.

> **L'informazione vera sta nel PERCENTILE, non nel sì/no.** Se Zandvoort cade al 10°
> percentile della distribuzione in campione, il cancello passa e il motore fuori campione
> è comunque **peggiore di nove gare su dieci** viste in casa. Va scritto così, non
> dedotto — ed è la stessa forma dell'avvertimento che la prereg impone già per H4.

## 3 · Cosa NON viene corretto, e va letto sapendolo

H2 e H4 hanno **lo stesso difetto** di H1: soglia dall'aggregato, applicata a una gara. Non
li tocco — il PO ha chiesto di affiancare H1′, e aggiungere cancelli non richiesti sarebbe
allargare la decisione. Ma le loro tariffe di fallimento in campione si dichiarano qui, e
il referto del 23 agosto dovrà riportarle accanto all'esito:

| | soglia firmata | fallisce in campione | distribuzione per-gara |
|---|---|---|---|
| **H2** | mediana \|errore\| ≤ 1,0 | **2 gare su 10** | da 0 a 3 (mediana 0,5) |
| **H4** | copertura ≥ 67,3% | **2 gare su 10** | da 46,7% a 94,4% (mediana 86,0%) |

Un fallimento di H2 o H4 su Zandvoort va letto sapendo che succede a due gare su dieci
anche in casa.

## 4 · La correzione al perimetro: il pavimento sorvegliava la popolazione sbagliata

La regola 3 di `PREREG_holdout_Olanda.md` dice: sotto **15 casi ammessi**, NON GIUDICABILE.
La prova a secco ha mostrato che il pavimento è messo sul numero sbagliato:

> **Monaco ha 47 casi ammessi ma solo 12 nella lettura M1-B2** — il 74% cade perché uno dei
> due motori non risponde o la terna comune non contiene il pilota. Il protocollo lo
> dichiara giudicabile guardando i 47, mentre la metrica gira su 12: **sotto il pavimento
> che la regola 3 esiste per imporre.**

**Si pre-registra adesso** che il pavimento dei 15 casi si applica alla **popolazione della
metrica** (M1-B2), non ai casi ammessi. È l'intento della regola 3 — «servono abbastanza
casi perché il numero voglia dire qualcosa» — applicato al numero che viene davvero
calcolato.

**Questa correzione non muove H1′**, e vale la pena dirlo perché è la prova che non è stata
scelta per convenienza: escludendo Monaco il minimo della distribuzione resta **20,0%**
(Cina), identico. Cambia solo l'ampiezza del riferimento, da 10 gare a 9.

## 5 · Cosa questa pagina NON fa

- Non modifica H1…H5: restano firmati e verranno **tutti riportati** il 23 agosto.
- Non abbassa nessuna soglia. H1 resta al 40,0% e il suo esito si scrive comunque.
- Non decide cosa fare se H1 e H1′ danno risposte opposte: si riportano entrambi con il
  percentile, e la lettura è del PO.
- Non tocca il sigillo, i modelli, né alcun file di dati.

## 6 · Perché è legittimo farlo oggi e non il 23

Perché **Zandvoort non è ancora corsa**. È la stessa logica, già scritta nella prereg
madre, per cui ri-firmare gli hash del sigillo prima della gara è lecito e dopo sarebbe la
fine dell'holdout: quello che conta non è se un documento cambia, ma **se chi lo cambia ha
già visto il risultato**. Qui nessuno l'ha visto, e la distribuzione di riferimento viene
da gare che il motore ha già consumato.
