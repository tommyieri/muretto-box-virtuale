# ESITO — il rodaggio della gomma nuova

*01/08/2026. Voce 1 di `PIANO_CORREZIONE.md`, eseguita sotto `PREREG_rodaggio.md`,
scritta prima della stima e prima del codice.*

**Verdetto: il termine PASSA il cancello e va in produzione, con una regressione
dichiarata e lasciata rossa.**

---

## Cosa è stato acceso

```
t(pilota, giro) = base(pilota) + δ·(giro − 1) + ρ·età − c·exp(−età/τ)
c = 0,67 s        τ = 4,75 giri
```

Sottratto in `stimaBasi`, ri-aggiunto in `creaPasso`, nella stessa modifica
(`simulatore/engine/passo_v2.mjs`). Parametri in `modello_v2.json` con targhetta,
`attivo: true`, e un interruttore che li spegne senza toccare codice.

**Stima** (`stima_rodaggio.mjs`): 6.575 giri verdi in aria libera (gap > 2,0 s o
primo) sulle 11 gare, `δ₇₀` e `ρ` cablati e non ri-stimati, perdita L1 su griglia
dichiarata, base = mediana per (gara, pilota) ricalcolata a ogni `(c, τ)`. Il
minimo non cade sul bordo. Il residuo per fascia di età si appiattisce come deve:

| età | 2-4 | 5-8 | 9-12 | 13-20 | 21+ |
|---|---|---|---|---|---|
| prima | −0,226 | −0,103 | +0,007 | +0,060 | 0,000 |
| dopo | +0,000 | −0,025 | +0,002 | +0,020 | −0,018 |

## Il cancello, in lettura primaria leave-one-race-out

Ogni gara valutata coi `(c, τ)` stimati sulle **altre dieci**. Lettura B2, 223 casi
appaiati, 0 casi con mutezza diversa fra le due varianti.

| | condizione | soglia | misurato | |
|---|---|---|---|---|
| C1 | mediana \|err\| ≤ | 1,0 | 1,0 | PASSA |
| C2 | esatti ≥ | 45,29% | **46,64%** | PASSA |
| C3 | troppo indietro < | 47,53% | **45,74%** | PASSA |
| C4 | \|bias medio\| < | 0,8251 | **0,7713** | PASSA |

Dentro campione dà gli **stessi identici numeri**: la posizione è un rango intero e
lo scarto fra i LORO (`c` da 0,48 a 0,84, `τ` da 3,25 a 5,50) non basta quasi mai a
ribaltarne uno. Il leave-one-race-out qui non è severo — è quasi un alias — e va
detto.

**Il margine è piccolo.** 10 casi migliorano, 2 peggiorano, 211 sono identici
(test dei segni p = 0,0386). Δesatti +1,35 punti, IC95 a blocchi=gare
[0,00; +3,32] — tocca lo zero. Δmedia\|err\| −0,0448, IC95 [−0,0922; −0,0107],
che lo zero non lo tocca. Due gare su undici cambiano quota di esatti (Austria
+3,5, Giappone +9,1); nessuna peggiora.

## La regressione, dichiarata e lasciata rossa

`bias piatto` — `max|bias| − min|bias|` fra gli orizzonti giudicabili — passa da
**0,0041 a 0,1030** contro una soglia pre-registrata di **0,1**. Fallisce di tre
millesimi.

| orizzonte | spento | acceso |
|---|---|---|
| H = 5 (11 gare) | +0,0728 | +0,1237 |
| H = 10 (8 gare) | −0,0770 | +0,0207 |
| H = 20 (3, non giudicabile) | −0,2928 | −0,2089 |

**Il meccanismo, non una scusa.** La base ora sottrae `w`, quindi sale di circa
0,05 s: diventa il passo su gomma matura. Nella misura del bias si proietta
**senza soste**, quindi le età solo crescono e `|w|` solo cala — il motore dice
«i tuoi giri veloci erano gomma fresca, il futuro è più lento». È esattamente la
proprietà che fa migliorare M1, dove invece io riparto da età 1 e i rivali no.
Non si può avere l'una senza l'altra.

