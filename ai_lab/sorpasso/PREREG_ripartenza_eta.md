# PREREG 3 — la ripartenza CONDIZIONATA al divario d'età gomma (prima di misurare)

*07/08/2026, notte fonda. La forma uniforme è a referto SPENTA (ESITO_cancelli_ripartenza):
il fenomeno esiste sul fondo (OR 1,357) ma abbassare la soglia a TUTTE le coppie sul giro
di ripartenza non migliora il record e non batte il placebo. Questa è la forma nuova
promessa nel verdetto — non un ritocco del delta, un meccanismo diverso: alla ripartenza
passa chi ha la gomma fresca, non chiunque.*

## La forma

Sul giro di ripartenza la soglia della coppia si abbassa **solo se chi attacca (dietro)
ha la gomma più fresca di chi difende (avanti) di almeno G giri**. Le altre coppie
restano alla soglia di sempre.

**G = 5 giri, dichiarato a priori e non tarato**: è il τ del rodaggio sigillato
(4,75 giri, `modello_v2.json`) arrotondato all'intero — sotto quel divario il set
«fresco» sta ancora scaldando e il vantaggio non è pieno.

## La misura (fondo 2018-2025 asciutto, stesse definizioni delle prereg 1-2)

Occasioni come sempre (adiacenti, gap ≤ 1,5 s, niente in/out-lap); in più il divario
d'età **Δ = età(avanti) − età(dietro)** letto dalle celle del giro (coppie senza età su
una delle due: escluse e contate). Quattro celle: {ripartenza, verde} × {fresco: Δ ≥ G,
resto: Δ < G}.

- **OR_f** = odds(sorpasso | ripartenza, fresco) / odds(sorpasso | verde, fresco)
- **OR_r** = odds(sorpasso | ripartenza, resto) / odds(sorpasso | verde, resto)
- **Δsoglia_fresco = ln(OR_f) / pendenza sigillata** (stessa conversione dichiarata).

## I cancelli (scritti prima)

- **R0″ — esistenza dell'interazione**: OR_f con IC95 (bootstrap blocchi-gara, 2.000,
  seme 20260807) che esclude 1, **e** OR_f > OR_r al punto. Se l'effetto di ripartenza
  non è concentrato nei freschi, questa forma è la stessa cosa dell'uniforme già bocciata
  e si chiude senza toccare il record.
- **R1/R2/R3 — applicazione sul record**, identici alle prereg 1-2 (basi: R1 ≤ 8,
  R2 ≤ 34; placebo con giri finti, seme 20260807, stessa condizione d'età). La regola
  gira nel record con accensione IN MEMORIA (il sigillo resta `attivo: false` finché i
  cancelli non hanno parlato).

Esiti dichiarati: R0″ fallisce → NULL, fine della famiglia ripartenza (niente quarta
forma senza un dato nuovo). R0″ passa ma R1-R3 no → a referto, spento, fine comunque.
Tutto passa → accensione nel sigillo (laboratorio e pagina «E se?»).
