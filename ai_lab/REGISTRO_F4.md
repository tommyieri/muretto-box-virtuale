# Registrazione dell'esito di F4 — pagina nuova e datata

**Data: 03/08/2026.** Come per F1, questa pagina **non modifica** `KPI_5_4_4.md`: la soglia
firmata resta dov'è. Qui si registra un esito.

---

## L'esito

> **F4 · MANCATO.**
> Il piano propone due soste in **0 gare su 2** fra quelle in cui la fonte esterna se le
> aspettava. La soglia firmata chiedeva ≥ 1 su 3.

## Perché si scrive «mancato» e non «rimandato»

La tentazione, discussa il 03/08, era rimandare il giudizio a quando il denominatore
arriverà a cinque gare: la potenza di un test su due casi è minima, e questo è vero.

**Ma la regola di casa dice che un KPI mancato si scrive**, e F4 oggi è mancato in modo
non ambiguo: non è 1 su 2 invece di 1 su 3 — è **zero**. Rimandare un giudizio già
determinato perché il campione è piccolo significherebbe usare la scarsa potenza come
scudo, e la scarsa potenza taglia in una direzione sola: rende difficile *dimostrare* un
successo, non protegge da un fallimento netto.

## I numeri, e da dove vengono

Le gare in cui Pirelli si aspettava due soste, dalla tabella verificata
(`pirelli_attese_2026.json`, 11/11 citazioni confermate alla fonte):

| gara | attesa Pirelli | k≥2 proposti dal motore | deficit della 2-soste |
|---|---|---|---|
| **Spagna** | «2 soste come minimo, terza non esclusa» | **0** su 1.099 pannelli | +15,1 s |
| **Austria** | «2 soste»; nel resoconto, *nessun* pilota ne fece una sola | **0** su 1.211 pannelli | +12,6 s |
| *Ungheria* | «1 e 2 alla pari» — caso limite, non entra nel denominatore | 0 | +13,3 s |

Su **11.142 pannelli** dell'intera stagione il motore propone k = 0 o k = 1 e **mai** k = 2
(`ESITO_censimento_soste.json`).

## Il perché è noto, e non è un difetto di programmazione

Col degrado lineare e uguale per tutte le mescole, il guadagno della seconda sosta cresce
come `ρ·(R+a)²/12` e supera una perdita ai box di ~22 s solo oltre i novanta giri di gara.
**Nessuna gara ci arriva.** Non è un bug: è l'aritmetica del modello.

E il tentativo di cambiarla è stato fatto e ha chiuso NULL lo stesso giorno
(`ESITO_cliff.md`): tre valori di curvatura derivati dai coefficienti pubblicati TUM, e
nessuno passa — **C1 e C2 sono in conflitto a ogni κ**, perché un termine della sola età
premia le gare lunghe invece delle gare dove servono due soste. Il simulatore di
riferimento della letteratura, coi suoi parametri, ha lo stesso sintomo.

> **F4 è mancato e, allo stato, non esiste un meccanismo noto per soddisfarlo.** Questa è
> l'informazione utile, e vale più del sì/no.

## Cosa NON si fa

- **Non si sposta la soglia** né si riformula F4: sarebbe E08 su una pagina firmata.
- **Non si conta l'Ungheria** nel denominatore per portarlo a tre: la sua attesa è «1 e 2
  alla pari», e includerla per allargare il campione sarebbe scegliere il perimetro dopo.
- **Non si rimanda** un esito già determinato.

## Cosa si fa, invece

**Il denominatore cresce da solo.** Undici gare del 2026 non sono ancora corse
(dall'Olanda in poi). Ogni gara in cui Pirelli si aspetta due soste aggiunge una riga, e
F4 **si rimisura** con lo stesso metro — la registrazione di oggi non chiude niente per
sempre: dice dove sta il 03/08/2026.

Perché F4 possa cambiare esito serve **un meccanismo nuovo**, e le due strade note sono
chiuse o depotenziate:

- il **cliff**: NULL, con il tentativo di riserva deliberatamente **non speso** — qualunque
  forma della sola età ha lo stesso difetto strutturale;
- gli **offset per mescola da Pirelli**: la ricognizione ha stabilito che, nella forma che
  servirebbe al motore, **non sono pubblicati** (Pirelli pubblica finestre e numero di
  soste, non secondi al giro per mescola).

Quello che resta aperto è una **fonte che pubblichi il degrado circuito per circuito**. Non
una forma più elaborata: proprio quel pezzo di informazione, che oggi non esiste in nessuna
fonte aperta — ed è la stessa cosa che otto risultati indipendenti dicono non essere
ricavabile dai nostri dati.

## Stato dei KPI dopo questa registrazione

| | esito | dove |
|---|---|---|
| **F1** | raggiunto a 6 giri, strumento e margine dichiarati | `REGISTRO_F1.md` |
| **F4** | **MANCATO** — 0 su 2, nessun meccanismo noto | questa pagina |
| F2 · F3 · F5 | aperti | — |

---

## Aggiunta del 04/08/2026 — sotto l'accensione della vita mescola, F4 si muove

**Questa sezione non riscrive la registrazione del 03/08**, che resta valida per la
configurazione in cui è stata fatta. Registra una **misura nuova sotto una configurazione
nuova**: il PO ha acceso `vita_mescola` il 04/08 (sigillo
`simulatore/data/modelli/vita_mescola.json`).

| gara | attesa Pirelli | pannelli con k ≥ 2, **03/08** | pannelli con k ≥ 2, **04/08** |
|---|---|---|---|
| **Spagna** | 2 soste come minimo | **0** su 1.099 | **52** su 1.099 · 4,7 % |
| **Austria** | 2 soste | **0** su 1.211 | **21** su 1.211 · 1,7 % |

Su tutta la stagione: **994 pannelli su 10.630 (9,4 %)** propongono due o più soste, contro
**zero su 11.142**. Il massimo è **Monaco al 45,2 %** — che è la gara con l'**obbligo
regolamentare delle due soste**, e dove quindi il motore ha cominciato a dire la cosa vera.

### Come va letto, e i tre limiti

1. **Non è una rimisura di F4 con lo stesso metro.** F4 è stato registrato su un motore in
   cui la mescola era inerte; qui la mescola fa qualcosa. Le due righe della tabella non
   sono confrontabili come «prima e dopo un fix»: sono due configurazioni diverse.
2. **Il meccanismo che le produce è registrato NULL sulla previsione**
   (`ai_lab/degrado/ESITO_vita_mescola.md`): il termine di vita **non** prevede la durata
   di uno stint meglio di una mediana. È acceso per far esistere la scelta della mescola,
   non perché predica meglio.
3. **Due soste in una minoranza di pannelli non è «il piano propone due soste».** In Spagna
   sono 52 su 1.099: il piano tipico resta a una sosta. Chi volesse dichiarare F4 raggiunto
   dovrebbe prima decidere se la soglia si legge sul singolo pannello o sul pannello tipico
   — e quella decisione va presa **prima** di guardare questi numeri, non dopo.

**Non dichiaro F4 raggiunto.** La registrazione del 03/08 resta, e questa aggiunta dice
soltanto che la configurazione accesa il 04/08 fa una cosa che quella vecchia non faceva
mai.
