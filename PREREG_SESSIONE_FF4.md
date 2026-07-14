# PREREG — Sessione FF4: "fastf1-engine-ready"

**Committato PRIMA di qualsiasi calcolo del nuovo metodo.** Nessun pit-loss a giro intero è
stato calcolato prima di questo commit. **Unica lettura a giro intero preesistente, dichiarata**:
i 3 out-lap dell'ATT6 Montreal (BOT/STR/NOR 2026: 86,03 / 85,81 / 83,11 contro verde mediano
77,10), già pubblicati in `NOTA_MONTREAL_NO_ATTIVAZIONE.md` — sono la **diagnostica su 3 stop**
che ha motivato questa sessione, **non** la misura FF4. Nessun altro numero a giro intero esiste.

Branch: `fastf1-engine-ready` (da `main` @ d498818: include Silverstone 20,80 in produzione e il
censimento FF3).

Vincoli (dal mandato): NON si tocca kernel, modulo pit, gancio degrado, golden, né alcun file di
produzione. **Nessuna attivazione in questa sessione.** Nessun merge.

---

## Perché questa sessione esiste

L'ATT6 di Montreal ha **respinto** il candidato 18,96 del censimento (0/3 migliorati, NOR
peggiorato err 0→3). La causa, verificata: il motore applica `pitLoss` come **costo totale del
pittare**, mentre `pit_loss_dry` di FF2/FF3 somma **solo i settori sopra soglia** — il warm-in
che si spalma sugli altri settori resta fuori dalla misura ma dentro la realtà.

Diagnosi incisa nella nota Montreal: **il pit-loss per settori è un LIMITE INFERIORE del
pit-loss rilevante per il motore.** A Silverstone i due coincidevano (il warm-in stava tutto in
S1-out, che era il settore affetto) e ATT6 passò; a Montreal no.

FF4 misura la grandezza **giusta per il motore**: il delta sul **giro intero**, warm-in incluso
**per costruzione**. È il metodo candidato nominato dalla nota Montreal, qui pre-registrato
invece che improvvisato.

## Il metodo (F4.1) — engine-ready

Per ogni stop, con gli **stessi riferimenti e filtri di FF2**, sostituendo i settori col giro:

```
delta_inlap  = LapTime(in-lap)  − mediana LapTime dei giri verdi di riferimento dello STESSO stint
delta_outlap = LapTime(out-lap) − mediana LapTime dei giri verdi di riferimento del NUOVO stint,
                                  posizioni 2–5 (mai il giro 1, che è l'out-lap stesso)
pit_loss_engine = delta_inlap + delta_outlap
```

- **Nessuna selezione di settori.** Il metodo a giro intero non identifica settori affetti: prende
  tutto il giro, quindi cattura il warm-in **ovunque cada**. È la differenza con FF2/FF3.
- **`LapTime` mancante**: FastF1 a volte lascia `LapTime` a NaN con i settori presenti. Regola
  pre-registrata: si usa `LapTime`; se assente e i tre settori ci sono, si usa **S1+S2+S3** (è la
  stessa grandezza per definizione — verificato in FF: 29,75+38,77+25,55 = 94,07 = LapTime). Se
  manca anche un settore, lo stop è scartato e contato.
- **Aspettativa dichiarata a priori**: il giro intero è **più rumoroso** del settore (traffico e
  variabilità del giro completo entrano nella misura). **Gli IC di FF4 saranno più larghi di
  quelli di FF3, e questo è il prezzo della grandezza giusta.** Se gli IC risultassero più
  stretti sarebbe un campanello, non una vittoria: andrebbe spiegato.

## Regole invariate da FF2/FF3 (NON re-implementate: importate dal generatore committato)

Gli helper di classificazione, scarico, stazionarietà e bootstrap sono **importati** da
`gen_censimento_pitloss.py` (in `main`), così il metodo **non può divergere** da quello già
validato. Restano identici:

- **DRY/WET/MISTA per gara**, congelata prima dei pit-loss (mescole ≥20% inter/wet + Rainfall
  ≥20%; discordanza → MISTA, esclusa da entrambi i panieri). **Verdetto solo su dry**
  (decisione di dominio del PO, FF2). Wet misurato e archiviato, senza soglie.
