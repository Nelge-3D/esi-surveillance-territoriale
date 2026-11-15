"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { NEAR_KM, NISAR, WIDE_KM, ZONE, concessions, daysAgo, distKm, fmtShort, lines, protectedArea, radd, towns, type Alert, type Elephant, type LL } from "./data";

export type MapAlert = { alert: Alert; status: string };
type Props = {
  module: "forest" | "plantation";
  showRadar: boolean;
  dateIdx: number;
  composite: boolean;
  showContext: boolean;
  satellite: boolean;
  alerts: MapAlert[];
  selectedId: string | null;
  plantation: { id: string; name: string; pt: LL } | null;
  scanTick: number;
  observations: Elephant[];
  picking: boolean;
  onSelect: (id: string) => void;
  onMapClick: (pt: LL) => void;
};

export const STATUS_COLOR: Record<string, string> = { surveiller: "#f2c14e", verifier: "#ff7a45", confirme: "#ff3d6e", ecarte: "#8fa39a" };

const LINE_STYLE: Record<string, L.PolylineOptions> = {
  route: { color: "#ffe9a8", weight: 3 },
  piste: { color: "#ffe9a8", weight: 1.5, opacity: 0.8 },
  rail: { color: "#f5f5f5", weight: 2, dashArray: "8 6" },
  riviere: { color: "#4aa8ff", weight: 2 },
};

