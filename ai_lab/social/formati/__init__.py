"""formati — un modulo per ogni tipo di post. Il registro dice chi sa disegnare cosa."""
from . import sosta, numero, compagni, mescole, classifica

REGISTRO = {
    "sosta": sosta.disegna,
    "numero": numero.disegna,
    "compagni": compagni.disegna,
    "mescole": mescole.disegna,
    "classifica": classifica.disegna,
}


def sa_disegnare(tipo: str) -> bool:
    return tipo in REGISTRO


def disegna(fatto, cartella):
    fn = REGISTRO.get(fatto.tipo)
    if not fn:
        raise KeyError(f"nessun formato sa disegnare '{fatto.tipo}' "
                       f"(ho: {', '.join(sorted(REGISTRO))})")
    return fn(fatto, cartella)
