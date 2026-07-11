"""gen_osservabilita_degrado.py — TEST DI OSSERVABILITA' (non di modellazione).

DOMANDA: esiste, nei dati, un'associazione fra eta'-gomma e passo che il caso non
produrrebbe? E' identificabilita'/osservabilita', NON stima. Quasi non-parametrico:
statistica di associazione per ranghi (Spearman), distribuzione nulla EMPIRICA per
permutazione. Nessun coefficiente, nessuna regressione, nessun IC parametrico.

DISEGNO — il carburante si annulla per COSTRUZIONE:
  unita' di permutazione = blocco (gara, giro). Dentro un singolo stint eta'-gomma e
  numero-di-giro crescono insieme: permutare l'eta' dentro lo stint permuterebbe anche il
  carburante -> falso positivo. Invece, dentro la STESSA gara allo STESSO giro, piloti
  diversi hanno eta'-gomma diversa (chi si e' fermato prima ha gomma piu' giovane) mentre
  carburante ed evoluzione pista sono ~identici per tutti. Permutando le etichette eta'
  ENTRO il blocco, il nullo ha carburante ed evoluzione pista identici per costruzione
  all'osservato: controllati esattamente, non sottratti con una stima contestabile.

IGIENE: riusata (importata, non reimplementata) da test_identificabilita_degrado +
gen_replay_perdita_stint: F1 verdi status=='1' (SC/VSC fuori) · F2 no out/in-lap
(pin/pout) · F3 slick SOFT/MEDIUM/HARD · F4 numerici · F5 lap>=2 · F6 life>=3 (out-lap +
warm-in fuori) · F7 outlier <=1.07x mediana-stint · ARIA PULITA gap-sesT all'auto davanti
> 2.0s (effetto-Leclerc). NESSUN filtro rilassato.

NORMALIZZAZIONE PASSO-BASE (centraggio, NON modello): dentro un blocco i piloti differiscono
anche per passo-base della vettura. Centro ogni pilota sul proprio passo mediano di gara
(giri validi post-igiene): passo_norm = tempo - mediana_pilota_gara. Scelta dichiarata.

BLOCCHI UTILIZZABILI: (gara, giro) entra solo se ha >=5 piloti E >=3 valori distinti di
life (variazione eta' non degenere). I degeneri non portano informazione: esclusi e contati.

CONFOUND COMPOUND (dichiarato, non risolto a parole): a parita' di giro chi ha gomma piu'
vecchia puo' avere anche mescola diversa; compound ed eta' si confondono parzialmente. Dove
i numeri lo consentono, si STRATIFICA il blocco per compound (permuta entro (gara,giro,
compound)) e si riporta sia stratificato sia non stratificato. Dove la stratificazione
svuota i blocchi (<5 piloti o <3 life distinti), i blocchi si perdono: contati.

STATISTICA: Spearman rho (Pearson sui ranghi medi, tie-corretto) fra life e passo_norm
ENTRO blocco, aggregata sui blocchi come MEDIA PESATA per numerosita' del blocco.
NULLO EMPIRICO: permuta le etichette life ENTRO ciascun blocco, ricalcola la statistica
aggregata, P volte (seed fissato). p_empirico one-sided (segno atteso rho>0: gomma vecchia
-> piu' lenta) = (#{perm >= osservata} + 1)/(P + 1) (convenzione, dichiarata; evita p=0).

VERDETTI (soglie CONGELATE, dichiarate prima dei numeri):
  GLOBALE (tutti i blocchi poolati): PASS se p_empirico < 0.01.
  PER-GARA (nullo ricostruito gara per gara): PASS se p<0.05 in >=50% delle gare con
    >=1 blocco usabile. E' la domanda che conta per il prodotto (il Muretto decide al giro
    L di UNA gara, non aggregando stagioni).
SEGNO: riportato. Associazione forte col segno sbagliato = allarme metodologico.

SECONDARIO RIMANDATO E CONDIZIONATO: multiverse/sensibilita' sulle specificazioni si esegue
SOLO se il primario passa. Se fallisce, la risposta c'e' gia' (informazione non nel dato).

Sola lettura sull'archivio. Artefatti NUOVI: data/osservabilita_blocchi.csv (writer
deterministico) + data/OSSERVABILITA_DEGRADO_REPORT.txt. Nessun file motore/gancio toccato.
"""
import os, csv
import numpy as np
from scipy.stats import rankdata
import gen_replay_perdita_stint as g
from test_identificabilita_degrado import pulisci, filtro_outlier, SOGLIA_OUTLIER, SLICK

