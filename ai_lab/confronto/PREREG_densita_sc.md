# Prereg — la densità spiega l'eccesso? Il test sulle soste **SC**, che non ho guardato

**Data: 15/08/2026.** Sigillata **prima** di misurare qualunque cosa sulle soste SC.

`REFERTO_61_righe.md` (15/08) ha fatto due cose: ha rimesso in gioco l'ipotesi della densità
— la falsificazione del 14/08 era calcolata su tutti i giri neutralizzati, dominati da Monaco
che **non ha una sola sosta VSC** nel campione (E16) — e ha visto, sulle 61 righe VSC, che
l'eccesso c'è dove il campo del motore è più stretto del vero e non c'è dove è più largo.

**Quel pattern è post-hoc**, trovato guardando le righe che dovrebbe spiegare. Questa prereg
lo mette alla prova su un campione che **non ho toccato**: le soste sotto **SC**.

---

## 0 · Cosa ho già visto delle SC, e cosa no

Va dichiarato per intero, perché è la differenza fra un test e una conferma.

**Ho visto**: l'aggregato. Sotto SC i passanti sono **0,957** nel motore contro **0,804** nel
vero, e il test dei segni sui «rimasti in pista» dà **9-8, p = 1,000** — cioè nessun eccesso
leggibile.

**Non ho visto**: nessuna scomposizione per gara delle SC, nessun rapporto di densità
calcolato sui **giri SC**, nessuna riga singola. Il gap per gara che ho guardato il 14/08 era
su **tutti** i giri neutralizzati mescolati, ed è proprio la statistica che si è rivelata
sbagliata.

## 1 · Il modello, che non ha **nessun parametro libero**

Chi perde Δt secondi in un campo dove le auto distano mediamente `g` secondi l'una dall'altra
ne scavalca circa `Δt / g`. Tutto misurato, niente da tarare:

```
passanti_previsti(motore) = Δt_motore / g_motore
passanti_previsti(vero)   = Δt_vero   / g_vero
eccesso_previsto          = Δt_m/g_m − Δt_v/g_v
```

`Δt` è la perdita della sosta rispetto al campo, sui **due** giri (in-lap + out-lap), la stessa
convenzione già usata e già corretta una volta. `g` è la **mediana dei distacchi fra auto
adiacenti di tutto il campo** al giro L−1, nella rispettiva simulazione o realtà. Mediana di
tutto il campo, non della regione dietro il pilota: è la scelta meno manipolabile, e la
dichiaro qui perché non si possa sceglierne un'altra dopo.

## 2 · I cancelli, dichiarati prima

**P0 — LA VALIDAZIONE DELLO STRUMENTO, e viene prima di tutto.** `Δt/g` deve predire i
passanti **osservati**, separatamente per il motore e per la realtà, su **tutte** le soste in
finestra (SC + VSC). Si riporta la correlazione fra previsto e osservato e lo **scarto medio
assoluto**.

> **Se lo scarto medio è più grande dell'effetto che il modello deve spiegare (~0,6
> passanti), P0 è rosso e tutto il resto è NULLO.** È esattamente ciò che è successo il 15/08
> al conteggio statico — predizione 2,35 contro 1,07 osservati, scarto 1,30 — e quella volta
> la validazione l'ho messa dentro il banco e mi ha salvato. Qui la metto di nuovo, e vale
> prima di P1.

**P1 — IL TEST FUORI CAMPIONE.** Sulle sole soste **SC**, l'`eccesso_previsto` deve correlare
con l'`eccesso_osservato`: correlazione di rango **positiva**, con l'IC95 (bootstrap a blocchi
= gare, 2.000 ripetizioni, seme 20260815) che **non contiene lo zero**.

**P2 — LA MAGNITUDINE.** La media dell'`eccesso_previsto` sulle SC deve avere lo **stesso
segno** di quella osservata (≈ +0,15) e stare **entro un fattore 3**. Il fattore 3 è largo di
proposito: un modello a zero parametri che azzecca l'ordine di grandezza è già molto, e una
banda stretta qui sarebbe un cancello sulla fortuna. Se il segno è giusto e la magnitudine no,
**si scrive che il modello ordina ma non misura**.

**P3 — IL PLACEBO.** Le stesse correlazioni con `g` **rimescolato fra le soste dentro ogni
gara** (200 permutazioni, seme 20260815). La correlazione vera deve stare **fuori dal 95°
percentile** delle finte. Rimescolare dentro le gare e non fra le gare distrugge il legame
fra la singola sosta e la densità che ha trovato, e lascia intatta la differenza fra circuiti.

## 3 · Che cosa vorrà dire l'esito

- **P0 verde, P1 verde, P3 pulito** → la densità del campo spiega l'eccesso **anche dove
  l'eccesso non c'è**, che è la prova più severa disponibile: il modello dovrebbe predire
  ~zero sotto SC e lo fa per la ragione giusta. Sarebbe la prima spiegazione di questa
  famiglia a sopravvivere, ed è **un referto, non un permesso di cambiare il motore**.
- **P0 rosso** → il modello non descrive la corsa e non se ne parla, come il 15/08.
- **P1 rosso** → la densità non regge fuori dal campione che l'ha suggerita: il pattern delle
  61 righe era una coincidenza fra sette gare, e si chiude. **Quinta ipotesi caduta**, e a
  quel punto la scrivo per l'ultima volta.
- **P1 verde ma P3 sporco** → è la differenza fra circuiti travestita: NULL.

## 4 · Cosa NON si fa, qualunque sia l'esito

- **Non si cambia niente nel motore.** Né κ, né il fattore della sosta, né la compressione:
  un modello che spiega non è una riparazione, e la riparazione avrebbe la sua prereg.
- **Non si ri-guarda il campione VSC per aggiustare il modello**: se P1 è rosso, è rosso.
- **Non si cambia la definizione di `g`** dopo aver visto i numeri: è la mediana di tutto il
  campo al giro L−1, scritta sopra.
- **Non si aggiungono termini** (un secondo parametro, una soglia sui gap grandi): il modello
  è quello a zero parametri. Se serve altro, è un'altra prereg.

---

*Sigillo: committata prima di misurare le soste SC. Nessun file di produzione cambia.*
