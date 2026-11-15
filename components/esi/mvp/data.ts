// ESI - MVP : zone pilote Bikélé-Essassa, près de Nkok, à l'est de Libreville (Estuaire, Gabon).
// Réel  : scènes NISAR L2 GCOV (nisar.json, produit par scripts/nisar_views.py),
//         zones de baisse de rétrodiffusion détectées, contexte OpenStreetMap (contexte.json).
// Simulé : alertes RADD, observations d'éléphants, relevés de terrain.
import contexte from "./contexte.json";
import nisar from "./nisar.json";

export type LL = [number, number];

export const ZONE = {
  name: "Bikélé-Essassa",
  region: "Estuaire, Gabon",
  bounds: nisar.zone as [LL, LL], // zone analysée, environ 11 km x 11 km
  view: nisar.view as [LL, LL],   // emprise des images affichées
};
export const NISAR = { source: nisar.source, images: nisar.images, change: nisar.change, thresholdDb: nisar.thresholdDb };

const DAY = 864e5;
const now = new Date();
now.setHours(12, 0, 0, 0);
export const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
export const fmtShort = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
export const kmText = (km: number) => (km < 0.1 ? "à moins de 100 m" : `à ${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`);
export const nf = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// Acquisitions NISAR réelles, espacées de 12 jours (cycle de répétition).
export const REPEAT_DAYS = 12;
export const acquisitions: Date[] = nisar.dates.map(d => new Date(d + "T12:00:00"));

export const towns = contexte.towns.map(t => ({ name: t.name, pt: t.pt as LL }));

export type Line = { name: string; kind: "route" | "piste" | "riviere" | "rail"; pts: LL[]; width: number };
export const lines = contexte.lines as unknown as Line[];

const park = contexte.parks[0];
export const protectedArea = { name: park?.name ?? "Aire protégée", ring: (park?.ring ?? []) as unknown as LL[] };

// Périmètres attribués : zone économique spéciale et sites industriels.
export const concessions = contexte.perimeters as unknown as { name: string; ring: LL[] }[];

export const EXAMPLE_PLANTATION: LL = [0.415, 9.635];

// ---------- Géométrie ----------
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distKm(a: LL, b: LL) {
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return (2 * R * Math.asin(Math.min(1, Math.sqrt(h)))) / 1000;
}
const toXY = (p: LL, o: LL): [number, number] => [rad(p[1] - o[1]) * R * Math.cos(rad(o[0])), rad(p[0] - o[0]) * R];
const fromXY = (x: number, y: number, o: LL): LL => [o[0] + deg(y / R), o[1] + deg(x / (R * Math.cos(rad(o[0]))))];

export function areaHa(ring: LL[]) {
  const pts = ring.map(p => toXY(p, ring[0]));
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2 / 10000;
}

