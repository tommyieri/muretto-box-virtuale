"""ai_lab/scienziato/autocalibra.py — IL PATTERN: un modello che si ricalibra da solo.

Questo modulo non sa niente di traffico. Sa una cosa sola: come si tiene vivo un modello
del laboratorio dentro il ciclo post-gara che il sito ha gia'.

IL CONTRATTO (chi vuole agganciare il prossimo modello implementa questo, e nient'altro):

    nome        str            identita' del modello, stabile nel tempo
    regime      str            '2026' o '2022-25' — i regimi non si mescolano MAI
    uscita      str            percorso del file dei coefficienti live
    calibra()   -> dict        ricalcola TUTTO dal fondo e ritorna i coefficienti

Il resto lo fa questo modulo, uguale per ogni modello:
  - TARGHETTA automatica: quante gare aveva sotto e quando e' stato calcolato;
  - STORICO dei cambiamenti: a ogni ricalibrazione registra di quanto si sono mossi i
    coefficienti rispetto alla volta prima. Se si muovono poco il modello si sta
    stabilizzando; se ballano, il regime e' ancora povero — e si vede, invece di sparire
    sotto una media che sembra ferma;
  - IDEMPOTENZA: rieseguire senza dati nuovi non cambia il file (stessa targhetta, stessi
    coefficienti, storico non allungato);
  - nessuna decisione: scrive il file dei coefficienti, non accende niente in produzione.
    L'interruttore live resta umano.

PERCHE' COSI': il sito ha gia' una pipeline che, all'arrivo di una gara, rilancia i
generatori (classifiche, race control, UI). Un modello del laboratorio e' un generatore
come gli altri: si aggiunge a quella lista, non si costruisce una pipeline nuova.
"""
import json
import os

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def _delta(vecchi, nuovi, prefisso=''):
    """Di quanto si e' mosso ogni coefficiente numerico, ricorsivamente."""
    fuori = {}
    for k, v in (nuovi or {}).items():
        w = (vecchi or {}).get(k)
        if isinstance(v, dict) and isinstance(w, dict):
            fuori.update(_delta(w, v, f'{prefisso}{k}.'))
        elif isinstance(v, (int, float)) and isinstance(w, (int, float)):
            fuori[f'{prefisso}{k}'] = round(v - w, 6)
    return fuori


