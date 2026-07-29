# NOTA — `demo/data/pitloss.json`: semantica per-gara (dal 14/07/2026, Sessione FF5)

## Cosa significa il valore, da FF5 in poi

`pitloss.json` è il pit-loss **per-gara** della demo. Il suo significato è cambiato con FF5:

- **prima**: valore travasato allo staging da `pit_loss_circuito_f1db.csv` (durata f1db, poi
  per Silverstone il tipico misurato) — una grandezza di *circuito* usata come se fosse della gara;
- **ora**: dove misurato e attivato, è il **pit-loss REALIZZATO di quella gara** (metodo
  engine-ready a giro intero, generatore `gen_pitloss_pergara.py`), cioè la grandezza che serve
  alla demo, che rigioca gare specifiche: "se pitti al giro X, dove rientri **in questa gara**".

Perché due grandezze (decisione PO dal quadro del 14/07): il **tipico del circuito** serve allo
staging delle gare future e vive nel CSV; il **realizzato della gara** serve al replay e vive
qui. La prova che le distingue: NOR L15 al Canada — reale P14; il motore predice P14 col
realizzato (24,24) e P11 col tipico (18,96/19,71).

## Stato dei valori (dopo il checkpoint FF5 del 14/07/2026)

| gara | valore | semantica |
|---|---:|---|
| **Miami** | **20,11** | **realizzato FF5, attivato al checkpoint** (era 22,63; ATT6: 6 migliorati sensibili, 0 peggiorati; golden PIA P14→P12) |
| Gran Bretagna | 20,80 | tipico attivato (PR #26); realizzato 20,43 ⇒ GIÀ CALIBRATA (Δ 0,37) |
| Canada | 24,37 | durata f1db; realizzato 24,24 ⇒ GIÀ CALIBRATA per coincidenza (Δ 0,13) |
| Austria | 21,63 | durata f1db; realizzato 21,98 ⇒ GIÀ CALIBRATA (Δ 0,35) |
| Australia | 18,15 | durata f1db; realizzato 24,10 **ma NON attivato**: gara SC-dominata (8/9 casi ATT6 sotto SC) e dispersa (IQR 10,17) — nessun valore unico la serve; il −5,95 resta documentato |
| Monaco | 24,80 | durata f1db; realizzato 22,61 **ma NON attivato**: la coda al rientro (proprietà permanente, FF3) rende il valore alto un cuscinetto empiricamente migliore (ATT6 3/3 peggiorati) |
| Spagna | 22,38 | durata f1db; realizzato 24,59 **ma NON attivato**: ai ranghi 4 peggiorati vs 1 migliorato (±1), nessuna evidenza a favore |
| Cina | 22,97 | durata f1db; gara 2026 NON MISURABILE (n=4, due stop rotti) |
| Giappone | 23,72 | durata f1db; gara 2026 NON MISURABILE (n=4; Δ stimato comunque 0,93) |
| Belgio | 23,36 | tipico travasato allo staging; realizzato **22,50** (n=8, IQR 5,17, misurato il 22/07) ⇒ **GIÀ CALIBRATA** (Δ 0,86 ≤ 1,0): non si tocca. Vedi sotto: due domande diverse, stessa conclusione |

Le misure non attivate restano agli atti in `data/pitloss_realizzato_2026.csv`: non sono
sbagliate — sono giuste per una grandezza che il rango al rientro non premia in quelle gare.

### Belgio: perché la riga mancava, e perché GIÀ CALIBRATA non contraddice il NON GIUDICABILE

La riga di Spa è rimasta fuori dal CSV dal 19/07 al 22/07 per un **motivo meccanico, non per
un verdetto**: la lista `DEMO` di `gen_pitloss_pergara.py` era cablata sulle 9 gare del 14/07
(anomalia già annotata in `REPORT_SPA_DOMENICA.md` punto 2), e `events_for` (FF3) scarta le
gare con data ≥ `TODAY`, che in FF3 è **inciso al 14/07/2026** — con quel valore Spa (19/07)
restava invisibile per sempre, non solo il giorno della gara. Dal 22/07 il perimetro è
**derivato da `data/gare_registro.json`** e la frontiera è la data odierna reale: l'11ª gara
entrerà da sola. Un'assenza silenziosa è peggio di un numero dichiarato.

Le due domande su Spa sono **diverse** e vanno tenute separate:

| domanda | gate | esito 19–22/07 |
|---|---|---|
| la gara 2026 può dire quanto vale il **TIPICO del circuito**? | GATE A / tipicità | **NON GIUDICABILE** — scarto 3,92 s dal grappolo (18,58, 6 blocchi); gara SC-dominata, 18 stop su 30 assorbiti dalle neutralizzazioni, n=8 residuo |
| quanto è costato **REALMENTE** pittare in quella gara, per il replay demo? | FF5 / realizzato | **22,50 s** (n=8) ⇒ **GIÀ CALIBRATA** (produzione 23,36, Δ 0,86) |

Non si contraddicono: FF5 dichiara la tipicità **informativa** e non gate proprio perché
giudicherebbe il candidato sbagliato. E le due strade **convergono sulla stessa azione**:
Spa resta a **23,36** in entrambe le fonti. Il candidato tipico **18,58 aspetta la prossima
Spa**, come deciso il 19/07.

Cautela dichiarata sul 22,50: n=8 e IQR 5,17 su due gruppi separati (4 stop 18,5–20,7, poi
4 stop 24,3–32,3) — la mediana cade nel gradino fra i due. È un numero **misurato**, non un
numero **robusto**: la classe GIÀ CALIBRATA qui significa "non c'è motivo di toccare", non
"il valore è confermato".

## REGOLA SOSTITUITA (14/07/2026)

La vecchia regola "pitloss.json e pit_loss_circuito_f1db.csv sono due fonti dello stesso
valore: cambiarle entrambe" **NON VALE PIÙ**. Nel protocollo per-gara sono **DUE GRANDEZZE
DIVERSE**: il CSV è il **TIPICO di circuito**, il JSON è il **valore IN USO per quella gara**
(realizzato dove misurato). **NON si allineano: allinearli distruggerebbe il realizzato.**

Dove la vecchia regola è scritta (documenti storici, contenuto preservato, non riscritti):
- `NOTA_SILVERSTONE.md` § "Le due fonti cambiate (coerentemente)" — era corretta ALLORA
  (pre-architettura per-gara): banner di rimando in testa a quel paragrafo.
- Messaggi di commit e PR delle attivazioni Silverstone/Montreal — immutabili per natura.
Il guard in `pubblica()` (quando verrà implementato — vedi avvertenza sotto) la farà
rispettare nel codice; fino ad allora la difesa è solo procedurale.

## Il protocollo ricorrente per le gare future

1. **Allo staging** (`pipeline_gara.py`, invariato): la gara nuova riceve il **tipico** dal CSV.
2. **Dopo la gara**: si misura il realizzato (`gen_pitloss_pergara.py`, metodo FF4/FF5) e lo si
   porta al checkpoint col protocollo FF5 — riproducibilità, classi (n≥5; |Δ|>1,0), tabella
   golden PRIMA, ATT6 v2 con la regola del caso sensibile, checkpoint PO, attivazione col tag.
3. **Prima applicazione: Spa**, dopo il GP del 19/07/2026 — fatta il 22/07 (esito: GIÀ
   CALIBRATA, niente da attivare; vedi sopra).

Dal 22/07 il passo 2 **non richiede più di aggiungere la gara a mano**: il perimetro di
`gen_pitloss_pergara.py` è derivato da `data/gare_registro.json`, quindi la gara pubblicata
entra da sé. Il generatore si ferma da solo (STOP, senza riscrivere il CSV) se una riga già
committata non si riproduce nella **misura** — circuito, n stop, realizzato entro la
tolleranza pre-registrata di 0,2 s. Le colonne `produzione`/`delta`/`classe` sono invece una
**fotografia di `demo/data/pitloss.json`**: si muovono quando la produzione si muove (è
successo a Miami, 22,63 → 20,11 dopo l'attivazione FF5), e il generatore lo stampa come
`PRIMA → ADESSO` con la causa. Se la classe si muovesse a produzione ferma, sarebbe deriva
e il generatore si fermerebbe.

Vincolo temporale da conoscere: la gara entra nel CSV **dal giorno dopo**, non il giorno
stesso (`events_for` scarta le gare con data ≥ oggi, e i dati FastF1 della gara odierna sono
comunque in assestamento). Rieseguire il generatore il lunedì è idempotente.

Avvertenza di metodo, dichiarata in FF5 e non ancora risolta: ATT6 v2 conta anche i pit sotto
SC, dove il parametro verde non si applica (il modulo stesso sopprime i gap lì). Nelle gare
SC-dominate questo inquina il conteggio dei sensibili in entrambe le direzioni. Etichettare i
casi SC come non-informativi è un cambio di metodo: **da pre-registrare** prima di usarlo.

Rollback di FF5: `git checkout pre-attivazione-ff5-2026-07-14 -- demo/data/pitloss.json demo/golden_pit.json`
