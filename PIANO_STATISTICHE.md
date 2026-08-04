# Piano — da «Classifiche» a «Statistiche»

*Scritto 04/08/2026. Censimento di 8 agenti sulle fonti del repo + ricerca esterna, poi tre proposte
d'architettura indipendenti, una sintesi, otto verifiche avversariali modulo per modulo e un critico
di completezza. I numeri marcati **[misurato]** li ho verificati io in questo worktree; quelli marcati
**[da verificare]** vengono dagli agenti e non li ho ricontrollati.*

---

## 0. Stato — ondata 0 e ondata 1 fatte (04/08/2026)

| | |
|---|---|
| **Ondata 0** | `demo/test_stat.mjs` + `demo/REGISTRO_SEZIONE.json`, agganciati a `banco.yml`. **203 asserzioni verdi**, 4 divergenze a registro. Provato che morde: cinque regressioni finte su cinque catturate, inclusa quella bidirezionale (una divergenza dichiarata che guarisce). |
| **Ondata 1** | Nav a sorgente unica (`statico.py::NAV` + `--nav`), sei pagine, quattro moduli, un generatore. |
| **Ondata 2** | Tre generatori (`gen_stat_gara.py`, `gen_stat_piloti.py`, C2 dentro `gen_stat_confronti.py`), la sesta pagina, sette moduli nuovi. `demo/test_stat.mjs` a **219 asserzioni**. |
| **Ondata 3** | S2 ritiri (con la firma da dare), V3 osservabilità misurata, C3 il ponte anno. **E l'aggancio all'automazione**, che mancava. Quattro generatori, tutti idempotenti. |

## 0-bis. L'automazione — il buco che il committente ha trovato

`aggiorna_stat.py` esisteva dall'ondata 1 ma **non era agganciato ad `auto_gara.py`**: la sezione
sarebbe rimasta ferma alla gara del giorno in cui è nata. Ora gira in **due punti**:

- **ondata 1**, dopo `aggiorna_ui` e il race control, perché legge quello che loro scrivono;
- **ondata 2**, dopo l'avanzamento del pin f1db, perché tre artefatti su quattro dipendono dalla
  *release* e non solo dalla gara — senza, le classifiche sarebbero avanti e la sezione indietro.

**Agganciarlo non basta**: gira con `check=False` e può fallire in silenzio. Quindi la sentinella
ora **dimostra che ha girato**, confrontando il perimetro dichiarato da ogni artefatto con le gare
pubblicate. Provata simulando due gare mancanti:
`gara_2026.json … indietro di 2: Belgio, Ungheria. Lanciare python3 aggiorna_stat.py`.

## 0-ter. Cosa ha prodotto l'ondata 3

- **S2 — ritiri**: 48 non arrivati, 46 con causa. Il raggruppamento in famiglie **non l'ho deciso**:
  `data/ritiri_raggruppamento.json` nasce `firmato: false`, e finché resta così si pubblica il
  **testo grezzo**. Le tre domande da sciogliere sono scritte lì dentro, come domande.
- **V3 — osservabilità**: la prosa è diventata un **censimento generato**. Risultato più netto di
  quanto dicesse la prosa: i canali pubblicati sono **cinque** e **il DRS non c'è affatto**, nemmeno
  a zero — quindi «nel 2026 il DRS è a zero» su questi dati **non è verificabile**, viene da fuori,
  e la pagina lo attribuisce invece di spacciarlo per misura.
- **C3 — il ponte anno**: nove stagioni, **13 trappole verificate una per una**. Il numero che
  giustifica l'intero modulo: il **2019 ha 21 gare in calendario e 15 usabili**; il 2021 ha
  **zero sprint su tre corse**; il 2024 ha i microsettori in 16 gare su 24.

**Tre cose che il ponte ha trovato e che non erano nel mio brief:**

1. **`lab/fondo.ASCIUTTE` butta via il 63% del 2018** (35.838 giri su 56.914): il suo vocabolario
   di mescole è quello post-2019, e applicato al 2018 scarta gomme asciutte vere. È il motivo per
   cui i «giri utilizzabili» del 2018 non sono confrontabili con quelli del 2019.
2. **I cid del progetto non sono i `circuitId` di f1db** — e una delle gare che si perdono
   nell'incrocio è proprio una gara accorciata (Germania 2019, 64 giri su 67).
3. **Giri registrati ≠ giri classificati** in 4 casi: quando la bandiera esce in anticipo, le auto
   il giro lo percorrono e la classifica non lo conta. Non è un errore di nessuna delle due fonti.