P_PERM = 10000                 # permutazioni (>=5000 richiesto)
SEED   = 20260711              # seed fissato e DICHIARATO (writer deterministico)
MIN_PILOTI, MIN_LIFE = 5, 3    # blocco usabile
OUT_CSV = os.path.join('data', 'osservabilita_blocchi.csv')
OUT_TXT = os.path.join('data', 'OSSERVABILITA_DEGRADO_REPORT.txt')


def prepara():
    """Ritorna (blocchi_nonstrat, blocchi_strat, copertura). Ogni blocco e' un dict con
    rl_c (rank life centrati), rp_c (rank passo_norm centrati), denom, w, gara, anno."""
    non_strat, strat = [], []
    cov = dict(gare=0, gare_usabili=set(), per_anno={}, esclusi_pochi=0, esclusi_degen=0,
               blocchi=0, righe=0, strat_blocchi=0, strat_persi=0)
    for anno in ('2023', '2024', '2025'):
        base = os.path.join('data', 'ti_archive', anno)
        if not os.path.isdir(base): continue
        cov['per_anno'].setdefault(anno, dict(blocchi=0, strat=0))
        for folder in sorted(os.listdir(base)):
            path = os.path.join(base, folder, 'Race.json')
            if not os.path.exists(path): continue
            cov['gare'] += 1
            cir = folder.replace(' Grand Prix', '')
            gara = f"{anno}:{cir}"
            rows = g.carica_plus(path)
            keep, _, N = pulisci(rows)
            keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)
            keep = [r for r in keep if r.get('clean')]
            if not keep: continue
            # passo-base: mediana per pilota di gara (giri validi)
            per_drv = {}
            for r in keep: per_drv.setdefault(r['drv'], []).append(r['time'])
            med = {d: float(np.median(v)) for d, v in per_drv.items()}
            for r in keep: r['passo_norm'] = r['time'] - med[r['drv']]
            # blocchi (gara, giro)
            bylap = {}
            for r in keep: bylap.setdefault(int(r['lap']), []).append(r)
            for lap, rr in sorted(bylap.items()):
                drivers = {r['drv'] for r in rr}
                lifes = {int(r['life']) for r in rr}
                if len(drivers) < MIN_PILOTI:
                    cov['esclusi_pochi'] += 1; continue
                if len(lifes) < MIN_LIFE:
                    cov['esclusi_degen'] += 1; continue
                blk = _mkblock(rr, gara, anno)
                if blk is None: cov['esclusi_degen'] += 1; continue
                non_strat.append(blk)
                cov['blocchi'] += 1; cov['righe'] += len(rr)
                cov['gare_usabili'].add(gara); cov['per_anno'][anno]['blocchi'] += 1
                # stratificazione per compound
                bycmp = {}
                for r in rr: bycmp.setdefault(r['compound'], []).append(r)
                for comp, cr in bycmp.items():
                    if len({r['drv'] for r in cr}) < MIN_PILOTI or len({int(r['life']) for r in cr}) < MIN_LIFE:
                        cov['strat_persi'] += 1; continue
                    sb = _mkblock(cr, gara, anno)
                    if sb is None: cov['strat_persi'] += 1; continue
                    strat.append(sb); cov['strat_blocchi'] += 1
                    cov['per_anno'][anno]['strat'] += 1
    return non_strat, strat, cov


def _mkblock(rr, gara, anno):
    life = np.array([int(r['life']) for r in rr], float)
    pnorm = np.array([r['passo_norm'] for r in rr], float)
    rl = rankdata(life); rp = rankdata(pnorm)              # ranghi medi (tie-corretti)
    rl_c = rl - rl.mean(); rp_c = rp - rp.mean()
    denom = float(np.sqrt((rl_c @ rl_c) * (rp_c @ rp_c)))
    if denom == 0:  # nessuna variazione utile
        return None
    rho = float((rl_c @ rp_c) / denom)
    return dict(rl_c=rl_c, rp_c=rp_c, denom=denom, w=len(rr), rho=rho, gara=gara, anno=anno)


def stat_osservata(blocchi):
    wsum = sum(b['w'] * b['rho'] for b in blocchi)
    wtot = sum(b['w'] for b in blocchi)
    return wsum / wtot if wtot else float('nan')


