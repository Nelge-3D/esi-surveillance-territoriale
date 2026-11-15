"use client";

import dynamic from "next/dynamic";

// Leaflet et le stockage local n'existent que dans le navigateur.
const App = dynamic(() => import("./App"), { ssr: false, loading: () => <p style={{ padding: 24 }}>Chargement de la carte…</p> });

export default function Loader() {
  return <App />;
}