E quattro correzioni al mio brief: le mescole 2018 sono **sei** nomi asciutti, non sette; i
microsettori intermittenti **non sono un fatto del 2024** (nel 2026 mancano anche in gara); le gare
accorciate sono **12**, non 2; e a Spielberg si è corso due volte anche nel **2021**, non solo nel 2020.

**Cosa ha prodotto l'ondata 2, e i controlli che l'hanno retta:**

- **P4 — chi ha condotto**: dal campo `pos`, **673 giri su 673**, e il controllo incrociato più
  forte disponibile è passato: **il leader dell'ultimo giro coincide col vincitore FIA in 11 gare
  su 11**. Verde e neutralizzato sono separati (64 giri su 673 sono dietro una bandiera).
- **P1/P2 — compagni di squadra**: regola dell'ultimo segmento comune, e si *vede* funzionare —
  Cadillac confrontata in Q1 tutte e 11 le volte, Ferrari in Q3 dieci volte su undici.
  Cross-check f1db contro classifica FIA su chi era davanti: **0 divergenze su 121 duelli**.
- **S1 — neutralizzazioni**: 6 SC, 17 VSC, 1 rossa; 10,0% dei giri-auto. Tre metriche separate.
- **T2 — pit lane**: scarto dalla mediana della propria gara, perché il tempo assoluto lo decide
  il circuito. Mercedes −0,55 s, Cadillac +1,17 s.
- **T3 — gomme**: 675 stint, 12.708 giri, **11 gare su 11** — la copertura più piena del sito.
- **C2 — il gruppo si è stretto?** Solo Q1, in percentuale, sui 5 circuiti corsi in tutti e nove
  gli anni. **Il 2025 è davvero molto più compatto del 2018**, e non è un'impressione: tutte e
  cinque le mediane per gara del 2025 stanno sotto tutte e cinque quelle del 2018 — separazione
  completa, che per caso capita una volta su 252. Ma **«ogni anno più stretto del precedente» è
  falso**: il 2022 risale, e il p90 rimbalza perché una sola sessione muove l'anno.
  Il **2026 rompe la direzione, ma meno di quanto sembri**: in grezzo è l'anno più largo dal 2018
  (1,086%), a campo pari scende a 0,789% — **circa metà del divario col 2025 sono le due vetture
  in più**. Il controllo a campo pari non era nel piano: è la differenza fra dire «il gruppo si è
  allargato» e «ci sono due macchine in più».

**Tre correzioni a quello che il censimento dava per buono:**

1. **Le tre fonti sulle soste non «divergono»**: `pitstops_2026.json` e f1db coincidono su
   **219/219**. A divergere sono i due conteggi *derivati* — il massimo stint sbaglia in 27 casi
   su 241, e il flag di pit non è affatto un conteggio di soste (segna entrata *e* uscita).
   In più f1db **salta dei numeri** nella sequenza (Australia: 1, 2, **4**): le soste si contano
   per righe, non col numero più alto, o se ne conta una in più in cinque casi.
2. **La qualifica 2026 ha 239 righe, non 217**: il 217 era della release `v2026.10.0`. La pinnata
   `v2026.11.0` copre 11 round.
3. **Nel 2026 non ci sono cambi di pilota**, contrariamente a quanto avevo assunto.

**Un difetto silenzioso trovato e messo a registro (voce S6):** gli artefatti chiamano le squadre
in tre modi («Haas» / «Haas F1 Team» / «Red Bull» / «Red Bull Racing») e un nome che non risolve
**non dà errore: dà il grigio di riserva**. È la decisione 8 che morde. Cerotto applicato in un
punto solo, e la sentinella ora pretende che ogni squadra trovi la sua livrea.

**Correzioni al piano, emerse costruendolo:**

- **C1 era etichettato onda ① e non lo era.** I dati f1db esistono, ma le pagine non possono leggere lo zip: serviva un generatore. È stato scritto (`gen_stat_confronti.py` + `aggiorna_stat.py`) e C1 è comunque in produzione.
- **`statistiche-stagione.html` non è nata**, per la regola di stop del §5: nessuno dei suoi moduli era di ondata 1. Non è in `PAGINE_FISSE` e non è nella sotto-barra.
- **Due difetti veri trovati strada facendo**, entrambi invisibili alla CI di allora: i footer di `dati.html` e `forza.html` sono su una riga sola e lo stampatore li aveva saltati in silenzio; e la famiglia CSS nuova non invalidava la cache perché `?v=` non era stato mosso. Il primo ha insegnato alla sentinella a guardare i footer, il secondo a pretendere **la stessa versione di `stile.css` in tutte le pagine**.
- **Debito S1 saldato**: `articolo.html`, `dati.html`, `forza.html` e `404.html` ora versionano `stile.css`. La voce è uscita dal registro.
- **`percentile()` è copiato da `dati.html` alla lettera**, non migliorato: la mia versione dava Ferrari 61/72/67 dove la pagina esistente pubblica 60/70/65. Due numeri per la stessa grandezza sullo stesso sito squalificano una sezione più di una cella mancante.

