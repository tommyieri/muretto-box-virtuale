# REPORT — CLIMATOLOGIA DEL DEGRADO (statistica descrittiva)

*Sessione 2026-07-16, branch climatologia-degrado. Protocollo: `PREREG_SESSIONE_CLIM.md`
(committata prima dei numeri, commit 268a41f). Generatore: `gen_climatologia_degrado.py`;
output tecnico completo: `data/CLIMATOLOGIA_REPORT.txt`.*

## Esiti KPI (formato del mandato)

**K1: combinazioni informative 42/61** (elenco completo nel report tecnico; per circuito:
austin S/M/H, baku M/H, catalunya S/M/H, hungaroring M/H, interlagos S/M, las-vegas M/H,
lusail M/H, marina-bay S/M/H, melbourne M/H, mexico-city S/M/H, miami M/H, monaco M/H,
montreal M/H, monza M/H, shanghai M, spa-francorchamps S/M, spielberg M/H, suzuka M,
yas-marina M/H, zandvoort M/H)

**K2 coerenza 2026: 39.9% dentro banda → STOP** (soglia congelata ≥ 40%; IC95 bootstrap
blocchi-gara [27.5%, 50.9%])

**K3 sanità: PASSA** (zero violazioni su 42 righe informative: ordine, magnitudini,
utilità vs pit-loss, conteggi)

**K4 gancio: scenari DISTINGUIBILI+PLAUSIBILI — golden banda-zero BIT-IDENTICO**
(`verifica_k4_clim.mjs`, meccanico: NON attiva nulla)

**Conseguenza (da prereg, senza attenuazioni): il gancio resta a banda-zero e la
climatologia si archivia con questa nota.** Il CSV committato è la versione
leave-2026-out (colonna `include_2026=False`). Nessun verdetto strategico: è del PO.

## Vicoli ciechi esplorati (una riga ciascuno)

- **Per-team (2026)**: mediane per team +0.034…+0.064 attorno al pooled +0.056, spread
  piccolo rispetto all'IQR degli stint → condizionare per team non paga.
- **Settori vs giri (FastF1, Austria/British 2026)**: i settori si muovono coerenti col
  giro (ad Austria S2 porta il grosso: +0.024 su +0.054) → nessun guadagno per una banda
  a livello giro.
- **Cliff**: allineando 1.916 stint lunghi alla fine, residuo mediano +0.12 s solo
  sull'ultimo giro utile con IQR ±0.5 s → nessun cliff sistematico (caveat: gli stint
  tirati oltre il limite non esistono nei dati, sopravvivenza).
- **Per-era pre-2023 (FastF1 2019-22, solo cache)**: Barcellona +0.011 (2019) vs +0.138
  (2022), Austria ~0 (2019-21) vs ~+0.08 (2022+) → cross-era instabile, conferma peso 0
  alle stagioni ≤2022.
- **British 2025 via FastF1**: pendenze mediane −0.41 s/giro su pista che si asciuga →
  ha motivato la guardia gara-bagnata (quota INT/WET > 5% → gara esclusa), decisa PRIMA
  dei numeri finali.

## Cosa mostra l'esplorazione (ciò che il degrado È STATO)

- **Forma**: sul plateau (life ≥ 3) il profilo mediano è quasi lineare fino a life ~30;
  `L_PLATEAU_MIN = 3` (pendenza insensibile spostando il taglio a 4 o 5).
- **Warm-in reale sui primi 2-3 giri**, con segni diversi per mescola (SOFT/MEDIUM più
  lenti al giro 2, HARD più veloce di ~0.15-0.30 s del proprio plateau): riportato nel
  CSV (`warmin_life2_med` dove n ≥ 10 giri).
- **Il condizionamento (mescola, circuito) sposta davvero**: Bahrain-SOFT +0.157 vs
  globale +0.072; shanghai-MEDIUM +0.122; lusail-MEDIUM −0.019 → la climatologia
  condizionata ha contenuto informativo (K1 42/61).
- **2026 ≠ storia recente in modo non uniforme**: il profilo HARD 2026 sale più ripido
  del 2023-25 (a life 20: +0.95 vs +0.59 sul profilo mediano) — coerente con gomme
  nuove e più piccole. È esattamente ciò che K2 quantifica sotto.

## Costruzione (dalla prereg, senza ritocchi)

