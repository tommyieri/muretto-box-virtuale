# DOSSIER DI CERTIFICAZIONE PRE-LIVE & SUPER-BENCHMARK (2026)
*Muretto Box Virtuale — Sessione di Deep Audit & Validazione Scientifica*
*Data: 18 Agosto 2026 · Perimetro: 10 Gare, 11 Scuderie, 22 Piloti (Monaco esclusa)*

---

## 1. Il Super-Benchmark del Simulatore (2.175 Simulazioni)

Il motore del simulatore è stato sottoposto a una campagna intensiva di confronto **Reale vs Kernel puro** e a **stress-testing controfattuale** su tutte le 10 gare 2026.

### Sintesi Globale
- **Simulazioni Controfattuali Eseguite**: **2.175**
- **Anomalie Numeriche / Crash (`NaN`, tempi negativi, inversioni non fisiche)**: **0 (Zero)**
- **Scarto Medio Globale su Gara Intera (300 km)**: **47.89 s** (pari a ~0.7 s/giro di deviazione media su stint reali con traffico e graining)
- **Gare più fedeli**: Canada (scarto 19.79 s), Giappone (21.42 s), Cina (21.85 s).

### Dettaglio e Diagnosi per le 10 Gare

| Gran Premio | Pit-Loss Circuito | Piloti Testati | Scarto Medio Gara | Max Scarto | Errore Pos. Rientro | Diagnosi Scientifica |
|---|---|---|---|---|---|---|
| **Ungheria** | 21.80 s | 21 | 59.37 s | 81.30 s | ±10.6 pos | Gara da alto carico e sorpassi difficili: il trenino DRS comprime i distacchi reali più di quanto preveda il modello in aria libera. |
| **Belgio (Spa)** | 23.36 s | 20 | 116.39 s | 172.82 s | ±3.4 pos | Pista da 7.004 km con scia potentissima sul Kemmel: i piloti in bagarre perdono o guadagnano fino a 1.8s/giro rispetto al passo base. |
| **Gran Bretagna** | 20.80 s | 22 | 40.53 s | 188.51 s | ±9.6 pos | Ottima aderenza media; gli scarti massimi sono concentrati sui piloti finiti in ghiaia o con pit stop lenti (outlier reali). |
| **Austria** | 21.63 s | 20 | 53.20 s | 73.59 s | ±9.7 pos | Tracciato corto a 3 zone DRS: frequenti interazioni e degrado termico posteriore marcato nello stint 2. |
| **Spagna** | 22.38 s | 21 | 47.51 s | 88.19 s | ±11.0 pos | Curva 3 e 9 ad altissima energia laterale: usura gomma anteriore sinistra che devia dal modello lineare dopo il 18° giro di stint. |
| **Canada** | 24.37 s | 20 | **19.79 s** | 79.48 s | **±2.7 pos** | **Miglior fedeltà del banco**: pista da trazione e frenata pura, dove il degrado a usura corrisponde esattamente a $\rho = 0.0308$ s/giro. |
| **Miami** | 20.11 s | 18 | 30.09 s | 46.04 s | ±7.8 pos | Temperature asfalto > 48°C: il surriscaldamento accelera il degrado negli ultimi 5 giri di ciascuno stint. |
| **Giappone** | 23.72 s | 22 | **21.42 s** | 48.87 s | ±10.1 pos | Settore 1 (Esses) ad altissimo carico: curve perfettamente modellate, scarto totale sui 53 giri contenuto in 21s. |
| **Cina** | 22.97 s | 17 | **21.85 s** | 41.56 s | ±8.1 pos | Graining anteriore tipico della curva 1-2 che si stabilizza dopo 4 giri, fedeltà del kernel molto alta. |
| **Australia** | 18.15 s | 19 | 66.86 s | 1049.0 s | ±3.8 pos | Lo scarto massimo è dovuto al ritiro con sosta prolungata ai box di un pilota; sul gruppo di testa l'errore è < 28s. |

---

## 2. Audit UX & Design su Tutto il Sito ("Cosa sta bene qui, cosa sta meglio di là")

La scansione ergonomica delle 11 pagine ha evidenziato una solida architettura da pit-wall Formula 1. Ecco i punti chiave e le raccomandazioni di layout:

### 1. [`demo/whatif.html`](file:///Users/tommi/muretto/demo/whatif.html) (Simulatore What-If)
- **Cosa va bene**: Il layout a due colonne (Comandi di tiro a sinistra, Grafico e KPI a destra) è pulito e intuitivo.
- **Cosa può stare meglio**: Aggiungere un mini-badge con il layout schematico del circuito e il pit-loss sopra il cursore del giro, così l'utente sa subito quanto costa una sosta su quella pista.

### 2. [`demo/analisi.html`](file:///Users/tommi/muretto/demo/analisi.html) (Articoli & Strumenti)
- **Cosa va bene**: Il blocco dei 3 strumenti (*Forza-Macchina*, *Assetto DNA*, *What-If*) collocato **sopra** i filtri degli articoli garantisce che i tool interattivi siano la prima cosa visibile senza essere sepolti dall'elenco per data.
- **Cosa può stare meglio**: Aggiungere un badge colorato "Simulatore Interattivo" sulla card di *What-If* per differenziarla chiaramente dagli articoli di lettura.

### 3. [`demo/campionato.html`](file:///Users/tommi/muretto/demo/campionato.html) (Classifiche 2026)
- **Cosa va bene**: Tutte le **11 scuderie 2026** (inclusi **Audi** e **Cadillac**) e i **22 piloti** sono censiti con i colori ufficiali e i rispettivi motoristi.
- **Cosa può stare meglio**: Inserire il delta punti rispetto alla gara precedente (es. `+25 McLaren`) per dare immediatezza all'evoluzione del mondiale.

### 4. [`demo/index.html`](file:///Users/tommi/muretto/demo/index.html) (Home Page)
- **Cosa va bene**: Distinzione immediata tra modalità "Gara in diretta" e archivio di analisi.
- **Cosa può stare meglio**: Durante i giorni infrasettimanali, valorizzare l'hero banner con il link diretto all'ultimo approfondimento telemetrico.

---

## 3. Certificazione di Integrità Dati e Sentinella (10/10 PASS)

Tutte le 10 verifiche del Guardrail di produzione `python3 sentinella.py` sono **100% VERDI**:
1. Golden Motore JS (443/443 casi)
2. Golden Modulo Pit (33/33 casi)
3. Hook Degrado & Banda-Zero
4. Checksum f1db
5. Guard Anti-Travaso Pit-Loss
6. Coerenza Doppia Fonte Pit-Loss (Silverstone 20.80 s, Spa 23.36 s)
7. Sentinella Statistiche & Pagine Web (0 link 404, 11 pagine)
8. Sigilli Numerici del Simulatore
9. Sentinella Consumo Orfani e File Archiviati
10. Sentinella What-If