---

## 1. La tesi

**La sezione non nasce: si raccoglie.** Il materiale di stagione esiste già ed è sparso in tre posti
che non si parlano:

| dove sta oggi | cosa c'è | dove dovrebbe stare |
|---|---|---|
| **Analisi** | `forza.html` (indice forza-vettura, slider R1→R11) | Statistiche · vetture |
| **Analisi** | `dati.html` (punta-vs-curva + DNA circuiti) | Statistiche · vetture |
| **Stagione** | grafico posizioni guadagnate/perse | Statistiche · piloti |
| **Classifiche** | standings piloti/costruttori | resta, è il cuore |

Aggiungere viste senza raccogliere queste tre produrrebbe un doppione della metà del sito.

**E la sezione ha una materia prima enorme e inutilizzata.** Il repo scarica f1db da sempre e ne apre
**15 tabelle su 47** [misurato]. Le 32 mai aperte contengono, per il solo 2026:

| tabella f1db mai usata | contenuto 2026 | cosa sblocca |
|---|---|---|
| `races-qualifying-results` | **217 righe con q1/q2/q3 veri** (217 in Q1, 159 in Q2, 97 in Q3) + millesimi | tutta la qualifica per fase |
| `races-driver-standings` | **21.427 righe, per ROUND, 1950-2026** + `positionsGained` | **il confronto fra stagioni, senza toccare il fondo** |
| `races-constructor-standings` | 10.599 righe dal 1958 | idem, per squadra |
| `races-fastest-laps` | 210 righe con giro, tempo, gap | il giro veloce canonico |
| `races-driver-of-the-day-results` | 50 righe con la percentuale di voti | il voto contro i dati |
| `constructors-chronology` | Sauber→BMW→Alfa→Kick→**Audi** | la carriera costruttore vera |

*Tutti [misurato] sullo zip `v2026.10.1` in cache.*

---

## 2. Una correzione a quello che ti ho detto a voce

Ti avevo riportato che «il giro 1 è sbagliato in 7 gare su 11 perché `cum_time` non porta l'offset di
griglia». **Il numero era giusto, il meccanismo no, e la conseguenza cambia il modulo.**

Il meccanismo vero [misurato]: quando un giro manca, il feed **copia il tempo-sessione del leader**
nella riga. A Cina, al giro 1, **cinque piloti hanno esattamente lo stesso `cum_time` 3483,760**
(ALB, BOR, HAM, NOR, PIA) — è un pareggio al millesimo, e vince chi viene prima in ordine alfabetico.
Non c'entra la griglia: ad ALB è capitato l'alfabeto, non la ventiduesima piazza.

E soprattutto: **il rimedio non è «escludere il giro 1»**. Il campo `pos` esiste nel grezzo ed è già
letto da un generatore committato (`gen_classifica_giro.py` → `data/classifica_giro_2026.csv`).
Con `pos`: **673 giri su 673 attribuiti, zero buchi** [misurato]. Confrontando i due metodi al giro 1,
`cum_time` sbaglia il leader in **3 gare** (Australia, Cina, Canada), non 7 — le altre 4 differenze
dal poleman sono sorpassi veri.

Un generatore *può* leggere `data/`; è la **pagina** che non può. Quindi il modulo «giri in testa»
non ha nessuna barra grigia da mostrare: ha il dato pieno.

---

## 3. Architettura — sei pagine, la nav resta a quattro voci

```
nav:  Stagione | Live | Analisi | STATISTICHE ←── cambia solo l'etichetta e la destinazione
                                       │
      ┌────────────────────────────────┴─────────────────────────────┐
      │ statistiche.html          il banco — coperture e provenienza │
      │ classifiche.html          Classifiche  ← URL INVARIATO       │
      │ statistiche-piloti.html   Piloti                             │
      │ statistiche-squadre.html  Squadre e vetture 2026  (#team #vetture)
      │ statistiche-stagione.html Stagione 2026                      │
      │ statistiche-confronti.html Confronti fra stagioni            │
      └──────────────────────────────────────────────────────────────┘
```