function elephantPreview(observation: Elephant) {
  const preview = L.DomUtil.create("figure", "m-elephant-preview");
  const scene = L.DomUtil.create("div", "m-elephant-scene", preview);
  const image = L.DomUtil.create("img", "", scene);
  // Image de référence : éléphants détectés sur image satellite à très haute résolution.
  const views = { detection: "/elephants-detection.jpg", raw: "/elephants-satellite.jpg" };
  image.src = views.detection;
  image.alt = "Image satellite avec les éléphants encadrés par la détection";
  image.width = 360;
  image.height = 360;
  const label = L.DomUtil.create("figcaption", "", preview);
  label.textContent = `Détection sur image satellite · ${observation.count} éléphant(s) signalé(s)`;
  const details = L.DomUtil.create("small", "", preview);
  details.textContent = fmtShort(daysAgo(observation.days)) + " · Exemple de référence";
  const toggle = L.DomUtil.create("button", "m-link", preview);
  toggle.type = "button";
  toggle.textContent = "Voir l'image sans les détections";
  L.DomEvent.on(toggle, "click", event => {
    L.DomEvent.stop(event);
    const raw = image.src.endsWith(views.detection);
    image.src = raw ? views.raw : views.detection;
    toggle.textContent = raw ? "Voir les détections" : "Voir l'image sans les détections";
  });
  image.addEventListener("error", () => {
    scene.hidden = true;
    label.textContent = "Image satellite indisponible";
  }, { once: true });
  return preview;
}

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const m = useRef<{ map: L.Map; sat: L.TileLayer; osm: L.TileLayer; nisar: L.ImageOverlay; change: L.ImageOverlay; context: L.LayerGroup; alerts: L.LayerGroup; plantation: L.LayerGroup; obs: L.LayerGroup } | null>(null);

  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: true, zoomSnap: 0.25, minZoom: 9, maxZoom: 18, maxBounds: L.latLngBounds(ZONE.view).pad(0.5) });
    map.fitBounds(ZONE.bounds);
    // Coordonnées sous le curseur (ou du dernier point touché), utiles pour situer une zone.
    const coords = new L.Control({ position: "bottomleft" });
    const readout = L.DomUtil.create("div", "m-coord");
    readout.textContent = "Survolez la carte";
    coords.onAdd = () => readout;
    coords.addTo(map);
    const show = (e: L.LeafletMouseEvent) => { readout.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`; };
    map.on("mousemove", show);
    map.on("click", show);
    map.createPane("sar").style.zIndex = "250";
    map.createPane("change").style.zIndex = "260";
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    // Vue réelle : imagerie optique. Vue NISAR : composite HH/HV issu des scènes GCOV réelles.
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Imagerie © Esri, Maxar, Earthstar Geographics", maxNativeZoom: 17, maxZoom: 18 });
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 });
    const nisar = L.imageOverlay(NISAR.images[NISAR.images.length - 1], ZONE.view, { pane: "sar", attribution: "NISAR L2 GCOV © NASA/ISRO, via ASF DAAC" });
    const change = L.imageOverlay(NISAR.change, ZONE.view, { pane: "change" });
    m.current = { map, sat, osm, nisar, change, context: L.layerGroup().addTo(map), alerts: L.layerGroup().addTo(map), plantation: L.layerGroup().addTo(map), obs: L.layerGroup().addTo(map) };
    map.on("click", e => latest.current.onMapClick([e.latlng.lat, e.latlng.lng]));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); map.remove(); m.current = null; };
  }, []);

  useEffect(() => {
    const s = m.current;
    if (!s) return;
    const [on, off] = props.satellite ? [s.sat, s.osm] : [s.osm, s.sat];
    off.remove();
    on.addTo(s.map);
  }, [props.satellite]);

  useEffect(() => {
    const s = m.current;
    if (!s) return;
    s.nisar.setUrl(NISAR.images[props.dateIdx]);
    if (props.showRadar) s.nisar.addTo(s.map); else s.nisar.remove();
    // Le rouge de la carte de changement ne s'affiche qu'en vue radar ; la vue réelle garde seulement les contours.
    if (props.composite && props.showRadar) s.change.addTo(s.map); else s.change.remove();
  }, [props.showRadar, props.dateIdx, props.composite]);

  useEffect(() => {
    const s = m.current;
    if (!s) return;
    s.context.clearLayers();
    L.rectangle(ZONE.bounds, { color: "#b7f5d2", weight: 1.5, dashArray: "4 6", fill: false, interactive: false }).addTo(s.context);
    for (const t of towns) L.circleMarker(t.pt, { radius: 4, color: "#fff", fillColor: "#fff", fillOpacity: 1 }).bindTooltip(t.name, { permanent: true, direction: "right" }).addTo(s.context);
    if (!props.showContext) return;
    if (protectedArea.ring.length) L.polygon(protectedArea.ring, { color: "#63f0bb", weight: 2, dashArray: "6 5", fillOpacity: 0.06 }).bindTooltip(protectedArea.name, { sticky: true }).addTo(s.context);
    for (const c of concessions) L.polygon(c.ring, { color: "#62c9f2", weight: 2, dashArray: "6 5", fillOpacity: 0.05 }).bindTooltip(c.name, { sticky: true }).addTo(s.context);
    for (const line of lines) L.polyline(line.pts, LINE_STYLE[line.kind]).bindTooltip(line.name, { sticky: true }).addTo(s.context);
    if (props.module === "forest") for (const r of radd) L.circleMarker(r, { radius: 4, color: "#e85dff", weight: 2, fillOpacity: 0.5 }).bindTooltip("Alerte RADD").addTo(s.context);
  }, [props.showContext, props.module]);

  useEffect(() => {
    const s = m.current;
    if (!s) return;
    s.alerts.clearLayers();
    for (const { alert, status } of props.alerts) {
      const selected = alert.id === props.selectedId;
      const color = STATUS_COLOR[status];
      const ring = alert.polys[props.dateIdx] ?? alert.ring;
      L.polygon(ring, { color, weight: selected ? 3 : 2, fillOpacity: 0, dashArray: alert.polys[props.dateIdx] ? undefined : "4 5" })
        .bindTooltip(alert.id, { direction: "top" })
        .on("click", e => { L.DomEvent.stopPropagation(e); latest.current.onSelect(alert.id); })
        .addTo(s.alerts);
      // Repère visible à petite échelle.
      if (!selected) L.circleMarker(alert.center, { radius: 9, color, weight: 2, fill: true, fillOpacity: 0.001 })
        .on("click", e => { L.DomEvent.stopPropagation(e); latest.current.onSelect(alert.id); })
        .addTo(s.alerts);
    }
  }, [props.alerts, props.selectedId, props.dateIdx]);

  useEffect(() => {
    const s = m.current;
    const a = props.alerts.find(x => x.alert.id === props.selectedId);
    if (!s || !a) return;
    // Marge autour de la zone : la moitié de sa taille, avec un minimum d'environ 450 m.
    const box = L.latLngBounds(a.alert.ring);
    const margin = Math.max(0.004, Math.max(box.getNorth() - box.getSouth(), box.getEast() - box.getWest()) * 0.5);
    s.map.flyToBounds([[box.getSouth() - margin, box.getWest() - margin], [box.getNorth() + margin, box.getEast() + margin]], { maxZoom: 16, duration: 0.8 });
  }, [props.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = m.current;
    if (!s) return;
    s.plantation.clearLayers();
    s.obs.clearLayers();
    if (props.module !== "plantation") return;
    const p = props.plantation;
    for (const o of props.observations) {
      const km = p ? distKm(p.pt, o.pt) : Infinity;
      const ring = km <= NEAR_KM ? "near" : km <= WIDE_KM ? "wide" : "out";
      L.marker(o.pt, { icon: L.divIcon({ className: "", html: `<span class="m-eleph ${ring}">🐘</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindTooltip(`${o.count} éléphant(s) · ${fmtShort(daysAgo(o.days))}<br>${o.source}<br>Fiabilité : ${o.reliability}`)
        .bindPopup(() => elephantPreview(o), { className: "m-elephant-popup", minWidth: 180, maxWidth: 360 })
        .addTo(s.obs);
    }
    if (!p) return;
    L.circle(p.pt, { radius: WIDE_KM * 1000, color: "#62c9f2", weight: 2, dashArray: "8 7", fillOpacity: 0.04, interactive: false }).addTo(s.plantation);
    L.circle(p.pt, { radius: NEAR_KM * 1000, color: "#ffb347", weight: 2, fillOpacity: 0.1, interactive: false }).addTo(s.plantation);
    L.marker(p.pt, { icon: L.divIcon({ className: "", html: '<span class="m-plant">🌱</span>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).bindTooltip(p.name, { permanent: true, direction: "bottom", offset: [0, 12] }).addTo(s.plantation);
  }, [props.module, props.plantation, props.observations]);

  useEffect(() => {
    const s = m.current;
    const p = latest.current.plantation;
    if (!s || !p || !props.scanTick) return;
    s.map.fitBounds(L.latLng(p.pt).toBounds(WIDE_KM * 2100));
    const sweep = L.circle(p.pt, { radius: 1, color: "#b7f5d2", weight: 3, fillOpacity: 0.12, interactive: false }).addTo(s.map);
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1600);
      sweep.setRadius(Math.max(1, k * WIDE_KM * 1000));
      if (k < 1) frame = requestAnimationFrame(step); else sweep.remove();
    };
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); sweep.remove(); };
  }, [props.scanTick]);

  return <div ref={el} className={"m-map" + (props.picking ? " picking" : "")} />;
}
