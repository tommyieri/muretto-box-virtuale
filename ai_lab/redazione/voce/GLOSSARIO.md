# Glossario tecnico della redazione

Le rese italiane da usare, i falsi amici, e ciò che nel 2026 è cambiato davvero.
Le liste **controllate a macchina** stanno in `lessico.json`: qui c'è ciò che va
capito, non ciò che va contato. Se una voce serve al correttore, va aggiunta al JSON.

Il glossario pubblico del sito (`demo/glossario.mjs`) è vincolante: se una definizione
qui diverge da quella, vince quella pubblica, perché è quella che il lettore vede nel
tooltip.

---

## 1. Aerodinamica

| inglese | italiano da usare | nota |
|---|---|---|
| downforce | **carico aerodinamico**, deportanza | mai «portanza»: è la forza opposta. «Carico» è la parola del paddock |
| drag | **resistenza aerodinamica** | «drag» ammesso in gergo, alternare per non ripetere |
| aero efficiency | **efficienza aerodinamica** | è un rapporto carico/resistenza: dirlo |
| low/high downforce trim | **assetto scarico / carico** | il trim aerodinamico non è l'assetto meccanico: due leve diverse |
| dirty air | **aria sporca** | in curva toglie carico |
| clean air | **aria pulita**, aria libera | «in aria libera» è la forma giusta per il passo |
| slipstream / tow | **scia** | sul rettilineo aiuta. Non è sinonimo di aria sporca |
| flow separation | **distacco del flusso** | se totale, «stallo» |
| floor / diffuser | **fondo / diffusore** | |
| ground effect | **effetto suolo** | nel 2026 i tunnel Venturi sono ridimensionati: non è il 2022 |
| porpoising | **porpoising**, effetto delfino | oscillazione aeroelastica ad alta velocità, **non** il saltellamento sui cordoli |
| bouncing | **rimbalzo, sobbalzo meccanico** | fenomeno distinto dal porpoising |
| plank / skid block | **tavola, pattini** | l'usura della tavola è la voce da squalifica |
| ride height | **altezza da terra** | |
| sidepod | **fiancata** | «sidepod» ammesso |

## 2. Gomme

| inglese | italiano da usare | nota |
|---|---|---|
| compound | **mescola** | mai «composto» |
| degradation | **degrado** | calo di prestazione, **anche a battistrada intatto** |
| wear | **usura** | consumo di battistrada: è un'altra cosa |
| graining | **graining**, granulazione | arrotolamento superficiale: si può guarire |
| blistering | **blistering**, vescicatura | surriscaldamento della massa: non si guarisce |
| working range | **finestra di funzionamento** | |
| warm-up | **messa in temperatura** | |
| flat spot | **piattello** | |
| cliff | **crollo prestazionale** | attenzione: nel nostro laboratorio il cliff **non è un parametro pubblicato**, e le nostre misure non lo trovano. Non citarlo come fatto |
| set of tyres | **treno di gomme** | |

Gamma 2026: **C1-C5**, niente C6. Battistrada più sottile (−25 mm anteriore, −30 mm
posteriore). Divari fra mescole più ampi e costanti che nel 2025.

## 3. Assetto, guida, meccanica

| inglese | italiano | nota |
|---|---|---|
| balance | **bilanciamento** | va sempre qualificato con la fase: ingresso, metà curva, uscita |
| understeer / oversteer | **sottosterzo / sovrasterzo** | |
| turn-in | **inserimento** | |
| apex | **apice** | distinguere apice geometrico da apice di traiettoria |
| traction | **trazione** | |
| lock-up | **bloccaggio** | |
| brake balance | **ripartizione di frenata** | |
| trail braking | **trail braking** | resa descrittiva: pressione residua sul freno in inserimento |
| lift and coast | **lift and coast** | rilascio anticipato del gas |
| compliance | **cedevolezza sospensiva** | |
| gear ratios | **rapporti al cambio** | «rapporti lunghi/corti» |
| downshift | **scalata** | |
| out-lap / in-lap | **giro di lancio / giro di rientro** | |
| flying lap | **giro lanciato** | |
| pace | **passo** | race pace = passo gara; one-lap pace = passo sul giro secco |

## 4. Strategia e gara

`undercut` e `overcut` restano in inglese (sono nel glossario pubblico). `pit-loss` è
il tempo perso dal passaggio dai box. **Attenzione al falso amico più insidioso:** in
italiano «box» è il garage; alla radio inglese «box» è l'ordine di rientrare. In
italiano si scrive «rientra», non «box».

`safety car` e `virtual safety car` sono femminili. `neutralizzazione` è il nostro
termine-ombrello e comprende entrambe più la bandiera rossa. I distacchi presi sotto
neutralizzazione **non sono passo**.

## 5. Power unit ed energia (2026)

La power unit non è «il motore»: comprende il termico, l'MGU-K, l'accumulatore,
l'elettronica di controllo e il turbo. L'**MGU-H non esiste più**.

Le grandezze di questa famiglia — erogazione, recupero, stato di carica, clipping —
**non sono nel nostro feed**. Si possono nominare come ciò che non misuriamo, e in
quel caso vanno nella tabella di provenienza con stato `NON_MISURABILE`. Non si
quantificano, non si insinuano, non si usano come spiegazione implicita.

