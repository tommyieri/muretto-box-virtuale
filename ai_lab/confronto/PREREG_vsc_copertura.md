# Prereg — B è la copertura? La VSC a tempo contro il simbolo per-giro

**Data: 15/08/2026.** Sigillata **prima** di misurare la pendenza.

`REFERTO_geometria_sosta.md` (15/08) lascia un fatto e un dubbio.

**Il fatto**: sotto VSC il motore lascia passare **1,902** auto attorno a chi si ferma contro
le **1,279** vere, e l'eccesso è quasi tutto di auto che **non si sono fermate** (1,705 contro
1,115). Appaiato: 25 contro 8, **p = 0,0046**, 6 gare su 7. Sotto SC non c'è niente (9-8,
p = 1,000).

**Il dubbio**: tutto è misurato con `regimePerGiroDiCampo`, cioè col **simbolo `'6'` per
giro** — su cui il progetto ha messo un veto esplicito il 07/08 (PR #127): *«mai costruire sul
simbolo `'6'` per-giro; la VSC A TEMPO è validata»*, perché quelle celle hanno **copertura
mediana 53%**: *«presenza giusta, quantità sbagliata»*.

**Questa prereg è il consumo di quella fonte validata**, che il progetto dichiara richiedere
la propria preregistrazione. Eccola.

---

## 0 · L'ipotesi, in una riga

Il motore applica compressione e fattore della sosta a un giro **per intero** ogni volta che
lo chiama VSC. Se quel giro è VSC solo a metà, il motore neutralizza il doppio di quanto la
gara ha neutralizzato davvero — e il campo che costruisce lì ha la forma sbagliata.

**Se è questo, l'eccesso di B deve essere più grande dove la copertura è più piccola.**

## 1 · Il campione, misurato PRIMA di questa prereg

Fonte: `ai_lab/neutralizzazione/frazioni_vsc_2026.json` — `f_vsc` per (gara, pilota, giro),
da `track_status` FastF1 sull'orologio di sessione più i confini di giro `LapStartTime/Time`,
prodotta da `estrai_frazioni_vsc.py` e validata con `PREREG_vsc_a_tempo.md`.

Le soste che il simbolo per-giro chiama VSC, viste col tempo vero:

| gara | soste | `f_vsc` mediana | piene (≥ 0,9) |
|---|---|---|---|
| Australia | 23 | 47% | 4 |
| Canada | 12 | 92% | 6 |
| Belgio | 9 | 52% | 0 |
| Gran Bretagna | 6 | 30% | 0 |
| Austria | 5 | 74% | 1 |
| Ungheria | 5 | 62% | 0 |
| Spagna | 3 | 100% | 2 |
| **totale** | **63** | **52%** | **13** |

**Il 52% riproduce il 53% che il progetto aveva registrato**, su un perimetro diverso: la
fonte dice la stessa cosa di prima, ed è la ragione per cui è credibile qui.

**E dice anche perché questa misura non si può fare a soglia.** Restringere alle sole VSC
piene lascerebbe **13 soste**: sotto la soglia dei 20 discordanti che uso da tre giorni, e
quindi NULL per costruzione. La copertura si usa **come variabile continua**, e questa è una
scelta obbligata dal campione, non una preferenza.

## 2 · La misura

Per ognuna delle 63 soste, dal banco `geometria_sosta.mjs` (osservato, nessun modello: chi era
dietro al giro L−1 ed è davanti a L+1):

```
eccesso = (passanti nel MOTORE) − (passanti nella REALTA')
```

e la si mette contro `f_vsc` di quella (gara, pilota, giro).

## 3 · I cancelli, dichiarati prima

**V1 — la pendenza, ed è l'unico che decide.** La retta di `eccesso` contro `f_vsc` ha
pendenza **negativa**, e l'IC95 **non contiene lo zero**. Bootstrap a **blocchi = gare**
(2.000 ripetizioni, seme 20260815), che è la regola della casa (E11) e qui conta doppio:
le gare hanno coperture molto diverse fra loro (Gran Bretagna 30%, Spagna 100%), quindi una
pendenza calcolata a caso sui 63 punti misurerebbe soprattutto la differenza fra gare.

**V2 — il placebo.** La stessa pendenza con `f_vsc` **rimescolata dentro ogni gara** (200
permutazioni, seme 20260815). La pendenza vera deve stare **fuori** dal 5° percentile delle
finte. Rimescolare *dentro* le gare e non fra le gare è deliberato: distrugge il legame fra la
singola sosta e la sua copertura, e lascia intatta la differenza fra circuiti — cioè attacca
esattamente la spiegazione alternativa più probabile.

**V3 — riportato, NON un cancello.** L'eccesso medio nei terzili di `f_vsc`, e sulle 13 soste
piene (≥ 0,9). Con 13 casi non decide niente e non lo si racconta come se decidesse: si
stampa perché è la lettura più diretta dell'ipotesi, e perché se andasse **contro** V1
bisogna dirlo.

## 4 · Che cosa vorrà dire l'esito

- **V1 verde e V2 pulito** → il meccanismo di B è la **copertura**: il motore tratta come
  piena una VSC che è a metà. È la prima spiegazione di questa famiglia che sopravvive, e va
  scritta con la sua magnitudine. **Non autorizza a cambiare niente**: la riparazione (usare
  la frazione invece del simbolo) sarebbe un'altra prereg, con i suoi cancelli.
- **V1 rosso** → la copertura non spiega B. Sarebbe la **quarta** spiegazione caduta in
  quattro giorni, e a quel punto lo scrivo così: il fenomeno è misurato, robusto e senza
  meccanismo, e chi riapre parta dai dati e non dalle mie ipotesi.
- **V1 verde ma V2 sporco** → la pendenza è la differenza fra circuiti travestita: NULL, e si
  dichiara che il campione non separa le due cose.

## 5 · Cosa NON si fa, qualunque sia l'esito

- **Non si tocca `regimePerGiroDiCampo`**, che è la definizione di produzione: cambiarla
  richiederebbe la sua prereg e i suoi cancelli sul prodotto.
- **Non si costruisce sul simbolo `'6'` per-giro** più di quanto già faccia il motore: qui la
  frazione entra solo come **variabile di misura**, mai come ingresso del kernel.
- **Non si promuove nessun fattore**, non si tara niente, non si accende niente.
- **Non si aggiungono soglie su `f_vsc`** dopo aver visto la nuvola: la scelta «continua e non
  a soglia» è fatta qui, sopra, e con la ragione scritta.

---

*Sigillo: committata prima di calcolare la pendenza. Nessun file di produzione cambia.*
