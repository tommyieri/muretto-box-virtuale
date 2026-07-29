# REPORT — FASE B (2a metà): calibrazione degli scenari

*Sessione 2026-07-20, branch claude/fase-b-copertura. Protocollo:
`PREREG_SESSIONE_FASEB2.md` (committata prima dei numeri, commit 2b832be).
Generatore: `gen_faseb2_copertura.py`; dettaglio: `data/FASEB2_COPERTURA_REPORT.txt`.*

## Esito (formato del mandato)

**CALIBRAZIONE: CALIBRATA — copertura 43.1%** [IC95 38.5%, 47.0%], soglia congelata
≥ 40%. n = 6.163 finestre, 9 gare (Monaco escluso).

Con la magnitudine corretta (M1), la banda climatologica proiettata in avanti contiene
il degrado cumulato osservato sui prossimi giri **al 43.1%** delle finestre — sopra la
soglia. Il miss è **quasi simmetrico**: 26.2% sotto l'ottimistico (realtà migliore del
best case), 30.7% sopra il pessimistico (peggiore del worst). Nessun bias di direzione:
la banda non è spostata, è solo dell'ampiezza giusta per contenere ~la metà centrale.

## Il fatto che vale più del 43% (secondario, ma netto)

Ricentrare la banda sulla **rate stimata dai giri già corsi** (banda "aggiornata dal
vivo") **crolla la copertura a 22.0%** (−21 punti). È la conferma più forte, sulla
stessa metrica, di ciò che l'arco chiuso aveva stabilito (K2 TRASFERIBILE, de-confuso
NULL, combinazione = moneta): **la rate live è troppo rumorosa/confusa** (pochi giri,
evoluzione-pista) e, usata per ri-centrare, peggiora la calibrazione invece di
migliorarla. La banda STATICA climatologica è la sorgente giusta per gli scenari.

## Lettura onesta (senza gonfiare)

- L'**IC95 [38.5%, 47.0%] sfiora sotto il 40%**: il verdetto usa la copertura puntuale
  (43.1%, come da soglia pre-registrata), ma la calibrazione non è larga — è "onesta
  quanto basta", non abbondante.
- Due circuiti **sotto-coprono**: spielberg 29.9%, silverstone 35.4% (gli altri 44-50%).
  Coerente con la loro storia (Austria: le tre mescole degradano quasi uguale → banda
  stretta → contiene meno; Silverstone: graining variabile). Non è un difetto del
  meccanismo, è la banda che è genuinamente più incerta lì.
- Copertura per compound omogenea (SOFT 38%, MEDIUM 45%, HARD 42%).

## Conseguenza sul piano

- **Cancello di calibrazione: PASSATO.** Gli scenari (con M1) sono onesti sull'orizzonte
  che serve al pit. Il blocco alla visibilità è tecnicamente sciolto su TUTTI i fronti:
  magnitudine (Fase B 1a metà, M1) e calibrazione (questa). L'accensione di
  `SCENARI_ATTIVI` resta una **decisione del PO**, ora senza riserve tecniche aperte.
- **Nessuna banda aggiornata dal vivo**: il secondario lo esclude sui dati; gli scenari
  restano alimentati dalla banda statica climatologica.
- Prossimo: **Fase C** (innesto live + shadow-run in Ungheria), con la dipendenza aperta
  sul feed (MQTT OpenF1 rotto dal 19/07).

## Golden (prima e dopo)

test_b.py 449/449 · test_b.mjs 449/449 · demo/test_pit.mjs 11/11 · test_degrado_hook
banda-zero bit-identica · verifica_k4_clim PASS. Questa sessione aggiunge solo file
nuovi (generatore, CSV, report, prereg): kernel, modulo pit, gancio, produzione non
toccati. Nessun file della demo modificato (gli scenari restano OFF).