Va anche detto che spento vince quel confronto **grazie al segno**: +0,073 e
−0,077 hanno moduli quasi identici e differenza 0,004. Acceso sono +0,124 e
+0,021, entrambi positivi, decrescenti, ed entrambi ben sotto il cancello sul
singolo orizzonte (0,17). Che `max|bias| − min|bias|` sia il metro giusto è una
domanda aperta — ma **non si riscrive un cancello dopo averne visto l'esito**
(E08). La soglia non è stata toccata, l'asserzione resta rossa in `s15`, e chi
vorrà cambiarla lo farà con una prereg nuova.

**Decisione del PO, 01/08:** va in produzione la miglior versione riproducibile,
non quella perfetta. Acceso, con la regressione visibile.

## Le condizioni di NULL, tutte verificate e tutte libere

- minimo **non** sul bordo della griglia;
- `τ` leave-one-race-out da 3,25 a 5,50 → fattore **1,69** (NULL sopra 3);
- `s11`/`s14` (invarianza al troncamento) e `s12` (ottimo analitico) verdi, senza
  che nessuna soglia sia stata toccata;
- **il giro raccomandato non si sposta in nessuna curva**: 0 su 1.505, su tutte e
  11 le gare (`sonda_curva_rodaggio.mjs`). La soglia di NULL era 10%.

Quest'ultima è la conferma sul prodotto di ciò che `PREREG_rodaggio.md` §4 aveva
dimostrato prima di guardare i dati: l'ottimo a una sosta cade dove l'età al pit
eguaglia l'età alla bandiera (`a+k = R−k`), e lì `w(a+k) − w(R−k) = 0` **per
qualunque `w` additiva sull'età**. La derivata seconda passa da `2ρ` a
`2ρ + (c/τ)[…]`: il minimo diventa più stretto, non più piatto.

**Quindi il rischio E01 scritto nel piano non esisteva**, ed è utile dirlo per il
prossimo: «con τ troppo grande il termine degenera in un vantaggio quasi-perpetuo,
cioè fermati subito» è falso per costruzione. `s12` lo prova ora anche con
`τ = 200`. Ciò che il rodaggio cambia è la **posizione prevista al rientro a giro
di sosta fisso**, non il punto in cui conviene fermarsi.

## Effetti collaterali misurati

**Il banco misurava un motore che non esiste.** `misure/rientro.mjs`,
`misure/bias.mjs`, `misure/g0.mjs` e `misure_congelamento.mjs` chiamano
`creaPasso`/`stimaBasi` direttamente, senza passare dal costruttore: col termine
acceso in produzione avrebbero continuato a misurare il passo senza rodaggio. È la
forma silenziosa di E12, ed è stata chiusa facendo viaggiare `rodaggio` insieme a
`ρ` e `δ₇₀` in `misura_tutto.mjs`. **`replay_g5.mjs` è stato lasciato fuori
deliberatamente**: è un esperimento chiuso con esito pre-registrato, e cambiargli
la fisica sotto sarebbe riscriverne il risultato (E22). Va rifatto con una prereg
sua, non con un edit.

**La banda di rientro è stata ricalibrata** sul motore nuovo
(`scrivi_banda_rientro.mjs`): lasciarla tarata su quello vecchio sarebbe stato E22
alla lettera. Tutto migliora, poco:

| | spento | acceso |
|---|---|---|
| D1 VERDE, fuori campione | 87,9% | 88,2% |
| **D1 NEUTRA, fuori campione** | **77,4%** | **78,6%** |
| banda complessiva | 85,4% | 85,9% |
| rientro NEUTRA, entro ±1 | 58,3% | 59,5% |
| rientro SOSTE_RIVALI, entro ±1 | 74,5% | 75,2% |

