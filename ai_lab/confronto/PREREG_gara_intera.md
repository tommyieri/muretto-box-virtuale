# PREREG — LA GARA INTERA COL NOSTRO MOTORE

**Scritta il 01/08/2026, PRIMA di far girare una sola simulazione.**
Richiesta del PO: *«devi fare tutta la gara dal primo giro all'ultimo seguendo la
stessa strategia. Ovviamente non devi barare, devi usare il nostro motore su tutto
e su tutti. Quindi i vari pit stop, pit loss, gomma, degrado gomma, scelta di
mescola. Guardiamo quanto differenzia dalla realtà.»*

Fin qui il motore è stato misurato su **un orizzonte di 5 o 10 giri** attorno a una
sosta (`orizzonti_validati` in `modello_v2.json`). Questa è la prima volta che gli
si chiede la gara intera. Il numero che ne esce non ha precedenti nel progetto:
per questo la metrica, il perimetro e le regole sui casi sporchi vanno fissati
adesso, quando ancora non so come andrà a finire (regola 3, E08).

---

## 1. Le tre cose che questo esperimento NON è

**(a) Non parte dal giro 1, e non è una scelta mia.** Il motore stima il passo
base dai giri verdi già percorsi. Al giro 1 non ce n'è nessuno; con
`min_giri_base = 4` il primo congelamento possibile è il **giro 5**. Simulare da
prima vorrebbe dire inventare un passo, che è esattamente ciò che la regola 6
vieta. Quindi: *gara intera* qui significa **dal giro 5 alla bandiera** — in
media ~55 giri su ~60, ma i primi quattro non sono simulabili e va detto.

**(b) Non è una previsione: le soste vere sono informazione dal futuro.** Al
giro 5 nessuno sa che quel pilota si fermerà al 22 e al 41 montando HARD e SOFT.
Qui gliele diamo. È deliberato: la domanda è *quanto sbaglia la FISICA*, non
*quanto indovina la strategia*. Con la strategia vera in mano, tutto ciò che
resta dell'errore è passo base, deriva carburante, degrado, rodaggio e prezzo
della sosta. Ma un lettore distratto leggerebbe questi numeri come una capacità
di previsione, e **non lo sono**: vanno pubblicati solo con questa riga attaccata.

**(c) Va cinque volte oltre l'orizzonte validato.** Il modello dichiara di essere
validato a 5 e 10 giri; qui se ne proiettano ~55. Il motore lo dice da sé con
l'assunzione `OLTRE_ORIZZONTE_VALIDATO`, e quell'avviso resta nel risultato di
ogni caso.

## 2. Il perimetro, dichiarato prima (e cieco all'esito)

Dieci gare, dieci team, dieci piloti, **tutti diversi**. La regola è meccanica,
così non posso scegliere i casi comodi:

- **Team**: i primi 10 in ordine alfabetico fra gli 11 del 2026 → esce Williams.
- **Gare**: le prime 10 in ordine alfabetico fra le 11 pubblicate → esce Ungheria.
- **Accoppiamento**: indice con indice.
  `Alpine↔Australia · Aston Martin↔Austria · Audi↔Belgio · Cadillac↔Canada ·
  Ferrari↔Cina · Haas↔Giappone · McLaren↔GranBretagna · Mercedes↔Miami ·
  Racing Bulls↔Monaco · Red Bull↔Spagna`
- **Pilota**: il primo in ordine alfabetico dei due del team in quella gara. Se
  non è utilizzabile (§3), si prova **il compagno di squadra**; se non lo è
  nemmeno lui, il caso è **SALTATO e contato come tale** — non si ripesca un
  pilota di un'altra gara, perché a quel punto la selezione smetterebbe di essere
  cieca.

## 3. Utilizzabile = queste quattro condizioni, tutte prima di guardare l'errore

1. **classificato** (`classificato = True`): se l'auto non ha finito, una
   posizione finale da confrontare non esiste. I 41 ritiri e i 7 non-partiti
   escono dal metro **e vengono contati nel referto**.
