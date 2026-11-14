"use client";

import { useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, ScaleControl, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import { disturbance, forestPatch, innerKm, lowland, mandji, outerKm, simulatedIncident, surveyArea, yombi, type Point } from "./scenario";

type Props = {
  candidate: Point;
  plantation: Point | null;
  canPlace: boolean;
  wildlife: boolean;
  flood: boolean;
  onPlace: (point: Point) => void;
};

function Placement({ onPlace }: Pick<Props, "onPlace">) {
  useMapEvents({ click: ({ latlng }) => onPlace([latlng.lat, latlng.lng]) });
  return null;
}

export default function ScenarioMap({ candidate, plantation, canPlace, wildlife, flood, onPlace }: Props) {
  const [tileError, setTileError] = useState(false);
  const point = canPlace ? candidate : plantation;

  return <div className="esi-map">
    <MapContainer bounds={[[-1.99, 10.16], yombi]} boundsOptions={{ padding: [22, 22] }} minZoom={8} maxZoom={17} className="esi-leaflet" scrollWheelZoom={false}>
      <TileLayer
        url={process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
        attribution={'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
        eventHandlers={{ tileerror: () => setTileError(true) }}
      />
      <ScaleControl position="bottomleft" imperial={false} />
      <CircleMarker center={mandji} radius={4} pathOptions={{ color: "#ecf6ef", fillOpacity: 1 }}>
        <Tooltip permanent direction="right">Mandji · Ndolou</Tooltip>
      </CircleMarker>
      <CircleMarker center={yombi} radius={4} pathOptions={{ color: "#ecf6ef", fillOpacity: 1 }}>
        <Tooltip permanent direction="left">Yombi</Tooltip>
      </CircleMarker>
      <Polygon positions={forestPatch} pathOptions={{ color: "#ff9468", fillOpacity: 0.5 }}>
        <Tooltip>Variation forestière simulée</Tooltip>
      </Polygon>
      <CircleMarker center={disturbance} radius={5} pathOptions={{ color: "#ff9468", fillOpacity: 1 }}>
        <Tooltip permanent direction="left">Changement simulé</Tooltip>
      </CircleMarker>
      {flood && <Polygon positions={lowland} pathOptions={{ color: "#68bdfb", dashArray: "5 6", fillOpacity: 0.18 }}>
        <Tooltip>Zone basse hypothétique · simulation</Tooltip>
      </Polygon>}
      {wildlife && <>
        <Polygon positions={surveyArea} pathOptions={{ color: "#e2bb79", dashArray: "5 6", fillOpacity: 0.18 }}>
          <Tooltip>Secteur d’étude fictif</Tooltip>
        </Polygon>
        <CircleMarker center={simulatedIncident} radius={5} pathOptions={{ color: "#e2bb79", fillOpacity: 0.7 }}>
          <Tooltip>Incident fictif · scénario</Tooltip>
        </CircleMarker>
      </>}
      {point && <>
        <Circle center={point} radius={outerKm * 1000} pathOptions={{ color: "#62c9f2", dashArray: "6 6", fillOpacity: 0.03, interactive: false }} />
        <Circle center={point} radius={innerKm * 1000} pathOptions={{ color: "#63f0bb", fillOpacity: 0.12, interactive: false }} />
        <CircleMarker center={point} radius={7} pathOptions={{ color: "#63f0bb", fillOpacity: 1 }}>
          <Tooltip permanent direction="bottom">{canPlace ? "Point proposé · fictif" : "Plantation fictive"}</Tooltip>
        </CircleMarker>
      </>}
      {canPlace && <Placement onPlace={onPlace} />}
    </MapContainer>
    <span className="esi-map-label">Fond géographique réel · couches de scénario simulées</span>
    {tileError && <p className="esi-map-error" role="status">Fond de carte indisponible. Les couches du scénario restent visibles.</p>}
  </div>;
}