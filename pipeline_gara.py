"""pipeline_gara.py — porta una gara nuova da TracingInsights alla demo, SEMI-automatica.

Principio: automatizza la fatica, MAI il giudizio. Tutta l'IDRAULICA (scoperta, download,
conversione, guardrail, staging) e' automatica; la pubblicazione in demo/ richiede un OK
umano dopo il riepilogo. Istruzioni per il product owner: COME_AGGIUNGERE_UNA_GARA.txt

Comandi:
  python3 pipeline_gara.py aggiorna "<NomeDemo>" "<Cartella TI>" <cid>
      COMANDO UNICO: esegue tutta l'idraulica di fila e si ferma UNA volta sola, al
      checkpoint finale (riepilogo + report), prima di pubblicare. Scrivi 'pubblica' al
      prompt per pubblicare in demo/; qualsiasi altra cosa annulla (demo intatta).
      es: python3 pipeline_gara.py aggiorna "Gran Bretagna" "British Grand Prix" silverstone

  python3 pipeline_gara.py scopri
      Sonda TracingInsights/2026 (raw URL, mai API contents) ed elenca le gare online
      che NON sono ancora nella demo (confronto con data/gare_registro.json).

  python3 pipeline_gara.py prepara "<NomeDemo>" "<Cartella TI>" <cid>
      Solo l'idraulica + checkpoint, SENZA pubblicare (controllo stadio per stadio).
      Scrive tutto in staging_gara/ (MAI in demo/). Il cid serve per il pit-loss
      (elenco cid: prima colonna di data/pit_loss_circuito_f1db.csv).

  python3 pipeline_gara.py pubblica "<NomeDemo>"
      SOLO DOPO OK UMANO: sposta la staging in demo/, aggiorna manifest, pitloss, esiti,
      neutralizzazione e registro, e riesegue il golden pit (11/11). Il git commit/push
      (= deploy Vercel) resta un passo umano separato.

CONFINE NON NEGOZIABILE: questo comando fa SOLO l'idraulica sicura. NON ricalcola mai
coefficienti motore (degrado, warm-in, profili), NON tocca la griglia (grids.json), NON
cambia il metodo del pit-loss (ne inserisce solo il valore da f1db), NON tocca la
telemetria. Tutto cio' e' "TOCCA IL MOTORE" e resta a mano (segnalato nel report).

GUARDRAIL (soglie dichiarate):
  1. COMPLETEZZA : >=18 piloti, >=40 giri, >=10 piloti sull'ultimo giro,
                   durata leader 60-150 min. Fallisce -> BLOCCA.
  2. DRY-CHECK   : criteri di drycheck_2026.valuta (INT/WET=0, pioggia<1%).
                   Fallisce -> NON pubblicabile in automatico, serve decisione umana
                   (il caso Canada Race, Fase 2.1).
  3. SANITA'     : team mappati per tutti, classifica ricostruibile via sesT su giri
                   campione, tabella pace popolata a meta' gara, e smoke-test del modulo
                   pit CONGELATO (pipeline_smoke_pit.mjs): caso verde -> gap numerici,
                   caso in finestra SC/VSC -> gap soppressi.
  In piu': la neutralizzazione rigenerata deve essere IDENTICA sulle gare esistenti
  (la gara nuova puo' solo aggiungere, mai cambiare cio' che e' gia' validato).

ESITI (euristica dichiarata, mostrata al checkpoint per verifica a occhio):
  ultimo giro == n_giri -> pieno_giro; ultimo cum_time entro 180s dalla bandiera ->
  doppiato (correva fino alla fine); altrimenti RIT. NP non derivabile senza griglia f1db.
"""
import os, sys, json, csv, shutil, subprocess, urllib.request, urllib.parse

REGISTRO = os.path.join('data', 'gare_registro.json')
STAGING  = 'staging_gara'
GP24 = ['Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Bahrain Grand Prix',
'Saudi Arabian Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix',
'Spanish Grand Prix','Barcelona Grand Prix','Canadian Grand Prix','Austrian Grand Prix',
'British Grand Prix','Belgian Grand Prix','Hungarian Grand Prix','Dutch Grand Prix',
'Italian Grand Prix','Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix',
'Mexico City Grand Prix','São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix',
'Abu Dhabi Grand Prix']

def _http(url, method='GET'):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': 'muretto'})
    try: return urllib.request.urlopen(req, timeout=40)
    except Exception: return None

def raw_url(ti, sess):
    return f"https://raw.githubusercontent.com/TracingInsights/2026/main/{urllib.parse.quote(ti)}/{sess}/session_laptimes.json"