Due errori che smascherano subito:

- **«batteria scarica» per spiegare il clipping.** Il clipping può accadere con
  energia disponibile: è un limite di potenza, o l'effetto del decadimento
  dell'erogazione con la velocità.
- **energia e potenza come sinonimi.** I megajoule non sono kilowatt. Nel 2026 è
  l'errore che rende un pezzo illeggibile a chi sa.

## 6. Il 2026, in breve, con la data addosso

> **Avvertenza.** Questi numeri vengono da fonti secondarie di buona qualità, non dai
> PDF FIA, e il quadro 2026 è stato ritoccato in corso di stagione. Un numero di
> regolamento citato senza data è un numero sbagliato. Prima di metterne uno in un
> pezzo, va verificato: qui stanno per non dire sciocchezze, non per essere citati.

- **Unità di potenza.** 1.6 V6 turbo, MGU-H abolito, MGU-K da 120 a 350 kW. Obiettivo
  di ripartizione circa 50/50 fra termico ed elettrico. Carburante 100% sostenibile;
  il limite è **energetico** (dell'ordine di 3000 MJ/h) e non più solo di massa; il
  carburante di gara scende da circa 110 a circa 70 kg.
- **Il decadimento dell'erogazione.** Piena potenza elettrica fino a circa 290 km/h,
  poi a scendere fino ad annullarsi verso 355 km/h. È il perno di quasi tutta
  l'analisi 2026 sulle velocità di punta: «ha mille cavalli» senza dire dove è una
  frase priva di senso.
- **Overtake** (ex Manual Override Mode): si attiva se si è entro un secondo al punto
  di rilevamento, mantiene i 350 kW più in alto e concede energia extra per il giro
  successivo. **Non è il nuovo DRS**: l'aero attiva è per tutti e legata alle zone,
  l'Overtake è legato alla prossimità. Confonderli è l'errore-firma del 2026.
- **Aero attiva.** DRS abolito. Ala anteriore a due elementi con flap mobile, ala
  posteriore a tre elementi, niente beam wing. Due configurazioni: **Corner Mode**
  (default, alto carico) e **Straight Mode** (basso carico), nelle zone definite dalla
  FIA circuito per circuito. Le fonti divergono sui target di riduzione (−30% carico e
  −55% resistenza nelle fonti anglosassoni, −15/30% e −40% in quelle italiane): se si
  cita, si cita l'intervallo e la fonte.
- **Superclipping.** Fenomeno nuovo del 2026: la vettura rallenta a gas pieno perché
  il termico sta caricando. È il motivo dei ritocchi energetici di metà stagione.
- **Telaio.** Peso minimo 768 kg, passo massimo 3400 mm, larghezza 1900 mm, fondo e
  ala anteriore più stretti. Via le carenature ruota.
- **Cosa NON è cambiato:** niente rifornimento, niente controllo di trazione, niente
  sospensioni attive.

## 7. Dati e telemetria

`long run` sta per passo gara. `fuel-corrected` è «corretto per il carburante».
`delta time` è il distacco cumulato. `gap` è il distacco.

**I settori sono S1, S2, S3.** In FastF1 non esistono microsettori: chiamare
«microsettore» un settore è un errore che il repository ha già pagato una volta. I
mini-settori costruiti in casa (per esempio i 24 della mappa di dominanza) si chiamano
mini-settori e si dice quanti sono.

La **velocità di punta** non è una misura di potenza: dipende da trim, scia,
erogazione e rapporti. Il **rilevamento di velocità** (speed trap) è un punto della
pista, non una proprietà della vettura.

---

## 8. Come argomenta chi sa

Sei passi, osservati sui pezzi tecnici di riferimento. Non è una struttura di pagina:
è la forma del pensiero che deve trasparire, qualunque forma abbia l'articolo.

1. **Osservazione.** Un fatto verificabile: un tempo, una velocità in un punto, un
   pezzo in una foto, un'assenza.
2. **Complicazione.** *La mossa che distingue il bravo dal dilettante:* si dichiara
   **prima** perché il confronto non è pulito — benzina, traffico, mescole, stint
   corti — e poi si usano i dati. Non dopo, in una nota.
3. **Ipotesi.** Formulata come meccanismo fisico, non come giudizio: «più carico → più
   vita gomma», non «hanno lavorato meglio».
4. **Prova parziale.** Il dato che discrimina, ancorato a un punto preciso della
   pista. Il numero non fluttua mai in astratto: ha una curva, un giro, uno stint.
5. **Conseguenza condizionata.** Che cosa implica *se* l'ipotesi regge, e che cosa la
   falsificherebbe.
6. **Chiusa aperta.** Non un riassunto: una conseguenza per domenica, o una domanda
   genuina.

E tre modi di dire che non si sa, in ordine di forza:

- **nominare il dato mancante** — «servirebbe una misura di X, che non abbiamo»;
- **dichiarare la confidenza in cifre** — «l'evidenza non è meglio di 50/50»;
- **graduare l'ipotesi** — «sembra», «l'evidenza suggerisce», «è compatibile con».

Il peggiore, e da evitare, è l'avverbio generico: «probabilmente».
