export type Point = [number, number];

export const mandji: Point = [-1.7058, 10.38865];
export const yombi: Point = [-1.40794, 10.62563];
export const examplePlantation: Point = [-1.788, 10.358];
export const disturbance: Point = [-1.798, 10.331];
export const forestPatch: Point[] = [
  [-1.7967, 10.3291], [-1.7961, 10.3323], [-1.7980, 10.3334],
  [-1.7998, 10.3321], [-1.7995, 10.3292], [-1.7982, 10.3285],
];
export const surveyArea: Point[] = [
  [-1.756, 10.316], [-1.760, 10.352], [-1.779, 10.367],
  [-1.783, 10.331], [-1.770, 10.304],
];
export const lowland: Point[] = [
  [-1.804, 10.349], [-1.808, 10.370], [-1.819, 10.376], [-1.812, 10.353],
];
export const simulatedIncident: Point = [-1.766, 10.332];
export const innerKm = 5;
export const outerKm = 20;

const earthRadiusKm = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function distanceKm(first: Point, second: Point) {
  const [latA, lngA] = first.map(radians);
  const [latB, lngB] = second.map(radians);
  const a = Math.sin((latB - latA) / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin((lngB - lngA) / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function zoneAt(distance: number) {
  if (distance <= innerKm) return "0–5 km · Vigilance élevée";
  if (distance <= outerKm) return "5–20 km · Vigilance potentielle";
  return "Hors des périmètres";
}

// Spherical polygon area for the small, fictional perturbation.
export const areaHa = Math.abs(forestPatch.reduce((sum, [lat, lon], index) => {
  const [nextLat, nextLon] = forestPatch[(index + 1) % forestPatch.length];
  return sum + radians(nextLon - lon) * (Math.sin(radians(lat)) + Math.sin(radians(nextLat)));
}, 0)) * earthRadiusKm ** 2 * 50;

export const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const references = [
  ["IFC · Olam Palm Gabon, Mouila Lot 2", "https://disclosures.ifc.org/project-detail/ESRS/39310/olam-palm-gabon"],
  ["RSPO · Carte de localisation du Lot 2", "https://rspo.org/wp-content/uploads/RSPO%20NPP_%20NOTIFICATION_OLAM%20PALM%20GABON_MOUILA%20LOT%202.pdf"],
  ["OpenStreetMap · Mandji (Ndolou)", "https://www.openstreetmap.org/node/3013074953"],
  ["OpenStreetMap · Yombi", "https://www.openstreetmap.org/node/5681276201"],
  ["NASA · NISAR et les écosystèmes", "https://science.nasa.gov/mission/nisar/ecosystem/"],
  ["Reiche et al. · Sentinel-1 et perturbations forestières", "https://doi.org/10.1088/1748-9326/abd0a8"],
  ["WWF-Gabon · Rapport annuel 2024", "https://wwfafrica.awsassets.panda.org/downloads/rapport-wwf-gabon-2024--final-version.pdf"],
  ["Terada et al. · Éléphants et cultures au Gabon", "https://doi.org/10.3389/fcosc.2024.1356174"],
  ["Whytock et al. · Pièges photographiques au Gabon", "https://doi.org/10.1111/2041-210X.14036"],
  ["Duporge et al. · Détection en savane boisée, WorldView-3/4", "https://doi.org/10.1002/rse2.195"],
  ["Airbus · Imagerie Pléiades Neo", "https://space-solutions.airbus.com/imagery/our-optical-and-radar-satellite-imagery/pleiades-neo/"],
] as const;