def aggiorna(modello, data_calcolo, verbose=True):
    """Ricalibra e scrive. Ritorna il rapporto del cambiamento.

    modello: oggetto col contratto (nome, regime, uscita, calibra()).
    data_calcolo: passata dall'esterno — nessun orologio implicito dentro il generatore.
    """
    dest = os.path.join(RADICE, modello.uscita)
    prec = json.load(open(dest)) if os.path.exists(dest) else None

    nuovo = modello.calibra()
    nuovo['nome'] = modello.nome
    nuovo['regime'] = modello.regime
    nuovo['targhetta'] = {'gare_sotto': nuovo.pop('_n_gare'),
                          'blocchi_sotto': nuovo.pop('_n_blocchi', None),
                          'calcolato_il': data_calcolo}

    coef_v = (prec or {}).get('coefficienti')
    coef_n = nuovo.get('coefficienti')

    # La chiave di invarianza include anche IL METODO e IL VERDETTO, non solo i coefficienti.
    # Prima guardava (coefficienti, gare_sotto): un cambio METODOLOGICO del cancello — per
    # esempio la partizione calibrazione/verifica — lasciava i coefficienti identici, quindi
    # il file risultava "invariato" e la modifica NON arrivava mai all'artefatto. Il modello
    # avrebbe continuato a esibire un verdetto prodotto da una regola che non esisteva piu'.
    # LA FIRMA E' TUTTO CIO' CHE IL GENERATORE PRODUCE, meno la contabilita' volatile
    # (`targhetta` porta la data, `storico` cresce di suo). Niente piu' elenchi di campi.
    #
    # Perche' cosi': l'elenco a mano e' stato sbagliato TRE volte di fila — prima conteneva
    # solo i coefficienti (e un cambio di partizione non arrivava all'artefatto), poi gli
    # mancava `limite_onesto` (e un limite scritto apposta per chi legge non arrivava). Ogni
    # volta la stessa forma: qualcosa di importante cambiava e il file diceva "invariato".
    # Un confronto sull'intero payload non puo' sbagliare per omissione.
    #
    # Il blocco `placebo` del traffico ne era escluso APPOSTA finche' non era riproducibile;
    # dal 21/07/2026 lo e' (riparazione autorizzata di traffico.placebo_leader), e l'intero
    # payload e' stato verificato IDENTICO su 4 PYTHONHASHSEED diversi. Se un giorno un
    # modello reintroducesse del non determinismo, questo file si riscriverebbe a ogni
    # esecuzione: e' il sintomo giusto da vedere, non un guasto da nascondere.
    def _firma(d):
        return {k: v for k, v in (d or {}).items() if k not in ('targhetta', 'storico')}

    invariato = bool(prec and coef_v == coef_n
                     and prec['targhetta']['gare_sotto'] == nuovo['targhetta']['gare_sotto']
                     and _firma(prec) == _firma(nuovo))

    if invariato:
        # IDEMPOTENZA: nessun dato nuovo -> il file non si tocca, lo storico non cresce.
        if verbose:
            print(f"  [{modello.nome}] nessun dato nuovo: file invariato "
                  f"({nuovo['targhetta']['gare_sotto']} gare). Idempotente.")
        return {'modello': modello.nome, 'cambiato': False,
                'targhetta': prec['targhetta'], 'delta': {}}

    dif = _delta(coef_v, coef_n)
    voce = {'calcolato_il': data_calcolo,
            'gare_sotto': nuovo['targhetta']['gare_sotto'],
            'delta_coefficienti': dif}
    nuovo['storico'] = ((prec or {}).get('storico') or []) + [voce]

    with open(dest, 'w') as f:
        json.dump(nuovo, f, ensure_ascii=False, indent=1)
        f.write('\n')

    if verbose:
        n_prima = (prec or {}).get('targhetta', {}).get('gare_sotto', 0)
        print(f"  [{modello.nome}] ricalibrato: {n_prima} -> "
              f"{nuovo['targhetta']['gare_sotto']} gare sotto")
        if dif:
            for k, v in sorted(dif.items()):
                base = (coef_v or {})
                print(f"      {k:28s} {v:+.5f}")
            print(f"      {giudizio_stabilita(dif, coef_v)}")
    return {'modello': modello.nome, 'cambiato': True,
            'targhetta': nuovo['targhetta'], 'delta': dif}


def giudizio_stabilita(dif, coef_prec, soglia_relativa=0.10):
    """Se i coefficienti si muovono poco, il modello si sta stabilizzando. Se ballano, il
    regime e' ancora povero — e va DETTO, non nascosto."""
    if not dif or not coef_prec:
        return 'prima calibrazione: nessun confronto possibile'
    rel = []
    piatti = {}

    def _piatta(d, pre=''):
        for k, v in (d or {}).items():
            if isinstance(v, dict):
                _piatta(v, f'{pre}{k}.')
            elif isinstance(v, (int, float)):
                piatti[f'{pre}{k}'] = v
    _piatta(coef_prec)
    for k, v in dif.items():
        base = abs(piatti.get(k, 0.0))
        if base > 1e-9:
            rel.append(abs(v) / base)
    if not rel:
        return 'nessun coefficiente confrontabile'
    m = max(rel)
    return (f'movimento massimo {m*100:.1f}% -> '
            + ('SI STA STABILIZZANDO' if m <= soglia_relativa
               else 'BALLA ANCORA: regime povero, non fidarsi della cifra decimale'))