2. **almeno una sosta** registrata: senza sosta non c'è pit-loss né mescola da
   simulare, e l'esperimento perderebbe metà del suo oggetto.
3. **nessuna sosta al giro ≤ 5**: il congelamento non può stare prima del giro 5,
   quindi una sosta precoce non è rappresentabile. (Sono 23 soste su tutto il
   fondo 2026.)
4. **il motore gli dà un passo base**: se non ce l'ha, esce con `null` esplicito
   (regola 6) e il caso è SALTATO, non riempito con un numero plausibile.

I **doppiati non escono**: essere doppiati non cambia l'ordine d'arrivo, e il
motore li ordina per `cum_time` esattamente come la classifica vera. Nessuna
regola speciale, ed è la risposta giusta.

## 4. Il metro

La posizione è un **rango dentro una popolazione**, e le due popolazioni non
coincidono: il motore colloca solo chi ha un passo base, la realtà classifica
solo chi è arrivato. Confrontare i due ranghi grezzi darebbe un numero che non
significa niente. Si usa la **ri-classificazione sulla popolazione comune**, che
nel progetto esiste già in un posto solo (`banco.mjs::riclassifica`, regola 1):
entrambi gli ordini ristretti ai piloti presenti in tutti e due, poi il rango.

- **ordine previsto** = i piloti ordinati per `cum_time` all'ultimo giro della
  traccia del motore;
- **ordine vero** = i classificati ordinati per `pos_finale` da
  `data/arrivi_2026.csv` (fonte indipendente dal `byLap`, così l'errore non può
  nascondersi dentro lo stesso file che il motore ha già letto).

`errore = posizione prevista − posizione vera`. Positivo = il motore lo mette
più indietro del vero.

## 5. I cancelli, con i numeri scritti adesso

| | cosa misura | soglia pre-registrata |
|---|---|---|
| **G1** | mediana di \|errore\| sui casi utilizzabili | **≤ 3 posizioni** |
| **G2** | quota di casi entro ±3 posizioni | **≥ 60%** |
| **G3** | bias medio con segno | **\|bias\| ≤ 1,5 posizioni** |
| **G4** | il motore batte il modello nullo (§6) sulla mediana di \|errore\| | **strettamente meglio** |

**G4 è il cancello che conta.** G1–G3 dicono se il numero è presentabile; G4 dice
se la fisica serve a qualcosa. Un G1 bellissimo con G4 fallito significherebbe
che 55 giri di simulazione non aggiungono niente a «le posizioni non cambiano»,
e in quel caso il verdetto è che la proiezione a gara intera **non va nel
prodotto**, per quanto belli siano gli altri tre.

Se G1, G2 o G3 falliscono ma G4 passa, il verdetto è: la proiezione a gara intera
è uno **strumento di laboratorio**, si dichiara il suo errore tipico e non si
pubblica come previsione. Nessuna soglia viene riscritta dopo aver visto i
numeri; se una si rivelasse mal posta, si mette a referto e se ne pre-registra
un'altra per la prossima tornata (E08).

## 6. Il modello nullo — «non cambia niente dal giro 5»

Il confronto onesto non è contro zero: è contro **la posizione che il pilota
aveva al giro del congelamento**, presa per `cum_time` dal `byLap` pinnato e
ri-classificata sulla stessa popolazione comune con la stessa funzione.

È il concorrente giusto perché è gratis, non richiede nessuna fisica, e nel 2026
è particolarmente forte: il motore per casi ha misurato che **senza DRS le
posizioni si muovono meno** (`ai_lab/casi/CARTA_DELLE_ERE.md`). Se il nostro
motore non lo batte, questa è l'informazione più utile che l'esperimento possa
produrre — e va scritta, non nascosta.

## 7. Cosa NON si tocca in base al risultato

Nessun coefficiente (ρ, δ₇₀, c, τ, min_giri_base), nessuna soglia, nessun prior.
Questa è una **misura**, non una taratura. Se l'esito suggerisce che qualcosa nel
modello è storto, quella diventa una prereg separata con il suo cancello, misurata
su un perimetro che non sia questo.
