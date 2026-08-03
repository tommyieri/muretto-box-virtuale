# Registrazione degli esiti di P1…P4 e I1…I5 — pagina nuova e datata

**Data: 03/08/2026.** Come per F1…F5, questa pagina **non modifica** `KPI_5_4_4.md`: le
soglie firmate restano dove sono. Qui si registrano nove esiti, e si mettono a referto due
riferimenti sbagliati della pagina firmata.

---

## Gli esiti

| KPI | esito | come si sa |
|---|---|---|
| **P1** | **RAGGIUNTO** | `censimento_vista.mjs --verifica` verde: 0 campi orfani non dichiarati |
| **P2** | **RAGGIUNTO** | 5 violazioni trovate e tolte; 0 promesse su rami chiusi o sezioni inesistenti |
| **P3** | **RAGGIUNTO** | la banda porta «circa 1 sosta su 8 finisce fuori»; l'orizzonte è etichettato **anche in produzione** |
| **P4** | **APERTO — serve il PO** | lo strumento che il KPI si è imposto è «mock approvato dal PO», e la firma è un atto umano |
| **I1** | **RAGGIUNTO** | `auto_run.sh` chiama la sonda a fine giro e ne riversa l'esito nel log |
| **I2** | **RAGGIUNTO** | `gen_numeri_ereditati.py --verifica` in CI + `s36_report_notte_fresco` |
| **I3** | **RAGGIUNTO** | i due duplicati di `demo/` sono a registro, e uno è sorvegliato byte per byte |
| **I4** | **META** | D4 chiuso; la prova alias LORO **resta aperta** |
| **I5** | **RAGGIUNTO** | ruleset `20247004`, attivo, contesti `suite` + `parita`, verificato via `gh api` |

## P1 — il censimento che mancava, e cosa ha trovato al primo giro

Lo strumento che la pagina firmata dichiarava necessario **non esisteva**. Ora c'è, e non
funziona per grep: **rende davvero la pagina** — 12 scenari × 3 componenti — con la vista
avvolta in un Proxy che registra ogni lettura.

**Prima misura: 148 campi emessi, 35 orfani.** Il più grosso era anche il più utile:
`piano.alternative` contiene il confronto che il motore fa col kernel (Australia: 0 soste
**8851,8** · 1 sosta **8854,4** · 2 soste **8868,9** · 3 soste **8887,2**) e
`piano.limite_perche` la ragione aritmetica. Entrambi calcolati, **mai mostrati**: la
domanda più ovvia davanti a «soste previste 1» — *e due?* — aveva la risposta a un campo di
distanza. Ora è in pagina, ed è la faccia leggibile di F4 mancato.

I 29 orfani restanti sono a registro in quattro gruppi, ognuno con la sua ragione:
targhetta dell'artefatto, **doppioni** (rischio E12), ingressi di decisioni già rese, campi
**sempre nulli** negli scenari committati — che il censimento non dichiara morti ma **non
giudicabili**, perché osserva letture e su un campo senza valore non può pronunciarsi.

**E lo strumento ha trovato un difetto in sé stesso.** Incrociandolo con un censimento
indipendente fatto per grep, il mio ne trovava *meno*: `pannello.mjs` apre con
`{ ...s, _data }`, e uno spread ingenuo faceva risultare «letti» tutti i campi di primo
livello. Corretto distinguendo `[[GetOwnProperty]]` da `[[Get]]` — non un'euristica sui
nomi, la differenza fra due operazioni del linguaggio. Restano **11 campi non giudicabili**
perché lo spread copia i primitivi in un oggetto normale e dopo sono invisibili: a registro,
con il rimedio noto.

## P2 — cinque promesse ritirate, e quattro erano su cose che la pagina non mostra

**Rami chiusi:** la home prometteva «caratterizzazione dei circuiti: **degrado gomme**»,
falsificato 0 circuiti su 8 — e la riga stava **due righe sotto** il commento che toglieva
la sorpassabilità per la stessa ragione. E l'etichetta della scena diceva «Proiezione fino
alla bandiera · i rivali non reagiscono»: mezza verità, perché **oltre 6 giri la proiezione
non è validata affatto**.

**Sezioni inesistenti:** la striscia strategia-gomme (`buildStrat` scrive in un id che non
esiste e non viene mai chiamata), la doppia classifica «in pista | ufficiale» (idem, e
`ufficiali_2026.json` si scarica ancora per un consumatore morto), e su `stagione.html` **la
stessa riga che `index.html` aveva già corretto il 02/08** — la correzione era stata
applicata a una pagina sola, e quella è linkata dalla nav di tutte.

## P3 — e un guasto in produzione che era mio

**La frequenza naturale.** «Copre l'88,2 %» è vero e non dice niente a chi non fa questo
mestiere. Ora accanto — non al posto — c'è «**circa 1 sosta su 8 finisce FUORI da questa
banda**». E l'unità torna sugli interi: la semi-ampiezza arrivava in pagina come «2» nudo
accanto a «Incertezza sulla posizione», ora è «**2 posizioni**». Un numero senza unità non è
più leggibile di un numero senza targhetta: è lo stesso difetto, un piano più in basso.

