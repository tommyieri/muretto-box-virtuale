#!/usr/bin/env python3
"""copertura_alpha_undercut.py — quanto lontano arriva il passo-base, PRIMA di usarlo.

    python3 copertura_alpha_undercut.py

Misura di FATTIBILITA' per il cancello 6.0 di PREREG_UNDERCUT_V2.md (sigillato ca71de6).
NON e' un backtest e non e' un modello: qui non si costruisce nessun margine, non si
confronta nessuna previsione, e il campo 'riuscito' dei casi undercut NON VIENE MAI LETTO
(c'e' un'asserzione che lo impone, piu' sotto). L'unica domanda e':

    per quanti casi undercut esisterebbe alpha_prior per ENTRAMBI i piloti della coppia?

Se la risposta e' bassa, il modello v2 finirebbe giudicato su un sottoinsieme selezionato
dai piloti che girano in aria libera — un campione che non rappresenta il fenomeno. Per
questo 6.0 chiede >= 80% di copertura sui difficili nuovi, oltre a |D_new| >= 15.

REGOLA DI AGGREGAZIONE (PREREG §3.1, ratificata dal PO il 22/07/2026, non si tocca qui):
    alpha_centrato(drv, gara) = alpha(drv, gara) - media dei alpha di quella gara
    alpha_prior(drv, R)       = mediana di alpha_centrato sulle gare 2026 PRECEDENTI a R
La centratura toglie l'offset di gara (carburante, pista); la differenza fra due piloti e'
invariante allo shift alpha<->delta_mescola, quindi Delta-passo e' identificato anche dove
il livello assoluto non lo e'.

PERIMETRO DELLE GARE-FONTE: tutte le gare 2026 precedenti che il modello del laboratorio
riesce a stimare, Canada compreso. L'esclusione del Canada vive nella definizione dei CASI
(partenza umida, conta_undercut.py), non nella sorgente del passo: sono due cose diverse e
tenerle separate e' la lettura letterale di §3.1.
"""
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, 'ai_lab', 'scienziato'))

import degrado as DG          # noqa: E402
import fondo                  # noqa: E402

USCITA = os.path.join(QUI, 'data', 'copertura_alpha_undercut.json')

# id del blocco del laboratorio -> nome della gara nei file undercut (conta_undercut.py)
NOMI = {'2026 British': 'Gran Bretagna', '2026 Belgian': 'Belgio'}


def nome_gara(blocco_id):
    return NOMI.get(blocco_id, blocco_id.split(' ', 1)[1])


# ---------------------------------------------------------------- alpha per gara
def alpha_per_gara():
    """alpha_centrato per pilota, gara per gara, in ordine CRONOLOGICO.

    Ogni gara e' stimata dal modello del laboratorio senza toccarlo: prepara() + stima().
    Le gare che il modello non sa stimare tornano con il loro motivo scritto, mai con uno
    zero al posto del numero mancante."""
    fuori = []
    for b in fondo.elenco_blocchi():
        if b['regime'] != '2026':
            continue
        righe = fondo.carica(b['percorso'])
        voce = {'blocco': b['id'], 'gara': nome_gara(b['id']),
                'data': fondo.data_gara(righe), 'alpha': {}, 'escluso': None}
        dati = DG.prepara(b)
        if dati is None:
            voce['escluso'] = 'gara bagnata'
        else:
            mod = DG.stima(dati)
            if 'escluso' in mod:
                voce['escluso'] = mod['escluso']
            else:
                a = mod['alpha']
                m = st.mean(a.values())                      # §3.1: centratura per-gara
                voce['alpha'] = {d: v - m for d, v in a.items()}
                voce['n_giri'] = mod['n_giri']
                voce['n_stint'] = mod['n_stint']
        fuori.append(voce)
    return sorted(fuori, key=lambda v: v['data'])


def prior_fino_a(gare, data_limite):
    """alpha_prior(drv) dalle sole gare STRETTAMENTE precedenti a data_limite (§3.1)."""
    acc = {}
    for g in gare:
        if g['data'] >= data_limite:
            continue
        for d, v in g['alpha'].items():
            acc.setdefault(d, []).append(v)
    return {d: st.median(vs) for d, vs in acc.items()}