**`classifiche.html` non si rinomina.** Cambiano `h1`, briciola e targhetta; l'URL, il contenuto e i
link già pubblicati dagli articoli restano. Zero stub con meta-refresh, zero redirect — e non è una
scelta estetica: `demo/vercel.json` **non ha né `redirects` né `rewrites` né `cleanUrls`** [misurato],
quindi uno stub sarebbe un travestimento che nessuna CI sorveglia.

**Sei file veri, non un file con i tab.** Due ragioni, la seconda è quella che regge:
1. la querystring non può scegliere un file su hosting statico — il repo lo ha già pagato una volta,
   ed è il motivo per cui gli articoli sono pre-renderizzati in `demo/articolo/`;
2. **il `lastmod` della sitemap è lo sha256 del file intero** (`data/lastmod_pagine.json`). Un file
   unico darebbe **una** data di modifica a cinque pilastri che si aggiornano in momenti diversi:
   una targhetta falsa, esattamente ciò che questa sezione esiste per non fare.

**`forza.html` e `dati.html` restano con lo stesso URL**, escono da Analisi ed entrano come *viste
estese* di due moduli. Le pagine di pilastro ne mostrano la sintesi e ci linkano per lo slider e lo
scatter interattivo. Nessun generatore si tocca: `ai_lab/redazione/pubblica_dati.py` e
`forza_macchina.py` continuano a scrivere quello che scrivono oggi.

---

## 4. I moduli, per pilastro

Legenda onde — **①** i dati ci sono già · **②** serve un generatore nuovo · **③** serve un ponte o una tua decisione.

### PILOTI — `statistiche-piloti.html`
| # | modulo | fonte | onda |
|---|---|---|---|
| P1 | **Compagni in qualifica** — regola dell'ultimo segmento in cui *entrambi* hanno un tempo valido, delta **e** conteggio | f1db `races-qualifying-results` | ② |
| P2 | **Compagni in gara** — due colonne (tutte le gare / entrambi classificati) e le gare cadute **elencate per nome** | f1db + `ufficiali_2026.json` | ② |
| P3 | **Griglia → arrivo** — dal `gridPositionNumber` post-penalità, con `N_utile` per pilota (va da 3 a 11, non 11 per tutti) | f1db + `ufficiali_2026.json` | ② |
| P4 | **Giri in testa** — da `pos`, 673/673, spaccati verde / neutralizzato (63 giri su 662 sono sotto SC) | grezzo via generatore | ② |
| P5 | **Dove la nostra ricostruzione non regge il referto** — il campo `cross_check` che **oggi nessuna pagina apre** | `schede_2026.json` | ① |

> **Niente rating pilota.** Non è identificabile su 11 gare: in letteratura ~88% della varianza è del
> costruttore. È un NULL prevedibile, e in questa casa un NULL si pre-registra prima, non si spiega dopo.
> La sezione lo **scrive**, in un riquadro, invece di far finta che nessuno l'abbia chiesto.

### TEAM — `statistiche-squadre.html#team`
| # | modulo | fonte | onda |
|---|---|---|---|
| T1 | **Forza-vettura, gara per gara** — bump chart + badge `passo_stato` su ogni cella | `forza_macchina.json` | ① |
| T2 | **La pit lane** — quante volte e quanto, con **f1db `races-pit-stops` come arbitro** delle tre fonti che oggi litigano | f1db + `pitstops_2026.json` | ② |
| T3 | **Gomme e stint** — quante soste per gara, durata per mescola e circuito, chi ha corso una strategia diversa dal campo | file gara | ② |

> **T3 è il modulo che nessuna proposta aveva visto, ed è la materia più ricca del repo** [misurato]:
> `compound` popolato su **12.708 giri-auto** (HARD 5.956 · MEDIUM 4.783 · SOFT 1.955 · INTER 14),
> **675 stint distinti**, **11 gare su 11** — copertura migliore di `forza_macchina` (10) e
> `stagione_dati` (10). Un esperto che apre «Statistiche 2026» cerca le gomme prima della forza-vettura.
> **Non è un modulo di degrado**: i modelli degrado e traffico sono `ACCENDIBILE=false` per verdetto
> del progetto. È descrittivo — durate e conteggi con N, mai curve.

### VETTURE 2026 — `statistiche-squadre.html#vetture`
| # | modulo | fonte | onda |
|---|---|---|---|
| V1 | **Punta contro curva + DNA del circuito** — la gara in primo piano in km/h, la nuvola di sfondo **in percentili dentro la gara** (fra tracciati i km/h non si confrontano) | `stagione_dati.json` | ① |
| V2 | **Telaio e motorista 2026: la mappa che si è rotta** — Alpine cliente Mercedes, Sauber→Audi, RB/RBR→Ford, Aston→Honda, Cadillac→Ferrari | f1db `seasons-entrants-*`, `chassis` | ② |
| V3 | **Il muro dell'osservabilità** — cosa è misurabile e cosa è un modello, più il regolamento **datato per evento** | dichiarazione + una misura | ③ |