def nullo_empirico(blocchi, rng):
    """Ritorna array (P,) della statistica aggregata sotto permutazione entro blocco,
    e il dizionario race->array(P,) per i nulli per-gara. Vettorizzato per blocco."""
    P = P_PERM
    glob_wsum = np.zeros(P); wtot = 0.0
    per_gara_wsum = {}; per_gara_wtot = {}
    for b in blocchi:
        n = b['w']; rp_c = b['rp_c']; rl_c = b['rl_c']; denom = b['denom']
        # P permutazioni indipendenti dei ranghi-life: shuffle di rl_c
        idx = np.argsort(rng.random((P, n)), axis=1)          # P permutazioni
        rho_perm = (rl_c[idx] @ rp_c) / denom                 # (P,) Pearson sui ranghi
        glob_wsum += n * rho_perm; wtot += n
        gr = b['gara']
        if gr not in per_gara_wsum:
            per_gara_wsum[gr] = np.zeros(P); per_gara_wtot[gr] = 0.0
        per_gara_wsum[gr] += n * rho_perm; per_gara_wtot[gr] += n
    glob = glob_wsum / wtot
    per_gara = {gr: per_gara_wsum[gr] / per_gara_wtot[gr] for gr in per_gara_wsum}
    return glob, per_gara


def p_emp(null_arr, oss):
    return (int(np.sum(null_arr >= oss)) + 1) / (len(null_arr) + 1)


def analizza(blocchi, etichetta, rng):
    oss = stat_osservata(blocchi)
    glob, per_gara = nullo_empirico(blocchi, rng)
    p_glob = p_emp(glob, oss)
    n_exceed = int(np.sum(glob >= oss))
    null_max = float(glob.max())
    # per-gara: statistica osservata di gara e p di gara
    per_gara_oss = {}
    for b in blocchi:
        per_gara_oss.setdefault(b['gara'], [0.0, 0.0])
        per_gara_oss[b['gara']][0] += b['w'] * b['rho']; per_gara_oss[b['gara']][1] += b['w']
    dett = {}
    for gr, (ws, wt) in per_gara_oss.items():
        o = ws / wt
        dett[gr] = dict(oss=o, p=p_emp(per_gara[gr], o), n_blocchi=sum(1 for b in blocchi if b['gara'] == gr))
    n_gare = len(dett)
    n_sig = sum(1 for d in dett.values() if d['p'] < 0.05 and d['oss'] > 0)
    frac = n_sig / n_gare if n_gare else 0.0
    return dict(etichetta=etichetta, oss=oss, p_glob=p_glob, n_gare=n_gare, n_sig=n_sig,
                frac=frac, dett=dett, n_blocchi=len(blocchi), n_exceed=n_exceed, null_max=null_max)


def scrivi_csv(non_strat):
    non_strat_sorted = sorted(non_strat, key=lambda b: (b['gara'],))
    with open(OUT_CSV, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['anno', 'gara', 'n_piloti', 'rho_block', 'peso'])
        for b in sorted(non_strat, key=lambda b: (b['anno'], b['gara'], -b['w'], round(b['rho'], 6))):
            w.writerow([b['anno'], b['gara'].split(':', 1)[1], b['w'], f"{b['rho']:.6f}", b['w']])


