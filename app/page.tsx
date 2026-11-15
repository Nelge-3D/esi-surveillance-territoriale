import type { Metadata } from "next";
import Loader from "../components/esi/mvp/Loader";

// Nom affiché sur l'onglet du navigateur.
export const metadata: Metadata = {
  title: "ESI - Outil de surveillance territoriale",
  description: "Surveillance territoriale à partir des données NISAR : observation forestière et protection des plantations au Gabon.",
};

export default function Home() {
  return <Loader />;
}
