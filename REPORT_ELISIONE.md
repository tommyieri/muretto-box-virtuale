# REPORT_ELISIONE — E1: il carburante si elide nei gap? (misura, non asserzione)

**VERDETTO: ELISIONE CONFERMATA** — il motore e' SANO nel suo uso proprio (gap relativi); il +27% non e' in discussione.

Residuo sul GAP fra piloti di controllo puliti (A dietro B, stesso freeze): gap_reale(E) - gap_simulato(E), SENZA re-inflazione. Se il carburante si elide, ~0 (mediana |/giro| <= 0.3) e insensibile alla re-inflazione.

| k | n coppie | mediana \|residuo/giro\| | IQR/giro | p95 \|/giro\| | max\|raw-reinfl\| | <=0.30? |
|---|---|---|---|---|---|---|
| 1 | 3937 | 0.280 | [-0.275,+0.286] | 1.296 | 0.0e+00 | SI |
| 3 | 3221 | 0.265 | [-0.261,+0.269] | 1.168 | 0.0e+00 | SI |
| 5 | 2603 | 0.252 | [-0.253,+0.250] | 1.150 | 0.0e+00 | SI |

Letture: (1) mediana |residuo/giro| <= 0.30 a TUTTI i k, e NON cresce con k (0.28->0.27->0.25) -> l'errore relativo del motore e' piccolo e stabile, al contrario del residuo ASSOLUTO per-pilota (~2 s/giro, carburante). (2) max|raw-reinfl| = 0 esatto -> il termine carburante e' identico per due auto allo stesso giro e si cancella ESATTAMENTE nella differenza. L'elisione non e' un'asserzione: e' una identita' verificata.

