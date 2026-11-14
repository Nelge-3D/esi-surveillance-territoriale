"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { areaHa, distanceKm, disturbance, examplePlantation, format, innerKm, references, simulatedIncident, zoneAt, type Point } from "./scenario";

const ScenarioMap = dynamic(() => import("./ScenarioMap"), {
  ssr: false,
  loading: () => <div className="esi-map loading">Chargement de la carte…</div>,
});

const steps = [
  ["Forêt", "Comparer les scènes", "layers"],
  ["Agriculture", "Situer la plantation", "pin"],
  ["Éléphants", "Explorer le contexte", "wildlife"],
  ["Décision", "Préparer la vérification", "report"],
] as const;

const paths = {
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  pin: "M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  wildlife: "M9 15c-3-1-5 0-5 3s4 3 8 1c4 2 8 2 8-1s-2-4-5-3c-1-3-5-3-6 0ZM4 11a2 3 0 1 0 0-6 2 3 0 1 0 0 6Zm5-4a2 3 0 1 0 0-6 2 3 0 1 0 0 6Zm6 0a2 3 0 1 0 0-6 2 3 0 1 0 0 6Zm5 4a2 3 0 1 0 0-6 2 3 0 1 0 0 6Z",
  report: "M5 3h11l3 3v15H5zM8 9h8m-8 4h8m-8 4h5",
};

