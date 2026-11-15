"use client";

import { NISAR, ZONE, acquisitions, fmtDate } from "./data";

// Fiche technique du MVP : fonctionnement de l'agent, technologies, données et glossaire.
// Elle distingue ce qui est réel dans le MVP de ce qui est une démonstration, et décrit
// pour chaque démonstration ce qui doit être implémenté.

const AGENT = [
  ["Charger", "Lecture des scènes NISAR de la zone, en polarisations HH et HV."],
  ["Préparer", "Conversion de la puissance en décibels et lissage sur 5 x 5 pixels pour réduire le chatoiement."],
  ["Comparer", "Différence de rétrodiffusion HV entre chaque date et la première date, prise comme référence."],
  ["Détecter", `Sont retenues les zones où le signal baisse de plus de ${Math.abs(NISAR.thresholdDb)} dB sur au moins 1 hectare.`],
  ["Quantifier", "Tracé du contour de chaque zone, calcul de sa surface en hectares à chaque date."],
  ["Contextualiser", "Croisement avec les routes, rivières, périmètres attribués, aires protégées et alertes RADD."],
  ["Évaluer", "Score de suspicion d'activité humaine sur 100, selon cinq critères affichés dans la fiche."],
  ["Alerter", "Rédaction de la fiche géolocalisée et classement : à surveiller, à vérifier, confirmé sur le terrain."],
];

const TECH = [
  ["Interface", "Next.js 16, React 19 et TypeScript, carte interactive Leaflet."],
  ["Traitement radar", "Scripts Python avec rasterio (lecture des images géoréférencées), NumPy et SciPy (calcul), Pillow (export des images)."],
  ["Accès aux données NASA", "Earthdata et le service Harmony, qui découpe les scènes sur la zone voulue ; les scènes sont distribuées par l'ASF DAAC."],
  ["Fonds et contexte", "Imagerie Esri World Imagery pour la vue réelle, OpenStreetMap pour les routes, rivières et périmètres."],
];

const DATA: { name: string; real: boolean; now: string; next: string }[] = [
  { name: "Images radar NISAR", real: true, now: "Trois scènes réelles NISAR L2 GCOV, trace 159, cadre 002.", next: "Ajouter chaque nouvelle acquisition, tous les 12 jours, et passer aux produits validés." },
  { name: "Zones de baisse détectées", real: true, now: "Calculées sur les scènes réelles par seuil sur la différence HV.", next: "Mesurer le taux de fausses alertes avec des relevés de terrain et des images optiques de même date." },
  { name: "Vue réelle", real: true, now: "Imagerie optique Esri, plus ancienne que les scènes NISAR.", next: "Utiliser des images optiques récentes et datées, par exemple Sentinel-2 ou Pléiades Neo." },
  { name: "Routes, rivières, périmètres", real: true, now: "Extraits d'OpenStreetMap.", next: "Intégrer les couches officielles : concessions forestières, permis et limites des aires protégées." },
  { name: "Score de suspicion", real: true, now: "Calcul réel sur les géométries, avec un barème fixé par l'équipe.", next: "Calibrer les poids sur des cas vérifiés par les Eaux et Forêts." },
  { name: "Alertes RADD", real: false, now: "Points de démonstration placés près de certaines zones.", next: "Charger les vraies alertes RADD, publiées sur Global Forest Watch, pour recouper les détections NISAR." },
  { name: "Détection des éléphants", real: false, now: "Positions, dates et effectifs de démonstration ; image de référence identique pour toutes les observations.", next: "Détection par Pléiades Neo : programmer des images à 30 cm autour des plantations enregistrées, puis y repérer les éléphants avec un modèle de détection d'objets entraîné sur des images annotées." },
  { name: "Migrations forcées", real: false, now: "Niveau de vigilance calculé sur les observations de démonstration.", next: "Relier dans le temps les détections Pléiades Neo, les pièges photographiques et les colliers GPS pour suivre les déplacements." },
  { name: "Relevés des écogardes", real: false, now: "Enregistrés dans le navigateur de l'appareil, sans partage.", next: "Base de données commune, comptes par agent et mode hors connexion sur le terrain." },
  { name: "Agent IA", real: false, now: "Chaîne de calcul à règles explicites ; les fiches sont rédigées à partir de modèles de phrases.", next: "Agent fondé sur un modèle de langage, qui surveille les nouvelles acquisitions, rédige et priorise les alertes." },
];