**L'orizzonte.** Il 03/08 ho registrato F1 a 6 giri e insegnato al pannello a dire «fin dove
la risposta è validata». Ho cablato il generatore del **demo** e non quello del **sito**:
`genera_vista_gara.mjs` costruiva il contesto senza `orizzonteRisposta`, e l'etichetta non
compariva in **nessuna** delle 11.303 risposte pubblicate. Chi leggeva vedeva solo
l'orizzonte del *passo* (10) e ne deduceva che fino a lì la risposta fosse buona — che
`REGISTRO_F1.md` dice essere falso fra 7 e 10 giri. **È E20 nella sua forma tipica: due
pezzi della stessa decisione, spenti uno solo.** Riparato e verificato: Monaco 1313 risposte
su 1322 portano l'etichetta, contro 0 prima.

## P4 — resta aperto, e la ragione è nel KPI stesso

La misura tipografica è stata fatta, leggendo il CSS riga per riga e rendendo il DOM: la
risposta è **21,6 px** contro i 16 px della curva e i 13,6 px del piano, ed è prima nel DOM
in entrambe le catene. **Ma lo strumento che P4 si è imposto è «mock approvato dal PO»**, e
non esiste. Dichiarare P4 raggiunto sulla base della tipografia sarebbe esattamente il «KPI
valutato a occhio» che la regola 1 della pagina firmata vieta.

Due riserve, misurate e da mettere davanti al PO quando deciderà: la risposta è la più
**grande** ma non la più **pesante** (peso 400, mentre «BOX NOW» e «Pit» sono 700), e la
riga non dice mai «a 2 giri» — il fatto che sia una risposta a due giri sta nella targhetta
e nel contesto, non nella riga.

## I1…I5 — e due riferimenti sbagliati della pagina firmata

**I1 raggiunto**: `auto_run.sh` chiama `sonda_deploy.sh` a fine giro e ne riversa l'esito
nel log, non fatale per scelta dichiarata. **Limite da scrivere**: la crontab **non è nel
repo**, quindi nessuno strumento può riprovarla domani; e il ramo ROSSO della sonda non è
mai scattato in produzione, quindi che segnali davvero è provato solo in laboratorio.

**I2 raggiunto**: metà era già vera (`CLAUDE.md`, verificato in CI). L'altra metà ora c'è:
`s36_report_notte_fresco` fallisce se il report manca, se non porta una data leggibile, o se
è più vecchio di **8 giorni** — soglia scelta sul calendario delle gare, non su un numero
tondo. Provata a fallire tutte e tre le volte.

**I3 raggiunto**, ma la soglia era **falsa alla lettera**: *nessun* duplicato era a
registro. Ora ce ne sono due — `demo/vendor/simulatore/` (necessario: è il prezzo di non
avere un build step) e **`demo/neutralizzazione.json`**, byte-identico a
`simulatore/data/archivio/dal_futuro/neutralizzazione.json` e sorvegliato **da niente**. È
E12 su un file di dati: una gara nuova poteva aggiornarne una copia sola, e il motore
avrebbe letto una tabella diversa da quella che il sito mostra. Ora il registro confronta
byte per byte.

**I4 a metà.** **D4 è chiuso**: il verificatore era implementato al rovescio della sua
prereg — pretendeva zero secchi asimmetrici, cioè diventava rosso *esattamente quando il
modello faceva la cosa giusta*. Ora sorveglia la coerenza fra bias e banda traslata, in
entrambi i versi, e passa; il modello non è stato toccato. **Resta aperta la prova alias
LORO**: i due numeri coincidono (0,8593 contro 0,8593), quindi nessuna perturbazione la
muove. Non si chiude correggendo un verificatore — serve rifare l'asserzione su una
quantità che possa davvero divergere, ed è una **scelta**, non una riparazione.

**I5 raggiunto**, verificato con `gh api` e non con la pagina: ruleset `20247004`,
enforcement **active**, contesti richiesti **`suite`** e **`parita`**.

### I due riferimenti sbagliati, a referto e non riscritti

`KPI_5_4_4.md` cita **`s34`** come strumento di I2 e **`s33`** come strumento di I3.
Nessuna delle due fa quello:

- `s33_cliff_spento.mjs` verifica che il termine **cliff**, spento, sia bit-identico a non
  esistere. Non tocca `demo/`, né i duplicati, né alcun registro.
- `s34_tetto_movimento.mjs` verifica il **tetto al movimento**. Non tocca nessun
  documento-verità.

Lo strumento vero di I3 è `demo/test_debito_demo.mjs`, che **non è una sentinella del
banco** — `run_suite.mjs` esegue solo `banco/sentinelle/*.mjs` — e gira nel job **`parita`**
della CI. Quello di I2 è lo step `gen_numeri_ereditati.py --verifica` nel job `suite`, più
`s36` da oggi.

**Non riscrivo la pagina firmata** (regola 3, E08). Il fatto va scritto perché è la stessa
classe di difetto che i KPI di Infrastruttura esistono per impedire: **un documento-verità
che nomina il guardiano sbagliato**. Chi avesse letto la pagina e controllato `s33` avrebbe
concluso che I3 era coperto, e avrebbe controllato una sentinella che parla d'altro.

## Stato dei KPI dopo questa registrazione

| | esito |
|---|---|
| **F1** raggiunto · **F2** raggiunto alla lettera · **F3** mancato · **F4** mancato · **F5** applicato | `REGISTRO_F1.md`, `REGISTRO_F2_F3.md`, `REGISTRO_F4.md`, `confronto/ESITO_F5_bis.md` |
| **P1** raggiunto · **P2** raggiunto · **P3** raggiunto · **P4** aperto (serve il PO) | questa pagina |
| **I1** raggiunto · **I2** raggiunto · **I3** raggiunto · **I4** a metà · **I5** raggiunto | questa pagina |
| **Z1 · Z2** | si misurano il 23/08 a Zandvoort |
