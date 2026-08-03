# PREREG — il cliff di fine vita, a forma e parametri IMPORTATI

**Scritta il 03/08/2026, prima di produrre un solo numero.** Sigillata col commit che la
introduce: i valori dei parametri importati entrano in questo documento **prima** che il
motore giri anche una volta con essi.

Riferimenti: KPI F4 (firmato 03/08, `ai_lab/KPI_5_4_4.md`) ·
`ai_lab/confronto/REFERTO_attese_pirelli.md` · `ai_lab/confronto/ESITO_censimento_soste.json`

---

## 1 · La domanda, e perché non è una riapertura dell'arco chiuso

Il pianificatore non propone mai due soste. Non è un difetto del codice: è aritmetica.
Col degrado lineare e uguale per tutte le mescole il costo ottimo a k soste è

    costo*(k) = ρ·[ (R+a)²/(2(k+1)) − a²/2 + R/2 ] + k·P

e il guadagno della seconda sosta, ρ·(R+a)²/12, supera una perdita ai box di ~22 s solo
oltre i novanta giri di gara. Nessuna gara ci arriva.

**L'arco della STIMA del degrado è chiuso** — cinque cancelli NULL, e la clausola di
riapertura dice: *solo con dati o fonte nuovi*. Questa prereg non ri-stima niente. Importa
una **forma funzionale** e i suoi **parametri**, entrambi presi da una fonte esterna
pubblicata, e li tratta come struttura dichiarata con targhetta — mai come una misura del
progetto. Se la struttura importata non basta, si scrive NULL e si chiude anche questa.

## 2 · Dove entra, e la conseguenza che va accettata prima

Il passo del modello v2 è

    t(pilota, giro, età) = base(pilota) + deriva·(giro−1) + ρ·età + w(età)

con `w(età) = −c·exp(−età/τ)` il rodaggio. Il cliff è un **secondo termine della stessa
famiglia**, `q(età)`, aggiunto in `simulatore/engine/passo_v2.mjs`. Il kernel non si tocca.

**La conseguenza, ed è la ragione per cui questa sezione esiste.** La regola 10 dice che
ciò che `creaPasso` ri-aggiunge, `stimaBasi` deve sottrarlo: è la forma operativa che
impedisce il ripetersi di E02 (carburante sottratto e mai ri-aggiunto, −1,48 s/giro di
bias). Quindi **le basi vanno ri-misurate** col termine nuovo sottratto.

Questo NON è un fit: i parametri di `q` sono fissati dalla fonte e non si muovono. Ma
significa che il sigillo del modello cambia, e va detto adesso:

- il modello nuovo vive in un file distinto con la sua targhetta, **non sovrascrive**
  `modello_v2.json`;
- `q` assente o null ⇒ termine spento e numeri **bit-identici** a prima (stesso
  contratto del rodaggio, verificabile da una sentinella);
- la **forma chiusa smette di valere** con un termine non lineare: resta come punto di
  partenza della discesa locale già presente in `pianoOttimo`, e il costo dei piani si
  valuta **numericamente**. Va dichiarato perché cambia cosa significa `formaChiusa`.

## 3 · I parametri, e da dove vengono

Si importano **forma e valori** da fonte pubblicata. Le candidate, in ordine di
preferenza:

- **A — TUMFTM/race-simulation** (LGPL, tre paper peer-reviewed):
  `helper_funcs/src/calc_tire_degradation.py` e i coefficienti per mescola nei file dei
  circuiti. È la candidata primaria: modello usato in letteratura, parametri pubblicati
  per circuito e per mescola.
- **B — Sulsters 2018** (VU Amsterdam), forma con termine super-lineare.
- **C — degrado a interesse composto** (`DR·(1+DC)^(età−1)`), cliff incorporato
  nell'esponenziale.

