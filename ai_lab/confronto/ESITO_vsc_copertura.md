# Esito — B **non** è la copertura: V1 rosso. Ma il veto di ieri è caduto.

**Data: 15/08/2026.** Esegue `PREREG_vsc_copertura.md`, sigillata a `ca3d314` prima di
calcolare la pendenza. Banco: `ai_lab/confronto/vsc_copertura.mjs`. Nessun file di produzione
toccato.

---

## I cancelli

61 soste su 7 gare · copertura media **59%** · eccesso medio **0,623** — che riproduce
esattamente l'1,902 − 1,279 del referto di ieri, misurato da un banco diverso.

| | | esito |
|---|---|---|
| **V1** pendenza dell'eccesso contro `f_vsc`, blocchi = gare | **+0,190** · IC95 **[−1,924 ; 1,619]** | **ROSSO** |
| **V2** placebo (200 permutazioni dentro le gare) | 5° percentile −0,762 · la vera è +0,190 | non pulito *(irrilevante: V1 è rosso)* |
| **V3** terzili *(riportato, non cancello)* | 0,40 → **1,05** → 0,43 | **non monotono** |

La pendenza non è solo dentro lo zero: **è del segno sbagliato**. L'ipotesi diceva che
l'eccesso dovesse crescere dove la copertura scende; cresce, semmai, nel mezzo.

## Il fatto che chiude la questione

**Sulle 13 soste in cui la VSC copre davvero tutto il giro (f ≥ 0,9) — dove l'assunzione del
motore «questo giro è interamente neutralizzato» è esattamente giusta — l'eccesso resta
+0,46.**

Non c'è nessuna riparazione della copertura che possa toglierlo, perché lì non c'è niente da
correggere. Il meccanismo che avevo proposto è falsificato dal suo stesso caso migliore.

## Ma qualcosa si è guadagnato, ed è il contrario di quello che cercavo

Ieri avevo chiuso il referto scrivendo che il numero di B **non andava usato per tarare
niente**, perché era misurato col simbolo `'6'` per-giro, che il progetto tiene sotto veto dal
07/08 per via della copertura al 53%.

**Quel caveat adesso è risolto, e nella direzione buona.** Misurando con la fonte validata:

- l'eccesso **non dipende dalla copertura** (pendenza dentro lo zero, terzili non monotoni);
- e **sopravvive intatto dove la copertura è piena** (+0,46 su 13 soste).

Quindi **B non è un artefatto del righello storto**. L'imprecisione del simbolo per-giro non è
ciò che lo genera, e il fatto misurato ieri — 1,90 auto contro 1,28, p = 0,0046, 6 gare su 7 —
regge anche guardandolo con l'orologio giusto.

Il veto resta in piedi come regola generale (nessuno costruisca sul `'6'` per-giro), ma **non
è più una riserva su questo risultato**.

## Il verdetto, nella formula che la prereg impone

La prereg diceva: *«V1 rosso → la copertura non spiega B. Sarebbe la quarta spiegazione caduta
in quattro giorni, e a quel punto lo scrivo così: il fenomeno è misurato, robusto e senza
meccanismo, e chi riapre parta dai dati e non dalle mie ipotesi.»*

**Lo scrivo così.**

| | spiegazione proposta | esito |
|---|---|---|
| 12/08 | la sosta costa troppo poco, quindi scavalca troppe auto | **segno rovesciato** |
| 14/08 | la compressione impacchetta il campo troppo stretto | **falso**: il campo del motore è 1,48× più largo |
| 15/08 | la densità locale entro Δt dietro chi si ferma | **lo strumento fallisce la sua validazione** |
| 15/08 | la copertura parziale della VSC | **falsificato dal suo caso migliore** |

Quattro ipotesi, quattro cadute. Non ne propongo una quinta.

## Che cosa resta, e vale la pena dirlo bene

**Un fatto solido e senza meccanismo**, che è comunque più di quanto c'era una settimana fa:

- sotto **VSC** il motore lascia passare **1,90** auto attorno a chi si ferma contro **1,28**
  vere (25 soste contro 8, p = 0,0046, 6 gare su 7);
- l'eccesso è quasi tutto di auto che **non si sono fermate** (1,705 contro 1,115);
- sotto **SC** non esiste (9-8, p = 1,000);
- **non** dipende dal prezzo della sosta (alzarlo lo peggiora), **non** dalla densità del
  campo, **non** dalla copertura della finestra;
- e **non è un artefatto della definizione sotto veto**, che è il guadagno di oggi.

Chi riapre parta da lì. E parta dai dati: `vsc_copertura.mjs --json` stampa le 61 soste una
per una, con copertura, passanti del motore e passanti veri. La prossima ipotesi la si tiri
fuori guardando quelle righe, non ragionando al tavolo — le ultime quattro sono nate al tavolo
e sono morte tutte.

---

*Nessun parametro toccato, `regimePerGiroDiCampo` invariata, nessuna promozione. Suite senza
regressioni.*
