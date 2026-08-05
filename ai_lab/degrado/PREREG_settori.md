# Prereg — i settori contro il muro del rumore

**Data: 04/08/2026.** Scritta **prima** di aver stimato un solo degrado di settore.
Esegue il lavoro n. 4 della direttiva del PO del 04/08.

---

## 1 · Il muro, e perché non è il modello

Misurato e già a referto (`ESITO_degrado_dal_campo.md`): il divario fra la mescola che
degrada di più e quella che degrada di meno vale **0,01578 s per giro d'età**, e il rumore
giro-per-giro — residuo dopo aver tolto pilota e giro — vale **0,3457 s**. Il rapporto:

> **21,9 giri d'età perché il divario raggiunga il rumore di un giro** — cioè esattamente
> quando i team la gomma la tolgono (HARD 22, MEDIUM 19, SOFT 12).

Il PO ha nominato la conseguenza: *il muro è la FONTE, non il modello.* Una misura meno
rumorosa farebbe emergere lo stesso effetto **dentro** la vita utile del pneumatico.

## 2 · Una cosa da correggere subito: i microsettori non ce li abbiamo

La direttiva dice «i microsettori — che il progetto ha già toccato per la redazione
tecnica». **Verificato sul grezzo, e non è così**: le colonne `ms1`, `ms2`, `ms3` del fondo
non sono tempi, sono **stringhe di codici di stato** per mini-settore (`'7511111'`,
`'11110111'`, `'111001'`), della stessa famiglia dei `SegmentsSector` di FastF1 —
bandiere/colori di segmento, non cronometri.

La risoluzione temporale più fine che il progetto possiede sono i **tre settori**: `s1`,
`s2`, `s3`, in secondi, presenti e completi. Questa prereg misura quelli. Se un giorno
arriveranno tempi per mini-settore, la domanda si rifà con la stessa forma e più
risoluzione.

## 3 · La metrica, e la soglia scritta adesso

Per ogni settore `k`, lo **stesso** stimatore del lap intero — effetti fissi `pilota` e
`giro` per gara, tolti con doppia sottrazione, e ρ per mescola sul residuo — e poi:

```
età_pareggio(k) = rumore(k) / divario(k)
```

dove `divario(k) = max ρ(mescola) − min ρ(mescola)` sul settore, e `rumore(k)` è la
deviazione standard del residuo dopo pilota e giro. Sul giro intero questo numero vale
**21,9**.

| | cancello | soglia, decisa adesso |
|---|---|---|
| **M1** | esiste un settore la cui età di pareggio è **dentro la vita utile** | `età_pareggio(k) ≤ 15 giri` |
| **M2** | **placebo**: le etichette mescola rimescolate entro (gara, pilota), 200 volte | il divario vero del settore vincente sta nel **5 % superiore** dei finti |
| **M3** | **stabilità**: il settore vincente è lo stesso stimando sul fondo 2022-2025 | stesso settore, e il suo divario ha lo **stesso segno** |

**Quindici e non venti**: la mediana di stint della MEDIUM è 19 giri e quella della SOFT 12.
Una misura che arriva al rumore a 15 giri parla mentre la gomma è ancora in macchina su
tutte e tre le mescole; una che ci arriva a 20 parla solo della HARD, cioè quasi mai.

## 4 · Cosa si spedisce, in ogni ramo

- **M1, M2, M3 passano** → si spedisce un ρ **per mescola** stimato sul settore vincente e
  riportato alla scala del giro con `ρ_giro(m) = ρ_settore(m) × (ρ_giro_comune /
  ρ_settore_comune)`. **È un'assunzione dichiarata** — che il degrado si ripartisca fra i
  settori nella stessa proporzione per tutte le mescole — e va scritta accanto al numero,
  non nascosta dentro.
- **M1 passa, M2 no** → NULL: il settore migliore non regge il placebo.
- **M1 passa, M3 no** → si spedisce **solo** se il settore vincente sul 2026 è anche il
  migliore sul fondo; altrimenti è una scelta fatta su undici gare e si dichiara tale.
- **M1 fallisce** → **NULL, e la risposta al PO è definitiva con questa fonte**: alla
  risoluzione che abbiamo il muro non cade. Non è il modello e non è il settore: è che
  servono tempi per mini-settore, che nel nostro grezzo non esistono.

## 5 · Cosa NON si fa

- Non si cambia il perimetro: stesse gare 2026, stesso filtro verde, stesse mescole slick
  del `ESITO_degrado_dal_campo.md`, così i numeri sono confrontabili riga per riga.
- Non si sceglie il settore dopo aver visto quale conviene: il settore vincente è quello con
  l'età di pareggio più bassa, e la regola è scritta qui.
- Non si tocca `rho` in produzione. Un ρ per mescola è un cambio di fisica e vuole la sua
  accensione, non un merge.

---

**Sigillo.** Committata prima di aver stimato un solo settore.
