# PREREG — FASE BAGNATO: riprodurre il crossover

**Scritta il 2026-07-29, PRIMA di stimare un solo coefficiente del modello
bagnato.** Regola 3.

**Trasparenza su cosa è già stato guardato.** Prima di questa prereg è stato
eseguito un **censimento di fattibilità** — strutturale, non di esito: quante
gare bagnate esistono, quanti giri, e in quante di esse le due famiglie di
gomme girano *pulite in contemporanea*. Il censimento non guarda dove cade il
crossover né quanto un modello lo sbaglierebbe: conta se il fenomeno è
osservabile. I suoi numeri sono riportati qui sotto perché la prereg li usa per
fissare le soglie, e nasconderli renderebbe le soglie inspiegabili.

## La domanda

Il selettore Wet è visibile ma spento dal giorno 1, con targhetta «modello non
ancora misurato». CLAUDE.md fissa il cancello per accenderlo: **riprodurre il
crossover reale** sulle gare bagnate del fondo.

## Cosa è il crossover, in termini misurabili

Il crossover è il momento in cui la famiglia di gomme più veloce cambia. È
osservabile solo dove **entrambe le famiglie girano insieme e pulite**:

- per ogni giro di una gara bagnata, il passo mediano dei piloti su slick
  (`verde`) e quello dei piloti su gomma da bagnato (`passoBagnato` — stessa
  definizione, altra famiglia: stesso status, stesso `del`, niente in-lap né
  out-lap);
- `Δ(giro) = mediana(bagnato) − mediana(slick)`;
- il **crossover reale** è il giro in cui Δ cambia segno.

**Minimo per una mediana: 3 piloti per famiglia.** Con un pilota solo non è una
mediana, è un giro — e un giro dentro una transizione è dominato dalla
situazione individuale (traffico, età gomma, quanto sta spingendo), non dalla
pista.

## Il modello, e il suo cancello

**Modello**: `Δ` in funzione di un indicatore di bagnato osservabile senza usare
la differenza fra famiglie (altrimenti è circolare): `w = passo mediano del
campo a quel giro / passo di riferimento asciutto della gara − 1`. Si stima
`Δ = a + b·w`; il crossover previsto è il primo giro in cui `w` supera
`w* = −a/b`.

**Validazione**: leave-one-race-out sulle gare giudicabili.

**CANCELLO**: il crossover è riprodotto su una gara se
`|giro previsto − giro reale| ≤ 3`. Il cancello passa se:

1. almeno il **70%** delle gare giudicabili è riprodotto; **e**
2. l'errore assoluto mediano è **≤ 2 giri**; **e**
3. il modello **batte** il predittore banale (il centro della finestra mista)
   sull'errore assoluto mediano. Senza questa condizione, su finestre di pochi
   giri «entro 3» si otterrebbe per costruzione.

**Solo se il cancello passa** il selettore Wet si accende.

## Condizione di NON ESEGUIBILITÀ (dichiarata prima)

La fase richiede **≥ 8 gare giudicabili**. Sotto quella soglia si dichiara
**non eseguibile su questo fondo**: una validazione leave-one-race-out su meno
di otto gare addestra su un pugno di casi e convalida su uno, e il numero che ne
esce non è una misura — è un aneddoto con un intervallo di confidenza.

## Il censimento di fattibilità, già eseguito

20 gare bagnate, 10.098 giri su gomma da bagnato (9.365 intermedia + 733 wet:
gli stessi numeri di CLAUDE.md). Gare con un cambio di segno osservabile, al
variare dei criteri:

| min piloti per famiglia | min giri misti | gare con finestra | **con cambio di segno** |
|---|---|---|---|
| 1 | 3 | 8 | **5** |
| 1 | 5 | 6 | 4 |
| 1 | 8 | 2 | 2 |
| 2 | 3 | 4 | 3 |
| 2 | 5 | 2 | 1 |
| 3 | 3 | 3 | 1 |
| **3** | **5** | **1** | **1** |

Il massimo è **5 gare**, e si ottiene solo col criterio più permissivo — quello
in cui la «mediana» di una famiglia è un giro singolo. Col criterio dichiarato
sopra (≥ 3 piloti, ≥ 5 giri misti) resta **una gara**.

Il motivo è fisico e si vede in fondo ai numeri: la transizione fra famiglie
avviene ai box, quindi i giri di cambio sono in-lap e out-lap — esclusi — e
molto spesso sotto Safety Car — esclusa. La finestra in cui due famiglie
corrono davvero fianco a fianco, pulite, è quasi vuota.

## Cosa NON si farà per far passare la fase

- **Non si abbassa il minimo di piloti per famiglia** a 1 o 2 per guadagnare
  gare. Una mediana su un giro non è una mediana, e la soglia è stata scelta su
  argomento statistico, non sul conteggio che produce.
- **Non si useranno i giri di cambio gomma come verità.** Il giro in cui una
  squadra monta le intermedie è una **DECISIONE**, non una misura (§4, la
  stessa regola che vale per la durata degli stint). Riprodurre le decisioni
  dei muretti non è riprodurre la fisica del crossover: sarebbe misurare la
  strategia altrui e chiamarla modello.
- **Non si accende il selettore Wet** con un modello descrittivo al posto di uno
  validato. Mostrare attivo un selettore che non ha superato il suo cancello è
  esattamente la promessa che CLAUDE.md vieta al giorno 1.

## Cosa resta a referto se la fase non è eseguibile

Le grandezze **descrittive** che il fondo bagnato può dare — quanto è più lenta
una gomma da bagnato rispetto al riferimento asciutto, e con che dispersione —
si riportano nell'esito **come diagnostica etichettata**, e NON in
`data/modelli/`: un file lì dentro verrebbe prima o poi consumato come modello,
e questa fase non ne ha prodotto uno.

La fase si potrà rieseguire senza ridiscutere nulla quando il fondo conterrà più
gare bagnate, o quando esisterà una fonte per-auto delle bandiere che permetta
di ammettere giri oggi esclusi.
