# PREREG V4 — la perdita RELATIVA della sosta, e il fattore pesato (prima di misurare)

*07/08/2026, notte fonda. V3 è a referto: passava alla lettera con una metrica mal
specificata — perdita contro il passo verde, quando il fattore è una perdita relativa
al campo rallentato. Questo è il metro nuovo promesso nel referto, con la lezione
cablata: la SANITÀ della misura stavolta è VINCOLANTE, e viene PRIMA del confronto.*

## Il metro nuovo

Per una sosta di `d` con in-lap al giro L (finestra L, L+1):

    Δ_d = cum_d(L+1) − cum_d(L−1)
    riferimento = mediana di Δ_r sui piloti che NON pittano in [L, L+1]
                  (niente in/out-lap in finestra, celle giudicabili, cum finiti)
    perdita_relativa = Δ_d − riferimento

La lentezza del giro si annulla per costruzione: il campo la paga uguale. Caso NON
GIUDICABILE se i non-fermati utilizzabili sono meno di **6** (sotto VSC si pitta in
massa: si dichiara, non si allenta).

    ratio = perdita_relativa / mediana delle perdite relative delle soste in VERDE
            pieno della stessa gara (f = 0, niente SC in finestra, stesso metro)

Modelli a confronto (identici a V3): **pesato** 1 − 0,35·f contro **binario attuale**
(0,65 se l'in-lap tocca la finestra, 1 altrimenti); f = media f_vsc su L e L+1;
contaminazione SC esclusa.

## I cancelli (l'ordine è parte del cancello)

**V4b — SANITÀ DEL METRO, vincolante e PRIMA di guardare il confronto:**
1. il riferimento verde di gara è positivo e d'ordine del pit-loss (∈ [10, 35] s)
   in ogni gara usata;
2. la mediana dei ratio in finestra ∈ (0, 1,2] — sotto regime una sosta relativa
   non può costare sistematicamente più che in verde;
3. i bin di copertura non crescono: mediana(pieni) < mediana(bassi).
Se V4b fallisce: **NON GIUDICABILE** — il metro è di nuovo sbagliato, niente si
accende, e non si legge V4a.

**V4a — il confronto (si legge solo con V4b verde):** appaiato caso per caso,
mediana |err| pesato < binario E vinte > perse.

## Applicazione, se V4b E V4a passano

`frazioniNeutralizzazione` ({drv: {giro: {f_vsc, f_sc}}}) nel costruttore — ingresso
di laboratorio, famiglia s25 — che pesa il PREZZO delle soste in finestra VSC
(la compressione non si tocca); sentinella s46 (spento è spento; f=1 ⇒ prior;
f=0 ⇒ verde; malformato esplode); cancello d'applicazione: il record dei 10 casi
non peggiora (somma |err| riclassificato ≤ 8). Produzione intoccata (E14).
Ogni altro esito: binario resta, referto scritto, e la famiglia si ferma qui
senza un'idea nuova sul metro.