export function inRing(p: LL, ring: LL[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const centroid = (ring: LL[]): LL => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

function nearestOnLine(p: LL, pts: LL[]) {
  let best = { km: Infinity, pt: pts[0] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = toXY(pts[i], p);
    const [bx, by] = toXY(pts[i + 1], p);
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const x = ax + t * dx, y = ay + t * dy;
    const km = Math.hypot(x, y) / 1000;
    if (km < best.km) best = { km, pt: fromXY(x, y, p) };
  }
  return best;
}

export function compass(from: LL, to: LL) {
  const [x, y] = toXY(to, from);
  const a = (deg(Math.atan2(x, y)) + 360) % 360;
  return ["au nord", "au nord-est", "à l'est", "au sud-est", "au sud", "au sud-ouest", "à l'ouest", "au nord-ouest"][Math.round(a / 45) % 8];
}

export const inZone = (p: LL) => p[0] >= ZONE.view[0][0] && p[0] <= ZONE.view[1][0] && p[1] >= ZONE.view[0][1] && p[1] <= ZONE.view[1][1];

// ---------- Zones de baisse détectées sur les scènes NISAR réelles ----------
// polys[i] = contour à l'acquisition i (null = rien de détecté), areas[i] = surface en hectares.
export const disturbances = (nisar.detections as unknown as { polys: (LL[] | null)[]; areas: number[]; dB: number; kind: string }[]).map((d, i) => ({
  id: "ESI-F-" + String(i + 1).padStart(3, "0"),
  dB: d.dB,
  polys: d.polys,
  areas: d.areas,
  bare: d.kind === "sol_nu", // défrichement déjà présent à la première date
}));

// Alertes RADD simulées (points), utilisées comme source de recoupement.
const lastRing = (i: number) => disturbances[i]?.polys.at(-1) ?? [];
export const radd: LL[] = [
  ...[0, 1, 3].filter(i => lastRing(i).length).map(i => { const c = centroid(lastRing(i)); return [c[0] + 0.0015, c[1] - 0.001] as LL; }),
  [0.432, 9.566], [0.368, 9.641],
];

export type Elephant = { id: string; pt: LL; days: number; count: number; source: string; reliability: string };
export const elephants: Elephant[] = [
  { id: "E1", pt: [0.435, 9.655], days: 2, count: 4, source: "Piège photographique IA", reliability: "Élevée" },
  { id: "E2", pt: [0.398, 9.652], days: 0, count: 3, source: "Signalement communautaire", reliability: "Moyenne" },
  { id: "E3", pt: [0.47, 9.7], days: 5, count: 2, source: "Signalement communautaire", reliability: "Moyenne" },
  { id: "E4", pt: [0.36, 9.71], days: 1, count: 6, source: "Pléiades Neo (détection IA)", reliability: "Moyenne" },
  { id: "E5", pt: [0.5, 9.73], days: 3, count: 3, source: "Collier GPS", reliability: "Élevée" },
  { id: "E6", pt: [0.33, 9.68], days: 9, count: 1, source: "Signalement communautaire", reliability: "Faible" },
  { id: "E7", pt: [0.455, 9.745], days: 12, count: 5, source: "Pléiades Neo (détection IA)", reliability: "Moyenne" },
];

// ---------- Analyse : quantifier, contextualiser, évaluer ----------
export type Criterion = { label: string; pts: number; max: number; detail: string };
export type BaseStatus = "surveiller" | "verifier";
export type Alert = {
  id: string;
  bare: boolean;
  polys: (LL[] | null)[];
  ring: LL[];
  center: LL;
  areas: number[];
  areaHa: number;
  deltaHa: number;
  dB: number;
  firstIdx: number;
  seenCount: number;
  persistent: boolean;
  place: string;
  access: { name: string; kind: Line["kind"]; km: number; pt: LL };
  inProtected: boolean;
  concession: string | null;
  raddKm: number | null;
  criteria: Criterion[];
  score: number;
  baseStatus: BaseStatus;
  summary: string;
};

function shapeMetrics(ring: LL[]) {
  const c = centroid(ring);
  const pts = ring.map(p => toXY(p, c));
  let xx = 0, xy = 0, yy = 0;
  pts.forEach(([x, y]) => { xx += x * x; xy += x * y; yy += y * y; });
  const t = 0.5 * Math.atan2(2 * xy, xx - yy);
  const along = pts.map(([x, y]) => x * Math.cos(t) + y * Math.sin(t));
  const across = pts.map(([x, y]) => -x * Math.sin(t) + y * Math.cos(t));
  const a = Math.max(...along) - Math.min(...along);
  const b = Math.max(...across) - Math.min(...across);
  return { elong: Math.max(a, b) / Math.max(1, Math.min(a, b)), rect: (areaHa(ring) * 10000) / (a * b) };
}

export function buildAlerts(): Alert[] {
  return disturbances.map(d => {
    const areas = d.areas;
    const firstIdx = d.polys.findIndex(p => p !== null);
    const seenCount = d.polys.filter(Boolean).length;
    const ring = d.polys[d.polys.length - 1] as LL[];
    const center = centroid(ring);
    const area = areas[areas.length - 1];
    const deltaHa = area - areas[areas.length - 2];
    const persistent = seenCount >= 2;

    const town = towns.map(t => ({ t, km: distKm(center, t.pt) })).sort((a, b) => a.km - b.km)[0];
    const place = `à ${nf(town.km)} km ${compass(town.t.pt, center)} ${/^[AEIOUYÉ]/.test(town.t.name) ? "d'" : "de "}${town.t.name}`;

    let access = { name: "", kind: "route" as Line["kind"], km: Infinity, pt: center };
    for (const line of lines) if (line.kind !== "rail") for (const p of [center, ...ring]) {
      const n = nearestOnLine(p, line.pts);
      if (n.km < access.km) access = { name: line.name, kind: line.kind, km: n.km, pt: n.pt };
    }
    const inProtected = inRing(center, protectedArea.ring);
    const concession = concessions.find(c => inRing(center, c.ring))?.name ?? null;
    const raddNear = Math.min(...radd.map(r => distKm(r, center)));
    const raddKm = raddNear <= 1.5 ? raddNear : null;
    const shape = shapeMetrics(ring);

    const criteria: Criterion[] = [
      {
        label: "Accessibilité (route ou rivière)", max: 25,
        pts: access.km < 1 ? 25 : access.km < 3 ? 15 : access.km < 6 ? 8 : 0,
        detail: `${access.name}, ${kmText(access.km)}`,
      },
      {
        label: "Forme de la zone", max: 20,
        pts: shape.rect > 0.9 || shape.elong >= 3 ? 20 : shape.elong >= 1.8 ? 10 : 0,
        detail: shape.rect > 0.9 || shape.elong >= 3 ? "Contour géométrique ou linéaire" : "Contour irrégulier",
      },
      {
        label: "Vitesse de la perte", max: 20,
        pts: deltaHa > 3 ? 20 : deltaHa > 1 ? 12 : deltaHa > 0.2 ? 5 : 0,
        detail: `${deltaHa >= 0 ? "+" : ""}${nf(deltaHa)} ha entre les deux dernières acquisitions`,
      },
      {
        label: "Statut du territoire", max: 25,
        pts: inProtected ? 25 : concession ? 0 : 15,
        detail: inProtected ? `Dans : ${protectedArea.name}` : concession ? `Dans : ${concession}` : "Hors périmètre attribué et hors aire protégée",
      },
      {
        label: "Concordance RADD", max: 10,
        pts: raddKm !== null ? 10 : 0,
        detail: raddKm !== null ? `Alerte RADD à ${nf(raddKm * 1000, 0)} m` : "Aucune alerte RADD à proximité",
      },
    ];
    const score = criteria.reduce((s, c) => s + c.pts, 0);
    const baseStatus: BaseStatus = persistent && score >= 50 ? "verifier" : "surveiller";

    const parts = [
      d.bare
        ? `Sol mis à nu sur ${nf(area)} ha, visible sur les ${seenCount} acquisitions radar : défrichement antérieur au ${fmtDate(acquisitions[0])}, ${place}.`
        : `Baisse de rétrodiffusion sur ${nf(area)} ha, détectée sur ${seenCount} acquisition${seenCount > 1 ? "s" : ""} radar (première détection le ${fmtDate(acquisitions[firstIdx])}, référence du ${fmtDate(acquisitions[0])}), ${place}.`,
      d.bare ? `Rétrodiffusion HV inférieure de ${nf(-d.dB)} dB à celle de la forêt voisine.` : `Baisse moyenne de rétrodiffusion HV : ${nf(d.dB)} dB.`,
      `Accès le plus proche : ${access.name}, ${kmText(access.km)}.`,
      inProtected ? `La zone se trouve dans une aire protégée (${protectedArea.name}).` : concession ? `La zone se trouve dans un périmètre attribué (${concession}) : l'activité peut être autorisée, à rapprocher du plan d'exploitation.` : "La zone est hors périmètre attribué connu.",
      !persistent
        ? `Détection unique : à confirmer à la prochaine acquisition (dans ${REPEAT_DAYS} jours) avant tout déplacement.`
        : baseStatus === "verifier"
          ? "Variation persistante avec indices concordants : vérification terrain recommandée."
          : "Indices d'activité humaine faibles : maintien en surveillance.",
      "Le caractère illégal ne peut être établi qu'après vérification des autorisations.",
    ];

    return { id: d.id, bare: d.bare, polys: d.polys, ring, center, areas, areaHa: area, deltaHa, dB: d.dB, firstIdx, seenCount, persistent, place, access, inProtected, concession, raddKm, criteria, score, baseStatus, summary: parts.join(" ") };
  }).sort((a, b) => b.score - a.score);
}

// ---------- Module plantations ----------
export const NEAR_KM = 5;
export const WIDE_KM = 20;
export type Obs = Elephant & { km: number; date: Date };
export type Vigilance = { level: "Élevée" | "Modérée" | "Faible"; reasons: string[]; near: Obs[]; wide: Obs[]; forest: { alert: Alert; km: number; status: string }[] };

export function assess(center: LL, observations: Elephant[], alerts: { alert: Alert; status: string }[]): Vigilance {
  const obs = observations
    .map(o => ({ ...o, km: distKm(center, o.pt), date: daysAgo(o.days) }))
    .filter(o => o.km <= WIDE_KM)
    .sort((a, b) => a.km - b.km);
  const near = obs.filter(o => o.km <= NEAR_KM);
  const wide = obs.filter(o => o.km > NEAR_KM);
  const forest = alerts
    .map(a => ({ ...a, km: distKm(center, a.alert.center) }))
    .filter(a => a.km <= WIDE_KM && a.status !== "ecarte")
    .sort((a, b) => a.km - b.km);

  const reasons: string[] = [];
  const recentNear = near.filter(o => o.days <= 7);
  const recentWide = wide.filter(o => o.days <= 14);
  const strongForest = forest.filter(f => f.status === "verifier" || f.status === "confirme");
  if (recentNear.length) reasons.push(`${recentNear.length} observation(s) d'éléphants à moins de ${NEAR_KM} km au cours des 7 derniers jours.`);
  if (recentWide.length) reasons.push(`${recentWide.length} observation(s) entre ${NEAR_KM} et ${WIDE_KM} km au cours des 14 derniers jours.`);
  if (strongForest.length) reasons.push(`${strongForest.length} perte(s) de couvert à vérifier ou confirmée(s) dans un rayon de ${WIDE_KM} km : l'habitat des éléphants peut être perturbé.`);
  if (!reasons.length) reasons.push("Aucune observation récente ni perte de couvert notable dans les périmètres.");
  const level = recentNear.length ? "Élevée" : recentWide.length || strongForest.length ? "Modérée" : "Faible";
  return { level, reasons, near, wide, forest };
}
