# PREREG — il traffico, primo ingresso: il DELTA-PASSO

Secondo giro dell'**agente autonomo a compito**. Branch
`ai-lab/autonomo-traffico-deltapasso`, 21/07/2026. Scritto **prima** di misurare.

Il giro precedente ha dimostrato che gli ±11,7 s non vengono dal passo base ma dai giri in
traffico (+8,17 s di mediana per caso, 36 giri sotto i 5 s di gap). Stanotte si attacca il
traffico, **un ingresso solo**.

## 0. Il difetto che voglio dimostrare

Il modello attuale tratta il traffico come pura **geometria**: gap piccolo ⇒ tempo perso,
chiunque tu sia e chiunque tu abbia davanti. Confonde due situazioni fisicamente opposte:
*non riesco a passare* e *sto per passare*. Una macchina molto più veloce dietro una lenta
non è intrappolata: passa. Il modello a solo-gap le dà la stessa penalità di una lenta
bloccata.

## 1. Il delta-passo, costruito dal fondo

**Accoppiamento chi-dietro-chi, giro per giro**: al giro L, fra le auto che hanno
completato L, si ordina per `sesT` (cronometria cumulata: fra chi ha fatto lo stesso numero
di giri, quell'ordine **è** l'ordine in pista). L'auto davanti a `d` è la precedente.
*Limite dichiarato*: i doppiati stanno su un altro indice di giro e non entrano.

**Delta-passo dinamico**: `Δ(d, L) = passo_pulito(d, L) − passo_pulito(davanti, L)`, dove il
passo pulito è la previsione del modello del piano di sotto per **quella** auto a **quel**
giro, **con la sua mescola e la sua età-gomma di quel momento**. Negativo = chi sta dietro
è più veloce.

Due avvertenze che il progetto ha già pagato, rispettate per costruzione:
- **è dinamico**: l'età-gomma entra, quindi due auto pari a inizio stint hanno Δ grande a
  fine stint se una ha la gomma finita;
- **è pulito**: carburante e degrado sono già dentro la previsione. In più, essendo una
  *differenza allo stesso giro*, i termini di carburante ed evoluzione pista **si elidono
  esattamente** — resta solo passo-pilota + mescola + degrado.

È la prima volta che il modello guarda una **relazione fra due piloti**, non una proprietà
di uno solo.

## 2. La risposta e le due forme, dichiarate ora

Risposta: `r(d, L) = tempo osservato − passo pulito previsto`, sui giri **verdi**, non
in/out-lap, con **gap < 5 s**.

**M0 — solo gap (il modello da battere)**: `r = a·exp(−gap/λ)`.

**M1 — trattenuto (additiva)**: `r = a·exp(−gap/λ) + c·max(0, −Δ)`.

**M2 — il massimo (fisica pura)**: `r = max(a·exp(−gap/λ), c·max(0, −Δ))`.
Motivazione: se non passi, il tuo giro vale al più quello di chi ti precede — perdi il
*maggiore* fra la penalità aerodinamica e il tuo vantaggio di passo. Il termine
`max(0, −Δ)` dice: chi è **più lento** di chi ha davanti non è trattenuto da niente.

**Al massimo due forme nuove** (M1, M2). La barra si applica a ciascuna, senza sconti.
Qualunque forma vinca in-sample ma non fuori campione è **dichiarata rumore**.

## 3. Il confondimento che può fabbricare il risultato — e come lo smonto

`r` contiene `−passo_pulito(d)` e `Δ` contiene `+passo_pulito(d)`. **Un errore di stima del
passo del pilota che segue entra nei due con segno opposto e crea correlazione negativa
spuria**, cioè esattamente il segno che cerco. È il modo più facile di prendersi in giro.

**Placebo dichiarato**: si rifà tutto sostituendo l'auto davanti con **un'altra auto a
caso dello stesso giro** (stesso `passo_pulito(d)`, leader sbagliato). Se l'effetto
sopravvive al placebo, è errore di misura e **non** fisica del traffico, e la scoperta è
annullata.

> **AVVISO AL TAVOLO — nuovo null.** Questo placebo è una funzione di ricampionamento
> **nuova**, non una modifica di quelle sigillate. Non l'ho sigillata da solo (il sigillo
> richiede `--attore`). **Va portata sotto sigillo da voi**: è esattamente il genere di
> codice che la regola vuole far guardare a un umano.

## 4. Il muro SC/VSC — proposta da verificare, non da assumere

Oggi si butta l'intera gara se ha un solo giro neutralizzato: restano 21 gare su 70, e il
2026 sparisce. Proposta: buttare **i giri** neutralizzati, non le gare, più una **finestra
di recupero** di K giri dopo la ripartenza, con **K derivato dai dati** (residuo mediano
contro "giri dalla fine dell'ultima neutralizzazione": K = la prima fascia il cui IC95
contiene lo zero).

**Come distinguo traffico vero da traffico artificiale**: non lo assumo — lo **misuro**.
Dopo un restart il gruppo è compattato dalla safety car, non dal passo: i *pairing* sono in
parte artificiali. Ma per stimare *quanto si perde dato gap e Δ* la ragione per cui ti
trovi lì non conta — anzi, il post-restart popola proprio le celle rare (auto veloce dietro
auto lenta) che in gara normale non esistono perché il sorpasso avviene subito.

**Il test**: stimo la funzione di penalità **separatamente** su giri di gara normale e su
giri post-restart (fuori dalla finestra K) e le confronto. Se i coefficienti sono
compatibili, i giri post-restart sono traffico vero e li tengo. **Se differiscono, torno al
filtro severo** e dichiaro che il traffico resta su pochi blocchi. Un NULL per mancanza di
dati è meglio di un numero su dati sporchi.

## 5. Fuori campione e barra del netto

Gare di indice pari = calibrazione, dispari = verifica (regola già dichiarata nelle
sessioni precedenti). Metrica: **errore assoluto mediano della penalità prevista**, per
gara (blocco), aggregato con `scheletro.bootstrap_a_blocchi` — **funzione sigillata,
chiamata e non modificata**.

> Una forma nuova sopravvive solo se il **miglioramento della mediana per gara sulle gare
> di verifica** supera **M = la semi-ampiezza dell'IC95 bootstrap-a-blocchi della metrica
> di M0 sulle stesse gare**, **e** l'IC95 del miglioramento appaiato per gara esclude lo
> zero.

## 6. Il test dell'esempio-guida (obbligatorio)

Cerco nei dati reali le auto con **Δ molto negativo** (molto più veloci) che si trovano
dietro qualcuno, e misuro **quanti giri consecutivi** ci restano. Se il fondo dice che
passano in fretta, un modello che usa Δ eredita quel comportamento; se il fondo dice che
restano intrappolate quanto le altre, **il delta-passo non serve** e lo dichiaro.

## 7. Il limite onesto, da scrivere nell'output

Il traffico si calcola **solo contro il campo reale**, non contro un campo che reagisce.
Nel controfattuale il resto del gruppo resta congelato alla realtà. Il modello dice
*«Leclerc diverso dentro la gara che È successa»*, non *«la gara che SAREBBE successa»*.

## 8. Un ingresso solo

Stanotte **solo delta-passo**. Difficoltà-di-sorpasso della pista e durata dell'incontro
**non si montano**: se il traffico migliora voglio sapere che è stato il delta-passo. Se la
diagnosi dice che da solo non basta, lo dichiaro come fronte del giro dopo — non aggiungo
la pista di nascosto per far tornare i conti.

## 9. Vincoli

Solo il fondo · blocchi = gare · kernel di produzione non montato · targhetta su ogni
numero · nessun push, PR, merge.