## La risposta alla voce 3, che il PO aveva rimandato proprio a qui

Il PO aveva scelto **(c) aspettare la voce 1**, perché era l'unica strada che
poteva spostare D1 togliendo il bias invece di allargare la banda. Ora è misurato:
**il rodaggio sposta D1 NEUTRA di +1,2 punti, da 77,4% a 78,6%. Non basta.** La
soglia pre-registrata è 80% e resta rossa.

La voce 3 torna quindi al PO con una strada in meno: restano **(a) ri-registrare
il livello per NEUTRA sul misurato**, dichiarando che 0,8 non è attingibile con
l'informazione disponibile al congelamento, e **(b) non pubblicare banda sotto
neutralizzazione**. L'unico candidato rimasto che potrebbe spostarla davvero è il
pacchetto neutralizzazione (voce 2), che è dove quattro metriche su cinque
puntano.

## Cosa questo NON dimostra

- **È tutto dentro campione.** `c` e `τ` vivono sulle stesse 11 gare di `ρ`, `δ₇₀`
  e della banda di rientro. Il leave-one-race-out è dentro quelle 11, e qui è
  quasi un alias della stima piena. **Nessun numero di questo esito è fuori
  campione.** Il primo vero è il 23 agosto (`PREREG_holdout_Olanda.md`).
- **Il verdetto poggia su `w(1)`, che è estrapolazione.** M1 misura la posizione al
  giro dopo la sosta, dove il kernel assegna età 1 (`kernel.mjs:165-167`). A età 1
  il fondo ha **5 giri utilizzabili in tutto**: l'out-lap è escluso dal filtro
  verde. `w(1) = −0,543 s` è la forma esponenziale estesa a una regione senza dati.
  Si aggiunge che il prior di pit-loss è definito come (in-lap + out-lap) meno due
  giri di passo pulito: **una parte del beneficio della gomma nuova sull'out-lap
  potrebbe già essere dentro la perdita**. Sovrapposizione dichiarata, non
  misurata, e non risolta qui.
- **Il bootstrap è debole.** Con 11 blocchi, ri-ottimizzare su una griglia salta
  agli estremi: l'8,0% delle ripetizioni collassa a `c ≤ 0,05`, e per questo l'IC95
  è l'intera griglia. I quartili sono la lettura utile — `c` [0,45 | 0,73 | 0,92],
  `τ` [3,25 | 4,75 | 6,75].
- **Due gare su dieci avevano segno contrario** nel residuo di partenza, e restano
  tali.
- **M2 non è stato usato come giudice**, ed era dichiarato prima: in una finestra
  senza soste tutte le età avanzano insieme e `w` si cancella nel distacco.

## Difetto di specifica, a referto

Il cancello scritto in `REFERTO_confronto_motori.md` §H nominava la lettura B2 ma
citava come soglie del segno `49,8%` e `+0,96`, che sono numeri della **lettura A**.
Le due letture hanno popolazioni diverse e non sono confrontabili. La condizione è
stata riscritta coi valori B2 del motore attuale (47,53% e +0,8251), misurati
**prima** di qualunque modifica e prima che esistesse un risultato da guardare.
Non è E08 — è la sostituzione di due numeri della lettura sbagliata con quelli
della lettura che il cancello stesso nomina — ma il difetto originale resta qui
scritto.

## Cosa si esegue per rifarlo

```bash
node ai_lab/confronto/stima_rodaggio.mjs        # c e tau, LORO, bootstrap
node ai_lab/confronto/cancello_rodaggio.mjs     # le quattro condizioni, lettura B2
node ai_lab/confronto/sonda_curva_rodaggio.mjs  # il giro raccomandato si sposta?
node simulatore/banco/run_suite.mjs             # 26/28 (s15 e s25 rosse, vedi sopra)
```
