# PREREG — le coppie alla pari alla ripartenza, SULLA FONTE NUOVA (sigillata in attesa)

*07/08/2026, notte. Direttiva del PO: «vai col meccanismo delle coppie alla pari appena
c'è una fonte nuova». Questa prereg si scrive ADESSO — prima che la fonte esista — e si
misura da sola, gara dopo gara, sulle sole gare che oggi non esistono ancora.*

## Da dove nasce l'ipotesi, detto senza giri

L'ipotesi è FIGLIA DEL FONDO: misurando la forma età-gomma (PREREG_ripartenza_eta) è
uscito il rovescio — l'effetto-ripartenza non sta in chi ha la gomma fresca (quello è
passo, già nel kernel via ρ·età: OR 1,019) ma **nelle coppie a gomme simili** (Δ < 5):
5,8% → 10,9%, OR 1,990 sul fondo 2018-2025. Siccome il fondo ha GENERATO l'ipotesi, il
fondo non può testarla (sarebbe la quarta forma sulla stessa fonte, vietata). Il test
vive solo su dati che l'ipotesi non ha mai visto.

## La fonte nuova, definita meccanicamente

**Le gare successive alle 11 del registro al 07/08/2026** (Australia, Austria, Belgio,
Canada, Cina, Giappone, Gran Bretagna, Miami, Monaco, Spagna, Ungheria — l'elenco
congelato vive nella sorveglianza). Zandvoort 23/08 è la prima. Ogni gara nuova entra
da sola nel perimetro via il registro; nessuna gara già vista può entrare.

## Ipotesi, misura, cancello (identici alle prereg precedenti dove non detto)

- **H**: sui giri di ripartenza, le coppie con divario d'età < 5 (G dal τ del rodaggio
  sigillato, come in PREREG_ripartenza_eta) passano più che sui giri verdi ordinari.
- Occasioni, finestre, sorpasso: definizioni delle prereg 1-3, invariate.
- **Cancello di lettura** (la sorveglianza CONTA e TACE finché non è raggiungibile):
  almeno **200 occasioni alla-pari di ripartenza** accumulate sulla fonte nuova, poi
  OR > 1 con IC95 (bootstrap blocchi-gara, 2.000, seme 20260807) che esclude 1.
  Potenza, detta onesta: il 2026 produce ~9 occasioni alla-pari di ripartenza a gara —
  il cancello parla realisticamente fra UNA-DUE stagioni. La sorveglianza è scritta
  perché nessuno debba ricordarselo.
- **Se il cancello passa**: si costruisce il meccanismo (tetto.ripartenza con condizione
  Δ < G), con sentinella propria, cancelli di applicazione R1-R3 sul record allargato
  alle gare nuove, e accensione = decisione PO. **Se fallisce**: NULL definitivo della
  famiglia, su fonte indipendente.

## Il sigillo

La sorveglianza (`sorveglia_coppie_alla_pari.mjs`) è agganciata ad auto_gara (passo di
ricerca, check=False: non ferma mai la gara) e riscrive
`SORVEGLIANZA_coppie_alla_pari.json` a ogni gara con lo stato dichiarato
(`IN_ATTESA n/200` oppure `CANCELLO_INTERROGABILE`). Nessun verdetto automatico:
quando il cancello diventa interrogabile, la lettura è un gesto umano.
