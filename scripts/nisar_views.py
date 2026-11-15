"""Prépare les vues NISAR réelles de la zone pilote Bikélé-Essassa (Estuaire, Gabon).

Entrée  : data/raw/*.tif  (NISAR L2 GCOV, bande L, HH et HV, sous-ensembles Harmony)
Sorties : public/nisar/<date>.webp       composite coloré HH/HV par date
          public/nisar/changement.png    baisse HV entre la première et la dernière date
          components/esi/mvp/nisar.json  emprise, dates et zones de baisse détectées

Lancer depuis le dossier ESI :  python scripts/nisar_views.py
(nécessite rasterio, numpy, scipy, pillow)
"""
import glob
import json
import os
import re

import numpy as np
import rasterio
from PIL import Image
from rasterio import features
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject
from scipy import ndimage

ZONE = (9.55, 0.35, 9.65, 0.45)   # ouest, sud, est, nord : zone analysée (11 km x 11 km)
VIEW = (9.45, 0.25, 9.75, 0.55)   # emprise affichée autour de la zone
RES = 0.00018                     # degrés par pixel (environ 20 m, résolution native)
DROP_DB = -3.0                    # seuil de baisse de rétrodiffusion HV
MIN_HA = 1.0                      # surface minimale d'une zone détectée

W = round((VIEW[2] - VIEW[0]) / RES)
H = round((VIEW[3] - VIEW[1]) / RES)
GRID = from_bounds(*VIEW, W, H)


