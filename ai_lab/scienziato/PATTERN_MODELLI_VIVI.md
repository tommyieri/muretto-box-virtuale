# Il pattern dei MODELLI VIVI — come si aggancia il prossimo

Un modello del laboratorio non è una fotografia: è un oggetto che **si ricalibra da solo**
quando il fondo riceve una gara nuova, come già fa la classifica del sito. Questo documento
è il contratto: il prossimo modello (degrado, carburante, quello che verrà) ci si aggancia
**senza reinventare niente**.

## Le quattro parti, sempre le stesse

```
1. un MODULO che sa calibrare        ai_lab/scienziato/modello_<fenomeno>.py
2. una RIGA nel registro             gen_modelli_lab.py  -> REGISTRO
3. un FILE di coefficienti live      data/modello_<nome>.json   (scritto dal generatore)
4. un INTERRUTTORE umano             il motore lo legge solo se un umano lo accende
```

Il ciclo esistente non si tocca: `auto_gara.py`, quando pubblica una gara nuova, esegue già
`aggiorna_ui.py`, `gen_race_control.py`, `gen_classifiche_ufficiali.py`. Adesso esegue anche
`gen_modelli_lab.py`. **Un modello del laboratorio è un generatore come gli altri.**

## Il contratto (è tutto qui)

```python
class IlMioModello:
    nome   = 'degrado_2026'          # identita' stabile nel tempo
    regime = '2026'                  # i regimi NON si mescolano mai
    uscita = 'data/modello_degrado_2026.json'

    def raccogli(self):  ...         # dal FONDO, solo il proprio regime
    def calibra(self, per_gara=None, dati=None) -> dict:
        return {'coefficienti': {...},        # i numeri che vanno live
                'intervalli':   {...},        # larghi se sono larghi: non si gonfia
                'forma':        {...},        # la formula, in chiaro
                'verifica':     {...},        # fuori campione + cancello di accensione
                'limite_onesto': [...],       # che cosa NON sa fare
                '_n_gare': N}                 # la targhetta se la mette autocalibra
```

`autocalibra.aggiorna(modello, data)` fa il resto, **uguale per ogni modello**:

- **targhetta** automatica (quante gare sotto, quando è stato calcolato);
- **storico**: a ogni ricalibrazione registra di quanto si è mosso ogni coefficiente, e
  giudica: *«movimento massimo 3,7 % → si sta stabilizzando»* oppure *«balla ancora: regime
  povero, non fidarsi della cifra decimale»*. Un modello che oscilla **si vede**, invece di
  sparire sotto una media che sembra ferma;
- **idempotenza**: rieseguire senza dati nuovi non tocca il file e non allunga lo storico;
- **nessuna decisione**: scrive i coefficienti, non accende niente.

## Le tre regole che il pattern impone (e perché)

**1. Il regime fa parte dell'identità.** `traffico_2026` e `traffico_2022_25` sono due
modelli diversi, con due file diversi. Mai una media a cavallo di una rottura regolamentare:
il progetto lo ha già misurato (Spearman fra difficoltà-pista storica e 2026 = −0,024,
scorrelate).

**2. La targhetta viaggia col numero.** Un coefficiente senza «quante gare aveva sotto e
quando» non è utilizzabile: non si sa se è riapribile. 10 gare chiedono di essere rifatte a
20.

**3. Il cancello di accensione è dentro il modello.** Ogni modello dichiara la propria
condizione per proporsi al live — per il traffico: *battere il modello-zero con l'IC95
appaiato che esclude lo zero*. Finché non la soddisfa, il file dice `ACCENDIBILE: false` e
**il modello resta spento da solo**, senza che nessuno debba ricordarsene. Quando la
soddisfa, lo dice. **La decisione di accendere resta umana; il modello dice solo quando se
l'è guadagnata.**

## Aggiungere il prossimo modello

```python
# gen_modelli_lab.py
REGISTRO = [
    ModelloTraffico('2026', uscita='data/modello_traffico_2026.json'),
    ModelloDegrado('2026',  uscita='data/modello_degrado_2026.json'),   # <- una riga
]
```

E poi niente: la pipeline post-gara lo ricalibra da sola, con targhetta, storico,
idempotenza e cancello di accensione.

## Il confine che il pattern rispetta

`pipeline_gara.py` dichiara: *«NON ricalcola mai coefficienti motore»*. Il pattern non lo
viola: i coefficienti che scrive sono **del laboratorio**, in `data/modello_*.json`, e
restano tali finché un umano non li aggancia al motore. La pipeline aggiorna la **misura**;
l'**accensione** è un gesto separato e umano.

## Comandi

```bash
python3 gen_modelli_lab.py --data 2026-08-02            # ricalibra tutti i modelli
python3 gen_modelli_lab.py --data 2026-08-02 --verifica # e stampa le verifiche
python3 gen_modelli_lab.py --data ... --senza-gara "2026 Miami"   # prova l aggiornamento
```
