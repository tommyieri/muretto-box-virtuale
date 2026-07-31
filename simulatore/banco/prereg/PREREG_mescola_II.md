# PREREG — FASE MESCOLA II: separare la mescola dall'evoluzione della pista

**Scritta il 2026-07-29, dopo l'esito della Fase Mescola I e la sua diagnosi
post-hoc.** Regola 3 / E08: la Fase I **non si riscrive**. La sua specifica
resta in `PREREG_mescola.md` esattamente com'era, il suo esito resta a referto
con i suoi numeri, e questa è una prereg NUOVA per la domanda che resta aperta.

## Cosa ha detto la Fase I

Il contrasto SOFT−HARD sulle pendenze di degrado, appaiato entro
(anno, gara, pilota) su 406 unità e 92 gare:

| | media Δ | IC95 | p (permutazione) |
|---|---|---|---|
| 2019–2025 | **−0,183** | [−0,257; −0,117] | 0,0001 |
| dentro campione 2019–2023 | −0,148 | [−0,231; −0,076] | 0,0001 |
| 2024 (fuori campione) | −0,336 | [−0,748; −0,125] | 0,0001 |
| 2025 (fuori campione) | −0,203 | [−0,443; −0,038] | 0,0030 |

L'effetto è **forte, stabile su sette leave-one-year-out, e riproducibile su due
stagioni fuori campione**. Ed è nel verso **sbagliato**: la SOFT mostra una
pendenza *meno* ripida della HARD.

**Il cancello NON è passato**, per la clausola direzionale che la Fase I aveva
dichiarato in anticipo: un effetto significativo col segno opposto è un segnale
di confondimento, non una misura di fisica della gomma. La clausola c'era prima
dei numeri, ed è servita a impedire di pubblicare un risultato all'incontrario
solo perché era statisticamente robusto.

## La diagnosi (post-hoc, non confermativa)

|  | SOFT | HARD |
|---|---|---|
| stint | 1.272 | 2.278 |
| giri per stint (mediana) | 13 | 24 |
| età media | 11,4 | 15,6 |
| posizione nella gara (frazione, mediana) | **0,05** | **0,35** |
| quota di stint che sono l'ultimo | 41,6% | 59,7% |

La SOFT è la gomma di **partenza**. L'appaiamento entro gara cancella
esattamente il carburante, che è lineare nel giro, ma **non** cancella
l'evoluzione della pista, che non lo è: è rapida all'inizio e va a plateau. Uno
stint sulla parte ripida vede i tempi scendere e ne raccoglie una pendenza più
negativa. È la stessa non-linearità che al PROMPT 03 ha messo in disaccordo la
stima entro-blocco di δ₇₀ (3,11) col replay (2,2) — due indizi indipendenti dello
stesso fenomeno.

Questa diagnosi è stata guardata **dopo** l'esito e per questo non conferma
niente: motiva la Fase II, non la sostituisce.

## La Fase II

**Domanda**: a parità di posizione nella gara e di finestra d'età, la mescola
separa il degrado?

**Disegno pre-registrato** (da eseguire quando la fase verrà aperta):

1. **Stessa unità** (stint con ≥ 5 giri utilizzabili) e stesso appaiamento entro
   (anno, gara, pilota) — il carburante deve continuare a cancellarsi.
2. **Appaiamento SU FINESTRA**: entra nell'unità solo la coppia di stint
   SOFT/HARD i cui intervalli di **giro di gara** si sovrappongono per almeno il
   50% del più corto dei due, e i cui intervalli di **età gomma** si
   sovrappongono per almeno il 50%. Così la pista e l'età sono comparabili per
   costruzione invece di essere corrette da un modello.
3. **Curva di evoluzione della pista stimata e sottratta**, come alternativa
   dichiarata al punto 2: per ogni gara, la mediana dei tempi verdi per giro
   (su tutti i piloti) come proxy di evoluzione + carburante; si sottrae dai
   tempi e si ricalcolano le pendenze. I due bracci si riportano ENTRAMBI: se
   concordano, l'effetto è robusto al metodo; se no, la fase è inconcludente.
4. Null per permutazione, bootstrap a blocchi = gare, leave-one-year-out:
   invariati.

**CANCELLO**: come la Fase I — IC che esclude lo zero su 2024 e 2025, segno
concorde dentro/fuori campione — **più** la clausola direzionale (Δ > 0) e
**più** l'accordo di segno fra i due bracci metodologici (2 e 3).

**Numerosità minima**: ≥ 20 unità appaiate per stagione fuori campione. Se
l'appaiamento su finestra scende sotto quella soglia, la Fase II è dichiarata
**non eseguibile su questo fondo**, e la separazione per mescola resta una
domanda aperta invece di diventare un numero debole.

## Fino ad allora

ρ resta **comune**. Il modello non prende un δ per mescola, la pagina continua a
dichiarare che la mescola scelta non cambia il degrado (p = 0,209 sul 2026), e la
sentinella `s21` fa fallire la suite se un ρ per mescola entra in `engine/` o
`data/modelli/` mentre questo esito è negativo.

Il ripiego «delta nominale Pirelli etichettato modello» **non viene adottato**:
non ne esiste una fonte citabile nel repo, e un numero inventato con targhetta
`modello dichiarato` resta un numero inventato. La targhetta dichiara la natura
di un numero, non lo autorizza a esistere.
