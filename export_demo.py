import os, sys, json
sys.path.insert(0, "engine")
from engine import ti_adapter, load, pace_base, FILES

OUT = os.path.join("demo", "data")

def export_gara(gara, raw=None):
    """Converte una gara nel formato demo.
    raw=None -> comportamento storico (engine.load dalla ti_cache, gare in engine.FILES).
    raw=DataFrame -> stessi adapter e pace del kernel su dati forniti dal chiamante
    (usato da pipeline_gara.py per le gare non presenti in engine.FILES, che e' congelato)."""
    states, N = ti_adapter(raw if raw is not None else load(gara), gara)
    laps = []
    for s in states:
        cars = {}
        for d, c in s.cars.items():
            cars[d] = {
                "team": c.team, "cum_time": c.cum_time, "lap_time": c.lap_time,
                "lap": c.lap, "stint": c.stint, "compound": c.compound,
                "tyre_age": c.tyre_age, "in_lap": c.in_lap, "out_lap": c.out_lap,
                "neutralized": c.neutralized,
            }
        laps.append({"lap": states.index(s) + 1, "cars": cars})
    # tabella pace[L][drv]: passo-base congelato calcolato dalla verita Python
    drivers = sorted(set().union(*[set(s.cars) for s in states]))
    pace = {}
    for L in range(1, N + 1):
        row = {}
        for d in drivers:
            p = pace_base(states, N, d, L)
            if p is not None:
                row[d] = p
        pace[str(L)] = row
    return {"gara": gara, "n_laps": N, "drivers": drivers, "laps": laps, "pace": pace}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for gara in FILES:
        obj = export_gara(gara)
        path = os.path.join(OUT, gara + ".json")
        with open(path, "w") as f:
            json.dump(obj, f, separators=(",", ":"))
        kb = os.path.getsize(path) // 1024
        manifest.append({"gara": gara, "n_laps": obj["n_laps"], "n_drivers": len(obj["drivers"])})
        print(f"{gara:10s} -> {obj['n_laps']:3d} giri, {len(obj['drivers'])} piloti, {kb} KB")

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("\nmanifest.json scritto. Export completo in demo/data/")