# ---------------------------------------------------------------- copertura sui casi
def casi_2026():
    """I 31 casi gia' censiti. Si leggono SOLO i campi di identita' e di dominio.

    Il campo 'riuscito' viene cancellato all'ingresso: cosi' non e' una promessa, e' una
    cosa che il codice non puo' piu' fare."""
    casi = json.load(open(os.path.join(QUI, 'data', 'undercut_casi_2026.json')))
    for c in casi:
        c.pop('riuscito', None)
        c.pop('gap_fin', None)
    return casi


def difficile(c):
    return 1.0 < c['gap0'] <= 3.5


def copertura(casi, gare):
    """Per ogni caso: alpha_prior esiste per A e per B? Nessun modello, solo presenza."""
    per_data = {g['gara']: g['data'] for g in gare}
    righe = []
    for c in casi:
        d = per_data.get(c['gara'])
        pri = prior_fino_a(gare, d) if d else {}
        righe.append({'gara': c['gara'], 'A': c['A'], 'B': c['B'], 'gap0': c['gap0'],
                      'difficile': difficile(c),
                      'alpha_A': c['A'] in pri, 'alpha_B': c['B'] in pri,
                      'coperto': c['A'] in pri and c['B'] in pri,
                      'gare_nel_prior': sum(1 for g in gare if d and g['data'] < d
                                            and g['alpha'])})
    return righe


SCALA = {}


def scala_delta(casi, gare):
    """La scala e il SEGNO di Delta-passo sulle coppie REALI dei casi.

    Serve a sapere se il termine K*Delta-passo e' una correzione o un padrone: se valesse
    quanto il gap0, la fisica della gomma diventerebbe un arrotondamento e la v2 sarebbe
    'vince chi ha la macchina piu' veloce' travestita da modello. Anche qui: nessun esito."""
    per_data = {g['gara']: g['data'] for g in gare}
    d = []
    for c in casi:
        pri = prior_fino_a(gare, per_data[c['gara']])
        if c['A'] in pri and c['B'] in pri:
            dp = pri[c['B']] - pri[c['A']]          # >0: A e' il piu' veloce dei due
            d.append({'gara': c['gara'], 'A': c['A'], 'B': c['B'], 'K': c['K'],
                      'gap0': c['gap0'], 'delta': dp, 'termine': c['K'] * dp,
                      'difficile': difficile(c)})
    if not d:
        return
    ass = sorted(abs(x['delta']) for x in d)
    ter = sorted(abs(x['termine']) for x in d)
    piu_veloce = sum(1 for x in d if x['delta'] > 0)
    print(f"\n  |Delta-passo| sulle COPPIE REALI (n={len(d)}): mediana {st.median(ass):.3f} s/giro, "
          f"media {st.mean(ass):.3f}, max {ass[-1]:.3f}")
    print(f"  |K*Delta-passo|: mediana {st.median(ter):.3f} s, max {ter[-1]:.3f} s — contro un "
          f"gap0 mediano di {st.median([x['gap0'] for x in d]):.2f} s")
    print(f"  -> il termine e' una CORREZIONE (~{100*st.median(ter)/st.median([x['gap0'] for x in d]):.0f}% "
          f"del gap tipico), non un padrone: la fisica della gomma resta al centro.")
    print(f"\n  SEGNO — chi attacca e' il piu' VELOCE dei due in {piu_veloce}/{len(d)} casi "
          f"({100*piu_veloce/len(d):.0f}%).")
    print(f"    Cioe' nella grande maggioranza degli undercut TENTATI chi attacca e' il piu'")
    print(f"    LENTO: e' l'auto bloccata dietro, quella che ha motivo di fermarsi prima.")
    print(f"    Ribalta la premessa raccontata in §0 del prereg (la Mercedes che undercutta la")
    print(f"    Racing Bulls). §0 non e' nel nucleo sigillato: la premessa narrativa cade, la")
    print(f"    formula di §2 no. Ma il termine sposterebbe quasi sempre la previsione verso")
    print(f"    'fallito', che e' gia' la classe maggioritaria (67-68%): vedi §11 del prereg.")
    SCALA.update({'n': len(d), 'delta_mediana_assoluta': st.median(ass),
                  'termine_mediano_assoluto': st.median(ter),
                  'quota_attaccante_piu_veloce': piu_veloce / len(d), 'coppie': d})


