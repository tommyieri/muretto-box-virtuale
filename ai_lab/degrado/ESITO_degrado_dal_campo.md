# ESITO — il degrado dal campo: l'effetto mescola è reale, e vale quanto il rumore

**Data: 04/08/2026.** Esegue `PREREG_degrado_dal_campo.md`, sigillata prima delle stime
(commit `f0fadb1`). Dati: `ESITO_cancelli_campo.json`.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **D0** | l'identificazione esiste | **PASSA** — **11 gare su 11** sopra soglia (da 2,39 a 8,83 giri, serve 2,0) |
| **D1** | non contraddice il sigillo | **PASSA** — ρ comune **0,04167**, dentro l'IC95 **[0,0108 ; 0,0527]** |
| **D2** | fuori campione, nella forma del live | **NON PASSA** — 2162-2230, p = 0,3120 · mediana 0,3487 contro 0,3457 |
| **D3** | placebo sulle etichette | **PASSA** — divario vero **0,01578** contro un 95° percentile di **0,01104** (200 rimescolamenti) |

Per la regola di decisione scritta nella prereg §4:

> **Il per-mescola è REALE ma NON PREDICE.** Si riporta come misura descrittiva, **non**
> come modello, e **non entra nel motore**.

## Le due cose che passano, e non sono piccole

**D1 · due identificazioni diverse danno la stessa risposta.** Il ρ sigillato del progetto
viene da una stima **longitudinale** sul fondo; questo viene da una **trasversale**, che
toglie l'evoluzione della pista invece di modellarla e non usa nemmeno il carburante.
Metodi senza niente in comune, e il numero cade dentro la banda già pubblicata. È la prima
conferma indipendente che ρ abbia mai avuto.

**D3 · l'effetto mescola non è un artefatto di chi la monta.** Era il sospetto ovvio: se le
squadre veloci usassero più spesso la hard, la hard sembrerebbe migliore senza esserlo.
Rimescolando le mescole **fra i piloti** — stessa struttura temporale, cambia solo chi aveva
cosa — il divario crolla a 0,0044 di mediana, e il vero sta sopra il 95° percentile di
duecento rimescolamenti.

| mescola | ρ (s/giro · giro d'età) |
|---|---|
| SOFT | **0,02891** |
| MEDIUM | **0,04022** |
| HARD | **0,04469** |

**Il verso è l'opposto dell'attesa ingenua** — la soft degraderebbe *meno* — ed è esattamente
la selezione che la prereg §6 aveva dichiarato **prima**: le età alte esistono solo per chi
ha scelto di restare fuori, e la soft viene staccata prima di tutte. Le sue osservazioni
sono tutte giovani e sane. **Il ρ che esce di qui è un limite inferiore, e lo è di più
proprio dove la gomma viene tolta prima.**

## Perché D2 fallisce, e qui c'è la risposta a tutto il resto

Il divario fra la mescola che degrada di più e quella che degrada di meno vale **0,01578 s
per ogni giro d'età**. Il rumore giro-per-giro, misurato come residuo dopo aver tolto pilota
e giro, vale **0,3457 s**.

| età gomma | divario cumulato |
|---|---|
| 5 giri | 0,079 s |
| 10 giri | 0,158 s |
| 15 giri | 0,237 s |
| 20 giri | 0,316 s |
| **22 giri** | **0,347 s** ← pari al rumore |

> **Il divario fra mescole raggiunge il rumore di un singolo giro a 21,9 giri d'età —
> cioè esattamente quando i team la gomma la tolgono.** (Vita mediana della hard: 22 giri.)

Questo spiega, con un solo numero, tutto ciò che questo problema ha prodotto in mesi:

- **perché ρ per mescola dava p = 0,209** sul fondo: l'effetto emerge a età che nei dati
  quasi non esistono, perché è lì che si stacca;
- **perché il termine di vita non predice** (`ESITO_vita_mescola.md`): quando comincerebbe a
  contare, lo stint è finito;
- **perché la mediana per mescola batte la fisica**: sull'intero intervallo in cui la gomma
  viene davvero usata, il segnale sta sotto il rumore;
- **perché D2 fallisce qui**: prevedere il tempo del giro successivo con un effetto che vale
  un ventesimo del rumore non può migliorare niente.

Non è una sfortuna e non è un difetto di stima. È la scala del fenomeno:

> **L'effetto della mescola sul tempo sul giro è reale, misurabile, non artefatto — e per
> tutta la vita utile del pneumatico è più piccolo del rumore di un giro.**

## Cosa questo cambia per il prodotto

**Non entra nel motore**, e la prereg lo aveva deciso prima. Ma è la prima volta che il
progetto ha una ragione **quantificata** per la frase che si porta dietro da mesi — *«le
mescole non separano il degrado»* — e la ragione non è che non separano: è che separano
**sotto il rumore**, e solo dove nessuno tiene la gomma.

Ne segue anche cosa servirebbe per cambiare la risposta, e non è un modello più furbo:
**dati più precisi del tempo sul giro**. Un rumore di 0,35 s per giro è quello che si ottiene
guardando il cronometro; i settori, o la telemetria, avrebbero un rumore più basso e
farebbero emergere lo stesso effetto molto prima dei 22 giri. È una domanda sulla **fonte**,
non sulla forma.

## I limiti dichiarati

- **La selezione non è corretta, è dichiarata** (prereg §6): i ρ sono limiti inferiori.
- **Il Giappone esce da D2** per rango non pieno: nella sua prima metà non tutte le mescole
  compaiono. Dichiarato, non aggirato.
- **D2 è mista per gara**: il campo batte il sigillo in Austria, Belgio, Spagna, Ungheria e
  Australia, e perde in Canada, Cina, Gran Bretagna, Miami e Monaco. Nessuna direzione, ed è
  coerente con un effetto sotto il rumore.
- **Lo stimatore non è mai stato provato in diretta.** Questa è la prova sul replay, dove la
  verità è nota. La decodifica di mescola ed età nel collettore resta una decisione del PO —
  e alla luce di D2, oggi non la consiglierei: si spenderebbe lavoro per portare in diretta
  un numero che, su questi dati, non migliora la previsione.
