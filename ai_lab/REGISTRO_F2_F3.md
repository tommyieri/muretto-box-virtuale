# Registrazione degli esiti di F2 e F3 — pagina nuova e datata

**Data: 03/08/2026.** Come per F1 e F4, questa pagina **non modifica** `KPI_5_4_4.md`: le
soglie firmate restano dove sono. Qui si registrano due esiti.

F2 e F3 si registrano **insieme** perché sono la stessa misura letta su due popolazioni, e
perché leggerne uno senza l'altro dà un'impressione falsa. Fonte:
`ai_lab/confronto/ESITO_tetto_uniforme.md`, che esegue `PREREG_tetto_uniforme.md` sigillata
prima dei numeri.

---

## Gli esiti

> **F2 · RAGGIUNTO — alla lettera, con il meccanismo dichiarato.**
> Terzile alto **10-21, p = 0,0708** (serviva p ≥ 0,05 e segno non peggiorato: saldo −11
> contro −15). Il cancello U3 della prereg passa, quindi la regola di decisione scritta
> prima è soddisfatta.

> **F3 · MANCATO.**
> Due terzili bassi **31-28, saldo +3, p = 0,7948**. Serviva **≥ 44-27 con p ≤ 0,0568**.

Configurazione: il **tetto uniforme** — il vincolo di duello con tutti e quattro i
parametri costanti nella fonte TUMFTM — su undici gare, strati congelati, taratura verde
(il braccio senza vincolo riproduce esattamente 193 casi, 13-28 e 44-27).

## Come F2 è stato raggiunto, e perché va detto prima del fatto che lo sia

| | senza vincolo | col vincolo |
|---|---|---|
| terzile alto, appaiato | 13-28 | 10-21 |
| **pari** | 22 | **32** |
| **quota di vittorie fra i discordanti** | **31,7 %** | **32,3 %** |

> **Il motore non sbaglia meno. Sbaglia uguale, più raramente.**

Il vincolo gli impedisce di muovere le auto, e un motore che non muove le auto **coincide
col nullo**, che è per definizione «non cambia niente». Il diagnostico va oltre: l'eccesso
di movimento passa da **+1,84 a −1,41**, cioè da «ne inventa troppo» a «ne produce troppo
poco». Non si è centrato il bersaglio: lo si è attraversato.

E lo stesso identico meccanismo, letto sull'altra popolazione, **è F3 che crolla**: lì la
quota di vittorie scende da **62,0 % a 52,5 %**, cioè a una moneta. Il movimento che il
motore produceva in quella popolazione era **giusto**, e il vincolo lo spegne insieme a
quello sbagliato.

**Un solo meccanismo spiega entrambi gli esiti: il vincolo avvicina il motore al nullo,
ovunque.**

## Il difetto di F2 che questo rende visibile — e che NON si riscrive

> **Il nullo stesso soddisfa F2 alla perfezione**: zero discordanti, p = 1, saldo 0.
> p ≥ 0,05 ✓, segno non peggiorato ✓.

F2, da solo, premia lo spegnersi. Non è una ragione per non registrarlo — è firmato, e una
soglia firmata non si allarga **né si stringe** dopo aver visto i risultati (regola 3,
E08). Rifiutare una promozione che il pre-registro concede è lo stesso errore di concedere
una promozione che nega.

Va anche detto cosa **regge**: **F3 è esattamente la guardia contro questa degenerazione**,
e l'ha intercettata al primo colpo. La coppia F2+F3 fa il suo lavoro. È F2 da solo a non
farlo — e chi legge «F2 raggiunto» senza F3 accanto sta leggendo metà del risultato.

## Cosa questi due esiti NON autorizzano

- **Non autorizzano ad accendere niente.** La configurazione che raggiunge F2 è **la stessa
  che fallisce F3**: non è spedibile. Il vincolo resta `tetto: null` in produzione.
- **Non muovono il voto della Fisica.** I KPI sono le condizioni, non il voto
  (`KPI_5_4_4.md`, regola 4 di quella pagina). Un 7 di Fisica chiedeva un orizzonte utile
  più lungo **senza** rompere ciò che funziona: qui una metà è passata rompendo l'altra.

## La strada che restava, e perché non arriva neanche lei

L'altra causa dichiarata — **i rivali non reagiscono mai** — non può raggiungere né F2 né
F3, e lo si sa **senza provare una regola**
(`ai_lab/confronto/REFERTO_famiglia_rivali_non_puo.md`):

- il **soffitto** della famiglia (l'oracolo, che conosce le soste vere di tutti) lascia il
  terzile alto a **12-28**: di 16 punti di divario, al bersaglio di F2 ne arrivano **2**, e
  le vittorie restano **12 in entrambe le configurazioni**;
- la soglia di F3 — 44-27 — **è il valore dell'oracolo**: ogni regola vera ha meno
  informazione, atterra fra identità (36-32) e oracolo, dunque **sotto**.

Quindi: **la sola configurazione che raggiunge F2 fallisce F3, e la sola famiglia che
restava non può raggiungere nessuno dei due.**

## Stato dei KPI dopo questa registrazione

| KPI | esito | dove |
|---|---|---|
| **F1** | RAGGIUNTO a 6 giri, strumento e margine dichiarati | `REGISTRO_F1.md` |
| **F2** | **RAGGIUNTO alla lettera** — meccanismo dichiarato: più pareggi, non più risposte giuste | questa pagina |
| **F3** | **MANCATO** — 31-28 contro ≥ 44-27 | questa pagina |
| **F4** | MANCATO — 0 su 2, nessun meccanismo noto | `REGISTRO_F4.md` |
| **F5** | strumento costruito e applicato al soffitto | `ai_lab/confronto/ESITO_controfigure_f5.md` |
