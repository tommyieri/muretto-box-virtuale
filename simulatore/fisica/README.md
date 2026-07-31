# 📐 Physics Lab — stima (`fisica/`, Python)

Modello del tempo sul giro: la stima produce JSON **con targhetta** (regola 2);
non re-implementa MAI la simulazione (regola 8: il kernel esiste in una lingua
sola, in `engine/`). Blocchi = gare, sempre (E11); guardie esplicite di
rango/condizionamento in ogni stimatore (E10).

`stima_v2.py` → `data/modelli/modello_v2.json`. Non ri-definisce "verde": legge
`data/viste/vista_verde_2026.json`, esportata dal modulo che possiede la
definizione (regola 1, E12).

- **ρ = 0,0308 s/giro·giro**, IC95 [0,0108; 0,0527] — misurato, fondo 2026,
  bootstrap 2.000, blocchi = gare. L'IC esclude lo zero e contiene lo 0,0389
  ereditato.
- **δ₇₀ stimato libero = 3,11** [2,74; 3,51] — ma **NON è il valore cablato**:
  l'esperimento pre-registrato ha scelto 2,2 (vedi `banco/prereg/`). La
  regressione sul giro di gara non separa il carburante dall'evoluzione della
  pista; il replay misura la deriva che serve davvero a proiettare.
- **Identificazione**: età e giro salgono insieme dentro uno stint e li separa
  solo l'azzeramento alla sosta. Guardie riportate nel modello: rango 2,
  condizionamento 38,8, correlazione entro-blocco +0,55, e 214 blocchi su 232
  con almeno due stint. Niente `pinv`: `solve` esplicita su matrice verificata.

Ordine di rigenerazione (i derivati di `data/` sono pinnati come il grezzo):
`esporta_vista_verde.mjs` → `stima_v2.py` → `replay_delta.mjs` →
`genera_inventario.mjs` → `genera_manifest.mjs`.

`stima_bagnato.py` → `banco/prereg/ESITO_bagnato.json` (non `data/modelli/`: la
fase bagnato non ha prodotto un modello — vedi `banco/README.md`). È l'unico
stimatore che si rifiuta di produrre numeri: misura prima quante gare sono
giudicabili e, sotto il minimo pre-registrato, si ferma. Stimare `a` e `b` su
una gara sola e scriverli in un esito significherebbe consegnare due numeri che
qualcuno, fra sei mesi, userebbe come misurati (E22).

**La Fase Difesa non ha uno stimatore qui.** La sua calibrazione ha bisogno del
kernel — la posizione di rientro si ottiene simulando — e il kernel esiste in una
lingua sola (regola 8). Quindi vive nel banco: `banco/misure/difesa.mjs` misura,
`banco/scrivi_banda_rientro.mjs` mette a referto e produce
`data/modelli/banda_rientro.json`. La regola «la statistica in Python produce
JSON con targhetta» vale per ciò che si può stimare fuori dal kernel; questa non
si poteva.
