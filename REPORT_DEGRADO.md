# REPORT — il degrado, giudicato su "batte la strategia reale"

Branch `ai-lab/scienziato-degrado` · 21/07/2026 · prereg scritto prima dei numeri:
[`ai_lab/scienziato/PREREG_degrado.md`](ai_lab/scienziato/PREREG_degrado.md)
Generatori: `run_degrado.py` → `esito_degrado.json`, `degrado_per_gara.csv` ·
`test_degrado_aggancio.mjs`

---

## (6) La frase onesta, per prima

> **Il degrado lineare NON supera l'asticella che avevo dichiarato — e il termine di C3 non
> la colma. Ma il vincolo che morde non è la forma del degrado: è che il modello riproduce
> una gara intera solo entro ±11,7 s, e su quel rumore la domanda strategica non si decide.**

E un secondo fatto, forse più grosso del primo: **la prima ipotesi portata dal carburante è
smentita. Il degrado NON è per-circuito** — 0 circuiti su 8 passano lo stesso metro a due
condizioni che sul carburante aveva promosso Austria e Bahrain.

---

## (1) Il carburante congelato come input

Entra come dichiarato, letto dagli artefatti già committati (nessun numero riscritto a mano):

| | |
|---|---|
| per-circuito (solo i PER-CIRCUITO VERI) | **Austria 2,018 s** · **Bahrain 4,122 s** |
| globale regime a effetto suolo | **3,151 s** |
| globale 2026 | **2,194 s** — numero unico, perché con una gara per circuito il per-circuito non è calcolabile |

Forma: toglie `Δ·(N−L)/(N−1)` al giro L. Come previsto nel prereg §0, le pendenze di degrado
sono quasi insensibili a questa scelta (il termine lineare nel giro assorbe il residuo); il
carburante pesa invece sui **totali** del controfattuale, dove niente lo assorbe.

### Le pendenze ricostruite (mediana cross-gara, s/giro di vita gomma)

| mescola | 2022-25 | 2026 |
|---|---|---|
| SOFT | +0,0617 (10 gare) | +0,0541 (5) |
| MEDIUM | +0,0576 (44) | +0,0441 (9) |
| HARD | +0,0476 (42) | +0,0398 (9) |

**L'ordinamento fisico SOFT > MEDIUM > HARD esce da solo, in entrambi i regimi**, senza che
nessun vincolo lo imponga. E il 2026 degrada meno del regime precedente su tutte e tre le
mescole. Sono i due controlli di sanità che il modello passa senza essere stato aiutato.

---

## (2) Aria libera — `G*` derivata dai dati

Il modello è stimato **solo su giri con gap davanti > 5 s**; poi i residui si misurano su
**tutti** i giri puliti. Nessuna circolarità.

| gap davanti | residuo mediano | IC95 (bootstrap sulle gare) | |
|---|---|---|---|
| 0,0–0,5 s | **+0,580** | [0,463 · 0,697] | traffico visibile |
| 0,5–1,0 s | +0,266 | [0,156 · 0,385] | traffico visibile |
| 1,0–1,5 s | +0,140 | [0,070 · 0,236] | traffico visibile |
| **1,5–2,0 s** | +0,077 | **[−0,027 · 0,158]** | **contiene zero → G\*** |
| 2,0–2,5 s | +0,026 | [−0,043 · 0,106] | contiene zero |
| 2,5–3,0 s | −0,014 | [−0,084 · 0,036] | contiene zero |
| 4,0–5,0 s | −0,085 | [−0,108 · −0,055] | (sotto zero) |
| > 8 s | −0,067 | [−0,078 · −0,049] | (sotto zero) |

**G\* = 1,5 s**, per la regola dichiarata. Il costo del traffico decade in modo pulito e
monotono — mezzo secondo a ruota, un decimo e mezzo a 1,5 s.

**Caveat che devo dichiarare**: le fasce oltre i 4 s hanno residuo **significativamente
sotto zero** (−0,05/−0,085). Non è traffico: è un piccolo bias di livello del modello alle
grandi distanze. Quindi la regola "prima fascia che contiene zero" sta leggendo in parte
quel bias, e `G*` = 1,5 s è probabilmente **permissiva**: la curva suggerisce che il
traffico si vede ancora fino a ~2,5 s. **Non ho cambiato la regola in corsa** — era
dichiarata, l'ho applicata, e segnalo che ammette qualche caso lievemente contaminato.

