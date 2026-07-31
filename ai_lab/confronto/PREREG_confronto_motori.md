# PREREG — il motore nuovo risponde MEGLIO del vecchio?

*Scritto il 31/07/2026, PRIMA di guardare qualunque numero del confronto (regola 3).*

L'audit di pubblicazione ha verificato che il motore nuovo **risponde**, non che risponda
**bene**. Vecchio e nuovo dissentono spesso — misurato: su Belgio il saldo era −396
risposte e in 5 casi su 111 la posizione differiva già solo fra diretta e replay. Quale dei
due abbia ragione **non è mai stato stabilito**. Questo documento fissa come stabilirlo,
prima di sapere come va a finire.

## La verità contro cui si misura

Non esiste un oracolo per «se ti fossi fermato al giro L, dove saresti rientrato»: nella
gara vera i rivali reagiscono. Ma esiste un caso in cui la domanda è stata **davvero posta
e davvero risposta dalla pista**: le **soste vere**.

Per ogni sosta reale di un pilota D con giro di ingresso `Li`:
- si **congela al giro `Li − 1`** — prima che la sosta sia visibile;
- si chiede al motore: «se D si ferma al giro `Li`, dove rientra?»;
- la **verità** è la posizione reale di D al giro di rientro `Lo = Li + 1`, contata fra le
  auto sullo stesso giro.

Entrambi i motori affrontano lo stesso handicap (non sanno che i rivali si fermeranno), sulle
stesse soste, con la stessa verità. Il confronto è quindi leale anche se nessuno dei due
può essere perfetto.

**Perimetro:** le 11 gare 2026 già in `demo/data/`. Escluse le soste con `Li ≤ 3` (non c'è
storia per stimare un passo), quelle di piloti senza `cum_time` al congelamento, e quelle
in cui il pilota è doppiato al rientro (la posizione «fra chi è a pari giro» non è
confrontabile). **Blocchi = gare**: nessuna statistica che mescoli gare (E11).

## Le metriche, e i cancelli

Ogni metrica si calcola sugli **stessi identici casi** per i due motori. Un caso a cui un
motore non risponde NON si scarta per entrambi: si conta come «muto», ed è un esito.

| | metrica | cancello: il nuovo è migliore se… |
|---|---|---|
| **M1** | errore di posizione al rientro, sulle soste vere — mediana di \|previsto − reale\| | mediana ≤ quella del vecchio, **e** quota di esatti ≥ quella del vecchio |
| **M2** | bias del passo: errore con segno sul distacco previsto a 3/5/10 giri, s/giro | \|bias\| ≤ quello del vecchio su tutti e tre gli orizzonti |
| **M3** | il «quando»: quota di casi in cui il minimo della curva cade **all'interno** e non al primo giro utile | il vecchio è noto a 0/249; il nuovo deve stare ≥ 50% sugli stessi casi |
| **M4** | copertura: casi con risposta, e **accuratezza dei casi persi** (M1 sui casi che il vecchio risponde e il nuovo no) | se il nuovo perde casi, quelli persi devono essere **peggiori della media** del vecchio: tacere dove si sbagliava è un guadagno, tacere dove si indovinava è una perdita |
| **M5** | calibrazione della banda ±1 del nuovo (il vecchio non ne ha) | copertura reale ≥ 80% (dichiarata 88,5%) |

## Cosa NON dimostra

- Non dice che il motore migliore sia **giusto**: dice che sbaglia meno su questi casi.
- Le soste vere sono un campione **non casuale** (i muretti scelgono quando fermarsi):
  la misura vale sul bersaglio del prodotto, non su un giro qualunque.
- M2 confronta proiezioni in verde: dove la gara è neutralizzata i due motori usano
  assunzioni diverse, e quel pezzo va letto a parte, non mediato dentro.

## Regola di condotta

Un cancello che risultasse mal specificato **si mette a referto e se ne pre-registra uno
nuovo**: non si riscrive dopo aver visto il risultato (E08). Se il vecchio vince su una
metrica, si scrive che vince.
