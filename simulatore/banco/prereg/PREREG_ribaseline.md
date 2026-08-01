# PREREG — ri-baselinare la linea di non-regressione del rientro

*Scritta il 01/08/2026 PRIMA di riscrivere il golden. Voce 7 di
`ai_lab/confronto/PIANO_CORREZIONE.md`.*

## Il problema, e perché non si risolve rilanciando il generatore

`s15` confronta i secchi del rientro con una linea registrata in
`banco/golden/banco_2026.json`:

```
PULITA        quota entro ±1   94,29%
SOSTE_RIVALI                   87,36%
NEUTRA                         67,72%
```

**Quei numeri sono stati misurati col metro vecchio** — quello che leggeva il futuro, prima
che la banda smettesse di calibrarsi su di esso (voce B). Confrontare una misura onesta con
una baseline disonesta non dice niente: il calo che `s15` denuncia oggi non è una
regressione del motore, è il prezzo di aver smesso di barare.

E la targhetta del golden **non lo dice**: non porta né la data, né quale versione del metro
l'ha prodotta. Un numero senza quelle due cose non è una linea di base, è un ricordo.

## Cosa si fa, e cosa NON si pretende

Si riscrive la linea col motore di oggi, e si **dichiara** cosa c'è dentro: data, `ρ`, `δ₇₀`,
rodaggio, soglia di base, regola sulle soste dei rivali, e gli hash dei modelli.

> **Ri-scrivere la linea rende `s15` verde PER COSTRUZIONE.** Un test di non-regressione
> contro una baseline appena riscritta non prova niente sul motore di oggi: prova solo che
> il motore è uguale a sé stesso. **Il valore è tutto per il futuro** — dal prossimo cambio
> in poi `s15` torna a mordere.
>
> Va scritto qui perché domani un verde non venga scambiato per una vittoria.

## Cosa si registra come «prima», per non perderlo

I numeri vecchi **non si cancellano**: restano nel golden sotto `linea_precedente`, con il
motivo per cui sono decaduti. Una misura non si butta perché è stata superata (E21), e chi
un giorno volesse sapere quanto è costato smettere di leggere il futuro deve poterlo
leggere.

## Cosa fa dichiarare NULL

- la nuova linea risulta **peggiore** su tutti e tre i secchi rispetto a quella vecchia: nel
  caso vorrebbe dire che qualcosa si è rotto oltre alla correzione del metro, e va capito
  prima di congelarlo;
- il golden nuovo non porta la targhetta completa: sarebbe ricreare il problema che si sta
  chiudendo.

## Cosa NON dimostra

- Non dice che il motore di oggi è **buono**: dice qual è, oggi, il suo comportamento — e lo
  fissa perché domani si possa vedere se peggiora.
- I secchi restano sulle stesse **11 gare 2026**: la linea è dentro campione come tutto il
  resto.
