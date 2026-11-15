"""Convertit l'extrait OpenStreetMap (data/osm/contexte.json, API Overpass) en contexte
compact pour l'application : routes, voie ferrée, rivières, localités, périmètres.

Lancer depuis le dossier ESI :  python scripts/osm_contexte.py
"""
import json

VIEW = (9.45, 0.25, 9.75, 0.55)
src = json.load(open("data/osm/contexte.json", encoding="utf-8"))


def pts(geometry, step=1):
    p = [[round(g["lat"], 5), round(g["lon"], 5)] for g in geometry if g]
    return p if len(p) <= 6 else p[::step] + ([p[-1]] if (len(p) - 1) % step else [])


def joined(ways):
    """Assemble des tronçons bout à bout en un anneau quand c'est possible."""
    ways = [w[:] for w in ways if len(w) > 1]
    if not ways:
        return []
    ring = ways.pop(0)
    while ways:
        for i, w in enumerate(ways):
            if w[0] == ring[-1]:
                ring += w[1:]
            elif w[-1] == ring[-1]:
                ring += w[::-1][1:]
            elif w[-1] == ring[0]:
                ring = w[:-1] + ring
            elif w[0] == ring[0]:
                ring = w[::-1][:-1] + ring
            else:
                continue
            ways.pop(i)
            break
        else:
            break
    return ring


lines, towns, perimeters, parks = [], [], [], []
for e in src["elements"]:
    t = e.get("tags", {})
    if e["type"] == "node" and t.get("place"):
        towns.append({"name": t.get("name", "Localité"), "pt": [e["lat"], e["lon"]]})
    elif e["type"] == "way" and t.get("highway"):
        major = t["highway"] in ("motorway", "trunk", "primary")
        name = t.get("ref") if major and t.get("ref") else t.get("name") or ("Route nationale" if major else "Route secondaire")
        lines.append({"name": "Route nationale 1 (RN1)" if name in ("RN1", "A1") else name, "kind": "route" if major else "piste", "width": 30 if major else 15, "pts": pts(e["geometry"], 2)})
    elif e["type"] == "way" and t.get("railway"):
        lines.append({"name": "Voie ferrée Transgabonais", "kind": "rail", "width": 12, "pts": pts(e["geometry"], 2)})
    elif e["type"] == "way" and t.get("waterway"):
        lines.append({"name": "Rivière " + t["name"] if t.get("name") else "Cours d'eau", "kind": "riviere", "width": 60, "pts": pts(e["geometry"], 3)})
    elif t.get("landuse") == "industrial":
        ways = [pts(m["geometry"]) for m in e.get("members", []) if m.get("geometry") and m.get("role") != "inner"] if e["type"] == "relation" else [pts(e["geometry"])]
        ring = joined(ways)
        if len(ring) > 3:
            perimeters.append({"name": t.get("name", "Zone industrielle"), "ring": ring[::2] if len(ring) > 60 else ring})
    elif t.get("boundary") == "protected_area" or t.get("leisure") == "nature_reserve" or t.get("boundary") == "national_park":
        ways = [pts(m["geometry"], 3) for m in e.get("members", []) if m.get("geometry") and m.get("role") != "inner"] if e["type"] == "relation" else [pts(e["geometry"], 3)]
        parks.append({"name": t.get("name", "Aire protégée"), "ring": joined(ways)})

out = {"source": "© contributeurs OpenStreetMap", "lines": lines, "towns": towns, "perimeters": perimeters, "parks": parks}
json.dump(out, open("components/esi/mvp/contexte.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(lines), "lignes |", [t["name"] for t in towns], "|", [(p["name"], len(p["ring"])) for p in perimeters], "|", [(p["name"], len(p["ring"]), p["ring"][:1]) for p in parks])
