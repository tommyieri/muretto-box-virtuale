# RECORD — la gara loro, poi la migliore (10 gare, 10 team, rivali veri)

*07/08/2026 · richiesta PO («dieci gare tranne Monaco, dieci piloti di dieci team;
prima la loro gara nel motore, poi prova a migliorarla sapendo com'è andata; portami
un record completo per la diagnosi»). Script: `migliora_strategia.mjs` · dati grezzi:
`RECORD_migliora_strategia.json`. **NON è un cancello**: nessuna soglia, nessun verdetto —
è il materiale per decidere dove riparare.*

## Cosa è stato fatto, esattamente

Perimetro meccanico: dieci team alfabetici × dieci gare alfabetiche senza Monaco; per
team, il primo pilota non saltato da `corri` (la macchina già usata per «gara intera»).
Per ogni caso, **stesso congelamento** (il primo con un passo base per il soggetto) e
**rivali con le LORO soste vere** (informazione dal futuro simmetrica, ingresso di
laboratorio; i ritirati veri passano da `rivaliNonClassificati`, la tacca scoperta
dalla pagina «E se?»):

- **Braccio A** — la strategia vera del soggetto, nel motore.
- **Braccio B** — la ricerca della strategia migliore: k∈{0,1,2,3}, griglia grossa sui
  giri + discesa per coordinate (±2, due passate), obiettivo lessicografico
  (posizione, poi tempo), mescole deterministiche da `mescolePerSoste` (il regolamento
  è un vincolo, non una variabile), k=0 solo se due slick già usate (REG01). Director
  sul piano vincente: **10/10 approvati**. Cucitura verificata: piani proposti ai
  rivali = piani arrivati al motore in tutti i casi campionati (20/20, 21/21, 18/18).

## Il record

| team | gara | pil | Lf | reale | motore (vera) | migliore | Δpos | Δs | piano migliore | vera |
|---|---|---|---|---|---|---|---|---|---|---|
| Alpine | Australia | COL | 5 | P14 | P14 | P14 | 0 | 15,6 | 30:H | 9:H 46:S |
| Aston Martin | Austria | ALO | 5 | P16 | P17 | P17 | 0 | 8,9 | 18:H 44:H | 24:S 49:S |
| Audi | Belgio | BOR | 9 | P8 | P11 | P11 | 0 | 0,1 | 21:H | 20:H |
| Cadillac | Canada | BOT | 8 | P15 | P18 | P17 | 1 | 14,1 | 21:H 45:H | 3:S 9:M 29:S 49:M |
| Ferrari | Cina | HAM | 5 | P3 | P3 | P3 | 0 | 31,9 | 25:H | 10:H |
| Haas | Giappone | OCO | 5 | P10 | P9 | P9 | 0 | 4,7 | 21:H | 19:H |
| McLaren | Gran Bretagna | NOR | 6 | P4 | P7 | P5 | 2 | 31,1 | 26:H | 28:H 38:M 48:S |
| Mercedes | Miami | ANT | 5 | P1 | P1 | P1 | 0 | 0,2 | 28:H | 26:H |
| Racing Bulls | Spagna | LAW | 5 | P9 | P8 | P8 | 0 | 6,4 | 32:H | 11:H 35:H |
| Red Bull | Ungheria | HAD | 5 | P6 | P7 | P5 | 2 | 8,8 | 20:H 48:H | 19:H 42:H |

*«motore (vera)» e «migliore» = posizioni nel campo simulato pieno. Δpos/Δs = guadagno
del braccio B sul braccio A: **promessa motore-contro-motore, mai contro la realtà**.
Le colonne riclassificate sulla popolazione comune (motore∩nullo∩verità) stanno nel JSON.*

## Le quattro letture (per la diagnosi, non per il verdetto)

**1 · Il motore a strategia vera: esatto 4/10 sulla popolazione comune, entro ±1 in
7/10, |errore| mediano 1.** Il nullo resta più esatto (6/10) — coerente col verdetto
«gara intera pari col nullo». Ma il dettaglio nuovo è CHI sbaglia: i due errori grossi
del motore (**Belgio +3, Gran Bretagna +2**) sono IDENTICI a quelli del nullo. Lì non è
la fisica del passo a mancare: è successo qualcosa dopo il congelamento che nessuna
proiezione quasi-statica coglie.

**2 · Gran Bretagna è la faglia più leggibile.** Cambi di posizione reali 15, del
motore 6: il campo vero si è rimescolato il triplo di quanto il motore muova. NOR vero
P4 con TRE soste; il motore lo mette P7 con le stesse soste, e la ricerca «migliora» a
P5 togliendone due. Dove il campo si muove tanto, il motore perde i sorpassi veri E
paga le soste più di quanto rendano.

**3 · Canada è l'errore opposto.** Il motore mette BOT P18 quando è arrivato P15
(riclassificato: −2, motore troppo pessimista sul campo... e cambi motore 12 contro 7
reali: l'unico caso in cui INVENTA movimento). È la gara con 6 non classificati:
proiettare i ritirati fino alla bandiera comprime il campo attorno al soggetto e
sposta i ranghi di chi arriva davvero.

**4 · L'ottimizzatore ha una sola idea: togliere soste e andare su HARD tardi.**
In 8 casi su 10 il per_k è monotono (k=1 ≥ k=2 ≥ k=3); il piano migliore è quasi
sempre UNA sosta HARD più tardi del reale, e le due soste compaiono solo dove la vita
mescola le forza (Austria, Canada, Ungheria — e Ungheria è l'unico caso in cui k=2
batte k=1: P5 contro P7). I guadagni promessi sono quasi tutti TEMPO (mediana ~8,8 s)
e quasi mai POSIZIONI (3/10): coi gap veri, 10-30 secondi non comprano un rango. È la
firma già misurata del sotto-fermarsi (ρ al fondo del suo IC95, degrado concavo): il
record mostra che resta identica anche a rivali veri e obiettivo-posizione.

## Dove guardare per riparare (proposte, da decidere insieme)

1. **Il movimento del campo nelle gare rimescolate** (Belgio, GB): l'errore condiviso
   col nullo dice che il collo di bottiglia non è il passo ma la dinamica di
   SC/ripartenze — il posto dove il motore e il nullo sbagliano INSIEME è il posto
   dove c'è informazione nuova da modellare (o da dichiarare non modellabile).
2. **I ritirati proiettati alla bandiera** (Canada): a gara nota il ritiro è un DATO
   come le soste. Un ingresso di laboratorio «ritiro al giro vero» (il gemello di
   `rivaliNonClassificati`, ma sul kernel) toglierebbe la compressione artificiale dei
   ranghi — da pesare contro la regola «il motore non fa sparire nessuno», che è una
   regola di PRODOTTO, non di laboratorio.
3. **Il mono-sosta dell'ottimizzatore**: non è un difetto della ricerca (Ungheria
   dimostra che due soste POSSONO vincere quando la vita mescola morde) — è il ρ/la
   concavità. Qualunque intervento passa dai capitoli già chiusi su ρ e curvatura:
   qui c'è solo la conferma che la firma persiste nella configurazione più favorevole
   alle soste (rivali veri che si fermano davvero).
