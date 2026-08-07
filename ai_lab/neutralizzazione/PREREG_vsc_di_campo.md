# PREREG — la VSC letta DI CAMPO (scritta prima di misurare)

*07/08/2026, sera. Il debito: VSC_REGIME pooled R_lap = 1,055, non fisico («nessuno
costruisca su VSC», Sessione N). Ma il dettaglio per-circuito dice altro: 6 circuiti su 9
sono DENTRO il range fisico [1,20–1,50]; a rompere il pooled sono Montreal (1,043, tanta
massa) e Suzuka (zero giri), e la classificazione v2 marca «evento» con una soglia di
appena DUE auto.*

## L'ipotesi, e da dove viene (dichiarato)

Il segnale '6' per-cella marca anche VSC **locali o parziali** — momenti che toccano
poche auto o una frazione di giro — che non rallentano il giro come una VSC vera.
Motivazione INDIPENDENTE da questo esito: (a) `pitloss_priors.json` ha già misurato che
restringere alle neutralizzazioni di campo sposta il kappa VSC da 0,9304 a 0,9791 —
«buona parte della compressione VSC misurata prima era artefatto di gialle locali»;
(b) la definizione `regimePerGiroDiCampo` (>50% del campo, la rossa vince a parità)
esiste da stamattina, nata per le ripartenze, NON tarata su questo esito.

## La misura

- **Perimetro primario: le 11 gare 2026 dell'archivio** (la fonte dichiarata rotta).
  Secondario descrittivo: il fondo 2018-2025 asciutto (non decide, dà potenza al quadro).
- **R_lap(auto, giro)** = lap_time / mediana dei lap_time VERDI della stessa auto nella
  stessa gara (filtro `verde()` di definizioni, il filtro del passo di sempre); niente
  in-lap/out-lap nel numeratore. Aggregato = mediana dei rapporti.
- **Tre popolazioni**: (1) giri **VSC DI CAMPO** (`regimePerGiroDiCampo` = VSC);
  (2) giri VSC **solo locali** (cella '6' ma il campo NON è in VSC) — la diagnosi;
  (3) per confronto, SC di campo (attesa: ~1,6, già validata).

## Il cancello (V1, stesso range fisico della Sessione N)

**PASSA** se, sulle gare 2026: R_lap(VSC di campo) pooled ∈ **[1,20–1,50]** E dentro il
range in **≥ 6 circuiti** fra quelli con almeno 5 giri-auto VSC-di-campo. Diagnosi
attesa (non vincolante): R_lap dei «solo locali» ≈ 1,0, e Montreal o rientra nel range
o perde quasi tutta la sua massa VSC (cioè il suo 1,043 ERA l'artefatto).

## Gli esiti dichiarati

- **PASSA** → rettifica datata sulle due NOTE (`STATUS_VOCABOLARIO_NOTA.md`,
  `rlap_per_regime.NOTA.md`): il veto si RESTRINGE — «nessuno costruisca sulla VSC
  per-cella/evento-≥2-auto» resta; la **VSC di campo è utilizzabile con targhetta**.
  Nessun consumo di produzione si accende qui: resta una decisione separata.
- **FALLISCE** → la VSC è rotta anche letta di campo: il debito è del segnale '6'
  stesso, il veto resta pieno, e non c'è terza lettura sulla stessa fonte.