function Icon({ name }: { name: keyof typeof paths }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export default function Dashboard() {
  const [step, setStep] = useState(0);
  const [comparison, setComparison] = useState(58);
  const [candidate, setCandidate] = useState<Point>(examplePlantation);
  const [plantation, setPlantation] = useState<Point | null>(null);
  const [name, setName] = useState("Parcelle de démonstration");
  const [savedName, setSavedName] = useState("");
  const [wildlife, setWildlife] = useState(true);
  const [flood, setFlood] = useState(true);
  const [recipient, setRecipient] = useState("Eaux et Forêts");
  const [submitted, setSubmitted] = useState(false);
  const distance = plantation ? distanceKm(plantation, disturbance) : null;
  const proximity = plantation ? distanceKm(plantation, simulatedIncident) : null;

  function navigate(next: number) {
    setStep(next);
    document.getElementById("analyse")?.scrollIntoView({ block: "start" });
  }

  return <div className="esi">
    <header className="esi-header">
      <a className="esi-brand" href="#"><span className="esi-mark" aria-hidden="true">◈</span><span><strong>ESI</strong><small>EARTH SURFACE INTELLIGENCE</small></span></a>
      <div className="esi-header-links"><span>Mandji–Yombi, Gabon</span><a href="#sources">Sources scientifiques ↗</a></div>
    </header>

    <main className="esi-main">
      <section className="esi-intro">
        <div>
          <div className="esi-mode"><i /> Prototype conceptuel</div>
          <h1>ESI — Earth Surface<br className="esi-title-break" /> Intelligence</h1>
          <p>Relier les changements forestiers, l’exposition des plantations et la surveillance préventive des éléphants.</p>
        </div>
        <aside className="esi-territory"><Icon name="pin" /><div><strong>Mandji–Yombi</strong><small>Ngounié · Gabon</small><a href={references[0][1]} target="_blank" rel="noreferrer">Contexte agricole · Mouila Lot 2 ↗</a></div></aside>
      </section>

      <section id="analyse" aria-label="Parcours de démonstration">
        <nav className="esi-tabs" aria-label="Étapes du parcours">
          {steps.map(([label, text, icon], index) => <button type="button" key={label} aria-current={step === index ? "step" : undefined} onClick={() => navigate(index)}>
            <span className="esi-tab-icon"><Icon name={icon} /></span><span><strong>{label}</strong><small>{text}</small></span>
          </button>)}
        </nav>

        <div className="esi-workspace">
          <div className="esi-visual">
            <div className="esi-visual-heading"><span><i /> {step === 0 ? "Comparaison forestière" : "Carte de veille"}</span><small>{step === 0 ? "SCÈNE FICTIVE" : "MANDJI · NGOUNIÉ"}</small></div>
            {step === 0 ? <>
              <div className="esi-comparison" role="img" aria-label="Scène de forêt illustrative générée par IA. Un masque orange indique une clairière simulée.">
                <div className="esi-after" style={{ clipPath: "inset(0 0 0 " + comparison + "%)" }}><span className="esi-clearing" /></div>
                <div className="esi-divider" style={{ left: comparison + "%" }}><span>‹›</span></div>
                <span className="esi-map-label">Scène illustrative générée par IA · lieu fictif</span>
                <span className="esi-before-label">AVANT</span><span className="esi-after-label">APRÈS</span>
              </div>
              <label className="esi-range"><span>Avant</span><input type="range" aria-label="Position du séparateur avant et après" min="0" max="100" value={comparison} onChange={event => setComparison(Number(event.target.value))} /><span>Après</span></label>
              <div className="esi-legend"><span><i className="orange" /> Perturbation illustrée</span><span>Surface calculée sur le polygone fictif de la carte.</span></div>
            </> : <>
              <ScenarioMap candidate={candidate} plantation={plantation} onPlace={setCandidate} canPlace={step === 1} wildlife={step >= 2 && wildlife} flood={step === 1 && flood} />
              <div className="esi-legend">
                <span><i className="orange" /> Changement simulé</span><span><i /> 0–5 km</span><span><i className="blue" /> 5–20 km</span>
                {step === 1 && flood && <span><i className="blue" /> Zone basse hypothétique</span>}
                {step >= 2 && wildlife && <span><i className="amber" /> Secteur et incident fictifs</span>}
              </div>
            </>}
          </div>

          <aside className="esi-panel" aria-label="Analyse du scénario">
            {step === 0 && <>
              <div className="esi-panel-title"><Icon name="layers" /> Changement forestier</div>
              <p className="esi-tag">Simulation</p>
              <div className="esi-metric">{format.format(areaHa)} <small>ha</small></div>
              <p>Surface du polygone perturbé dans le scénario.</p>
              <dl className="esi-stats">
                <div><dt>Période fictive</dt><dd>4 → 28 oct. 2026</dd></div>
                <div><dt>Intensité illustrative</dt><dd>Forte</dd></div>
                <div><dt>Indice anthropique fictif</dt><dd>3/5 · non calibré</dd></div>
              </dl>
              <p className="esi-note">Zone à vérifier. La cause et le potentiel de restauration restent à examiner sur le terrain.</p>
              <button className="esi-primary" onClick={() => navigate(1)}>Situer une plantation <span>→</span></button>
            </>}

            {step === 1 && <>
              <div className="esi-panel-title"><Icon name="pin" /> Plantation fictive</div>
              <p>Cliquez sur la carte pour déplacer le point ou utilisez l’emplacement proposé.</p>
              <form className="esi-form" onSubmit={event => { event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return; setPlantation(candidate); setSavedName(cleanName); setSubmitted(false); }}>
                <label>Nom de la parcelle<input value={name} onChange={event => setName(event.target.value)} required maxLength={60} /></label>
                <button className="esi-primary" disabled={!name.trim()}>Enregistrer la plantation <span>→</span></button>
              </form>
              {distance !== null && <p role="status" className="esi-note"><strong>{savedName}</strong><br />{format.format(distance)} km du point de référence du changement · {zoneAt(distance)} (scénario).</p>}
              <label className="esi-toggle"><input type="checkbox" checked={flood} onChange={event => setFlood(event.target.checked)} /> Zone basse fictive · ruissellement à examiner</label>
              <p>Les périmètres sont des distances de veille illustratives.</p>
              <button className="esi-secondary" onClick={() => navigate(2)}>Examiner le contexte des éléphants →</button>
            </>}

            {step === 2 && <>
              <div className="esi-panel-title"><Icon name="wildlife" /> Surveillance préventive</div>
              <p className="esi-tag">Historique documenté</p>
              <p><strong>42 intrusions attribuées à des éléphants sur 212</strong>, pour Mandji et Gamba réunis en 2024. <a href={references[6][1]} target="_blank" rel="noreferrer">Rapport WWF ↗</a></p>
              <label className="esi-toggle"><input type="checkbox" checked={wildlife} onChange={event => setWildlife(event.target.checked)} /> Afficher le secteur et l’incident fictifs</label>
              {proximity !== null && <p className="esi-note">{format.format(proximity)} km entre la plantation et l’incident fictif. Distance illustrative.</p>}
              <p>Les couches de scène illustrent une vérification possible. Les observations GPS autorisées, les pièges photographiques et Pléiades Neo sont des pistes à évaluer.</p>
              <button className="esi-primary" onClick={() => navigate(3)}>Consulter la fiche de décision <span>→</span></button>
            </>}

            {step === 3 && <>
              <div className="esi-panel-title"><Icon name="report" /> Fiche de décision ESI</div>
              <p className="esi-tag">Évaluation simulée</p>
              <dl className="esi-stats">
                <div><dt>Forêt</dt><dd>{format.format(areaHa)} ha fictifs</dd></div>
                <div><dt>Plantation</dt><dd>{distance === null ? "À enregistrer" : format.format(distance) + " km du changement"}</dd></div>
                <div><dt>Éléphants</dt><dd>Historique régional</dd></div>
              </dl>
              <p className="esi-note"><strong>{distance !== null && distance <= innerKm ? "Priorité élevée · exemple" : "À examiner · exemple"}</strong><br />Vérifier la perturbation, son origine et le contexte local. Toute mission d’écogardes relève d’une équipe habilitée.</p>
              <form className="esi-form" onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
                <label>Destinataire de démonstration<select value={recipient} onChange={event => { setRecipient(event.target.value); setSubmitted(false); }}>
                  <option>Eaux et Forêts</option><option>Équipe d’écogardes</option><option>Organisme de conservation</option>
                </select></label>
                <button className="esi-primary" disabled={!plantation}>Simuler le signalement <span>→</span></button>
              </form>
              {!plantation && <button className="esi-secondary" onClick={() => navigate(1)}>Enregistrer une plantation →</button>}
              {submitted && <p className="esi-confirm" role="status">Signalement simulé pour {recipient}. Aucun message envoyé.</p>}
            </>}
          </aside>
        </div>
      </section>

      <section id="sources" className="esi-sources">
        <div><div className="esi-mode"><i /> Méthode et provenance</div><h2>Fondements scientifiques</h2><p>Ce MVP utilise des visualisations conceptuelles pour illustrer le fonctionnement proposé. Un déploiement réel nécessiterait des traitements satellitaires validés, des données écologiques fiables et des vérifications terrain.</p></div>
        <ul>{references.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label} ↗</a></li>)}</ul>
      </section>
    </main>
    <footer className="esi-footer"><span>ESI — Earth Surface Intelligence</span><span>DEUS TECH MACHINA · NASA Space Apps Challenge 2026</span></footer>
  </div>;
}