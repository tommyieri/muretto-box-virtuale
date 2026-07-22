"""ai_lab/scienziato/autocalibra.py — IL PATTERN: un modello che si ricalibra da solo.

Questo modulo non sa niente di traffico. Sa una cosa sola: come si tiene vivo un modello
del laboratorio dentro il ciclo post-gara che il sito ha gia'.

IL CONTRATTO (chi vuole agganciare il prossimo modello implementa questo, e nient'altro):

    nome        str            identita' del modello, stabile nel tempo
    regime      str            '2026' o '2022-25' — vedi EMENDAMENTO qui sotto
    uscita      str            percorso del file dei coefficienti live
    calibra()   -> dict        ricalcola TUTTO dal fondo e ritorna i coefficienti

--------------------------------------------------------------------------------------
EMENDAMENTO 22/07/2026 — «i regimi non si mescolano MAI» diventa:

    I REGIMI SI MESCOLANO SOLO ATTRAVERSO UNO SPOSTAMENTO DICHIARATO,
    E IL PESO DELLO STORICO SI SCRIVE IN TARGHETTA.

PERCHE'. La regola vecchia e' troppo rigida in un verso e troppo permissiva nell'altro.
Troppo rigida: vieta di usare otto stagioni per dare un punto di partenza a un regime che
ne ha dieci gare, e quindi condanna ogni modello nuovo a tacere per mesi. Troppo permissiva:
non chiede a nessuno di dire QUANTO del passato sta ancora usando, quindi un numero
ereditato e un numero misurato oggi hanno lo stesso aspetto sul file.

E c'e' una ragione di metodo, misurata fuori: il cancello binario GO/NO-GO con cui questo
laboratorio decide il valore dei coefficienti si chiama test-then-pool, ed e' documentato
come subottimale rispetto al peso continuo (robust mixture prior, conditional power prior).
Un NULL butta via l'informazione parziale; un peso la conserva scalata.

CIO' CHE CAMBIA IN PRATICA — poco, e verificabile:
  - un modello PUO' partire da un prior storico, ma DEVE dichiarare `peso_storico` nella
    targhetta: 1 = sto usando solo il passato, 0 = solo il regime nuovo. Chi legge il file
    vede quanto vale il passato in quel numero, senza doverlo ricostruire.
  - il peso NON e' scelto da un umano: si aggiorna da solo a ogni gara secondo l'evidenza
    (lab/coefficiente_vivo.py). Se il regime nuovo smentisce lo storico, scende.
  - i CANCELLI restano, ma cambiano mestiere: NON decidono piu' quanto vale un numero,
    decidono solo se ACCENDERE una cosa in produzione. Sono due domande diverse e finora
    avevano una risposta sola.
  - un modello che NON usa lo storico scrive `peso_storico: 0` e si comporta come prima.

MISURATO SUL PRIMO CASO REALE (gradino di sosta, 8 stagioni di prior contro 8 gare 2026):
il peso e' sceso da solo a 0,67 e il confronto prequenziale dice che sul GRADINO lo storico
non aiuta. La regola nuova non impone di usare il passato: impone di DIRE quanto lo si usa,
e rende visibile quando non serve. Con la regola vecchia quel numero non esisteva.
--------------------------------------------------------------------------------------

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


CAMPI_TARGHETTA = ('gare_sotto', 'calcolato_il')


def verifica_contratto(modello, coef):
    """Un contratto non verificato non e' un contratto. Ritorna la lista dei guasti.

    Prima del 22/07/2026 questo modulo non controllava NULLA del payload: un modello
    aggiunto male entrava nel ciclo e nessuno se ne accorgeva. Due buchi reali trovati
    all'audit: `ACCENDIBILE` stava al primo livello nel degrado e solo annidato nel
    traffico (quindi un lettore automatico non poteva leggere il verdetto in modo
    uniforme), e nessuno pretendeva il peso dello storico.
    """
    guasti = []
    for campo in ('nome', 'regime', 'uscita'):
        if not getattr(modello, campo, None):
            guasti.append(f'manca il campo obbligatorio {campo}')
    if not isinstance(coef, dict):
        return guasti + ['calibra() non ha ritornato un dict']
    if 'coefficienti' not in coef:
        guasti.append("manca la chiave 'coefficienti'")
    # POSIZIONE CONTRATTUALE: al primo livello, sempre, per tutti.
    if 'ACCENDIBILE' not in coef:
        guasti.append("manca ACCENDIBILE al PRIMO livello (il verdetto va letto senza scavare)")
    # EMENDAMENTO: quanto del passato c'e' dentro questo numero.
    t = coef.get('targhetta') or {}
    if 'peso_storico' not in t:
        guasti.append("manca targhetta.peso_storico (0 = solo regime nuovo, 1 = solo storico)")
    else:
        w = t['peso_storico']
        if not isinstance(w, (int, float)) or not (0.0 <= w <= 1.0):
            guasti.append(f'targhetta.peso_storico fuori da [0,1]: {w!r}')
    return guasti


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
    # PESO DELLO STORICO IN TARGHETTA (emendamento 22/07/2026). Lo mette questo modulo, non
    # il modello, cosi' NESSUN modello puo' dimenticarlo. Un modello che non attinge al
    # passato dichiara 0 e si comporta esattamente come prima; uno che attinge dichiara
    # quanto, e quel numero si aggiorna da solo (lab/coefficiente_vivo.py).
    peso = getattr(modello, 'peso_storico', None)
    if callable(peso):
        peso = peso()
    nuovo['targhetta'] = {'gare_sotto': nuovo.pop('_n_gare'),
                          'blocchi_sotto': nuovo.pop('_n_blocchi', None),
                          'calcolato_il': data_calcolo,
                          'peso_storico': 0.0 if peso is None else float(peso)}

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

    # IL CONTRATTO SI VERIFICA. Non e' fatale — fermare il ciclo post-gara per un campo
    # mancante sarebbe il rimedio peggiore del male — ma il guasto finisce NEL FILE e nel
    # log, cosi' non puo' restare invisibile come e' stato finora.
    guasti = verifica_contratto(modello, nuovo)
    if guasti and verbose:
        print(f"  [{modello.nome}] ⚠ CONTRATTO: {len(guasti)} guasti")
        for g in guasti:
            print(f"        - {g}")

    # I CAMPI DI CONTRATTO CONTANO NELL'INVARIANZA. Senza questa riga si crea un FALSO
    # VERDE: la verifica gira sul payload in memoria (che il campo ce l'ha), l'idempotenza
    # guarda solo i coefficienti e non riscrive, e il file su disco resta senza il campo —
    # con il controllo che dice "tutto a posto". Visto succedere il 22/07 sul degrado.
    contratto_v = {k: (prec or {}).get('targhetta', {}).get(k) for k in ('peso_storico',)}
    contratto_v['ACCENDIBILE'] = (prec or {}).get('ACCENDIBILE')
    contratto_n = {k: nuovo.get('targhetta', {}).get(k) for k in ('peso_storico',)}
    contratto_n['ACCENDIBILE'] = nuovo.get('ACCENDIBILE')

    invariato = bool(prec and coef_v == coef_n
                     and prec['targhetta']['gare_sotto'] == nuovo['targhetta']['gare_sotto']
                     and contratto_v == contratto_n
                     and _firma(prec) == _firma(nuovo))

    if invariato:
        # IDEMPOTENZA: nessun dato nuovo -> il file non si tocca, lo storico non cresce.
        if verbose:
            print(f"  [{modello.nome}] nessun dato nuovo: file invariato "
                  f"({nuovo['targhetta']['gare_sotto']} gare). Idempotente.")
        return {'modello': modello.nome, 'cambiato': False,
                'targhetta': prec['targhetta'], 'delta': {}}

    dif = _delta(coef_v, coef_n)
    # IL VERDETTO NELLO STORICO (22/07/2026). Prima ogni voce conteneva solo
    # {calcolato_il, gare_sotto, delta_coefficienti}: si vedeva se i numeri SI MUOVEVANO,
    # non se SBAGLIAVANO DI MENO. Quindi alla domanda "da quando aggiungiamo gare, il
    # modello sta migliorando?" non c'era risposta leggibile in nessun file — che e'
    # esattamente il dato che serve all'auto-miglioramento.
    voce = {'calcolato_il': data_calcolo,
            'gare_sotto': nuovo['targhetta']['gare_sotto'],
            'delta_coefficienti': dif,
            'ACCENDIBILE': nuovo.get('ACCENDIBILE'),
            'peso_storico': (nuovo.get('targhetta') or {}).get('peso_storico'),
            'guasti_contratto': guasti or None}
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