**Vincolo assoluto:** i parametri sono quelli della fonte, trascritti con `{valore, fonte,
url, data}`. **Nessun ricentraggio, nessuna scala aggiustata sui nostri dati, per nessuna
gara.** Un'ampiezza rifittata per gara sarebbe la porta sul retro della stima, cioè
esattamente ciò che il cancello adattamento ha già bocciato (NULL). Se i parametri della
fonte vengono da vetture o stagioni diverse, il disallineamento si dichiara — non si
corregge.

Se nessuna fonte pubblica i parametri nella forma che serve, si scrive e la fase si
chiude: è già successo con gli offset per mescola di Pirelli, che **non sono pubblicati**
nella forma utile al motore (referto attese Pirelli, §5).

## 4 · Il bersaglio, dichiarato prima

Il censimento ha già misurato di quanto perde il piano a due soste. Questi numeri sono
**pubblicati e congelati** prima di questa prereg, e sono il bersaglio:

| gara | attesa Pirelli | deficit della 2-soste | ruolo |
|---|---|---|---|
| **Austria** | 2 soste; nessun pilota ne fece una sola | **+12,6 s** | bersaglio primario |
| **Spagna** | 2 come minimo, terza non esclusa | **+15,1 s** | bersaglio primario |
| Ungheria | 1 e 2 alla pari | +13,3 s | caso limite, non giudica |
| le altre 8 | 1 sosta | — | **non devono cambiare** |

## 5 · I cancelli

**C1 — il bersaglio.** Col cliff acceso, il piano propone **due soste in almeno una fra
Austria e Spagna**, al congelamento canonico e per la maggioranza dei piloti di quella
gara (>50% dei pannelli con piano).

**C2 — nessun danno dove il motore aveva ragione.** Nelle **otto gare in cui Pirelli si
aspettava una sosta**, la quota di pannelli che propongono k≥2 resta **sotto il 10%**.
Un modello che comincia a proporre due soste ovunque non ha imparato niente: ha solo
alzato il degrado.

**C3 — la fisica non peggiora dove è validata.** Sul banco unico, metrica a due giri, il
motore col cliff **non peggiora** contro il motore senza: test dei segni, `p ≥ 0,05` per
un eventuale peggioramento. La metrica e il perimetro sono quelli tarati (n = 235).

**C4 — la bandiera non peggiora.** Sul banco unico, metrica alla bandiera in
configurazione oracolo, il saldo contro il nullo **non scende** sotto quello attuale
(+2) più della tolleranza di un caso: `saldo ≥ +1`.

**Tutti e quattro** devono passare. C1 senza C2 è un modello che ha imparato a proporre
due soste sempre; C1 senza C3 è una fisica peggiore che indovina una risposta.

## 6 · Cosa si scrive se falliscono

**NULL onorato, per iscritto**, con questa formula: *«la forma di fine vita importata da
&lt;fonte&gt;, coi suoi parametri pubblicati, non è sufficiente a far comparire una seconda
sosta dove la fonte esterna se l'aspettava»*. E si dichiara **di quanto** manca: il
deficit residuo su Austria e Spagna dopo il cliff.

Non si prova una seconda forma sullo stesso dato sperando che passi. Se A fallisce, si può
provare B **una sola volta**, dichiarando che è il secondo tentativo — e se fallisce anche
B, l'arco si chiude come si è chiuso quello del degrado stimato. Tre forme sullo stesso
bersaglio sarebbero forking paths.

## 7 · Cosa questa prereg NON autorizza

- Non autorizza a **stimare** alcun parametro dai nostri dati.
- Non autorizza a **muovere una soglia** di questo documento dopo aver visto un numero.
- Non autorizza ad **accendere** il termine in produzione: l'accensione è, come sempre,
  una decisione del PO, e arriva dopo i cancelli, non insieme.
- Non tocca il **KPI F4**, il cui denominatore è due e la cui potenza è dichiarata bassa
  nel referto: superare C1 su una gara sola è un **indizio**, non una prova, e va detto
  nel referto d'esito con le stesse parole.
