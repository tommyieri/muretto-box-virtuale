# PREREG — GARA INTERA, SECONDO GIRO: dare potenza a G4

**Scritta il 01/08/2026, dopo il primo giro e PRIMA di rimisurare.**
Prereg del primo giro: `PREREG_gara_intera.md`.

## Cosa si sa già, e va detto subito

Il primo giro ha prodotto **7 casi utilizzabili su 10**. G1, G2 e G3 sono passati;
**G4 è fallito**: il modello nullo («il pilota finisce dove stava al giro 5»)
batte il motore, mediana di \|errore\| **0 contro 1**, media **1,14 contro 1,57**.
Cinque piloti su sette sono arrivati esattamente dove stavano al giro 5.

**Questo esito è già a referto e non si annulla.** Il secondo giro non è un
secondo tentativo di far passare G4: la direzione del risultato è nota, e cercare
adesso un perimetro che la ribalti sarebbe E08 travestito da approfondimento.
Il secondo giro serve a una cosa sola: **con sette casi non si conclude niente,
né a favore né contro**. Se il verdetto è NO-GO per la proiezione a gara intera,
dev'essere un NO-GO che regge, non un NO-GO da campione minuscolo.

Le quattro soglie **restano identiche** (G1 ≤ 3 · G2 ≥ 60% · G3 \|·\| ≤ 1,5 ·
G4 strettamente meglio del nullo). Non se ne tocca una.

## Le due riparazioni, e perché non sono scorciatoie

Tre casi su dieci sono usciti. I motivi, guardati da vicino, sono due difetti
della prima prereg — non proprietà del mondo.

**(a) Il congelamento fisso al giro 5 dà per scontato che al giro 5 ci siano
quattro giri verdi.** È falso quando la gara parte neutralizzata: **Belgio è
partito dietro la Safety Car** (status 4 ai giri 2-3) e **Gran Bretagna sotto
giallo** (giri 1-2). Lì il motore non ha un passo base e si rifiuta di inventarlo
— regola 6 che funziona. La prima prereg diceva «il primo congelamento possibile»
e poi lo scriveva come la costante 5: la costante era la mia istanza della regola
sotto un'ipotesi che non vale sempre.

→ **Congelamento adattivo: il primo giro ≥ 5 in cui il motore produce davvero un
passo base per quel pilota.** È la regola che la prima prereg voleva dire. Non
avvantaggia nessuno: un congelamento più tardi accorcia la proiezione, quindi se
mai *aiuta il modello nullo*, che parte da una posizione più matura.

**(b) Una sosta prima del congelamento non è un ostacolo: è già nello stato.**
Il costruttore legge lo stato reale fino al giro di congelamento, quindi un
pilota che si è fermato al giro 3 arriva al giro 5 già con la gomma nuova e
l'età giusta. Escluderlo (BOT in Canada, PIA in Gran Bretagna) era una cautela
mal riposta.

→ **Le soste ≤ congelamento si tolgono dal piano** perché il motore le ha già
ereditate dallo stato vero; restano nel piano solo quelle future. La strategia
seguita resta quella vera, per intero.

## I due perimetri

- **R2a — i dieci del PO.** Stesso accoppiamento della prima prereg
  (team↔gara alfabetico, pilota alfabeticamente primo, ripiego sul compagno),
  con le due riparazioni. È la consegna letterale: dieci gare, dieci team, dieci
  piloti diversi.
- **R2b — tutto il perimetro.** Ogni coppia pilota-gara delle 11 gare pubblicate
  che soddisfi le condizioni di utilizzabilità (classificato, ≥1 sosta dopo il
  congelamento, passo base disponibile). Serve solo a dare **potenza a G4**.
  Il verdetto sul prodotto si legge **qui**, non su R2a: dieci casi non decidono
  se una funzione va online.

Su R2b si riporta anche **G4 per gara** (blocchi = gare, E11): se il motore
perdesse ovunque tranne che in due gare, saperlo cambia la diagnosi.

## Cosa si fa dopo, già deciso adesso

- **G4 fallito anche su R2b** → la proiezione a gara intera **non entra nel
  prodotto**, e la ragione si scrive per esteso: nel 2026 senza DRS le posizioni
  si muovono poco, e «non cambia niente» è un concorrente forte che 55 giri di
  fisica non battono. Nessun coefficiente viene toccato per rimediare.