- **`pit_lane_time` = PitOut(out-lap) − PitIn(in-lap)**, righe diverse accoppiate per pilota.
- **Stazionarietà**: gara che devia > 2,0 s dalla mediana delle altre → esclusa e dichiarata;
  esclusioni a prefisso temporale → cambio layout, contano solo le stagioni del layout attuale.
- **Drive-through esclusi**: rilevatore FF3 = gomma che continua a invecchiare attraverso il
  transito (stesso compound e `TyreLife` = precedente + 1) **oppure** `Stint` invariato.
- **`IsAccurate` SOLO sui giri verdi di riferimento**, mai su in/out-lap (in FastF1 sono `False`
  per definizione: il filtro letterale azzera il campione).
- Esclusi: SC/VSC/bandiera rossa su in-lap o out-lap, primo/ultimo giro, stint con < 4 giri verdi
  di riferimento.
- **IC95 bootstrap a BLOCCHI CONTATI COME BLOCCHI**: mediana delle mediane di gara, **mai** pesata
  per numero di stop (10.000 ricampionamenti, seed fisso).
- **Riconciliazione scarti esatta**: il generatore esce con errore se i conti non tornano.

## Regola di FF3 che NON si applica, e perché (dichiarato PRIMA)

**">2 settori affetti ⇒ gara esclusa"**: era una regola di **applicabilità del metodo per
settori**. Il metodo a giro intero non identifica settori e non ha quella modalità di
fallimento ⇒ **la regola non si applica**. **Conseguenza dichiarata ora**: rientrano nel campione
le gare che FF3 aveva escluso per quel motivo (fra cui **Canada 2024 e 2026** e **Spa 2025**).
Non è una scorciatoia per allargare il campione: è l'unica lettura coerente col metodo nuovo, e
la si scrive prima di vedere se conviene.

## Il veto fisico: quale resta, quale cade, e perché (deciso PRIMA dei numeri)

- **RESTA — `pit_loss_engine > 0`**: pittare non può far guadagnare tempo. Se **> 10%** degli stop
  dry di un circuito ha `pit_loss_engine ≤ 0`, la misura è dominata dal rumore ⇒ **NON
  MISURABILE** per quel circuito.
- **CADE — `pit_loss ≤ pit_lane_time`**: **non è un vincolo fisico per questa grandezza.**
  Algebricamente `pit_loss_engine = (pit_lane_time − track_time) + warm_in`, quindi
  `pit_loss_engine ≤ pit_lane_time` equivale a `warm_in ≤ track_time`: una **contingenza** fra due
  quantità indipendenti, non una legge. FF3 lo aveva già mostrato per il metodo per settori (il
  veto scattava strutturalmente su 15 circuiti su 21 → riclassificati **MISURA NON SEPARABILE**
  dal PO). Includendo il warm-in **per costruzione**, la disuguaglianza diventa ancora meno
  informativa.
  **Non lo si rimuove per salvare un risultato** — lo si rimuove prima di vedere i risultati,
  perché applicato a questa grandezza sarebbe un errore di dimensione. **`track_time` e i conteggi
  di violazione si riportano comunque come DIAGNOSTICA**, così il lettore giudica.

## F4.0 — SILVERSTONE È IL TEST BLOCCANTE (dal mandato, non negoziabile)

