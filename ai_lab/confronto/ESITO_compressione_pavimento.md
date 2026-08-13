# Esito — il pavimento sulla compressione: **C2 ROSSO, la forma non si accende**

**Data: 13/08/2026.** Misura dei cancelli di `PREREG_compressione_pavimento.md`, eseguita
dopo il sigillo. La riparazione è stata **annullata** come la prereg impone.

---

## I quattro cancelli misurabili

| | | prima | dopo | esito |
|---|---|---|---|---|
| **C1** | giri sotto il pavimento · giri negativi | **305 · 1** | **0 · 0** | **VERDE** |
| **C2** | i giri verdi non si muovono | — | **230 tempi verdi diversi su 8.296** | **ROSSO** |
| **C3** | il pavimento morde su < 30% dei compressi | 22,1% (limite sup.) | **25,1%** (351/1.396) | **VERDE** |
| **C4** | rifiuti sul contro-fattuale < 5% | **27%** (17/64) | **0%** (0/64) | **VERDE** |

C5 non è stato misurato: la forma è caduta prima.

**C1 e C4 sono il punto della prereg, e sono netti.** I 305 giri impossibili spariscono tutti,
compreso il negativo di Monaco, e il contro-fattuale passa da un rifiuto su quattro a **zero**:
il pannello potrebbe rispondere sulla gara del giocatore a ogni giro.

Ed è proprio per questo che C2 va onorato invece che aggirato.

## C2, guardato da vicino

C2 ha due metà, e vanno separate.

**Prima metà — «le gare senza alcuna finestra di neutralizzazione»: campione VUOTO.** Tutte e
undici le gare del 2026 hanno almeno una finestra (il minimo è l'Ungheria con una VSC). Una
metà di cancello che non ha campione non è né verde né rossa: è un errore di scrittura mio, e
va detto.

**Seconda metà — «i giri fuori finestra restano identici al bit»: ROSSA.** 230 tempi sul giro
verdi cambiano su 8.296, e 798 cumulati.

### Perché cambiano — l'esperimento decisivo

Il clamp vive **dentro** il ramo `if (comprime …)`: strutturalmente non può toccare un giro
verde. L'ho verificato invece di dedurlo, rieseguendo tutto **col tetto al movimento spento**:

| con il tetto acceso | con il tetto **spento** |
|---|---|
| 230 tempi verdi diversi | **0 tempi verdi diversi su 2.947** |
| | 341 tempi in neutralizzazione diversi su 812 |

**Zero.** I giri verdi si muovono per intero a causa del **tetto al movimento**, che è
order-dependent per costruzione e gira sui giri verdi: con un campo meno compresso decide
sorpassi diversi, e quelli cambiano i tempi. Non è una fuga della riparazione — è una seconda
meccanica che reagisce.

### Che cosa vuol dire per il cancello

**C2, come l'ho scritto, era impassabile per costruzione.** Finché nel kernel esiste una
meccanica order-dependent che gira in verde, *qualunque* modifica alla compressione muove dei
giri verdi. C2 non misurava «la riparazione è uscita dal perimetro»: misurava «la riparazione
ha fatto qualcosa».

Questo lo dichiaro come difetto della prereg, non come assoluzione della forma.

## La decisione

**La forma non si accende, e il kernel è tornato quello di prima** (`--verifica` del trasporto
passa: 12 moduli identici all'originale).

La prereg dice, al §5: *«C2 rosso → la riparazione tocca il verde: si annulla, qualunque cosa
dicano gli altri»*, e al §6: *«se la forma non passa, passa il referto»*. Un cancello che si
riscrive quando boccia smette di essere un cancello — e il valore di questo progetto è che i
cancelli sono stati onorati anche quando faceva comodo il contrario.

Ho già emendato C3 una volta, **prima** di misurare l'esito e nella direzione severa, e l'ho
scritto. Emendare anche C2 **dopo** aver visto l'esito sarebbe la cosa opposta, e la farebbe
diventare una taratura.

## Il successore, e cosa deve dichiarare prima

Una prereg nuova, che non riusi questa misura come prova ma la rifaccia:

1. **Il perimetro si prova sulla struttura, non sull'effetto.** Il cancello giusto è: il clamp
   non si esegue mai su un giro fuori finestra — verificabile con un contatore dentro il ramo,
   e vero per costruzione. Non «i verdi non cambiano», che dipende dal tetto.
2. **La deriva indotta dal tetto va misurata e limitata**, non vietata: quanti sorpassi in più
   o in meno, e di quanto cambiano gli arrivi. È una domanda sul TETTO, e ha il diritto a una
   soglia dichiarata prima.
3. **Un'alternativa dichiarata adesso per non sceglierla dopo**: far pagare la compressione al
   **leader** invece che agli inseguitori, che è la lettura fisica giusta (sotto
   neutralizzazione il campo si compatta perché chi è davanti rallenta). Costa muovere
   l'ancora di tutti i cumulati, e va misurata con i suoi cancelli.

## Che cosa resta vero da oggi, comunque

- Il kernel **emette 305 giri che il suo stesso Director rifiuta**, tutti dentro una
  neutralizzazione. Il numero è misurato, il meccanismo è letto nel codice, e il difetto non
  è più un sospetto.
- Il pavimento **funziona**: li porta a zero e sblocca il contro-fattuale. Non è la forma a
  essere sbagliata — è il cancello che non sapeva distinguere la riparazione dalla sua
  conseguenza.
- Il pannello che risponde alla gara del giocatore resta bloccato dietro questa decisione, e
  il blocco adesso ha un nome e un numero.