def load(path):
    out = np.full((H, W), np.nan, dtype="float32")
    with rasterio.open(path) as src:
        reproject(rasterio.band(src, 1), out, dst_transform=GRID, dst_crs="EPSG:4326",
                  resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
    return out


def db(power):
    return 10 * np.log10(np.where(power > 0, power, np.nan))


def stretch(x, lo, hi):
    return np.clip((x - lo) / (hi - lo), 0, 1)


scenes = {}
for path in sorted(glob.glob("data/raw/*_reformatted.tif")):
    m = re.search(r"_(\d{8})T\d{6}_\d{8}T\d{6}_.*frequencyA_(HHHH|HVHV)_", path)
    if m:
        scenes.setdefault(m.group(1), {})[m.group(2)] = path
dates = sorted(scenes)
os.makedirs("public/nisar", exist_ok=True)

smooth_hv = []
for date in dates:
    hh, hv = load(scenes[date]["HHHH"]), load(scenes[date]["HVHV"])
    # Composite coloré : rouge = HH, vert = HV, bleu = rapport HH/HV.
    r = stretch(db(hh), -17, -2)
    g = stretch(db(hv), -23, -7)
    b = stretch(db(hh) - db(hv), 3, 13)
    rgb = np.nan_to_num(np.dstack([r, g, b])) ** 1.2
    alpha = np.where(np.isnan(hh) | np.isnan(hv), 0, 255).astype("uint8")
    img = Image.fromarray(np.dstack([(rgb * 255).astype("uint8"), alpha]), "RGBA")
    img.save(f"public/nisar/{date}.webp", quality=90, method=6)
    # Pour la comparaison : moyenne 5 x 5 de la puissance HV (réduit le chatoiement).
    smooth_hv.append(db(ndimage.uniform_filter(np.nan_to_num(hv, nan=0.0), 5)))
    print(date, "ok")

# Baisse HV par rapport à la première date, limitée à la zone analysée.
cols = np.arange(W) * RES + VIEW[0]
rows = VIEW[3] - np.arange(H) * RES
in_zone = ((rows[:, None] >= ZONE[1]) & (rows[:, None] <= ZONE[3]) & (cols[None, :] >= ZONE[0]) & (cols[None, :] <= ZONE[2]))
PIXEL_HA = (RES * 111320) ** 2 / 10000
deltas = [s - smooth_hv[0] for s in smooth_hv]
masks = [None] + [ndimage.binary_opening((d < DROP_DB) & in_zone, iterations=1) for d in deltas[1:]]

labels, count = ndimage.label(masks[-1])
detections = []
for i in range(1, count + 1):
    comp = labels == i
    area = comp.sum() * PIXEL_HA
    if area < MIN_HA:
        continue
    # Zone d'influence de la détection, pour retrouver son état aux dates précédentes.
    near = ndimage.binary_dilation(comp, iterations=3)
    polys, areas = [], []
    for mask in masks:
        part = None if mask is None else (mask & near)
        if part is None or part.sum() * PIXEL_HA < 0.2:
            polys.append(None)
            areas.append(0)
            continue
        shapes = [s for s, v in features.shapes(part.astype("uint8"), mask=part, transform=GRID) if v == 1]
        ring = max((s["coordinates"][0] for s in shapes), key=len)
        polys.append([[round(lat, 6), round(lng, 6)] for lng, lat in ring[:-1]])
        areas.append(round(float(part.sum() * PIXEL_HA), 2))
    detections.append({"polys": polys, "areas": areas, "dB": round(float(np.nanmean(deltas[-1][comp])), 1)})
detections.sort(key=lambda d: -d["areas"][-1])
for d in detections:
    d["kind"] = "baisse"

# Défrichements déjà présents à la première date : sol nu (HV faible) sur toutes les scènes.
# Ils ne ressortent pas comme changement ; on les repère par leur niveau HV autour d'un point choisi.
BARE_DB = -18.0
BARE_SEEDS = [(0.3972, 9.7064)]  # lat, lon : un point dans chaque défrichement à quadriller (ici à 7 km à l'est d'Essassa)
forest_db = float(np.nanmedian(smooth_hv[-1][in_zone]))
bare = [ndimage.binary_opening(s < BARE_DB, iterations=1) for s in smooth_hv]  # sur toute l'emprise affichée
bare_labels, _ = ndimage.label(bare[-1])
for lat, lon in BARE_SEEDS:
    row, col = round((VIEW[3] - lat) / RES), round((lon - VIEW[0]) / RES)
    window = bare_labels[row - 15:row + 16, col - 15:col + 16]
    ids = window[window > 0]
    if not ids.size:
        continue
    comp = bare_labels == np.bincount(ids).argmax()
    near = ndimage.binary_dilation(comp, iterations=3)
    polys, areas = [], []
    for mask in bare:
        part_labels, _ = ndimage.label(mask & near)
        sizes = np.bincount(part_labels.ravel())[1:]
        part = part_labels == (sizes.argmax() + 1)
        shapes = [s for s, v in features.shapes(part.astype("uint8"), mask=part, transform=GRID) if v == 1]
        ring = max((s["coordinates"][0] for s in shapes), key=len)
        polys.append([[round(y, 6), round(x, 6)] for x, y in ring[:-1]])
        areas.append(round(float(part.sum() * PIXEL_HA), 2))
    detections.append({"polys": polys, "areas": areas, "dB": round(float(np.nanmean(smooth_hv[-1][comp])) - forest_db, 1), "kind": "sol_nu"})

# Carte de changement : rouge = baisse HV à la dernière date.
last = deltas[-1]
change = np.zeros((H, W, 4), dtype="uint8")
strength = stretch(-last, -DROP_DB, 8)
change[..., 0] = 255
change[..., 1] = (70 * (1 - strength)).astype("uint8")
change[..., 2] = 48
change[..., 3] = np.where(masks[-1], 235, 0)
Image.fromarray(change, "RGBA").save("public/nisar/changement.png")

meta = {
    "source": "NISAR L2 GCOV (provisoire), bande L, trace 159, cadre 002, orbite ascendante",
    "zone": [[ZONE[1], ZONE[0]], [ZONE[3], ZONE[2]]],
    "view": [[VIEW[1], VIEW[0]], [VIEW[3], VIEW[2]]],
    "dates": [f"{d[:4]}-{d[4:6]}-{d[6:]}" for d in dates],
    "images": [f"/nisar/{d}.webp" for d in dates],
    "change": "/nisar/changement.png",
    "thresholdDb": DROP_DB,
    "detections": detections,
}
with open("components/esi/mvp/nisar.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False)
print(len(detections), "zones de baisse >=", MIN_HA, "ha :", [d["areas"] for d in detections[:12]])
