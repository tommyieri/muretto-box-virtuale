# REPORT — lo Scienziato sul 1° piano: la correzione carburante ricostruita dal fondo

Branch `ai-lab/scienziato-fuel` · 21/07/2026 · prereg: [`ai_lab/scienziato/PREREG_scienziato_fuel.md`](ai_lab/scienziato/PREREG_scienziato_fuel.md)
Generatore: `python3 ai_lab/scienziato/run_scienziato.py` → `esito_fuel.json`, `fuel_per_gara.csv`

---

## (A) Fase A — eliminato / retrocesso / conservato

Censimento completo file per file: [REPORT_FASE_A_RIFONDAZIONE.md](REPORT_FASE_A_RIFONDAZIONE.md).
Registro dei numeri retrocessi: [ai_lab/scienziato/RETROCESSIONE.md](ai_lab/scienziato/RETROCESSIONE.md). In sintesi:

**ELIMINATO** — l'unico giudice automatico con autorità finale del laboratorio era il
Distruttore. `ai_lab/distruttore/distruttore.py` non emette più `KILLED`/`SURVIVES`: emette
`proposta` (`FALSIFICA_PROPOSTA` / `NON_FALSIFICATA`) più il campo `decisione = RINVIATA AL
TAVOLO UMANO`. `run_distruttore.py` esce **sempre 0**: nessun exit-code decide più se
un'ipotesi vive. Gli altri `sys.exit`/`process.exit` del repo sono stati classificati uno
per uno: sono test di **codice** (`test_b.mjs`, `test_pit.mjs`, `test_degrado_hook.mjs`,
`check_banda_gancio.mjs`, `verifica_k4_clim.mjs`, `test_guard_travaso.py`,
`test_f1db_checksum.mjs`, `pipeline_smoke_pit.mjs` — dichiarano essi stessi "nessun numero
di dominio") o guardrail di **integrità dati** prima di pubblicare (`gen_censimento_pitloss`,
`gen_pitloss_pergara`, `gen_pitstops`, `gen_mappa_gare`, `gen_schede`, `gen_tele`,
`auto_gara`). Restano: non giudicano ipotesi.

**RETROCESSO** (marcato in testa al file, con rinvio al registro): `ai_lab/auditor/tools.py`
(tutto il residuo vive nello spazio fuel-corretto), `ai_lab/designer/designer.py` (prescrive
`fuel_corrected_pace` come variabile risposta a ogni protocollo generato),
`ai_lab/distruttore/patogeni.py` (il "noto-vero" che tara il giudice è il pit-loss
29,12→20,80; il "noto-falso" parte dal cap ZONE 1,5/STRENGTH 1,0),
`test_identificabilita_degrado.py` (contiene una **seconda** costante carburante, 2,1 s,
incoerente con i 3,0 s del motore). Elencati e non toccati: `engine/engine.py` e
`live/pace_base_live.py` (produzione), i CSV derivati di `data/`, i dossier
`ai_lab/reports/` e la mappa `ai_lab/knowledge/` (condizionati, non falsi).
I branch investigatori: `ai-lab/traffic-investigator` ha codice di scandaglio riusabile ma
ogni sua misura passa da `distruttore.misura_traffico` ⇒ da riverificare;
`ai-lab/tyre-investigator` ha solo una preregistrazione, niente da retrocedere.

**CONSERVATO COME METODO** (e riusato qui): filtri dichiarati e **contati**; guardrail di
rango, mai `pinv` silenziosa; SE cluster-robust per (pilota, stint); mai pooling fra gare;
**blocchi indipendenti** = gare, non osservazioni; bootstrap a blocchi; permutation null;
replica out-of-sample; soglia di aria libera 2,0 s calcolata dal fondo; preregistrazione
scritta prima dei numeri; ogni valore col suo generatore committato. **Nessun output
numerico di questi metodi è stato riusato come acquisito.**

---

## (B1) Il coefficiente ricostruito dal fondo

### B1.1 Che cosa è identificabile (e che cosa no)

