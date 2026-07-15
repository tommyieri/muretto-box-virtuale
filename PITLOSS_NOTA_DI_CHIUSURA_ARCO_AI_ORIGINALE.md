> DOCUMENTO STORICO, mai committato all'epoca (ritrovato non tracciato il 15/07/2026
> nel checkout locale). E' l'originale della nota di chiusura Arco A->I. STATO DELLE
> SUE PARTI: le anomalie A1/A2 sono state lavorate dalla Sessione N (SC risanata a
> R_lap 1,614; VSC ancora rotta, non costruirci sopra); Silverstone e' stato poi
> riaperto e corretto per la via FF2 (20,80); la semantica pit-lane-time e' stata
> dimostrata da FF3 su 20 circuiti. A1/A2 NON sono pathway aperti. Il valore vivo di
> questo documento: la sezione A2 e' la FONTE del numero "13 giri / 2,3% (13/559)"
> citato da REPORT_NEUTRALIZZAZIONE:132, e le 9 lezioni di metodo + gli standard
> adottati non vivono in nessun altro file del repo.

# PITLOSS — NOTA DI CHIUSURA DEL FILONE

*Arco A → I. Nove sessioni. Chiuso con NO-GO sulla correzione, e con la causa in mano.*

---

## Sintesi in tre righe

- **Il debito ha una causa fisica, dimostrata:** `pit_loss_circuito_f1db.csv` contiene la
  **durata dello stop (pit-lane time)**, non il pit-loss. Silverstone: durata 29,6 ≈ nominale
  29,12, ma il pit-loss reale è ~20,9. Verificato su 8/9 circuiti entro 1,0 s, con un dato
  esterno ingerito apposta (durate per-stop, via Jolpica).
- **Il fix NON è validato, e il motivo è definitivo:** il modello a due componenti
  (`pit_loss = pit_lane_time − track_time`) è **corretto in principio ma inosservabile** sui dati
  pubblici. Il `track_time` della maggior parte dei circuiti è **più piccolo del rumore con cui lo
  misuriamo**. Solo Silverstone emerge nettamente.
- **Non si tocca nulla.** GB resta 29,12. Il ratio SC 0,42 resta. Il modulo pit congelato e i suoi
  golden restano intatti.

---

## Il risultato decisivo (Sessione I): il fallimento si SPOSTA

Con riferimento a **mediana-di-gara** (metodo C) il vincolo fisico falliva su **Spagna**.
Con riferimento **locale** (ultimi 5 giri dello stesso stint — il contrafattuale corretto) fallisce
su **Australia** (track_time −2,6, robusto in ogni stagione asciutta: 2023 −1,5 / 2024 −2,0 /
2026 −4,1, ciascuna con la propria durata).

**Il fallimento non è sparito: si è spostato.** È una firma diagnostica, non un incidente. Se
cambiando il metodo di misura la violazione salta da un circuito all'altro, non esiste "un
circuito problematico": esiste un **errore di 2–3 secondi che gira per il dataset** e affiora dove
capita, a seconda di come si misura.

**La conferma è nella scala dei track_time:**

| circuito | track_time (rif. locale) |
|---|---|
| Gran Bretagna | **+9,7** |
| Miami | +4,3 |
| Monaco | +1,9 |
| Austria | +0,9 |
| Spagna | +0,3 (FRAGILE: il segno cambia con la finestra 3/5/7) |
| Australia | **−2,6** (impossibile) |

Su 7 circuiti su 9 la quantità da stimare è **sotto il livello di rumore delle nostre misure**.

**È la stessa parete del degrado:** il segnale esiste, il modello è corretto, i dati pubblici non
lo risolvono. Due filoni, stesso muro — e per la stessa ragione (osservabilità, non algoritmo).

---

## Perché il pooling multi-stagione non ha salvato l'SC

Il pooling ha prodotto 4/9 circuiti con ≥8 stop SC, ma **non ha prodotto blocchi indipendenti**:
gli eventi SC sono rari e concentrati (Spagna: 10 stop tutti dalla stessa gara). Il bootstrap a
blocchi degenera su un blocco solo → IC a larghezza zero, che **non sono intervalli di confidenza**.
La diagnosi di H ("l'osservato SC è inutilizzabile come metro") è stata **confermata con più dati,
non superata**. Più stagioni non creano più eventi indipendenti.

---