const GLOSSARY = [
  ["NISAR", "Satellite radar d'observation de la Terre de la NASA et de l'agence spatiale indienne ISRO, lancé en juillet 2025. Il repasse au-dessus du même point tous les 12 jours."],
  ["Radar à synthèse d'ouverture (SAR)", "Capteur qui émet des micro-ondes et mesure leur écho. Il voit de jour comme de nuit et à travers les nuages, ce qui est décisif en zone équatoriale."],
  ["Bande L", "Gamme de longueur d'onde radar d'environ 24 cm. Elle pénètre le feuillage et réagit aux troncs et aux grosses branches, donc à la biomasse forestière."],
  ["Rétrodiffusion", "Part du signal radar renvoyée vers le satellite. Une forêt dense renvoie beaucoup de signal ; un sol mis à nu en renvoie peu."],
  ["Polarisation HH et HV", "Orientation de l'onde émise puis reçue : H pour horizontale, V pour verticale. HV est la plus sensible au volume de végétation."],
  ["Décibel (dB)", "Unité logarithmique de l'intensité du signal. Une baisse de 3 dB correspond à un signal divisé par deux."],
  ["GCOV", "Produit NISAR de niveau 2 : images de rétrodiffusion déjà géoréférencées, ici avec des pixels de 20 m."],
  ["Chatoiement (speckle)", "Aspect granuleux propre aux images radar. On le réduit en moyennant des pixels voisins."],
  ["Trace et cadre", "Numéros qui identifient l'orbite du satellite et le découpage de l'image le long de cette orbite."],
  ["Earthdata, Harmony, ASF DAAC", "Portail de données de la NASA, son service de découpage à la demande, et le centre d'archives qui distribue les données radar."],
  ["RADD", "Alertes de perturbation forestière produites par l'université de Wageningen à partir du radar Sentinel-1, diffusées sur Global Forest Watch."],
  ["Sentinel-1 et Sentinel-2", "Satellites européens du programme Copernicus : Sentinel-1 est un radar en bande C, Sentinel-2 un capteur optique à 10 m."],
  ["Pléiades Neo", "Satellites optiques d'Airbus qui fournissent des images commerciales à 30 cm de résolution, assez fines pour distinguer un éléphant en milieu ouvert."],
  ["Résolution spatiale", "Taille au sol d'un pixel de l'image : 20 m pour NISAR GCOV, 30 cm pour Pléiades Neo."],
  ["Détection d'objets", "Modèle d'apprentissage profond qui repère et encadre des objets dans une image, ici des éléphants."],
  ["Esri World Imagery", "Mosaïque mondiale d'images optiques, utilisée comme vue réelle. Les dates des images varient selon les lieux."],
  ["OpenStreetMap", "Carte mondiale libre et collaborative, source des routes, rivières et périmètres affichés."],
  ["Périmètre attribué", "Zone accordée à un opérateur : concession, permis ou zone économique. Une coupe peut y être autorisée."],
  ["Écogarde", "Agent de terrain chargé de la surveillance des forêts et de la faune."],
  ["GeoJSON", "Format de fichier d'échange pour les données géographiques, utilisé pour télécharger une fiche."],
];

export default function Fiche({ onClose }: { onClose: () => void }) {
  return <div className="m-sheet" role="dialog" aria-modal="true" aria-label="Fiche technique" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <article>
      <header>
        <div><h2>Fiche technique</h2><p>ESI - Outil de surveillance territoriale · {ZONE.name}, {ZONE.region}</p></div>
        <button className="m-secondary" onClick={onClose}>Fermer</button>
      </header>

      <section>
        <h3>En bref</h3>
        <p>ESI détecte les pertes de couvert forestier sur des images radar NISAR, les classe par niveau de suspicion et guide les écogardes vers les zones à vérifier. Un second module surveille les migrations d'éléphants autour des plantations enregistrées. La zone pilote mesure environ 11 km sur 11 km et s'appuie sur {acquisitions.length} acquisitions, du {fmtDate(acquisitions[0])} au {fmtDate(acquisitions[acquisitions.length - 1])}.</p>
      </section>

      <section>
        <h3>Fonctionnement de l'agent d'analyse</h3>
        <ol className="m-sheet-steps">{AGENT.map(([title, text], i) => <li key={title}><b>{i + 1}</b><div><strong>{title}</strong><span>{text}</span></div></li>)}</ol>
        <p>L'agent ne conclut jamais seul à une infraction : une baisse du signal peut aussi venir de l'humidité du sol, d'une inondation ou d'un chantier autorisé. La vérification sur le terrain et le contrôle des autorisations restent indispensables.</p>
      </section>

      <section>
        <h3>Technologies utilisées</h3>
        <dl className="m-sheet-list">{TECH.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
      </section>

      <section>
        <h3>Satellites et données</h3>
        <dl className="m-sheet-list">
          <div><dt>NISAR</dt><dd>{NISAR.source}. Pixels de 20 m, polarisations HH et HV.</dd></div>
          <div><dt>Imagerie optique</dt><dd>Esri World Imagery pour la vue réelle.</dd></div>
          <div><dt>Pléiades Neo</dt><dd>Prévu pour la détection des éléphants, à 30 cm de résolution. Non utilisé dans le MVP.</dd></div>
          <div><dt>Sentinel-1 (RADD)</dt><dd>Prévu pour recouper les détections NISAR. Non chargé dans le MVP.</dd></div>
          <div><dt>OpenStreetMap</dt><dd>Routes, voie ferrée, rivières, zone économique de Nkok, parc national d'Akanda.</dd></div>
        </dl>
      </section>

      <section>
        <h3>Données réelles et données de démonstration</h3>
        <div className="m-sheet-table">
          <table>
            <thead><tr><th>Élément</th><th>Statut</th><th>Dans le MVP</th><th>À implémenter</th></tr></thead>
            <tbody>{DATA.map(d => <tr key={d.name}><th>{d.name}</th><td><em className={d.real ? "real" : "demo"}>{d.real ? "Réel" : "Démonstration"}</em></td><td>{d.now}</td><td>{d.next}</td></tr>)}</tbody>
          </table>
        </div>
        <p>Limites de la détection d'éléphants par satellite : un éléphant caché sous une forêt dense reste invisible même à 30 cm, les nuages bloquent les images optiques, et les images Pléiades Neo sont payantes et programmées à l'avance. Les pièges photographiques et les colliers GPS restent la source des alertes rapides. Méthode de référence : Duporge et al., doi:10.1002/rse2.195.</p>
      </section>

      <section>
        <h3>Glossaire</h3>
        <dl className="m-sheet-list glossary">{GLOSSARY.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}</dl>
      </section>
    </article>
  </div>;
}