Silverstone si misura **per primo**. Il 20,80 è **già in produzione** (attivato, PR #26, ATT6 2/3).

```
|pit_loss_engine_dry(Silverstone) − 20,80|  >  1,5 s
    ⇒ il valore in produzione è SBAGLIATO ⇒ si riporta ROLLBACK e CI SI FERMA.
      Montreal, Spa e Austin NON si misurano in questa sessione.
```

- Se la differenza è **≤ 1,5 s**: il 20,80 è **confermato dal metodo engine-ready** — cioè da un
  metodo indipendente dal settore che l'ha prodotto — e si procede sugli altri tre.
- La soglia 1,5 s è del mandato, incisa qui. **Non si arrotonda**: 1,51 è un fallimento.
- **Se il test fallisce, il rollback si riporta, NON si esegue**: nessuna attivazione né
  disattivazione in questa sessione (vincolo del mandato). La decisione è del PO.

## F4.2 — Circuiti e ordine

| ordine | circuito | produzione | valore FF2/FF3 (per settori) | ruolo |
|---|---|---:|---:|---|
| **1** | **silverstone** | **20,80** | 20,80 (attivato) | **BLOCCANTE: verifica retroattiva** |
| 2 | montreal | 24,37 | 18,96 (GO censimento, **ATT6 respinta**) | rimisura engine-ready |
| 3 | spa-francorchamps | 23,36 | 19,04 (GO censimento) | rimisura engine-ready |
| 4 | austin | 24,25 | 20,57 (GO censimento) | rimisura engine-ready |

Stagioni: 2018–2026 dove l'evento esiste (gare successive al 2026-07-14 non esistono). Cache
FastF1 già popolata dalle sessioni FF/FF2/FF3, **non committata**.

## F4.3 — Verdetto per circuito (soglie invariate, precedenza incisa)

`guadagno = produzione − pit_loss_engine_dry` · `rapporto = |guadagno| / (larghezza_IC95 / 2)`

Ordine di valutazione (il primo che scatta vince):
1. **NON MISURABILE** — > 10% degli stop dry con `pit_loss_engine ≤ 0`.
2. **NON ESEGUIBILE** — blocchi dry **< 5** (non si abbassa).
3. **GIÀ CALIBRATO** — |guadagno| ≤ **1,0 s** e larghezza ≤ 6,0.
4. **GO** — larghezza ≤ **3,0 s** **e** rapporto ≥ **3,0×**. *(Se il rapporto è 2,9× ⇒ AMBIGUO:
   non si arrotonda.)*
5. **AMBIGUO** — larghezza ≤ 3,0 con rapporto < 3,0; oppure larghezza in (3,0 – 6,0].
6. **NO** — larghezza > 6,0.

**Anche un GO non attiva nulla in questa sessione.** Un eventuale GO engine-ready autorizzerebbe
una sessione di attivazione dedicata **con ATT6**, che resta il giudice: FF4 misura meglio la
grandezza, non sostituisce la verifica contro la realtà.

## F4.4 — Confronto obbligatorio con FF3 (per settori)

Per ogni circuito, in tabella: `pit_loss_engine` vs `pit_loss_dry(FF3)` e la **differenza**, che
è la stima del **warm-in fuori dai settori affetti**. Attesa dalla diagnosi Montreal:
differenza ~0 a Silverstone, **positiva e grande** a Montreal. **Se l'attesa è smentita, si
scrive**: vorrebbe dire che la diagnosi del fallimento ATT6 era sbagliata.

## Criteri di fallimento e leve vietate

1. **F4.0 fallisce** (Silverstone oltre 1,5 s) ⇒ **STOP immediato**, rollback riportato, gli altri
   circuiti non si misurano. Non si cerca a valle una variante del metodo che lo salvi.
2. Circuito sotto 5 blocchi ⇒ NON ESEGUIBILE, **la soglia non si abbassa**.
3. Riconciliazione scarti non esatta ⇒ il generatore esce con errore.
4. **Vietato, per nome**: reintrodurre la selezione dei settori se il giro intero risulta troppo
   rumoroso; spostare le soglie (20%, 2,0 s, 5 blocchi, 3,0 s, 3,0×, 1,0 s, 1,5 s di F4.0);
   passare al bootstrap pooled; riclassificare DRY/WET dopo i pit-loss; ripescare gare escluse;
   escludere gli stop lenti (come NOR a Montreal) perché "non rappresentativi"; usare
   FP/qualifica; arrotondare il rapporto o la soglia di F4.0.
5. Nessuna attivazione, nessuna correzione, nessun merge.

## Output attesi

- `PREREG_SESSIONE_FF4.md` (questo file, **committato per primo**)
- `gen_pitloss_engine_ready.py` — generatore committato (importa gli helper da FF3)
- `data/pitloss_engine_ready.csv` — la tabella (un circuito per riga)
- `data/engine_ready_stops.csv` — uno stop per riga
- `REPORT_PITLOSS_ENGINE_READY.md`, con **in cima**:
  - `F4.0 SILVERSTONE: engine-ready = X.XX vs 20,80 in produzione, |Δ| = Y.YY s -> [CONFERMATO / ROLLBACK]`
  - `F4.3 VERDETTI: silverstone [..] | montreal [..] | spa [..] | austin [..]`
  - `F4.4 warm-in fuori dai settori (engine-ready − FF3), per circuito`
- Golden verdi prima e dopo.

Nessun verdetto strategico: è del PO.
