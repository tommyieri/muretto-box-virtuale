# REPORT — FASE B: la magnitudine corretta della proiezione di degrado

*Sessione 2026-07-20, branch claude/fase-b-magnitudine. Protocollo:
`PREREG_SESSIONE_FASEB.md` (committata prima dei numeri, commit b6fbe9b).
Generatore: `gen_faseb_magnitudine.py`; dettaglio: `data/FASEB_MAGNITUDINE_REPORT.txt`.*

## Esito (formato del mandato)

**MAGNITUDINE: M1 — corregge il doppio conteggio di M0.**
BIAS M0 **+0.4212** [IC95 +0.34, +0.51] → M1 **+0.0494** [IC95 −0.006, +0.092];
MAE **0.57 → 0.35** s/giro. n = 34.707 coppie, 7.081 casi, 9 gare (Monaco escluso).

- **M0** (gancio attuale, `rate·(A−1)`): BIAS **positivo e IC che esclude lo zero** →
  **doppio conteggio confermato in replay**, non solo in teoria.
- **M1** (`rate·(A−A₀)`, A₀ = mediana life del window pace_base): BIAS **quasi-nullo**
  (IC include 0), MAE la più bassa. **QUALIFICA** su tutti e tre i criteri congelati.
- **M2** (`rate·(A−A_cur)`): BIAS **−0.25** (sottostima, come previsto — ancora il passo
  al giro corrente che è già sotto pace_base). Non qualifica.

Conferma diagnosi (descrittiva): A₀ mediano **8.0** [q25 5, q75 11.5]; sovrastima
implicata del gancio `rate·(A₀−1)` ≈ **+0.37 s/giro** con rate mediano 0.052 — combacia
col BIAS misurato di M0 (+0.42). La teoria di Fase A regge sui dati.

## Il fix (implementato, gancio NON toccato)

M1 entra come **adapter al call-site** in `pitbande.mjs`, esattamente come la prereg
prevedeva: `tyreAge0' = tyreAge0 − A₀ + 1`, così la penalità del gancio
`rate·(tyreAge0'+s−1)` diventa `rate·((tyreAge0+s) − A₀) = rate·(A − A₀)`. Il gancio
resta **byte-identico**; A₀ si ricostruisce in-pagina dal window di pace_base (stesso
filtro del kernel), **nessun file di dati nuovo**. Verificato:

- **banda-zero bit-identica** al kernel (a rate=0 la penalità è 0 per ogni età): PASS.
- Effetto sullo scenario che aveva rivelato il problema (Austria VER giro 36): prima
  (M0) tutti e tre gli scenari P8; ora (M1) **ottimistico P7** (tiene la posizione),
  centrale/pessimistico P8 di stretta misura (NOR +0.04/+0.12). Il degrado non è più
  gonfiato: VER è sul confine P7/P8, non nettamente scavalcato.

## Cosa NON dice questo esito

- **Non riapre il degrado-predizione**: la banda è quella climatologica già TRASFERIBILE
  (K2 43.7%); qui si è validato solo COME applicarla. M1 isola il fix di FORMA — il suo
  BIAS residuo di +0.05 riflette l'accuratezza della banda (rate storico vs rate vero del
  singolo pilota) e la lieve evoluzione-pista, non la formula.
- **Non accende gli scenari**: `SCENARI_ATTIVI` resta OFF. Il blocco tecnico
  (magnitudine non validata) è però RIMOSSO: ora è una pura decisione del PO, a una riga.

## Conseguenza sul piano

- Fase B — prima metà (magnitudine): **CHIUSA con fix validato e applicato**.
- Fase B — seconda metà (copertura-rolling della banda aggiornata coi giri già corsi):
  domanda successiva, **prereg propria**, quando il PO vuole.
- Produzione: invariata (gancio a banda-zero). Demo: adapter M1 attivo nel calcolo,
  scenari ancora dietro il flag.

## Golden (prima e dopo)

test_b.py 449/449 · test_b.mjs 449/449 · demo/test_pit.mjs 11/11 · test_degrado_hook
banda-zero bit-identica · check_banda_gancio PASS · verifica_k4_clim PASS · pitbande
import OK. Kernel, modulo pit (logica), gancio (logica), produzione: non toccati.