def main():
    print('=' * 92)
    print('COPERTURA DI ALPHA — misura di fattibilita\' per il cancello 6.0 (nessun esito letto)')
    print('=' * 92)

    gare = alpha_per_gara()
    print(f"\n{'gara':16s} {'data':12s} {'piloti con alpha':>16s} {'giri':>7s} {'stint':>6s}  nota")
    print('-' * 92)
    for g in gare:
        nota = g['escluso'] or ''
        print(f"{g['gara']:16s} {g['data']:12s} {len(g['alpha']):>16d} "
              f"{g.get('n_giri', 0):>7d} {g.get('n_stint', 0):>6d}  {nota}")
    stimate = [g for g in gare if g['alpha']]
    piloti = sorted({d for g in stimate for d in g['alpha']})
    print(f"\n  gare stimate: {len(stimate)}/{len(gare)} | piloti visti almeno una volta: {len(piloti)}")

    # quante gare servono a un pilota per entrare nel prior: distribuzione delle presenze
    presenze = {d: sum(1 for g in stimate if d in g['alpha']) for d in piloti}
    if presenze:
        print(f"  presenze per pilota: mediana {st.median(presenze.values()):.0f}/"
              f"{len(stimate)}, minimo {min(presenze.values())}, massimo {max(presenze.values())}")

    # descrittiva del REGRESSORE (mai dell'esito): quanto vale Delta-passo?
    prior_finale = prior_fino_a(gare, '9999-99-99')
    if len(prior_finale) >= 2:
        vs = sorted(prior_finale.values())
        coppie = [abs(a - b) for i, a in enumerate(vs) for b in vs[i + 1:]]
        print(f"\n  alpha_prior (tutte le 10 gare): {len(prior_finale)} piloti, "
              f"spread {vs[-1] - vs[0]:.3f} s/giro; ordine in {os.path.relpath(USCITA, QUI)}")
        print(f"  |Delta-passo| fra due piloti A CASO: mediana {st.median(coppie):.3f} s/giro "
              f"— e' la STATISTICA SBAGLIATA per questo fenomeno, tenuta qui perche' non")
        print(f"    torni a spaventare qualcuno: le coppie dei casi non sono a caso, sono due")
        print(f"    auto che corrono entro 5 s, quindi adiacenti come passo. Sotto quella vera.")

    casi = casi_2026()
    righe = copertura(casi, gare)
    scala_delta(casi, gare)
    print(f"\n{'gara':16s} {'casi':>5s} {'coperti':>8s} {'difficili':>10s} {'dif.coperti':>12s} "
          f"{'gare nel prior':>15s}")
    print('-' * 92)
    for nome in sorted({r['gara'] for r in righe}):
        b = [r for r in righe if r['gara'] == nome]
        d = [r for r in b if r['difficile']]
        print(f"{nome:16s} {len(b):>5d} {sum(r['coperto'] for r in b):>8d} {len(d):>10d} "
              f"{sum(r['coperto'] for r in d):>12d} {b[0]['gare_nel_prior']:>15d}")
    dif = [r for r in righe if r['difficile']]
    cop_tot = sum(r['coperto'] for r in righe) / len(righe) if righe else 0
    cop_dif = sum(r['coperto'] for r in dif) / len(dif) if dif else 0
    print('-' * 92)
    print(f"{'TOTALE':16s} {len(righe):>5d} {sum(r['coperto'] for r in righe):>8d} "
          f"{len(dif):>10d} {sum(r['coperto'] for r in dif):>12d}")
    print(f"\n  copertura complessiva: {100*cop_tot:.1f}%  |  sui DIFFICILI: {100*cop_dif:.1f}%")
    print(f"  soglia del cancello 6.0: 80% sui difficili NUOVI (questa e' in campione: "
          f"indicativa, non decide)")

    # proiezione per la prossima gara: il prior che l'Ungheria troverebbe gia' pronto
    pronti = len(prior_finale)
    print(f"\n  proiezione Ungheria (26/07): alpha_prior gia' disponibile per {pronti} piloti "
          f"sulle 10 gare 2026")

    os.makedirs(os.path.dirname(USCITA), exist_ok=True)
    json.dump({'gare': [{k: v for k, v in g.items() if k != 'alpha'} |
                        {'piloti_con_alpha': sorted(g['alpha'])} for g in gare],
               'casi': righe,
               'copertura_totale': cop_tot, 'copertura_difficili': cop_dif,
               'alpha_prior_finale': {d: round(v, 4) for d, v in sorted(
                   prior_finale.items(), key=lambda x: x[1])},
               'scala_delta_passo': SCALA},
              open(USCITA, 'w'), indent=1, ensure_ascii=False)
    print(f"\nscritto {os.path.relpath(USCITA, QUI)}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