> V3 non è una pagina di scuse. Contiene **una misura vera**: si conta quante righe della telemetria
> pubblicata hanno il canale DRS non nullo. Nel 2026 il canale è rimasto nello schema ed è a zero —
> così il ritiro di ogni metrica «vettura in scia» diventa un numero invece di un'opinione.
> E il regolamento 2026 **non è costante nella stagione**: almeno due cambi in corsa (recupero in
> qualifica 8,5→7,0 MJ da Melbourne; pacchetto dal GP di Miami). Una tabella intitolata «2026» senza
> data per evento è falsa a metà.

### STAGIONE 2026 — `statistiche-stagione.html`
| # | modulo | fonte | onda |
|---|---|---|---|
| S1 | **Neutralizzazioni** — dispiegamenti, giri neutralizzati e quota di distanza: **tre metriche diverse, tutte e tre stampate** | digit di `status` nel file gara | ② |
| S2 | **Ritiri** — «non arrivato» = `classificato=false` nell'arbitro; le cause solo da `reasonRetired` | `ufficiali_2026.json` + f1db | ③ |
| S3 | **Il muro delle coperture** *(vive sull'hub)* — heatmap 11 gare × N artefatti, cinque stati | tutti i manifest | ② |

> **S1 tocca la trappola più insidiosa**: `race_control_2026.json` **non contiene le safety car**
> (solo giallo/info/penalità). Chi le cerca lì conclude che il 2026 ne ha avute due invece di tredici.
> Stanno nei digit di `status` dentro il file gara: 4=SC, 6=VSC, 5=rosso.
>
> **S2 richiede la tua firma** (§7): il raggruppamento delle cause è una scelta editoriale — 197 valori
> di testo libero. Senza firma, la tabella mostra il testo grezzo.

### CONFRONTI FRA STAGIONI — `statistiche-confronti.html`
**Qui il piano è cambiato in corsa, ed è il miglioramento più grosso.** Le tre proposte lo mandavano
tutte all'onda ③, appeso a un ponte sul fondo storico che non esiste. Il critico ha trovato che la
fonte canonica per farlo **è già in cache**:

| # | modulo | fonte | onda |
|---|---|---|---|
| C1 | **La corsa al titolo, 2018→2026** — dopo N gare, quanto era largo il vantaggio del leader, quante squadre entro il 20%, quando il titolo è stato deciso | f1db `races-driver-standings` / `races-constructor-standings` | ① |
| C2 | **Il campo si è stretto?** — dispersione in qualifica per anno sui circuiti comuni, dal `q1Millis` (Q1 = l'unico segmento in cui c'è tutto il campo), **in percentuale, mai in secondi** | f1db `races-qualifying-results` | ② |
| C3 | **Quante gare sono davvero usabili, 2018-2026** — il ponte sul fondo | `data/fondo/` | ③ |

**Perché C1 cambia tutto:** 21.427 righe per-round dal 1950, il 2026 trattato come tutti gli altri anni,
nessun ponte, nessuna mappa di continuità delle squadre da decidere, nessuna delle undici trappole del
fondo. Il quinto pilastro passa da «vuoto fino all'onda 3» a **consegnabile nella prima**.

C3 resta, ma diventa quello che è: la pagina che dichiara **quanto poco** è confrontabile, e non è
poco lavoro dirlo bene — 2018 ha un altro alfabeto delle mescole, sei gare 2019 sono gusci vuoti
(le usabili sono 15, non 21), il Belgio 2021 è durato 3 giri, Sakhir 2020 è una pista diversa dal
Bahrain, i giri cancellati non esistono prima del 2020, e la Spagna 2026 cade fuori in silenzio perché
la cartella si chiama «Barcelona Grand Prix». **[da verificare — dal censimento, non ricontrollate]**

---

## 5. Il lavoro, in quattro ondate

### Ondata 0 — la sentinella, **prima** di toccare una riga
`demo/test_stat.mjs` nasce **verde sullo stato di oggi**, con le divergenze note messe a registro.
Se nasce dopo, certifica il risultato invece di sorvegliare il cambiamento.

Oggi **la CI non tocca né HTML né CSS**: una pagina può nascere rotta e `banco.yml` resta verde.
La sezione ne aggiunge cinque.

Il test verifica: nav normalizzata coerente in tutti i `demo/*.html` · ogni `href` risolve a un file
esistente · `PAGINE_FISSE` ↔ disco **nei due versi** · `stile.css` caricato col `?v=` · nessuna pagina
della sezione legge fuori da `demo/data/` · nessun file in `demo/data/stat/` senza generatore registrato.

> Correzione obbligatoria alla specifica: il test **non** può pretendere che il blocco nav sia
> byte-identico. Non lo è in nessun caso e non deve esserlo — `class="on"` e il prefisso href
> (`""` nelle pagine, `"/"` in 404, `"../"` negli articoli) sono informazione, non deriva.
> Va normalizzato prima di confrontare. **[da verificare: 8 varianti di md5 in 15 file]**

### Ondata 1 — la sezione esiste e ha già cinque pilastri
Nav e struttura + i moduli che leggono dati già pronti: **P5, T1, V1, C1**.
Alla fine di questa ondata la voce di menu punta a qualcosa di finito, e tutti e cinque i pilastri
hanno almeno un modulo vero.

### Ondata 2 — i generatori
`aggiorna_stat.py` + cinque script → **P1 P2 P3 P4, T2 T3, S1 S3, C2**.

### Ondata 3 — quello che dipende da te
**V3, S2, C3** — le tre cose che richiedono una firma o un ponte (§7).

> **Regola di stop, da approvare:** *una voce di sotto-nav e una riga di `PAGINE_FISSE` si accendono
> solo quando il loro artefatto esiste.* Senza questa regola il modo classico in cui questo lavoro non
> finisce è: cinque pagine promesse, tre finite, due in sitemap e vuote.

---

## 6. I generatori — cinque script, un comando, mai dentro `aggiorna_ui`

```
aggiorna_stat.py [--gara <nome>] [--solo registro|gara|piloti|vetture|confronti]
  ├── gen_stat_gara.py       → demo/data/stat/gara_2026.json      (giri in testa da `pos`, neutralizzazioni, gomme, pit lane)
  ├── gen_stat_piloti.py     → demo/data/stat/piloti_2026.json    (compagni, griglia→arrivo, ritiri)   [f1db]
  ├── gen_stat_vetture.py    → demo/data/stat/vetture_2026.json   (telaio, motorista, regolamento)     [f1db]
  ├── gen_stat_confronti.py  → demo/data/stat/confronti.json      (titolo per round, dispersione quali)[f1db]
  └── gen_stat_registro.py   → demo/data/stat/registro.json       ← SEMPRE ULTIMO
```

**Perché separato da `aggiorna_ui.py` e non dentro i suoi `passi`:** `auto_gara.py` lo invoca con
`check=False`, cioè un passo che fallisce non ferma niente. Cinque generatori nuovi dentro quella
lista fallirebbero in silenzio. Un comando proprio, con exit non-zero, si accorge.

**Un involucro unico per tutti e cinque**, o il muro delle coperture dovrà crescere un estrattore per
file — che è il debito da cui la sezione nasce:

```json
{ "_generatore": "gen_stat_piloti.py",
  "calcolato_il": "2026-08-04T18:20:11Z",        // ora di CALCOLO, mai una data di gara
  "provenienza": { "f1db_release_pinnata": "…", "f1db_release_letta": "…",
                   "artefatti_letti": [{"path": "…", "sha256_12": "…"}] },
  "perimetro":   { "anno": 2026, "gare": [ … ],  // DERIVATO da gare_registro.json, mai cablato
                   "assenti": [{"gara": "Monaco", "motivo": "telemetria lacunosa"}] } }
```

**Tre patch a generatori esistenti**, di cui una bloccante:
- `forza_macchina.py` e `pubblica_dati.py` devono scrivere `gare_assenti: [{gara, motivo}]`. Oggi
  «Monaco esclusa» è **cablato in `forza.html` riga 400** [da verificare]: finché il motivo sta nella
  pagina e non nel file, nel muro delle coperture quella cella resta giustamente **rossa**.
- `gen_motori.py` e `gen_mappa_gare.py` sono **fuori dal ciclo automatico**: un cambio di motorista a
  stagione in corso resterebbe fermo. V2 non si pubblica finché non rientrano.

---

## 6-bis. Le decisioni — CHIUSE TUTTE il 04/08/2026

Decisione di Tommi («chiudile tutte»), su proposta dell'assistente. Ognuna è reversibile, e
dove c'era una scelta contestabile è scritta l'alternativa scartata.

| # | decisione | come è stata chiusa |
|---|---|---|
| 1 | **Cause di ritiro** | **Firmata.** 8 famiglie, `data/ritiri_raggruppamento.json`. Le tre scelte contestabili — batteria nella power unit, contatto separato da danno-da-contatto, «incidente» e non «errore di guida» — sono scritte lì con il perché e con l'alternativa scartata. |
| 2 | **Regolamento 2026** | **NON si pubblica la tabella.** In una sezione costruita sulla provenienza, mettere numeri regolamentari che non abbiamo misurato e che le fonti riportano in disaccordo (768 vs 770 kg, 288 vs 290 km/h) sarebbe l'unico posto del sito con cifre non verificabili. V3 pubblica solo il **censimento dei canali**, che è una misura, e attribuisce a chi le fa le affermazioni che vengono da fuori. |
| 3 | **Pagine orfane** | **Adottate**, non cancellate. `quali/sprint/libere/tele.html` sono in `PAGINE_FISSE` e sono linkate **dal muro delle coperture**, che pubblica una riga per ognuno degli artefatti che mostrano: la riga porta al dato invece di limitarsi a contarlo. Chiude S2 e S3. |
| 4 | **Sprint** | **Non si importano le altre tre**, si dichiara il debito. Il muro ora distingue **«assente da noi»** (giallo) da **«assente ovunque»** (rosso), misurando cosa ha la fonte canonica: sprint 4 round su 4, libere FP1 11 su 11. La riga magra non dice più «i dati non esistono», dice «non li abbiamo importati». |
| 5 | **Vista cross_check rientrata** | **Rientra**, sotto Statistiche. Era stata tolta da `gara.html` il 25/07 con la motivazione «la loro casa naturale è Analisi»: la casa naturale ora esiste, ed è questa. Il modulo P5 è in `classifiche.html`. |
| 6 | **Pit-loss** | **La decisione del 02/08 regge e non è in conflitto.** Il modulo T2 pubblica il **transito in pit lane**, che è una grandezza *diversa* dal pit-loss — e la pagina lo scrive tre volte. Nessun modulo della sezione pubblica `pitloss.json` sotto l'etichetta «in uso». |
| 7 | **2022 nei confronti** | **Dentro, ma solo come conteggio.** Il ponte C3 conta il 2022 come ogni altro anno perché è *descrittivo*: dice quante gare sono usabili, non giudica niente. `PREREG_2022.md` ha soglia congelata e regola-stop, e **resta chiuso**: nessun modulo della sezione lo tocca. |
| 8 | **Identità squadre** | **Chiusa con una tabella generata.** `gen_stat_identita.py` → `demo/data/stat/identita.json`: 11 squadre, 24 alias, canonico = `team_demo` (scelto perché *misurato* che coincide già con le chiavi dei colori). Il dizionario cablato in `stat.mjs` è sparito, e il generatore **esce 1** se una squadra non trova la livrea. |
| 9 | **Regola di stop e MVP** | **Applicata** fin dall'ondata 1: `statistiche-stagione.html` non è nata finché non è esistito il suo artefatto. |

---

## 7. Le decisioni che servono a te *(storico — tutte chiuse, vedi §6-bis)*

| # | decisione | se non decidi |
|---|---|---|
| 1 | **Cause di ritiro**: firmi la mappa dei raggruppamenti (197 valori di testo libero) o si pubblica il grezzo? | S2 mostra `reasonRetired` così com'è |
| 2 | **Regolamento 2026**: si pubblica una tabella con parametri FIA/Formula1.com? Chi firma la riga quando le fonti discordano (768 vs 770 kg, 288 vs 290 km/h)? | V3 resta solo la parte misurata (il DRS a zero) |
| 3 | **Pagine orfane**: `quali.html`, `sprint.html`, `libere.html`, `tele.html` sono vive, funzionanti e **linkate da zero file** [misurato], fuori da `PAGINE_FISSE`. Si adottano sotto Statistiche o si cancellano? | la sezione pubblica righe di copertura su dati il cui unico lettore è irraggiungibile |
| 4 | **Sprint**: il sito pubblica **una sprint su quattro** mentre le classifiche ne contengono i punti (21 su 219 per il leader). Si importano le altre tre o si dichiara la scomposizione? | il muro scrive «sprint 1/11» e sembra un limite del dato — non lo è, f1db le ha tutte e quattro |
| 5 | **Vista rientrata**: il confronto f1db/ricostruzione fu tolto da `gara.html` il 25/07 («la loro casa naturale è Analisi»). P5 lo fa rientrare: serve una riga di decisione, o è una vista bocciata rientrata da un'altra porta | P5 resta fuori |
| 6 | **Pit-loss**: il 02/08 hai deciso che il valore in uso è quello del motore, non `pitloss.json`. T2 va adeguato | rischio di pubblicare due numeri per la stessa gara senza dirlo |
| 7 | **2022**: il fondo lo contiene completo, ma `PREREG_2022.md` ha soglia congelata e regola-stop. Dentro o fuori dal perimetro dei confronti? | C3 si ferma al 2023 |
| 8 | **Identità squadre**: servono **una** tabella sigla↔`driverId`↔team e una di continuità fra gli anni. Oggi ci sono **tre alfabeti** in giro («Haas F1 Team» / «Haas» / «Red Bull» vs «Red Bull Racing») | moduli della stessa pagina normalizzano in modi diversi: numeri diversi, non stili diversi |
| 9 | **Regola di stop e MVP** (§5) | il lavoro non finisce |

---

## 8. Cosa la sezione **non** dirà — e va pubblicato

Per un pubblico esperto questa lista vale quanto una vista, ed è l'unica difesa contro «e il rating dei
piloti?». Va in pagina sull'hub, non in nota:

- **Rating pilota** — non identificabile su 11 gare (~88% della varianza è del costruttore).
- **Sorpassi** — non pubblicabili senza definizione operativa: includendo o escludendo giro 1,
  doppiaggi e riprese in pit lane si ottengono numeri diversi del 30-40% per la stessa gara.
- **Degrado e traffico** — spenti per verdetto del progetto (`ACCENDIBILE=false`), arco chiuso da
  cinque NULL, e il circuito non è un predittore su otto risultati indipendenti.
- **Energia ibrida** — stato di carica, MJ, mappe motore, Overtake Mode: **non osservabili** da dati
  pubblici, per decisione di F1. Ogni stima è un modello e va etichettata come tale.
- **Ritmo gara in secondi al giro** — senza correzione carburante ci sono ~2 s/giro fra inizio e fine
  stint. Se si pubblica un passo, si stampa accanto il coefficiente e la catena di filtri.
- **I sei CSV orfani** — `firme_pace`, `team_profile_aggregate`, `driver_profile`, `long_run_quality`,
  `stint_gold`, `difficolta_sorpasso`. Sono i più invitanti proprio perché sembrano finiti: c'è già il
  delta fra compagni, c'è già una colonna che si chiama `significativo`. Nessuno ha un generatore.
  `difficolta_sorpasso.csv` è **vietato per iscritto in quattro punti del repo**. **[da verificare]**

---

## 9. I quattro rischi veri

1. **La sezione si fossilizza mostrando una data recente.** È il guasto che il progetto ha già pagato.
   Contromisura: `test_stat_dati.py` in CI verifica che ogni artefatto dichiari il round di riferimento
   e che coincida con l'ultimo round del registro.
2. **Due numeri diversi per la stessa cosa sullo stesso sito.** In `demo/data/analisi/` ci sono 12
   articoli congelati; almeno quattro misurano grandezze che i moduli nuovi ripubblicheranno con regole
   diverse — su `hun-quali-h2h-2026` la Ferrari passa da 7-3 a 6-4 **[da verificare]**. Serve la regola:
   chi è l'arbitro, e la vista linka l'articolo dichiarando che sono due domande diverse.
3. **Promuovere il CSS coi nomi nudi rompe due pagine con la CI verde.** `.seg` **non è libero**:
   esistono già `.evtl .seg` e `.ms-strip .seg` usate da `gara.html` e `weekend.html`, e non dichiarano
   `display`/`gap`/`border`/`padding` — che passerebbero. Va promosso namespacizzato `.stat-*`.
   **[da verificare]**
4. **Il muro delle coperture confonde «non c'è» con «non l'abbiamo preso».** f1db ha tutte le libere
   principali, tutte le qualifiche e tutti i weekend sprint 2026; noi pubblichiamo libere per 2 gare e
   sprint per 1. Servono due stati distinti: *assente ovunque* è un limite del mondo, *assente da noi*
   è un debito con un rimedio noto.

---

## 10. Il conto

**5 generatori nuovi · 5 pagine nuove · 1 kit condiviso (`stat.mjs`) · 2 test nuovi · la famiglia CSS
`.stat-*` da promuovere · la nav portata a sorgente unica in `statico.py` · 3 patch a generatori esistenti.**

La nav non si tocca a mano in 15 file: il meccanismo per farlo da un punto solo **esiste già** e
funziona — `statico.py` scrive per intero la nav e il footer di `404.html` e dei 12 articoli. Tredici
file su 28 sono già a sorgente unica; sono i 15 restanti il problema, e la risposta è estendere quel
meccanismo, non ripetere la modifica.
