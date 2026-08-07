# ESITO — non sono i sopravvissuti: il degrado è CONCAVO

**Data: 05/08/2026.** Esegue `PREREG_rho_selezione.md`, sigillata prima dei numeri (commit
`044a828`). Dati: `ESITO_rho_selezione.json`. Nessuna soglia toccata.

**Taratura passata**: sul campione intero, senza pavimento d'età, lo strumento ritrova
**0,04167** — il numero pubblicato in `ESITO_degrado_dal_campo.md` (D1). La scala costruita
sopra è quindi giudicabile.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **R1** | la selezione esiste | **NON PASSA** — rapporto 2,206 (≥ 1,25 ✓) ma **placebo p = 0,39** |

> **Il ρ non è basso perché lo misuriamo sui sopravvissuti. È basso perché il degrado è
> CONCAVO**, e una retta stimata su tutte le età ne prende la pendenza media.

R2 e R3 **non si eseguono**: erano condizionati all'esistenza di un ρ corretto per la
selezione, e quel ρ non esiste.

## 1 · La scala, e perché sembrava una prova

| finestra | n | ρ | identificazione |
|---|---|---|---|
| età ≤ 10 | 2.741 | **0,08554** | 0,94 |
| età ≤ 15 | 4.826 | 0,07309 | 1,76 |
| età ≤ 20 | 6.392 | 0,06352 | 2,64 |
| età ≤ 25 | 7.447 | 0,05183 | 3,55 |
| età ≤ 30 | 8.109 | 0,04718 | 4,20 |
| età ≤ ∞ | 8.906 | **0,03877** | 5,51 |

Il ρ misurato sulle età basse è **2,2 volte** quello misurato su tutte, e la discesa è
monotòna su sei punti. Guardata da sola, questa tabella è esattamente ciò che la selezione
produrrebbe — ed è il motivo per cui il placebo era il pezzo centrale della prereg e non un
ornamento.

## 2 · Il placebo, e cosa ha separato

Permutando le **lunghezze** degli stint fra gli stint della stessa gara, la selezione si
rompe (la durata di una gomma non ha più niente a che fare con come stava andando) e la
curvatura resta intatta.

| | |
|---|---|
| rapporto **vero** | **2,206** |
| rapporto **finto**, mediano su 500 permutazioni | **2,147** |
| permutazioni che fanno almeno quanto il vero | **195 / 500** |
| **p** | **0,3912** |

Le scale finte scendono **quanto** quella vera. Con la selezione rotta, il declino resta.
Quindi il declino non era selezione: **è la forma della curva.**

Il limite dichiarato prima si è visto nei numeri: il placebo può solo accorciare, mai
allungare, e in media **304 stint su 566** sono rimasti intatti perché la lunghezza pescata
era più lunga della loro. È **conservativo** — rende il placebo più simile ai dati veri — e
nonostante questo il vero non si distingue.

## 3 · Il limite che va scritto accanto ai numeri

Le finestre strette hanno un'**identificazione debole**, e per lo standard che il progetto
si è già dato: `D0` chiede almeno **2,0 giri** di variazione d'età residua dopo aver tolto
pilota e giro, e le prime due finestre stanno sotto — 0,94 a ≤10 e 1,76 a ≤15.

**Non cambia il verdetto** (R1 cade sul placebo, non sul rapporto) e non cambia il confronto
(il placebo soffre la stessa debolezza, quindi i due lati sono confrontabili). Ma il ρ =
0,0855 della prima riga **non è un numero da citare da solo**. La finestra più stretta che
passa D0 è ≤ 20, con ρ = 0,0635: rapporto **1,64** sul ρ pieno, e la conclusione è identica.

## 4 · La conseguenza: la spiegazione che il progetto aveva è caduta

Ieri la scomposizione aveva trovato che il motore **fa troppo poche soste in 114 casi su
167 e troppe in zero**, con una causa aritmetica — il ρ è troppo basso perché la forma
chiusa voglia fermarsi — e con **una sola spiegazione disponibile**: il ρ è un limite
inferiore per selezione, e sta scritto nel referto del degrado dal campo.

**Quella spiegazione adesso è esclusa.** Il ρ basso non è un artefatto di misura da
correggere: è la pendenza media di una curva che è davvero più piatta a età alta.

Restano due strade, e nessuna delle due è «alza il ρ»:

1. **La forma.** Il modello è lineare in età; il campo dice che la pendenza locale cala da
   0,0635 (età ≤ 20, identificazione buona) a 0,0388 (tutte). Un modello concavo è una
   descrizione più fedele — ma **quale effetto abbia sul numero di soste va misurato, non
   dedotto**: con una curva concava la sosta *riporta* la gomma nel tratto ripido, quindi
   fermarsi può costare *di più*, non di meno. Sarebbe la direzione sbagliata, e va
   verificato prima di costruirci sopra.
2. **Il pit-loss.** `(k+1)* = (R+a)·√(ρ/2P)` ha due ingredienti, e finora se n'è guardato
   uno solo. Un `P` troppo **alto** produce lo stesso sotto-fermarsi di un ρ troppo basso, e
   il pit-loss del progetto ha una storia lunga e un debito dichiarato.

## 5 · Un incastro con un NULL già chiuso, e va notato

Il **cliff** è stato chiuso NULL il 03/08. Il cliff ipotizzava che il degrado **accelerasse**
a fine vita — cioè una curva **convessa**.

Qui si misura il contrario: la pendenza locale **cala** con l'età. Le due cose non sono in
conflitto, si spiegano a vicenda — **si cercava una curvatura nel verso sbagliato**, ed è
coerente che non si sia trovata.

Non è una riapertura del cliff e non ne è la prova al contrario: è un'osservazione che,
se un giorno qualcuno vorrà rimettere mano alla forma del degrado, dice da che parte
guardare.

## 6 · Cosa NON si conclude

- **Non** si conclude che il ρ in produzione sia sbagliato. Si conclude che è la pendenza
  media di una curva concava, ed è esattamente ciò che una retta può dare.
- **Non** si conclude che un modello concavo curerebbe il sotto-fermarsi. Potrebbe
  peggiorarlo (§4.1), e va misurato.
- **Non** si tocca niente in produzione. Questa sessione non ha acceso nulla, come la sua
  prereg dichiarava in anticipo per tutti e quattro i rami.