def registro(): return json.load(open(REGISTRO))

# ---------------------------------------------------------------- 1. SCOPERTA
def scopri():
    note = {v['ti'] for v in registro().values()}
    print("Sonda TracingInsights/2026 (raw URL)...")
    mancanti = []
    for ti in GP24:
        r = _http(raw_url(ti, 'Race'), 'HEAD')
        if r is None: continue
        stato = 'IN DEMO' if ti in note else 'MANCANTE DALLA DEMO'
        if ti not in note: mancanti.append(ti)
        print(f"  {ti:32s} Race online  -> {stato}")
    if not mancanti:
        print("\nLa demo e' allineata: nessuna gara nuova online.")
    else:
        print(f"\nGare da portare in demo: {mancanti}")
        print('Prossimo passo:  python3 pipeline_gara.py aggiorna "<NomeDemo>" "<Cartella TI>" <cid>')
    return mancanti

# --------------------------------------------- 2+3. IDRAULICA -> STAGING (core)
def _prepara(nome, ti, cid):
    """Tutta l'idraulica fino allo staging. BLOCCA (sys.exit) se un guardrail fallisce.
    Ritorna un contesto (ctx) per checkpoint e report. NON stampa il checkpoint e NON
    tocca demo/."""
    reg = registro()
    if nome in reg:
        sys.exit(f"BLOCCO: '{nome}' e' gia' nel registro (gia' in demo).")
    if any(v['ti'] == ti for v in reg.values()):
        sys.exit(f"BLOCCO: la cartella TI '{ti}' e' gia' associata a una gara in demo.")

    # download (o riuso dell'archivio)
    raw_path = os.path.join('data', 'ti_archive', '2026', ti, 'Race.json')
    if os.path.exists(raw_path) and os.path.getsize(raw_path) > 1000:
        print(f"[dati] riuso l'archivio esistente: {raw_path}")
    else:
        r = _http(raw_url(ti, 'Race'))
        if r is None: sys.exit(f"BLOCCO: {ti}/Race non e' online su TracingInsights.")
        raw = r.read(); json.loads(raw)  # valida prima di scrivere
        os.makedirs(os.path.dirname(raw_path), exist_ok=True)
        open(raw_path, 'wb').write(raw)
        print(f"[dati] scaricato: {raw_path} ({len(raw)//1024} KB)")
    d = json.load(open(raw_path))

    # GUARDRAIL 2 — dry-check (prima di tutto: e' il piu' economico e il piu' importante)
    from drycheck_2026 import valuta
    dc = valuta(d, 'Race')
    if not dc['dry']:
        sys.exit(f"NON PUBBLICABILE IN AUTOMATICO: sessione non asciutta "
                 f"(INT/WET={dc['intwet']}, pioggia={dc['frac_rain']}). "
                 f"Richiede decisione umana esplicita — vedi il caso Canada Race in data/DEGRADO_NOTA.txt.")

    # GUARDRAIL 1 — completezza
    ses = [t for t in d['sesT'] if isinstance(t, (int, float))]
    durata_min = (max(ses) - min(ses)) / 60 if ses else 0
    ultimo = dc['max_lap']
    sul_finale = len({d['drv'][i] for i in range(len(d['lap']))
                      if d['lap'][i] is not None and int(d['lap'][i]) == ultimo})
    problemi = []
    if dc['n_piloti'] < 18: problemi.append(f"piloti {dc['n_piloti']}<18")
    if ultimo < 40: problemi.append(f"giri {ultimo}<40")
    if sul_finale < 10: problemi.append(f"solo {sul_finale} piloti sull'ultimo giro")
    if not (60 <= durata_min <= 150): problemi.append(f"durata {durata_min:.0f} min fuori da [60,150]")
    if problemi:
        sys.exit(f"BLOCCO COMPLETEZZA (gara a meta' caricamento?): {'; '.join(problemi)}")

    # conversione — STESSO formato di export_demo.py (adapter e pace del kernel congelato)
    import pandas as pd
    from export_demo import export_gara
    obj = export_gara(nome, raw=pd.DataFrame(d))
    N = obj['n_laps']

    # GUARDRAIL 3 — sanita'
    problemi = []
    senza_team = {dd for lp in obj['laps'] for dd, c in lp['cars'].items() if not c['team']}
    if senza_team: problemi.append(f"piloti senza team: {sorted(senza_team)}")
    for L in (2, N // 2, N):
        cars = next(lp['cars'] for lp in obj['laps'] if lp['lap'] == L)
        ok_ct = sum(1 for c in cars.values() if isinstance(c['cum_time'], (int, float)))
        if ok_ct < 10: problemi.append(f"classifica non ricostruibile al giro {L} ({ok_ct} cum_time)")
    if len(obj['pace'][str(N // 2)]) < 10:
        problemi.append(f"tabella pace scarsa a meta' gara ({len(obj['pace'][str(N//2)])} piloti)")
    if problemi:
        sys.exit(f"BLOCCO SANITA': {'; '.join(problemi)}")

    # neutralizzazione: rigenera con la gara nuova; le esistenti NON devono cambiare
    from gen_neutralizzazione import genera, gare_da_registro
    gare = gare_da_registro(); gare[nome] = raw_path
    neu = genera(gare)
    attuale = json.load(open(os.path.join('demo', 'neutralizzazione.json')))
    diverse = [g for g in attuale if neu.get(g) != attuale[g]]
    if diverse:
        sys.exit(f"BLOCCO: la rigenerazione cambierebbe gare gia' validate: {diverse}")
    ng = neu[nome]
    fin = ng.get('sc', []) + ng.get('vsc', []) + ng.get('rf', [])

    # esiti (euristica dichiarata in testa al file)
    last, last_ct = {}, {}
    for lp in obj['laps']:
        for dd, c in lp['cars'].items():
            last[dd] = lp['lap']
            if isinstance(c['cum_time'], (int, float)): last_ct[dd] = c['cum_time']
    bandiera = min(c['cum_time'] for c in obj['laps'][-1]['cars'].values()
                   if isinstance(c['cum_time'], (int, float)))
    esiti_gara = {dd: ('pieno_giro' if l >= N else
                       'doppiato' if last_ct.get(dd, 0) >= bandiera - 180 else 'RIT')
                  for dd, l in last.items()}

    # pit-loss dal cid (fonte f1db, la stessa delle altre gare in demo; debito P1 aperto)
    pit_loss, fonte_pl = 22.0, 'FALLBACK 22.0 (cid non trovato!)'
    with open(os.path.join('data', 'pit_loss_circuito_f1db.csv')) as f:
        for row in csv.DictReader(f):
            if row['cid'] == cid: pit_loss, fonte_pl = float(row['pit_loss_s']), f"f1db cid={cid}"

    # scrivi la STAGING (mai demo/)
    sdir = os.path.join(STAGING, nome)
    shutil.rmtree(sdir, ignore_errors=True)
    os.makedirs(os.path.join(sdir, 'data'))
    json.dump(obj, open(os.path.join(sdir, 'data', nome + '.json'), 'w'), separators=(',', ':'))
    json.dump(neu, open(os.path.join(sdir, 'neutralizzazione.json'), 'w'), indent=2)
    meta = dict(nome=nome, ti=ti, cid=cid, raw=raw_path, n_laps=N,
                n_drivers=len(obj['drivers']), pit_loss=pit_loss, fonte_pit_loss=fonte_pl,
                esiti=esiti_gara, finestre=fin, drycheck=dc['esito'], durata_min=round(durata_min, 1))
    json.dump(meta, open(os.path.join(sdir, 'meta.json'), 'w'), indent=2)

    # smoke-test del modulo pit CONGELATO su copie in staging
    smoke = os.path.join(sdir, 'smoke'); os.makedirs(os.path.join(smoke, 'data'))
    for f in ('engine.mjs', 'pitscenario.mjs'):
        shutil.copy(os.path.join('demo', f), smoke)
    shutil.copy(os.path.join(sdir, 'neutralizzazione.json'), smoke)
    shutil.copy(os.path.join(sdir, 'data', nome + '.json'), os.path.join(smoke, 'data'))
    print("[guardrail 3] smoke-test modulo pit (congelato) sui dati in staging:")
    r = subprocess.run(['node', 'pipeline_smoke_pit.mjs', smoke, nome, str(pit_loss)])
    if r.returncode != 0:
        sys.exit("BLOCCO SANITA': lo smoke-test del modulo pit e' fallito.")

    # anomalie (NON bloccanti): guardrail vicino soglia + esiti sospetti — per il report
    n_rit = sum(1 for e in esiti_gara.values() if e == 'RIT')
    n_dop = sum(1 for e in esiti_gara.values() if e == 'doppiato')
    anomalie = []
    if dc['n_piloti'] == 18: anomalie.append("piloti al minimo consentito (18)")
    if ultimo <= 42: anomalie.append(f"giri vicino alla soglia minima ({ultimo}, min 40)")
    if sul_finale <= 11: anomalie.append(f"piloti sull'ultimo giro vicino alla soglia ({sul_finale}, min 10)")
    if durata_min <= 66 or durata_min >= 144: anomalie.append(f"durata leader vicino al bordo ({durata_min:.0f} min, range 60-150)")
    if n_rit >= 7: anomalie.append(f"molti ritirati ({n_rit}) — verifica l'euristica esiti a occhio")
    if n_rit == 0 and n_dop == 0: anomalie.append("nessun ritirato/doppiato — verifica che l'euristica esiti abbia senso")

    return dict(nome=nome, ti=ti, cid=cid, N=N, sul_finale=sul_finale, durata_min=durata_min,
                dc=dc, fin=fin, ng=ng, esiti_gara=esiti_gara, pit_loss=pit_loss,
                fonte_pl=fonte_pl, sdir=sdir, anomalie=anomalie)

# ------------------------------------------------ 4. CHECKPOINT (riepilogo)
def stampa_checkpoint(ctx):
    nome, ti, N = ctx['nome'], ctx['ti'], ctx['N']
    dc, esiti_gara = ctx['dc'], ctx['esiti_gara']
    rit = sorted(dd for dd, e in esiti_gara.items() if e == 'RIT')
    dop = sorted(dd for dd, e in esiti_gara.items() if e == 'doppiato')
    riep = f"""
{'='*72}
CHECKPOINT UMANO — riepilogo di cosa verrebbe pubblicato
{'='*72}
  Gara        : {nome}  (TracingInsights: {ti})
  Giri        : {N} completi ({ctx['sul_finale']} piloti sull'ultimo giro, durata {ctx['durata_min']:.0f} min)
  Meteo       : {'ASCIUTTA' if dc['dry'] else 'NON ASCIUTTA'} (INT/WET={dc['intwet']}, pioggia={('%.1f%%' % (100*dc['frac_rain'])) if dc['frac_rain'] is not None else 'n/d'})
  Piloti      : {dc['n_piloti']} — tutti con team mappato
  Finestre SC/VSC : {ctx['fin'] if ctx['fin'] else 'nessuna'}  (soppressione gap verificata dallo smoke-test)
  Pit-loss    : {ctx['pit_loss']} s  (fonte {ctx['fonte_pl']}; debito P1 aperto: metodo non riverificato)
  Esiti (euristica, verifica a occhio):
    - a pieni giri : {len(esiti_gara) - len(rit) - len(dop)}
    - doppiati     : {dop if dop else '—'}
    - ritirati     : {rit if rit else '—'}
  Griglia     : ASSENTE (si aggiunge da f1db verificato; la UI ordina il giro 1 via sesT)
  Guardrail   : completezza OK · dry-check OK · sanita' OK (smoke pit incluso)
{'='*72}"""
    print(riep)
    open(os.path.join(ctx['sdir'], 'riepilogo.txt'), 'w').write(riep)

# ------------------------------------------------ 3b. REPORT AUTOMATICO
def stampa_report(ctx):
    nome, sdir = ctx['nome'], ctx['sdir']
    kb = os.path.getsize(os.path.join(sdir, 'data', nome + '.json')) // 1024
    man = json.load(open(os.path.join('demo', 'data', 'manifest.json')))
    ng = ctx['ng']
    r = []
    r.append("REPORT AUTOMATICO")
    r.append("-" * 72)
    r.append("SCRITTURE PREVISTE IN demo/ (solo dopo l'OK):")
    r.append(f"  demo/data/{nome}.json                 NUOVO ({kb} KB)")
    r.append(f"  demo/data/manifest.json               +1 gara ({len(man)} -> {len(man)+1})")
    r.append(f"  demo/data/pitloss.json                + {nome}: {ctx['pit_loss']} s")
    r.append(f"  demo/data/esiti.json                  + {nome}: {len(ctx['esiti_gara'])} piloti")
    r.append(f"  demo/neutralizzazione.json            + {nome} (sc={ng.get('sc',[])} vsc={ng.get('vsc',[])} rf={ng.get('rf',[])}); esistenti INVARIATE")
    r.append(f"  data/gare_registro.json               + {nome}")
    r.append("")
    r.append("DA FARE A MANO (fuori dall'automatico — tocca il motore o serve verifica):")
    r.append(f"  - griglia di partenza (grids.json): ASSENTE per {nome} -> da f1db, verificata a mano")
    r.append("  - pit-loss: valore f1db inserito, ma DEBITO P1 (metodo non riverificato)")
    r.append("  - ricalcoli motore (degrado_gamma_linlog, warm-in, profili pilota/team): NON automatici")
    r.append("  - telemetria di posizione: fuori da questo comando (controllo-copertura separato)")
    r.append("")
    r.append("MOTORE NON TOCCATO (per costruzione — il comando non li scrive mai):")
    r.append("  engine/, engine.mjs, pitscenario.mjs, golden, degrado_gamma_linlog.csv,")
    r.append("  stint_gold, warmin_prior, profili, grids.json  (+ test_pit riverificato dopo publish)")
    r.append("")
    r.append("ANOMALIE / DA GUARDARE:")
    if ctx['anomalie']:
        for a in ctx['anomalie']: r.append(f"  - {a}")
    else:
        r.append("  - nessuna (guardrail lontani dalle soglie, esiti nella norma)")
    r.append("-" * 72)
    testo = "\n".join(r)
    print("\n" + testo)
    open(os.path.join(sdir, 'report.txt'), 'w').write(testo)

# ------------------------------------------------------------ 5. PUBBLICA
def pubblica(nome):
    sdir = os.path.join(STAGING, nome)
    if not os.path.exists(os.path.join(sdir, 'meta.json')):
        sys.exit(f"BLOCCO: nessuna staging per '{nome}'. Esegui prima 'prepara' o 'aggiorna'.")
    meta = json.load(open(os.path.join(sdir, 'meta.json')))

    shutil.copy(os.path.join(sdir, 'data', nome + '.json'), os.path.join('demo', 'data', nome + '.json'))
    shutil.copy(os.path.join(sdir, 'neutralizzazione.json'), os.path.join('demo', 'neutralizzazione.json'))

    man_p = os.path.join('demo', 'data', 'manifest.json')
    man = json.load(open(man_p))
    man = [m for m in man if m['gara'] != nome] + [dict(gara=nome, n_laps=meta['n_laps'], n_drivers=meta['n_drivers'])]
    json.dump(man, open(man_p, 'w'), indent=2)

    pl_p = os.path.join('demo', 'data', 'pitloss.json')
    pl = json.load(open(pl_p)); pl[nome] = meta['pit_loss']
    json.dump(pl, open(pl_p, 'w'), separators=(',', ':'))

    es_p = os.path.join('demo', 'data', 'esiti.json')
    es = json.load(open(es_p)); es[nome] = meta['esiti']
    json.dump(es, open(es_p, 'w'))

    reg = registro(); reg[nome] = dict(ti=meta['ti'], raw=meta['raw'], cid=meta['cid'])
    json.dump(reg, open(REGISTRO, 'w'), indent=2)

    print(f"[pubblica] {nome} aggiunta a demo/ (manifest, pitloss, esiti, neutralizzazione, registro).")
    print("[verifica] golden pit sul modulo congelato:")
    r = subprocess.run(['node', 'test_pit.mjs'], cwd='demo')
    if r.returncode != 0:
        sys.exit("ATTENZIONE: golden pit FALLITO dopo la pubblicazione — NON committare, indagare.")
    print("\nFatto. Prossimo passo umano (OK separato): git add/commit/push -> deploy Vercel.")

# ------------------------------------------------------ COMANDO UNICO
def aggiorna(nome, ti, cid):
    ctx = _prepara(nome, ti, cid)     # tutta l'idraulica -> staging (BLOCCA se un guardrail fallisce)
    stampa_checkpoint(ctx)            # unico checkpoint: riepilogo
    stampa_report(ctx)                # + report automatico
    print(f"\nLa demo NON e' stata toccata. Staging pronta in {ctx['sdir']}.")
    try:
        risposta = input(">>> Scrivi 'pubblica' e premi Invio per PUBBLICARE in demo/, "
                         "altro (o Invio) per ANNULLARE: ").strip()
    except EOFError:
        risposta = ''
    if risposta == 'pubblica':
        print()
        pubblica(nome)
    else:
        print(f"Annullato. demo/ intatta; staging conservata in {ctx['sdir']} "
              f"(puoi ripubblicare piu' tardi con: python3 pipeline_gara.py pubblica \"{nome}\").")

# -------------------------------------------- 2+3 CLI: solo idraulica + checkpoint
def prepara(nome, ti, cid):
    ctx = _prepara(nome, ti, cid)
    stampa_checkpoint(ctx)
    stampa_report(ctx)
    print(f"\nLa demo NON e' stata toccata. Per pubblicare, DOPO l'OK umano:")
    print(f"    python3 pipeline_gara.py pubblica \"{nome}\"")

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['scopri']: scopri()
    elif a[:1] == ['aggiorna'] and len(a) == 4: aggiorna(a[1], a[2], a[3])
    elif a[:1] == ['prepara'] and len(a) == 4: prepara(a[1], a[2], a[3])
    elif a[:1] == ['pubblica'] and len(a) == 2: pubblica(a[1])
    else: sys.exit(__doc__)
