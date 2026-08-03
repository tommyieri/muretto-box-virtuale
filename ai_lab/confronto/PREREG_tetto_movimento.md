# PREREG — il tetto al movimento: le auto smettono di attraversarsi

**Scritta e sigillata il 03/08/2026**, prima di produrre un solo numero. I parametri della
fonte sono già dentro (`duello_tum_2026.json`), estratti prima che il motore girasse una
volta con essi.

Riferimenti: `ESITO_cliff.md` (il ramo precedente, chiuso NULL) · `PREREG_sorpassi.md`
(il ramo della probabilità, chiuso fuori campione) · KPI F2/F3/F5 firmati il 03/08 ·
banco unico `banco_regole.mjs` (tarato 8/8).

---

## 1 · Perché questa e non un'altra

Il referto gara-intera ha stabilito che il pareggio del motore col nullo è la **somma di
due popolazioni opposte**: dove il motore non inventa movimento vince 44-27, dove ne
inventa perde **13-28 (p = 0,027)**. E ha anche indicato l'unica strada permessa: **un
tetto al movimento**, non una probabilità di sorpasso — quest'ultima è un ramo chiuso
fuori campione su 78 gare mai viste, mancato per 0,0024, e non si riapre.

Il motivo per cui il motore inventa movimento è dichiarato nel kernel da sempre: **le auto
possono attraversarsi**. Nessun vincolo impedisce a un cum di scavalcarne un altro, quindi
il campo si rimescola più di quanto la pista consenta.

**Perché ora e non il cliff.** Il cliff è appena fallito perché serviva sapere quanto
degradano le gomme circuito per circuito, e quel numero non esiste da nessuna parte. Qui è
il contrario: la grandezza che serve — **quanto è difficile passare su quel circuito** — è
pubblicata, per circuito, e i suoi autori la usano davvero.

## 2 · I parametri, TRASCRITTI (e la differenza dal cliff conta)

Fonte: **TUMFTM/race-simulation**, blocco `race_pars` dei 121 file `pars_*.ini`.

| parametro | valore | natura |
|---|---|---|
| `min_t_dist` | **0,50 s** | **costante su tutti e 121 i file** |
| `t_duel` | **0,30 s** | costante su tutti e 121 |
| `t_overtake_loser` | **0,30 s** | costante su tutti e 121 |
| `t_gap_overtake` | **per circuito**, mediana 2,025 s, da 1,26 a 3,75 | 19 valori distinti |

**Questa è trascrizione, non derivazione**, e la differenza rispetto al cliff è la ragione
per cui questa prereg può essere la prima e non la seconda: quei `k_2_quad` erano fit mai
attivati (`tire_deg_model = "lin"` in 2.479 voci su 2.479), mentre questi valori sono
**scelti dagli autori e usati dal loro simulatore**. Tre sono costanti su tutto il
dataset, quindi non c'è nemmeno una statistica da scegliere.

**I valori per i nostri circuiti** (file 2019, il più recente disponibile):

| gara | t_gap_overtake | | gara | t_gap_overtake |
|---|---|---|---|---|
| Giappone | 1,26 s | | Spagna | 2,31 s |
| Gran Bretagna | 1,35 s | | Ungheria | 2,42 s |
| Cina | 1,50 s | | Australia | 2,70 s |
| Belgio | 1,83 s | | Canada | 3,75 s |
| Austria | 2,01 s | | Monaco | 3,75 s |

**Miami non esiste in TUM** (non correva fra il 2014 e il 2019). **Non si sostituisce con
la mediana**: la gara esce dal perimetro e lo si dichiara. Un valore di ripiego travestito
da misura è precisamente ciò che il badge del pit-loss ha insegnato a non fare.

**Nota di provenienza da tenere in prereg**: i parametri vengono da vetture e regolamenti
2019, con il DRS. Nel 2026 il DRS non esiste (Manual Override Mode). Il disallineamento
**si dichiara e non si corregge**: correggerlo sarebbe stimare.

## 3 · La forma del vincolo

Al giro `g`, per ogni coppia di auto adiacenti nell'ordine per cum:

1. **Pavimento**: il gap fra due auto non scende mai sotto `min_t_dist` = 0,50 s. Chi
   raggiunge senza avere il passo per passare **resta dietro**, e il suo cum viene alzato
   a quel pavimento.
2. **Sorpasso concesso** solo se il vantaggio di passo dell'inseguitore supera
   `t_gap_overtake` del circuito.
3. **Costi in tempo, non probabilità**: `t_duel` = 0,30 s a entrambi per ogni giro in
   contatto; `t_overtake_loser` = 0,30 s a chi subisce il sorpasso.

**Il kernel non si tocca.** Il vincolo si applica come funzione di riordino sull'ordine per
cum, con lo stesso contratto del cliff: **assente o null ⇒ numeri bit-identici**, e a dirlo
sarà una sentinella, non un commento.

**Cosa NON è**: non predice *chi* supererà chi. Non introduce nessuna probabilità. Limita
*quanto* movimento è fisicamente possibile — che è precisamente la formulazione che il
referto gara-intera dichiara permessa, e la ragione per cui `s25_difesa` non viene violata.

## 4 · I cancelli

**T1 · la ferita.** La popolazione «inventa PIÙ movimento del vero» (terzile alto, oggi
**13-28**) migliora: il saldo `vince − perde` sale di **almeno 6** (da −15 a ≥ −9).

**T2 · nessun danno dove il motore ha ragione.** I due terzili bassi, oggi **44-27**, non
peggiorano: saldo ≥ **+13** (oggi +17), cioè al più quattro casi persi.

**T3 · il movimento si avvicina al vero.** L'eccesso medio di cambi di posizione
(`cambi_motore − cambi_reali`) del terzile alto **si riduce in valore assoluto** rispetto
a oggi (+1,8).

**T4 · la fisica non peggiora dove è validata.** Banco unico, metrica a due giri (n=235):
nessun peggioramento significativo, `p ≥ 0,05`.

**T5 · il placebo** (KPI F5, firmato). Il tetto deve battere un **tetto finto**: stesso
meccanismo, stessa frequenza di blocchi, ma con `t_gap_overtake` **assegnato a caso fra i
circuiti** (permutazione dei dieci valori, seme dichiarato 20260803, 200 permutazioni). Se
il tetto vero non batte il 95° percentile dei finti su T1, **il guadagno non viene dalla
pista ma dal fatto di frenare il movimento in generale** — ed è NULL.

**T1, T2, T4 e T5 devono passare tutti.** T3 è diagnostico e si riporta comunque.

## 5 · Cosa si scrive se falliscono

NULL onorato per iscritto, con la formula: *«il vincolo di duello importato da TUMFTM, coi
suoi parametri pubblicati, non riduce il movimento inventato dal motore là dove ne inventa
troppo»*, e il saldo residuo del terzile alto dichiarato.

**Se passa T1 ma non T5**, si scrive che il guadagno esiste ma **non dipende dal circuito**:
in quel caso il vincolo utile è un pavimento uniforme, non una soglia per pista, e la
distinzione va detta perché cambia cosa si è imparato.

Nessuna seconda forma di vincolo si prova sullo stesso bersaglio senza dichiararla come
secondo tentativo.

## 6 · Cosa questa prereg NON autorizza

- Non autorizza nessuna **probabilità di sorpasso**, in nessuna forma: ramo chiuso.
- Non autorizza a **stimare** né a ricentrare `t_gap_overtake` sui nostri dati.
- Non autorizza a **inventare un valore per Miami**: la gara esce dal perimetro.
- Non autorizza l'**accensione in produzione**: è una decisione del PO, dopo i cancelli.
