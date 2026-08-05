# Prereg — i rivali non sono fermi: l'obiettivo del pianificatore, primo pezzo

**Data: 04/08/2026.** Scritta **prima** di aver misurato un solo piano coi rivali in
movimento. Esegue il lavoro n. 3 della direttiva del PO.

---

## 1 · Il difetto, e cosa se ne è già staccato oggi

> «Minimizza il tempo totale di gara con i rivali fermi, senza traffico e senza posizione in
> pista.»

Tre difetti in una riga. **Uno è già caduto stamattina**: accendendo il tetto al movimento
(soglia misurata su 5.498 occasioni) il traffico è entrato nell'obiettivo, perché il
pianificatore valuta i piani **simulandoli** e nella simulazione ora le auto non si
attraversano più. Misurato:

| | senza tetto | col tetto |
|---|---|---|
| errore mediano sulla durata di uno stint | 8 giri | **7** |
| «arrivi così» (non fermarti mai) | 73/167 · 44 % | **64/167 · 38 %** |

Restano gli altri due, e questa prereg attacca **il primo**: i rivali fermi.

## 2 · I rivali fermi sono una finzione, e in produzione pure

Verificato: né `genera_vista_gara.mjs` né `genera_vista.mjs` né il ponte live passano
`pianiRivali`. Quindi in **produzione** il motore pianifica contro venti auto che **non si
fermano mai**. Con `rho` e `vita_mescola` accesi, quelle auto invecchiano la gomma fino alla
bandiera e diventano lentissime: il mondo contro cui il pilota ottimizza non esiste.

## 3 · La proposta: i rivali si fermano quando la loro gomma finisce

Nessuna informazione dal futuro (regola 5, E14). Per ogni rivale, **al congelamento** si
conosce la mescola che ha addosso e la sua età. `vita_mescola` dice quanto dura quella
mescola. Quindi:

```
prossima sosta del rivale  =  freezeLap + max(1, vita(mescola) − età)
poi si ripete fino alla bandiera, con la mescola scelta dalla stessa regola del pilota
```

**Perché non è il mirror-play degenere.** Il tentativo precedente dava a TUTTI i rivali la
**stessa** sosta, perché usciva da una forma chiusa che dipende solo dalla gara: un grado di
libertà per gara, non per rivale. Qui ogni rivale ha la **sua** gomma e la **sua** età al
congelamento, quindi la sua sosta. È la differenza fra un parametro e un'osservazione.

**Perché è legittimo usare `vita_mescola` qui.** I suoi cancelli sono NULL come *predittore
della durata*, ed è acceso per decisione del PO. Ma qui non gli si chiede di predire meglio
di una mediana: gli si chiede di **non lasciare i rivali fermi**, che è un'alternativa
peggiore di qualunque prior ragionevole. La targhetta lo dice: `PRIOR_COMPORTAMENTALE`.

## 4 · I cancelli, con le soglie scritte adesso

Metro: lo stesso di `PREREG_vita_mescola.md` — errore assoluto in giri fra la durata che il
pianificatore sceglie e quella vera, sulle **167 decisioni misurabili**, leave-one-race-out.
Il braccio di riferimento è **il motore di oggi**, cioè col tetto acceso e i rivali fermi:
errore mediano **7**, «arrivi così» **64/167**.

| | cancello | soglia |
|---|---|---|
| **R1** | l'errore mediano **scende di almeno 1 giro** (≤ 6) | e il test dei segni appaiato ha p ≤ 0,05 |
| **R2** | «arrivi così» scende **sotto 45/167** (dal 38 % al 27 %) | — |
| **R3** | la **risposta a due giri** — la sola validata — non peggiora in modo significativo | non (perde e p < 0,05) |
| **R4** | **placebo**: ai rivali si dà una sosta a un giro **a caso** nella stessa finestra | il guadagno di R1 non deve sopravvivere |

**R4 è il cancello che conta.** Se dare ai rivali una sosta qualsiasi funziona quanto darla
quando la loro gomma finisce, allora il guadagno viene dall'**esistere** delle soste, non da
*quando* cadono — e in quel caso si spedisce comunque la versione a caso? No: si spedisce la
versione **comportamentale**, dichiarando che il guadagno è del meccanismo e non del prior.
Una sosta plausibile è comunque preferibile a una sorteggiata, ma **la ragione va scritta
giusta**.

## 5 · Le regole di decisione

- **R1 e R3 passano** → si accende. È il difetto più grande del prodotto e un miglioramento
  misurato non si lascia sul tavolo.
- **R1 passa, R3 no** → non si accende: il prodotto pubblica la risposta a due giri, e non si
  paga il piano con la risposta.
- **R1 non passa, R2 sì** → si riporta e non si accende: meno «non fermarti mai» senza meno
  errore vuol dire che il motore sbaglia *diversamente*, non *meno*.
- **R1 e R2 non passano** → NULL, e il difetto resta aperto sul terzo pezzo: l'obiettivo è
  ancora il **tempo**, non la **posizione**. Quello è il passo successivo e ha la sua prereg.

## 6 · Cosa NON si fa qui

- Non si cambia l'obiettivo da tempo a posizione: è il terzo pezzo, e cambiarlo insieme a
  questo renderebbe impossibile sapere quale dei due ha fatto la differenza (E20).
- Non si usa nessuna sosta vera dei rivali: sarebbe l'oracolo, cioè E14.
- Non si tocca `vita_mescola`: si legge, non si ri-tara.

---

**Sigillo.** Committata prima di aver costruito un solo piano rivale.