I due parametri del kernel (70 kg, 3/70 s/kg) compaiono **solo come prodotto**: dal fondo
non si può separare "quanti kg" da "quanti secondi per kg". La grandezza identificabile è
una sola, ed è quella che ho ricostruito:

> **Δ = lo scivolamento totale del tempo sul giro dal giro 1 al giro N** dovuto al termine
> lineare nel giro-gara. Il kernel afferma Δ = 3,0·(N−1)/N ≈ **3,0 s**, uguale ovunque.

**Limite di identificazione, dichiarato nel prereg §2 prima di eseguire**: dentro uno stint
giro-gara ed età-gomma sono collineari; la separazione viene dalla desincronizzazione **fra
stint**. Ma resta un confondimento che la sola cronometria di gara **non può** sciogliere:
l'evoluzione della pista è anch'essa lineare nel giro e ha lo **stesso segno** del
carburante. Quindi

```
Δ̂ = Δ_carburante + Δ_evoluzione_pista  (+ gestione: lift-and-coast, risparmio gomme)
```

**Δ̂ è un LIMITE SUPERIORE sull'effetto carburante, non una sua misura pura.** Chiunque
dichiari di aver "misurato il fuel" dai soli tempi di gara sta in realtà misurando questa
somma.

### B1.2 Isolamento

Fondo usato: `time`, `sesT`, `pin`/`pout`, `status`. L'**età-gomma è ricostruita dai soli
pit reali** — non ereditata: il controllo contro il campo `life` della fonte dà **80,98 % di
accordo esatto** su 88 440 giri, e gli scarti sono **positivi** (`life` > ricostruita),
esattamente come atteso per chi parte su gomme già usate in qualifica.

Filtri (tutti contati, `esito_fuel.json`): solo verde puro `status=='1'`; via in/out-lap;
via giri cancellati; giro ≥ 2; età ≥ 3; slick; outlier > 1,07× mediana di stint; e
soprattutto **aria libera ≥ 2,0 s dall'auto davanti sullo stesso giro** — obbligatorio, non
opzionale: il traffico **decresce lungo la gara** e imiterebbe il carburante. Gare con
pioggia (`wR`) scartate in blocco. Su 88 440 giri grezzi ne restano **34 mila** puliti; il
filtro traffico da solo ne toglie 24 870.

Stimatore per gara (la gara è il blocco): OLS di `time` su effetti fissi di **pilota**
(mai di stint), livelli di compound, **pendenza di degrado per compound**, e il coefficiente
γ sul giro-gara. Δ = −γ·(N−1). SE cluster-robust per (pilota, stint).

### B1.3 I due regimi, separati

| regime | gare (blocchi) | **Δ ricostruito** | IC95 bootstrap sui blocchi | Δ_kernel |
|---|---|---|---|---|
| **2023-25** | 59 | **+3,151 s** | **[2,919 · 3,396]** | +2,947 s |
| **2026** | 10 | **+2,194 s** | **[1,654 · 3,424]** | +2,948 s |

Il segno è quello atteso (i giri diventano più veloci col serbatoio che si svuota).

**Null di permutazione** (400 repliche; si permutano gli *offset* di stint, tenendo ferme le
età: la desincronizzazione diventa finta). Mediana aggregata del null ≈ 0,00 s in entrambi i
regimi, q95|null| = 0,29 s (2023-25) e 0,46 s (2026), **p = 0,0025** — il minimo ottenibile
con 400 repliche. Il segnale non è un artefatto del disegno.

**I due regimi sono distinguibili?** differenza 2023-25 − 2026 = **+0,957 s**, IC95
**[−0,358 · 1,578]** → **NO**: con 10 sole gare 2026 i dati **non distinguono** i due lati
del confine regolamentare. Non è una prova che siano uguali — è poca potenza. Il briefing
("un coefficiente unico a cavallo del confine è già sospetto") resta **aperto**: il punto
stimato 2026 è più basso di ~30 %, ma l'intervallo non lo separa.

**Robustezze** (tutte dichiarate nel prereg, tutte stabili):