- **G4 passato su R2b** (con G1-G3 già passati su R2a) → la proiezione è
  utilizzabile **come strumento dichiarato**, mai come previsione: le soste vere
  restano informazione dal futuro, e resta l'avviso `OLTRE_ORIZZONTE_VALIDATO`.

In nessuno dei due casi si toccano ρ, δ₇₀, c, τ, `min_giri_base`, prior o soglie.
Questa resta una misura.

---

# ESITO — misurato il 01/08/2026

`node ai_lab/confronto/gara_intera.mjs --tutto`

## R2a — i dieci del PO: **10/10 casi**, nessuno saltato

Le due riparazioni funzionano: Belgio entra congelando al giro 9, Gran Bretagna
al 6, Canada all'8 con la prima sosta (giro 3) ereditata dallo stato vero.

| | valore | soglia | |
|---|---|---|---|
| G1 mediana \|errore\| | **1,5** | ≤ 3 | PASSA |
| G2 entro ±3 | **80,0%** | ≥ 60% | PASSA |
| G3 bias medio | **+1,10** | \|·\| ≤ 1,5 | PASSA |
| G4 batte il nullo | **1,5 vs 0,5** | meglio | **FALLITO** |

Appaiato: il motore vince 1 caso, ne perde 6, ne pareggia 3.

## R2b — tutto il perimetro: **193 casi** su 241 coppie

Scartati solo i non arrivati: 41 ritiri e 7 non-partiti. Nessun'altra perdita.

| | valore | soglia | |
|---|---|---|---|
| G1 mediana \|errore\| | **1** | ≤ 3 | PASSA |
| G2 entro ±3 | **86,0%** | ≥ 60% | PASSA |
| G3 bias medio | **+0,04** | \|·\| ≤ 1,5 | PASSA |
| G4 batte il nullo | **1 vs 1** | strettamente meglio | **FALLITO** |

Motore: \|errore\| medio 1,73 · esatti 49/193 · entro 1 108.
Nullo:  \|errore\| medio 1,72 · esatti 53/193 · entro 1 120.
Appaiato: **48 vinte, 62 perse, 83 pari**. Test dei segni bilaterale sulle 110
coppie discordanti: **p = 0,215**.

Per gara (E11): il motore vince **solo in Australia**; il nullo vince in Canada,
Cina, Monaco e Spagna; **sei gare in pareggio**.

## Verdetto

**G4 è fallito con potenza.** Non «il motore è peggio»: p = 0,215 dice che non è
nemmeno significativamente peggiore. Il verdetto giusto è più scomodo di
entrambe le letture semplici — **il motore e «non cambia niente dal giro 5» sono
indistinguibili**. Cinquantacinque giri di fisica non spostano il numero.

Come pre-registrato in §«Cosa si fa dopo»: **la proiezione a gara intera non
entra nel prodotto.** Nessun coefficiente viene toccato per rimediare.

## Le due cose che questo esperimento ha però stabilito

**1. La fisica non è rotta, ed è la prima volta che lo si misura su gara intera.**
G3 = **+0,04 posizioni** su 193 casi e ~53 giri proiettati a testa. Gli errori
della famiglia E02 — carburante sottratto e mai ri-aggiunto, deriva col segno
sbagliato — su 53 giri produrrebbero una deriva enorme e sistematica. Non c'è.
Il motore proiettato cinque volte oltre il suo orizzonte validato resta
**centrato**. Va detto perché il piano di correzione nasceva dal sospetto opposto.

**2. Il collo di bottiglia non è la fisica del giro: è che nel 2026 le posizioni
non si muovono.** Il nullo azzecca 53 arrivi su 193 senza calcolare niente, e ne
prende 120 entro una posizione. Combacia con quello che il motore per casi aveva
già misurato per un'altra strada (`ai_lab/casi/CARTA_DELLE_ERE.md`: senza DRS le
posizioni sono più vischiose, e fermarsi in verde fa perdere posizioni nel 58,9%
dei casi). Due strumenti diversi, stessa conclusione: **l'errore residuo non sta
nel tempo sul giro, sta in ciò che decide i sorpassi** — e quello, nel 2026, il
progetto non lo modella per scelta dichiarata (§«Cosa NON costruire al giorno 1»).

Non è materia per una nuova taratura dei coefficienti. Se si vorrà attaccarla,
sarà una prereg sua, su un fenomeno suo.