## Cosa è stato dimostrato (regge)

1. **Il kernel è sano nel suo uso proprio, e ora è certificato in secondi assoluti.**
   L'offset carburante (pace fuel-corretta non re-inflazionata, ~2 s/giro) si elide **esattamente**
   nei gap sincroni: `max|raw − reinflated| = 0` per identità algebrica, e il residuo-gap dei
   piloti di controllo è piccolo e **piatto** (0,28 → 0,25 s/giro, non cresce con k). Anche il
   degrado si elide nei gap. **Il +27% non è in discussione.**
   *Corollario retroattivo:* la chiusura del filone degrado non era solo "non misurabile" — era
   anche **operativamente irrilevante nell'uso proprio del motore**.

2. **`pit_loss_circuito_f1db.csv` è la durata dello stop.** Dimostrato con dati esterni
   indipendenti. È la spiegazione unificata di tutte le anomalie osservate: sovra-dispersione,
   correlazione −0,76 col nominale, e il fatto che il ratio SC "funzioni" — funziona **grazie**
   all'errore (0,42 × 29,12 = 12,2 ≈ pit-loss SC reale di Silverstone).

3. **Due errori si compensano.** Correggere il pit-loss verde **senza** correggere il regime SC
   romperebbe la neutralizzazione, cioè il momento in cui la decisione di pit conta di più.
   La correzione, se mai si farà, è **atomica**.

4. **Il bias del metodo di misura del pit-loss è reale e modellabile.** Degrado in-lap +
   warm-in out-lap, unidirezionale verso l'alto. La correzione risolve Austria (track_time da
   −0,3 a +0,2). Non risolve Spagna.

---

## Cosa NON è stato dimostrato (e resta aperto)

- **Il pit-loss verde vero, per circuito.** Il metodo di misura ha un bias noto, e dopo averlo
  corretto Spagna resta fisicamente impossibile. **Non abbiamo un numero difendibile da mettere
  in produzione.**
- **La struttura del pit-loss sotto neutralizzazione.** Il ratio 0,42 costante è teoricamente
  sbagliato (comprime anche la componente pit-lane, che sotto SC non cambia) ma **non abbiamo un
  sostituto validato**. Resta in produzione perché il suo errore compensa l'altro.

---

## ANOMALIE AGLI ATTI (pathway di riapertura designato)

**Non si riapre il filone per un algoritmo migliore sugli stessi dati.** Si riapre solo se una di
queste due anomalie viene risolta **a monte**, con generatore committato, come lavoro a sé:

**A1 — `R_lap` misurato è fisicamente implausibile.**
Misurato a Silverstone: **1,12** (un giro sotto SC sarebbe il 12% più lento del verde). Il valore
fisico atteso è ~1,5 (verde ~88 s, SC ~130 s). Il valore che farebbe tornare la predizione H2
all'osservato è **1,64** — cioè proprio l'ordine atteso.
→ Sospetto: **le finestre SC sono mal identificate** (mescolate con VSC, o contaminate dai giri di
deployment/restart, che sono transizioni e non regime).
→ **Nota di disciplina:** questa osservazione **non riabilita il modello** e non è stata usata per
riaprire. H1 fallisce su Spagna in modo **indipendente** da R_lap: anche con R_lap corretto, il
modello cadrebbe comunque. L'anomalia è registrata, non sfruttata.

**A2 — Debito neutralizzazione (da Sessione E4).**
Le due fonti di neutralizzazione discordano nel **2,3% dei giri** (13/559). Il flag per-auto
(`ti_adapter`) è sempre più largo del `neutralizzazione.json` (soglia ≥2 auto). Entrambe hanno
generatore committato, ma **misurano cose diverse**, e **il modulo pit usa solo il json**.
→ È plausibilmente la stessa radice di A1.

**Condizione di riapertura:** risolvere A2 (una fonte di verità unica per la neutralizzazione, con
generatore) e verificare se A1 si sana di conseguenza. Se `R_lap` misurato torna a ~1,5, il test
H2 va rifatto **con i KPI originali, non rinegoziati**. Se H1 continua a fallire su Spagna, il
filone resta chiuso comunque.

---

## Lezioni di metodo (le più costose della settimana)

1. **Una tabella esterna ingerita senza generatore non era solo miscalibrata: era un'altra
   grandezza.** Quattro sessioni di statistica per sospettarlo, una sessione di dominio + un dato
   nuovo per dimostrarlo. *Regola 2 del progetto, confermata nel modo più caro possibile.*