| variante | 2023-25 | 2026 |
|---|---|---|
| base (aria 2,0 s) | +3,151 | +2,194 |
| aria 1,0 s / 3,0 s | +3,134 / +3,127 | +2,342 / +2,118 |
| nessun filtro traffico | +3,184 | +2,643 |
| età dal campo `life` | +3,163 | +2,236 |
| senza livelli di compound | +3,201 | +2,330 |
| con età² | +3,146 | +2,285 |

### B1.4 Emendamento dichiarato

Alla prima esecuzione 4 gare cadevano per rango non pieno: un compound con **1 solo giro**
rende la sua colonna dummy collineare alla propria colonna età. Ho adottato il guardrail
**già dichiarato dal progetto** in `test_identificabilita_degrado.py` (un compound entra con
≥ 3 stint e ≥ 30 giri, altrimenti i suoi giri sono esclusi **esplicitamente e contati**).
Trasparenza: **prima** dell'emendamento 2023-25 = +3,154 su 56 gare, **dopo** = +3,151 su 59.
L'emendamento recupera dati, non sposta la risposta.

---

## (B2) Confronto col mattone esistente — **UGUALE**

Regola scritta nel prereg §5 prima dei numeri: UGUALE ⟺ Δ_kernel dentro l'IC95 sui blocchi.

| regime | kernel | ricostruito | IC95 | scarto | **esito** |
|---|---|---|---|---|---|
| 2023-25 | +2,947 | +3,151 | [2,919 · 3,396] | +0,204 | **UGUALE** |
| 2026 | +2,948 | +2,194 | [1,654 · 3,424] | −0,754 | **UGUALE** |

**Dico esplicito: UGUALE. Il FUEL_COEFF passa da "creduto" a VERIFICATO** — nel senso
preciso, e solo in quello, che segue.

Tre precisazioni che il tavolo deve avere sotto gli occhi:

1. **2023-25 sta dentro, ma vicino al bordo.** Il valore del kernel cade al **3,9°
   percentile** della distribuzione bootstrap (dentro il 95 %, ma di poco). 23 gare su 59
   stanno sotto il kernel, 36 sopra.
2. **2026 sta comodamente dentro, ma per debolezza.** Il kernel cade all'83° percentile con
   un intervallo largo 1,8 s: con 10 gare l'IC95 è talmente ampio che sarebbe stato
   difficile *non* contenere il kernel. È un "uguale" povero di informazione.
3. **La direzione informativa.** Poiché Δ̂ è un limite **superiore** (§B1.1), il risultato
   2023-25 dice: il kernel attribuisce al carburante ~2,95 s dei ~3,15 s totali di
   scivolamento disponibile, lasciandone ~0,2 all'evoluzione pista, alla gestione gomme e a
   tutto il resto. **Il kernel è appoggiato al soffitto.** Non è falsificato — è al limite di
   ciò che il fondo può concedergli.

Poiché l'esito è UGUALE, l'agente **prosegue a B3** come da prereg. Nessun numero è stato
montato, nessuna sostituzione proposta, il kernel di produzione non è stato toccato.

---

## (B3) La mappa dei fronti deboli

### F1 — Il vero punto debole non è il livello: è che il kernel usa **un numero solo**

Il kernel corregge 3,0 s a **ogni** circuito. Dal fondo:

| regime | min | q25 | mediana | q75 | max | IQR | SD |
|---|---|---|---|---|---|---|---|
| 2023-25 | 1,79 | 2,72 | **3,15** | 3,66 | 8,71 | 0,94 | 1,01 |
| 2026 | 0,00 | 1,71 | **2,19** | 3,42 | 4,39 | 1,71 | 1,31 |

E questa dispersione **non è rumore**: su 22 circuiti corsi in ≥ 2 stagioni, la SD *dentro*
lo stesso circuito fra anni è 0,49 s contro 0,73 s *fra* circuiti — **il 69 % della varianza
è spiegato dal circuito**, e si ripete di anno in anno:

```
Austria     2,20 · 1,79 · 2,06        <- sempre basso
Bahrain     3,85 · 3,94 · 4,52        <- sempre alto
Las Vegas   4,16 · 4,10 · 3,57        <- sempre alto
```

**Fronte aperto n.1**: il carburante non è una costante di campionato, è una costante *di
circuito* (kg/giro e sensibilità al peso cambiano con la pista). Il piano che verrà —
passo pulito per stint — erediterà questo errore su ogni circuito lontano dalla mediana.

### F2 — Il confondimento fuel / evoluzione pista non è sciolto

È il limite strutturale (§B1.1) e nessuna quantità di gare di gara lo scioglie: servono dati
**fuori** dalla gara. Per stringerlo servirebbe una fonte dove il carico di carburante e
l'età della pista si muovono in modo indipendente — sessioni di libere/qualifica dello
stesso weekend, dove la pista evolve ma il carico no. Il caso limite si vede a occhio:
**2024 Monaco = +8,71 s**, gara a passo di gestione dopo la ripartenza da bandiera rossa —
lì Δ̂ è quasi tutto lift-and-coast, zero carburante.

### F3 — Il regime 2026 è troppo povero per dire qualcosa

10 gare, IC95 largo 1,8 s (81 % del valore stimato, contro il 15 % del 2023-25). Le due
gare più deboli — Miami (Δ = 0,00, IC che attraversa lo zero) e Monaco (Δ = 1,29, idem) —
non portano informazione. Il confronto fra regimi resta **indeciso**. Servono gare: con il
ritmo attuale, la potenza per distinguere i regimi arriva verso fine stagione.

### F4 — Dove il segnale è sporco

- **Desincronizzazione debole** (|corr(giro, età)| > 0,75): 8 gare su 59 nel 2023-25 (Jeddah,
  Baku, Australia 2023, Cina e Monaco 2024, Bahrain 2025) e 2 su 10 nel 2026 (Cina,
  Giappone). Sono gare a **una sola sosta**, dove tutti si fermano nella stessa finestra:
  poca desincronizzazione ⇒ intervalli larghi (Jeddah arriva a ±1,3 s).
- **Pendenza di degrado negativa** in alcune gare (Austria 2024: −0,145 s/giro): fisicamente
  implausibile. Dove succede, la decomposizione giro/età sta forzando — segnale che il
  modello lineare in età non basta su quelle piste.
- **11 gare perse**: 10 per pioggia, 1 (2025 Belgian) ancora per rango non pieno.
- **Fuori campione: non concludente.** La regola dichiarata (calibrazione su gare pari,
  misura su dispari) dà 2023-25 → ricostruita 0,524 s vs kernel 0,652 s (vince la
  ricostruita); 2026 → 0,989 vs 0,911 (vince il kernel). Ma prima dell'emendamento §B1.4 —
  cioè con 3 gare in meno — il 2023-25 dava il risultato **opposto**. Un test che si ribalta
  per 3 gare non ha potenza: **non lo uso come evidenza in nessuna direzione**, e lo dichiaro
  invece di nasconderlo. Il motivo è chiaro da F1: entrambe le previsioni sono *costanti*, e
  la dispersione fra circuiti è più grande della differenza fra le due costanti.

### Che cosa serve al piano dopo (2° piano: il passo pulito per stint)

1. Un Δ **per circuito**, non uno solo (F1) — il dato per farlo c'è già:
   `ai_lab/scienziato/fuel_per_gara.csv`, 69 gare col loro intervallo.
2. Una fonte fuori-gara per separare carburante da evoluzione pista (F2) — senza, ogni
   numero del 1° piano resta un limite superiore.
3. Gare 2026 (F3) — solo tempo.

Nessuna di queste è stata montata. Sono il fronte dichiarato, e lo decide il tavolo umano.

---

## Vincoli rispettati

Fondo unica fonte · ogni valore col suo generatore committato (`run_scienziato.py` →
`fuel_per_gara.csv` + `esito_fuel.json`) · blocchi contati, non osservazioni · regimi mai
mescolati · kernel di produzione non toccato · nessun push, nessuna PR, nessun merge.
