# PREREG — la compressione dei distacchi, giudicata FUORI CAMPIONE a Zandvoort

*Scritta il 01/08/2026, ventidue giorni prima della gara. È l'unico motivo per cui questo
documento vale qualcosa.*

## Perché esiste

La voce 2 ha prodotto **sei ipotesi e sei esiti** sullo stesso campione di undici gare
(`PREREG_neutralizzazione.md`). L'ultima — restringere il termine alle **neutralizzazioni
di campo** — porta il bias sotto regime praticamente a zero:

| orizzonte | motore attuale | col termine |
|---|---|---|
| 3 giri | +1,7903 | **+0,2328** |
| 5 giri | +0,9113 | **−0,0720** |
| 10 giri | +0,5783 | **+0,0033** |

Ma sei passaggi sullo stesso campione consumano gradi di libertà, e **nessun cancello in
casa può restituirli**. Comunque siano andati C1–C5, quei numeri sono dentro campione.

**Questo documento fissa l'unica prova che resta.** Zandvoort è una gara che nessuna delle
sei ipotesi ha mai visto, e si brucia una volta sola.

## Lo stato sigillato — verificato oggi, non promesso

```
kappa (compressione)   SC 0,6971  IC95 [0,6151; 0,7735]   ·  VSC 0,9791  IC95 [0,9463; 0,9959]
persistenza            SC 2 giri                          ·  VSC 1 giro
fattore di sosta       SC 0,6227                          ·  VSC 0,7188
criterio di campo      >= 50% delle auto sotto regime al giro L
```

```
data/priors/pitloss_priors.json               6fb2cc580a2d5635b4da67403ea701541b5e209942a69106a1facf2e7b561476
data/viste/compressione_e_fattori_fondo.json  5c2116084c0ace8f401c7a1c569616eab22669616c5b807f5b4ad227cc692e0c
```

Tutti misurati sul **fondo** (71 gare per κ sotto SC, 44 sotto VSC), non sulle undici del
banco. Il controllo che valida il metro regge: in verde il fattore realizzato è 1,011.

Il ciclo post-gara **non li ricalibra da solo** finché `SIGILLO_holdout.json` è aperto — e
non è una promessa, è un lucchetto in `auto_gara.py`.

## Il cancello, con C2 SCRITTO BENE

Su una gara sola «scende in 7 gare su 8» non ha senso. E il C2 delle sei prove precedenti
era **mal specificato**: contava come fallimento una gara in cui il termine si astiene
correttamente. Qui è riscritto — **prima di vedere qualunque dato di Zandvoort**, che è
l'unica circostanza in cui riscrivere un cancello è lecito.

| | condizione |
|---|---|
| **H1** | il `\|bias\|` sotto regime **scende** su tutti e tre gli orizzonti (3, 5, 10 giri) |
| **H2** | il bias **non cambia segno** su nessun orizzonte: niente overcorrezione, il difetto delle prime quattro ipotesi |
| **H3** | i congelamenti **verdi** restano identici AL BIT |
| **H4** | i congelamenti con regime **NON di campo** restano identici al bit: il termine deve astenersi dove ha dichiarato di astenersi |

**H4 è la condizione che rende questa una prova e non una misura.** L'ipotesi della PREREG-6
non è «comprimere aiuta»: è «comprimere aiuta **dove il campo è neutralizzato** e va lasciato
stare altrove». Se il termine agisse anche sulle gialle locali, avrebbe ragione per il motivo
sbagliato.

## NON GIUDICABILE — la condizione che va scritta adesso

Zandvoort **potrebbe non avere nessuna Safety Car**. In quel caso non c'è niente da
misurare, e va detto prima invece di trasformare un campione vuoto in un verdetto.

> Se i congelamenti con **neutralizzazione di campo** sono **meno di 30 righe**
> (gara × giro × orizzonte × pilota), l'esito è **NON GIUDICABILE** e il sigillo **resta
> aperto** fino alla gara successiva con abbastanza materiale. Non si abbassa la soglia.

## Cosa succede dopo, nei due casi

**Se passa:** il termine si accende, e si dichiara che è passato su **una** gara fuori
campione — promettente, non stabilito. La seconda conferma arriva alla gara dopo.

**Se non passa:** la voce 2 si chiude. Sei ipotesi in casa e una smentita fuori sono un
risultato, non un fallimento: vorrebbe dire che il bias sotto regime va affrontato da
un'altra parte, e che avremmo speso tre settimane invece di una stagione a scoprirlo.

## Cosa questo NON dirà

- Una gara sola non stabilisce niente da sola, nemmeno passando.
- Il ramo Safety Car su M1 resta **n = 17** e non lo tocca.
- I 70 casi su 84 che partono in verde e finiscono neutralizzati restano fuori dalla portata
  dell'informazione ammessa al congelamento, comunque vada.