**Quanti casi restano in aria libera: 33**, su 8 gare. Ecco dove sono finiti gli altri:

| esclusi | quanti |
|---|---|
| giri mancanti (ritiri, buchi) | 62 |
| **cancello di calibrazione** (il modello non riproduce la gara reale entro tol) | 45 |
| mescola SOFT senza ρ stimabile | 10 |
| **rientro in traffico** (il filtro richiesto da Tommi) | **9** |

Il traffico esclude solo 9 casi — perché `G*` è piccola. **Il vero collo di bottiglia non è
il traffico: è il cancello di calibrazione**, che butta 45 casi.

---

## (3) C1 — la X grezza

| regime | X | gare | tol derivata | margine mediano vittorie |
|---|---|---|---|---|
| **2022-25** | **11/33 = 33,3 %** | 8 | 11,73 s | 13,81 s (servirebbe ≥ 23,46) |
| **2026** | **non misurabile** | 0 | — | — |

### Il 2026 non è misurabile, e la ragione è strutturale

Censimento delle neutralizzazioni (SC/VSC, decodifica committata):

```
2022-25 :  21 gare PULITE  ·  39 neutralizzate  ·  10 di pioggia
2026    :   0 gare PULITE  ·  10 neutralizzate
```

**Tutte e dieci le gare 2026 hanno almeno un giro sotto SC o VSC.** Col filtro dichiarato —
e quel filtro serve: sotto safety car il tempo reale contiene secondi che nessun degrado può
spiegare — il regime 2026 non ha un solo caso valutabile. Non è un difetto del modello: è il
calendario. Va detto, non aggirato.

### Che cosa misura davvero la X (e dove ho sbagliato l'asticella)

Per costruzione `sim(ottima) ≤ sim(reale)`, e il cancello di calibrazione impone
`|sim(reale) − reale| ≤ tol`. Quindi per vincere l'ottima deve battere la strategia reale di
**più di 2·tol ≈ 23 s**. La X **non è l'accuratezza del modello**: è *«quanto spesso esisteva
un guadagno strategico di almeno 23 secondi»*. Un pilota che ha già fatto la strategia giusta
non viene battuto — ed è giusto così.

Con questa lettura, **la soglia del 60 % che ho dichiarato era mal posta**: pretendeva che in
6 gare su 10 il pilota avesse lasciato mezzo minuto sul tavolo. L'ho dichiarata prima di
misurare e **non l'ho toccata**; la porto al tavolo come criterio da ridiscutere, non come
verdetto sul degrado.

**Criterio di stop, applicato come dichiarato**: casi OK (33 ≥ 30, su 8 ≥ 8 gare) · nettezza
NON raggiunta → **C3 serve davvero**.

---

## (4) C2 — dove fallisce, e la prima ipotesi **smentita**

### I cluster

| per circuito | | per mescola dell'ottima | | per numero di soste |  |
|---|---|---|---|---|---|
| Singapore | 3/3 | MEDIUM+SOFT | **3/3** | 1 sosta | 7/22 |
| Hungarian | 2/5 | HARD+MEDIUM | **8/30** | 2 soste | 4/11 |
| United States | 2/6 | | | | |
| Italian | 2/7 | | | | |
| Abu Dhabi | 1/4 | | | | |
| Miami | 1/7 | | | | |
| Dutch | 0/1 | | | | |

Il segnale più netto: **il modello vince quando propone MEDIUM+SOFT (3/3) e fatica quando
propone HARD+MEDIUM (8/30)**. Cioè vince quando dice «gomma più morbida, stint più corti» e
perde quando dice «tira la dura». Coerente con un degrado lineare che **sottostima il crollo
di fine stint**: se il degrado accelerasse, la HARD lunga sarebbe meno conveniente di quanto
il modello creda. Ed è esattamente il termine che C3 andava a testare.

### Il degrado è per-circuito? **No.**

Metro a due condizioni, con la soglia **riderivata per questo fenomeno** (la 0,869 s del
carburante non gli appartiene) usando la stessa procedura sigillata: **soglia degrado =
0,0293 s/giro** al 5 % di falsi positivi congiunti.