def main():
    non_strat, strat, cov = prepara()
    rng = np.random.default_rng(SEED)
    res_ns = analizza(non_strat, 'NON stratificato (gara,giro)', rng)
    res_st = analizza(strat, 'STRATIFICATO (gara,giro,compound)', rng) if strat else None
    scrivi_csv(non_strat)

    L = []; Pr = L.append
    Pr("=" * 78)
    Pr("OSSERVABILITA' ETA'-GOMMA — test di permutazione entro blocco (gara,giro)")
    Pr("=" * 78)
    Pr(f"Statistica: Spearman rho(life, passo_norm) entro blocco, MEDIA PESATA per numerosita'.")
    Pr(f"Nullo: permutazione etichette life entro blocco, P={P_PERM}, seed={SEED} (fissato).")
    Pr(f"p_empirico one-sided (segno atteso rho>0) = (#perm>=oss + 1)/(P+1).")
    Pr(f"Soglie CONGELATE: globale PASS se p<0.01; per-gara PASS se p<0.05 in >=50% gare.")
    Pr("")
    Pr("-" * 78)
    Pr("COPERTURA")
    Pr("-" * 78)
    Pr(f"  gare (Race.json) 2023-25: {cov['gare']}  |  con >=1 blocco usabile: {len(cov['gare_usabili'])}")
    Pr(f"  blocchi (gara,giro) usabili: {cov['blocchi']}  (righe totali {cov['righe']})")
    for a in ('2023', '2024', '2025'):
        if a in cov['per_anno']:
            Pr(f"    {a}: {cov['per_anno'][a]['blocchi']} blocchi  |  stratificati {cov['per_anno'][a]['strat']}")
    Pr(f"  blocchi esclusi: {cov['esclusi_pochi']} (<{MIN_PILOTI} piloti) + "
       f"{cov['esclusi_degen']} (eta'-gomma degenere, <{MIN_LIFE} life distinti)")
    Pr(f"  stratificazione per compound: {cov['strat_blocchi']} sotto-blocchi sopravvivono; "
       f"{cov['strat_persi']} persi (<{MIN_PILOTI} piloti o <{MIN_LIFE} life nel compound).")
    Pr("")
    Pr("-" * 78)
    Pr("VERDETTO PRIMARIO")
    Pr("-" * 78)

    def blocco_res(r):
        if r is None:
            Pr("  (stratificato: nessun sotto-blocco sopravvive -> non calcolabile)"); return
        seg = '+' if r['oss'] > 0 else '-'
        alert = '' if r['oss'] > 0 else '   <-- SEGNO SBAGLIATO (allarme metodologico)'
        Pr(f"  {r['etichetta']}  ({r['n_blocchi']} blocchi)")
        Pr(f"    statistica osservata (rho aggregato) = {r['oss']:+.4f}  segno {seg}{alert}")
        Pr(f"    GLOBALE: {r['n_exceed']}/{P_PERM} permutazioni >= osservata (nullo max {r['null_max']:+.4f}); "
           f"p_empirico = {r['p_glob']:.2e}")
        Pr(f"             -> {'PASS' if r['p_glob'] < 0.01 and r['oss']>0 else 'FAIL'} (soglia <0.01)")
        Pr(f"    PER-GARA: {r['n_sig']}/{r['n_gare']} gare con p<0.05 e segno giusto "
           f"= {r['frac']*100:.1f}%  -> {'PASS' if r['frac'] >= 0.5 else 'FAIL'} (soglia >=50%)")
    blocco_res(res_ns)
    Pr("")
    blocco_res(res_st)
    Pr("")
    Pr("-" * 78)
    Pr("LIMITI DICHIARATI")
    Pr("-" * 78)
    Pr("  - CONFOUND COMPOUND residuo: nel non-stratificato, a parita' di giro chi ha gomma")
    Pr("    piu' vecchia puo' avere mescola diversa; eta' e compound si confondono in parte.")
    Pr("    Lo stratificato lo controlla ma perde blocchi (vedi copertura): e' il confound")
    Pr("    onesto del disegno, riportato non nascosto.")
    Pr("  - Il disegno testa l'associazione TRA PILOTI allo stesso giro: e' la traccia")
    Pr("    OSSERVABILE del degrado lungo lo stint, NON il fenomeno stesso. Un nullo non")
    Pr("    battuto dice 'non c'e' traccia distinguibile dal caso', non 'il degrado non esiste'.")
    Pr("  - Normalizzazione passo-base = centraggio sulla mediana pilota-gara (dichiarato),")
    Pr("    non un modello: non separa evoluzione-pista da fuel (entrambi ~costanti nel blocco).")
    Pr("")
    # secondario condizionato
    primario_pass = (res_ns['p_glob'] < 0.01 and res_ns['oss'] > 0) or (res_ns['frac'] >= 0.5)
    Pr("-" * 78)
    Pr("SECONDARIO — RIMANDATO E CONDIZIONATO")
    Pr("-" * 78)
    Pr(f"  multiverse/sensibilita' sulle specificazioni: {'ESEGUIBILE (primario passa)' if primario_pass else 'NON eseguito (primario non passa: la risposta c e gia, aggiungere modelli sarebbe rumore).'}")
    Pr("")
    Pr("Nota: verdetti MECCANICI di osservabilita'. Il verdetto STRATEGICO (archiviare o no")
    Pr("il degrado) NON e' scritto qui: e' del PO.")
    Pr("=" * 78)
    testo = "\n".join(L)
    print(testo)
    open(OUT_TXT, 'w').write(testo + "\n")
    print(f"\n[scritto] {OUT_CSV} ({len(non_strat)} blocchi)")
    print(f"[scritto] {OUT_TXT}")


if __name__ == '__main__':
    main()