2. **Due metodi che concordano non confermano se sono lo stesso metodo travestito.** I metodi C e
   D erano algebricamente identici. La domanda giusta non è "quante misure concordano" ma **"da
   quali direzioni diverse potrebbero sbagliare"**.
3. **Validare uno strumento significa misurarne il BIAS (mediana con segno), non il RUMORE
   (mediana del valore assoluto).** Il rumore per-stop non uccide un giudice: la mediana su n stop
   converge. Il bias sì.
4. **Un controllo a vuoto su coppie simmetriche è tautologico** (dà zero per algebra). Serve un
   placebo strutturato, appaiato alla struttura di selezione dei casi reali.
5. **Il criterio di plausibilità fisica va applicato simmetricamente**, anche ai valori che non
   vogliamo mettere in discussione — non solo a quelli nuovi.
6. **Il vincolo fisico batte il KPI.** `0 ≤ pit_loss ≤ pit_lane_time` ha chiuso la questione dove
   quattro sessioni statistiche non erano arrivate.
7. **Se il fallimento si SPOSTA cambiando metodo, non è un caso difficile: è rumore che affiora.**
   Spagna con la mediana-di-gara, Australia con il riferimento locale. Nessun circuito è "il
   problema": il problema è un errore di 2–3 s che gira per il dataset.
8. **Più dati non creano più eventi indipendenti.** Il pooling 2023–26 ha quadruplicato gli stop
   sotto SC ma non i blocchi: gli eventi SC sono rari e concentrati. Un IC calcolato su un blocco
   solo ha larghezza zero e **non è un intervallo di confidenza**. Quando si poola, contare i
   BLOCCHI, non le righe.
9. **La pre-registrazione va INCISA IN GIT prima dei numeri** (Sessione I: `PREREG_SESSIONE_I.md`
   committato prima di eseguire il generatore). Una dichiarazione d'intenti si può riscrivere; un
   commit timestampato no. **Da adottare come standard per ogni sessione futura.**

---

## STANDARD ADOTTATI DA QUESTO ARCO (validi per tutte le sessioni future)

- **Pre-registrazione committata prima dei numeri.** Metodo, campione, soglie e criteri di
  fallimento in un file, committato, *poi* si gira.
- **Ogni test di validazione di uno strumento deve poter bocciare lo strumento.** Se il test non
  può fallire, non è un test.
- **Contare i blocchi indipendenti, non le osservazioni**, in ogni bootstrap.
- **Il vincolo fisico ha diritto di veto sul KPI**, in entrambe le direzioni.

---

## PIANO DI MERGE (decisione operativa)

Il valore dell'arco è nei **report, nei generatori e nelle lezioni** — non nei verdetti. E un
verdetto sbagliato lasciato su `main` senza avviso è **un warm-in che aspetta di succedere**:
qualcuno lo rileggerà fra sei mesi senza il contesto di oggi.

**Obbligatorio PRIMA del merge — annotare in testa ai due report invalidati:**

- `REPORT_RESIDUO.md` (Sessione A): verdetto **STOP invalidato** dalla Sessione A-bis.
  Annotare: *"VERDETTO INVALIDATO — la misura era dominata dal termine carburante non
  re-inflazionato. Vedi REPORT_RESIDUO_DEBUG.md."*
- `REPORT_PITLOSS_GAP.md` (Sessione E): verdetto emesso con un **KPI mal scritto** (valore assoluto
  invece che con segno). Annotare rimandando alla Sessione F.

**Non cancellare nulla:** la storia degli errori è il valore principale di questo arco. Ma nessun
verdetto invalidato può stare su `main` senza avviso in testa.

**Merge unico**, con questa nota di chiusura in testa al repo. I golden restano verdi (11/11,
449/449, hook PASS): **nessun file di produzione è stato toccato in tutto l'arco A→I.**

---

## Cosa NON si fa

- Non si sostituisce `pit_loss_circuito_f1db.csv`.
- Non si tocca il ratio SC 0,42.
- Non si riapre il filone per un modello più sofisticato sugli stessi dati.
- **Non si riapre per una nona sessione.** La riapertura passa da A2 (fonte di verità della
  neutralizzazione), che è un lavoro **a monte** e **a sé**, non un ripescaggio di questo.