| circuito | ρ_MEDIUM per stagione | lato | D | esito |
|---|---|---|---|---|
| Saudi Arabian | −0,025 · 0,040 · 0,077 | oscilla | 0,0297 | NON PASSA |
| Italian | 0,061 · 0,035 · 0,027 | oscilla | 0,0283 | NON PASSA |
| Abu Dhabi | 0,080 · 0,077 · 0,095 | **sopra** | 0,0225 | NON PASSA (distanza) |
| Mexico City | 0,027 · 0,088 · 0,040 | oscilla | 0,0150 | NON PASSA |
| Austrian | 0,057 · 0,077 · 0,058 | **sopra** | 0,0080 | NON PASSA (distanza) |
| Hungarian · Japanese · United States | — | oscilla | ≤0,006 | NON PASSA |

> **PER-CIRCUITO VERI sul degrado: 0 su 8.**

Solo due circuiti tengono il segno, e nessuno dei due è abbastanza lontano dal globale.
**L'ipotesi che il degrado fosse per-circuito «come e più del carburante» è smentita dai
dati**, con lo stesso metro che sul carburante aveva promosso Austria e Bahrain. Il degrado
si comporta come una proprietà **della mescola**, non della pista — almeno alla risoluzione
che 8 circuiti con 3 stagioni permettono.

---

## (5) C3 — il termine non-lineare: montato, misurato, **scartato**

Termine scelto: **η² (degrado che accelera con la vita gomma)** — suggerito direttamente dal
cluster HARD+MEDIUM di C2.

```
X_vecchia (lineare)   : 11/33 = 33,3 %   tol 11,73 s
X_nuova   (con eta^2) :  9/30 = 30,0 %   tol 10,92 s
coefficiente eta^2, mediana sulle gare: +0,00010 s/giro^2
```

**Non migliora.** Il coefficiente è minuscolo (su uno stint di 25 giri vale 0,06 s al giro
finale: dentro il rumore) e la X peggiora leggermente. Dichiarato e **scartato**: nessun
secondo tentativo in questa sessione, com'era scritto nel prereg §6.

Nota onesta: `tol` scende (11,73 → 10,92 s), cioè il modello riproduce le gare *un po'
meglio*, ma non abbastanza da spostare la domanda strategica. È un'altra conferma che il
vincolo è il rumore complessivo, non la forma della curva.

---

## (6) Stato del golden dopo aver toccato il kernel

L'aggancio è in `demo/engine.mjs`: parametro `degrado` **opzionale**. Assente ⇒ bit-identico.
Forma **incrementale** `p + rate·(età − età₀)`, che non ri-conta il degrado già dentro il
passo base misurato — era il difetto del gancio v1 (`rate·(età−1)` su un `pace_base` già
degradato).

```
node test_b.mjs      => PASS  449/449 sotto 1e-9
node demo/test_pit.mjs => PASS  11/11
node test_degrado_aggancio.mjs:
  PASS  SPENTO = BIT-IDENTICO
  PASS  RATE ZERO = BIT-IDENTICO
  PASS  RATE 0.05 = +0.750s ESATTI su 6 giri
```

**Il golden non si è mosso di un ulp.** Il kernel di produzione si comporta oggi
esattamente come ieri; l'aggancio esiste ma è spento, e accenderlo lo decide il tavolo.

---

## Che cosa va al tavolo

1. **La X: 11/33 (33,3 %) in aria libera, su 8 gare, regime a effetto suolo.** Sotto la
   regola d'ingaggio, questo è territorio «non si tocca» — ma leggendo *che cosa* misura la
   X (§3), la lettura giusta è: in un terzo dei casi puliti esisteva una strategia migliore
   di almeno 23 secondi, e il modello l'ha trovata.
2. **Il degrado non è per-circuito** (0/8). L'analogia col carburante non regge: si può
   smettere di cercare lì.
3. **Il 2026 è cieco a questo metro**: 10 gare su 10 neutralizzate. Serve una decisione del
   tavolo su come trattare le gare con SC — oggi la scelta dichiarata (escluderle) costa
   l'intero regime nuovo.
4. **Il collo di bottiglia è `tol` = 11,7 s**, non la forma del degrado: 45 casi su 33
   ammessi cadono già al cancello di calibrazione. Il prossimo mattone utile non è un
   termine in più sul degrado — è capire da dove viene quel rumore di gara.

Kernel di produzione intatto (golden lo dimostra), niente montato, nessun push.
