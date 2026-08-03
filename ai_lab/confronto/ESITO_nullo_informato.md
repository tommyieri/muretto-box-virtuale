# ESITO — il nullo che conosce la sosta: il primo risultato non-NULL della giornata

**Data: 03/08/2026.** Esegue `PREREG_nullo_informato.md`, sigillata poche ore prima.
Numeri: `ESITO_curva_nullo_informato.json`. Sola lettura.

Controllo a 2 giri: **235 casi, 36-12, p = 0,0007** — riprodotto. La curva si legge.

## Il risultato, ed è l'opposto di quello che avevo previsto

Scrivendo la prereg avevo messo per iscritto la mia attesa: *«il risultato più probabile è
che la curva si abbassi molto: se il grosso del +92 è "so della sosta", toglierlo lascia
poco»*. **È andata al contrario.**

| giri | nullo VECCHIO (ordine fermo) | nullo INFORMATO (+ pit-loss) | batte entrambi? |
|---|---|---|---|
| 2 | 161-69 · **+92** · p 0,0000 | 62-17 · **+45** · p 0,0000 | **sì** |
| 3 | 146-72 · +74 · p 0,0000 | 92-17 · +75 · p 0,0000 | **sì** |
| 4 | 136-80 · +56 · p 0,0002 | 105-15 · +90 · p 0,0000 | **sì** |
| 5 | 129-83 · +46 · p 0,0019 | 114-17 · +97 · p 0,0000 | **sì** |
| **6** | 119-88 · **+31** · p **0,0368** | 127-16 · **+111** · p 0,0000 | **sì** |
| 8 | 102-86 · +16 · p 0,2739 | 150-9 · +141 · p 0,0000 | no |
| 10 | 101-84 · +17 · p 0,2394 | 158-14 · +144 · p 0,0000 | no |

## Perché è più forte di quanto sembri: i due nulli sbagliano in direzioni opposte

Il fatto che salta all'occhio è che **il nullo informato viene battuto sempre più
largamente al crescere dell'orizzonte** (+45 a due giri, +144 a dieci) mentre quello
vecchio viene battuto sempre **meno** (+92 → +17). Un nullo *più* informato che regge
*peggio*: sembra un paradosso, e invece è la cosa più istruttiva del referto.

- Il **nullo vecchio** dice «l'ordine non cambia». È molto sbagliato subito dopo la sosta —
  il soggetto ha appena perso venti secondi — ma diventa **accidentalmente buono** a lungo
  raggio, perché su gomme nuove il pilota **recupera** la posizione che aveva.
- Il **nullo informato** dice «il soggetto è venti secondi indietro, e ci resta». È molto
  buono subito dopo la sosta e diventa **sempre peggiore**, perché non lascia mai
  recuperare nessuno.

**I due sbagliano in verso opposto e si scambiano il ruolo di baseline forte.** Un motore
che ne battesse uno solo starebbe sfruttando la debolezza strutturale di quello. Battere
**tutti e due insieme** significa un'altra cosa: che il motore segue la **forma** del
recupero — la caduta e la risalita — e non solo uno dei due estremi.

> **La frontiera è 6 giri**, ed è l'ultimo orizzonte in cui il motore batte **entrambi** i
> nulli in modo significativo. A 8 giri ne batte solo uno.

## Cosa questo dice, e cosa non dice, del KPI F1

F1 chiede che l'orizzonte in cui il motore batte il non-fare-niente si estenda **a ≥ 6
giri con p < 0,05**. A 6 giri il motore batte il nullo letterale (p = 0,0368) e quello
informato (p = 0,0000). **La sostanza di F1 è soddisfatta, e in un modo che significa
qualcosa** — non contro un solo avversario di comodo.

**Ma non lo dichiaro io raggiunto**, per due ragioni di procedura che restano valide:

1. la lettura pre-registrata della prima curva è bloccata dal suo criterio di
   contaminazione degenere, e quel documento non si riscrive;
2. **registrare l'esito di un KPI è una decisione del PO**, e qui c'è per giunta da
   scegliere quale strumento conti. Serve una **pagina nuova e datata** che lo dica.

Quello che posso dire senza decidere niente: **se il PO adotta la congiunzione dei due
nulli come strumento di F1, F1 è raggiunto a 6 giri.** È la lettura più severa disponibile
oggi, ed è quella che raccomando proprio perché è la più severa.

## Il dato che va letto accanto ai saldi

A **2 giri il motore e il nullo informato sono PARI in 193 casi su 272** (il 71%): a due
giri dalla sosta non è ancora successo abbastanza perché i due si distinguano, e il
vantaggio si concentra sui 79 casi discordanti. La quota di pari scende a 81 su 253 a
dieci giri.

Chi legge il **+45** a due giri come «il motore stravince» lo sta leggendo male: a due giri
il motore **quasi sempre dice la stessa cosa** di un nullo che sa della sosta. Il suo
contributo cresce col tempo, e questo è coerente con la fisica che modella (degrado,
carburante, recupero) — non con un vantaggio informativo, che si consumerebbe.

## Il limite dichiarato, che resta

Oltre ~4 giri le soste vere dei rivali entrano nella finestra (mediana 6 a quattro giri,
11 a dieci): da lì in poi la differenza misura **anche** la non-conoscenza della strategia
altrui, non solo la fisica del passo. Non c'è un criterio che separi i due contributi —
quello della prima curva era degenere e non ne ho inventato un secondo dopo averlo visto
fallire. Resta come covariata dichiarata, e la frontiera di 6 giri va letta sapendolo.

## Nota di metodo

Avevo scritto la mia previsione nella prereg **prima** di misurare, e la misura l'ha
smentita. È il motivo per cui la previsione va scritta: se l'avessi tenuta in testa, oggi
racconterei di averlo sospettato. Il valore di una prereg non è solo impedire di barare sui
cancelli — è **rendere visibili gli sbagli di intuizione**, che sono l'informazione più
utile su quanto ci si può fidare della prossima intuizione.

Va anche detto che ci sono voluti **due difetti di implementazione** prima di arrivare a un
numero: la prima scrittura passava per `doveRientri`, che proietta solo fino al giro di
rientro (curva vuota da 3 giri in su); la seconda passava al nullo l'oggetto `perdita`
invece del numero, sommando un oggetto a un cum e producendo NaN (zero casi a ogni
orizzonte). In entrambi i casi il sintomo era «n = 0», che è **rumoroso e impossibile da
scambiare per un risultato** — ed è l'unica ragione per cui non sono finiti in un referto.