Degrado marginale = pendenza OLS del tempo **fuel-corretto (3/70, convenzione kernel)**
su `life`, sul plateau dello stint, **riferimento LOCALE allo stint** (mai passo di gara
intera). Igiene: verdi, no in/out-lap, no drive-through, `2 ≤ lap ≤ N−1`, solo slick,
outlier 1.07×, stint ≥ 5 giri usabili. Guardia gara-bagnata: 8 gare escluse (elenco nel
report tecnico; tra cui Interlagos 2024 100%, Australia 2025 81%, British 2025 74%).
Stint qualificati: **2.909** (2.483 del 2023-25, 426 del 2026). Pesi 1/.5/.25/.125,
quantili pesati (Hazen). Banda = q25/mediana/q75, **a due lati** (nessun pavimento a 0:
l'errore della banda unilaterale è inciso e non si ripete).

## K2 nel dettaglio (il cuore dell'esito)

Bande costruite **senza il 2026** (anti-circolarità), testate sui 316 stint 2026 con
banda valida: copertura pooled **39.9%** contro nominale ~50% e soglia 40% → **STOP**.

| taglio | copertura | n |
|---|---|---|
| HARD | 45.6% | 147 |
| MEDIUM | 36.9% | 160 |
| SOFT | 0.0% | 9 |
| Giappone | 69.0% | 42 |
| Austria | 49.1% | 53 |
| Cina | 48.5% | 33 |
| Australia | 43.6% | 39 |
| Miami | 39.4% | 33 |
| Monaco | 26.7% | 30 |
| Barcellona | 22.6% | 62 |
| Canada | 12.5% | 24 |

Lettura onesta: lo STOP è **per un decimo di punto** e l'IC95 [27.5%, 50.9%] attraversa
la soglia — ma la soglia era congelata e si onora. Il quadro per-gara non è rumore
uniforme: Suzuka/Spielberg/Shanghai trasferiscono quasi al nominale, Barcellona/
Montreal/Monaco no — **le gomme 2026 spostano la distribuzione in modo specifico per
circuito**, non con un offset globale recuperabile allargando la banda. Il SOFT 2026 è
quasi non testabile (n=9). Nota già incisa altrove e coerente: il degrado utile al
routing va informato da dati 2026, non da un prior storico — questa sessione lo
**misura** anche per la forma descrittiva per-circuito.

## K4 nel dettaglio (meccanico, non attivazione)

Austria, caso golden VER freeze 30 → pit 34 (metà di 71 giri, verde). Bande spielberg:
MEDIUM [+0.063, +0.082, +0.107], HARD [+0.055, +0.074, +0.088]; SOFT NON-INFORMATIVA →
[0,0,0] per regola dichiarata. VER (HARD, età gomma 12, pit-loss 21.63 s):

| scenario | rientro | gap avanti | gap dietro |
|---|---|---|---|
| ottimistico | P7 | +4.426 s | −1.308 s |
| centrale | P7 | +3.054 s | −1.011 s |
| pessimistico | P7 | +2.586 s | −0.810 s |

Ampiezza 2.158 s su orizzonte 5 giri: **distinguibili** (≥ 0.5 s), **plausibili**
(≤ 25% del pit-loss = 5.41 s; ordine pess ≥ centrale ≥ ott su tutti i piloti).
Banda-zero **bit-identica** (`test_degrado_hook.mjs` PASS prima e dopo).

## Golden (prima e dopo)

`test_b.py` 449/449 (max diff 4.3e-12) · `test_b.mjs` 449/449 (<1e-9) ·
`demo/test_pit.mjs` 11/11 · `test_degrado_hook.mjs` banda-zero bit-identica —
**verdi PRIMA e DOPO**. Kernel, modulo pit, gancio, golden, produzione: non toccati.

## Limiti dichiarati

- Il riferimento locale lascia dentro l'evoluzione pista → bias verso il basso.
- q25/q75 pesati descrivono metà centrale della storia: le code (graining severo,
  gestione estrema) sono fuori per costruzione ed etichettate come tali.
- Madrid (madring): nessuna storia, nessuna riga.
- La copertura K2 è calcolata solo dove esistono bande leave-2026-out valide (47
  combinazioni): i circuiti 2026 non ancora corsi non sono testati per definizione.
- "Previsto" non compare in nessun artefatto: tre scenari etichettati come scenari,
  distribuzione di ciò che il degrado È STATO.
