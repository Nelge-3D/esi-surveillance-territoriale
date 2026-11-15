"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fiche from "./Fiche";
import MapView, { STATUS_COLOR } from "./MapView";
import { EXAMPLE_PLANTATION, NEAR_KM, REPEAT_DAYS, WIDE_KM, ZONE, acquisitions, assess, buildAlerts, elephants, fmtDate, fmtShort, inZone, kmText, nf, type Alert, type Elephant, type LL, type Obs } from "./data";
import "./mvp.css";

type Verification = { nature: string; permit: string; notes: string; date: string; gps: string };
type Plantation = { id: string; name: string; crop: string; pt: LL };
type Saved = { analysed: boolean; verifications: Record<string, Verification>; plantations: Plantation[]; reports: Elephant[] };

const STORE = "esi-mvp-v2";
const STATUS_LABEL: Record<string, string> = { surveiller: "À surveiller", verifier: "À vérifier", confirme: "Confirmé sur le terrain", ecarte: "Écartée après vérification" };
const NATURES = ["Exploitation forestière", "Orpaillage", "Défrichement agricole", "Cause naturelle (chablis, tornade)", "Aucune perturbation constatée"];
const PERMITS = ["À vérifier auprès de l'administration", "Autorisation présentée", "Aucune autorisation présentée"];
const RANK = ["verifier", "confirme", "surveiller", "ecarte"];
const STEPS = [
  `Chargement de ${acquisitions.length} acquisitions NISAR GCOV réelles (bande L, HH et HV)`,
  "Calibration et filtrage du chatoiement",
  "Comparaison des rétrodiffusions date à date",
  "Extraction des zones de baisse HV supérieure à 3 dB (1 ha minimum)",
  "Calcul des surfaces et de leur évolution",
  "Croisement avec RADD, routes, concessions et aires protégées",
  "Calcul du score de suspicion et rédaction des fiches",
];

const statusOf = (a: Alert, v?: Verification) => (!v ? a.baseStatus : NATURES.indexOf(v.nature) <= 2 ? "confirme" : "ecarte");

// Détection d'éléphants sur image satellite à très haute résolution :
// image de référence, avec ou sans les cadres de détection.
function OpticalChip() {
  const [boxes, setBoxes] = useState(true);
  return <figure className="m-chip">
    <img src={boxes ? "/elephants-detection.jpg" : "/elephants-satellite.jpg"} width={480} height={480} alt={boxes ? "Image satellite avec les éléphants encadrés par la détection" : "Image satellite d'un groupe d'éléphants parmi les arbres"} />
    <figcaption>Exemple de détection d'éléphants sur image satellite à très haute résolution</figcaption>
    <button className="m-link" onClick={() => setBoxes(!boxes)}>{boxes ? "Voir l'image sans les détections" : "Voir les détections"}</button>
  </figure>;
}

export default function App() {
  const alerts = useMemo(buildAlerts, []);
  const [module, setModule] = useState<"forest" | "plantation">("forest");
  const [saved, setSaved] = useState<Saved>(() => {
    try { const raw = localStorage.getItem(STORE); if (raw) return JSON.parse(raw); } catch { /* stockage indisponible */ }
    return { analysed: false, verifications: {}, plantations: [], reports: [] };
  });
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignoré */ } }, [saved]);

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showRadar, setShowRadar] = useState(true);
  const [composite, setComposite] = useState(false);
  const LAST = acquisitions.length - 1;
  const [dateIdx, setDateIdx] = useState(LAST);
  const [showContext, setShowContext] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Verification>({ nature: NATURES[0], permit: PERMITS[0], notes: "", date: "", gps: "" });

  const [activeId, setActiveId] = useState<string | null>(saved.plantations[0]?.id ?? null);
  const [name, setName] = useState("Ma plantation");
  const [crop, setCrop] = useState("Manioc");
  const [pick, setPick] = useState<null | "plantation" | "report">(null);
  const [scanTick, setScanTick] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [openObs, setOpenObs] = useState<string | null>(null);

  const withStatus = useMemo(() => alerts.map(alert => ({ alert, status: statusOf(alert, saved.verifications[alert.id]) })), [alerts, saved.verifications]);
  const visible = useMemo(() => (saved.analysed ? [...withStatus].sort((a, b) => RANK.indexOf(a.status) - RANK.indexOf(b.status) || b.alert.score - a.alert.score) : []), [saved.analysed, withStatus]);
  const side = useRef<HTMLElement>(null);
  useEffect(() => { side.current?.scrollTo(0, 0); }, [selectedId, module]);
  const selected = visible.find(a => a.alert.id === selectedId) ?? null;
  const plantation = saved.plantations.find(p => p.id === activeId) ?? null;
  const observations = useMemo(() => [...elephants, ...saved.reports], [saved.reports]);
  const vigilance = useMemo(() => (plantation ? assess(plantation.pt, observations) : null), [plantation, observations]);

  function runAnalysis() {
    setRunning(true); setLog([]); setSelectedId(null); setShowRadar(true); setComposite(false); setDateIdx(0);
    STEPS.forEach((step, i) => setTimeout(() => {
      setLog(l => [...l, step]);
      setDateIdx(Math.min(LAST, i));
      if (i === STEPS.length - 1) {
        setRunning(false); setComposite(true); setDateIdx(LAST);
        setSaved(s => ({ ...s, analysed: true }));
      }
    }, 700 * (i + 1)));
  }

  function createPlantation(pt: LL, note: string) {
    const p = { id: "P" + Date.now(), name: name.trim() || "Ma plantation", crop, pt };
    setSaved(s => ({ ...s, plantations: [p, ...s.plantations] }));
    setActiveId(p.id); setMessage(note); rescan();
  }
  function rescan() {
    setScanning(true); setScanTick(t => t + 1);
    setTimeout(() => setScanning(false), 1700);
  }
  function locate() {
    setMessage("Recherche de la position GPS…");
    const fallback = (why: string) => createPlantation(EXAMPLE_PLANTATION, why + " Position de démonstration utilisée, près d'Essassa.");
    if (!navigator.geolocation) return fallback("Géolocalisation indisponible.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pt: LL = [coords.latitude, coords.longitude];
        if (inZone(pt)) createPlantation(pt, `Position enregistrée (précision ± ${Math.round(coords.accuracy)} m).`);
        else fallback("Votre position est hors de la zone pilote.");
      },
      () => fallback("Position GPS non obtenue."),
      { timeout: 7000 },
    );
  }
  function onMapClick(pt: LL) {
    if (!pick) return;
    if (!inZone(pt)) { setMessage("Choisissez un point dans la zone pilote."); return; }
    if (pick === "plantation") createPlantation(pt, "Centre de la plantation placé sur la carte.");
    else {
      setSaved(s => ({ ...s, reports: [...s.reports, { id: "R" + Date.now(), pt, days: 0, count: 1, source: "Signalement de l'agriculteur", reliability: "À confirmer" }] }));
      setMessage("Signalement enregistré et partagé avec les plantations voisines.");
    }
    setPick(null);
  }

  function submitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaved(s => ({ ...s, verifications: { ...s.verifications, [selected.alert.id]: { ...form, date: new Date().toISOString() } } }));
  }
  function gps() {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setForm(f => ({ ...f, gps: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` })),
      () => setForm(f => ({ ...f, gps: "Position non obtenue" })),
      { timeout: 7000 },
    );
  }
  function download(a: Alert, status: string) {
    const feature = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...a.ring, a.ring[0]].map(([lat, lng]) => [lng, lat])] },
      properties: { id: a.id, statut: STATUS_LABEL[status], surface_ha: +a.areaHa.toFixed(2), score: a.score, criteres: a.criteria, resume: a.summary, verification: saved.verifications[a.id] ?? null, donnees: "NISAR L2 GCOV" },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(feature, null, 2)], { type: "application/geo+json" }));
    const link = document.createElement("a");
    link.href = url; link.download = a.id + ".geojson"; link.click();
    URL.revokeObjectURL(url);
  }
  function reset() {
    setSaved({ analysed: false, verifications: {}, plantations: [], reports: [] });
    setSelectedId(null); setActiveId(null); setLog([]); setComposite(false); setMessage("");
  }

  // Parcours guidé : trois étapes par module, l'étape en cours dépend de l'état de la session.
  const steps = module === "forest" ? ["Analyser", "Choisir une zone", "Vérifier sur le terrain"] : ["Enregistrer", "Scanner", "Suivre les alertes"];
  const step = module === "forest"
    ? (!saved.analysed || running ? 0 : !selected ? 1 : saved.verifications[selected.alert.id] ? 3 : 2)
    : (!plantation ? 0 : scanning ? 1 : 2);

  // Page d'accueil : elle s'efface en fondu, puis les étapes du parcours sont mises en avant quelques secondes.
  const [welcome, setWelcome] = useState<"shown" | "leaving" | "gone">("shown");
  const [guiding, setGuiding] = useState(false);
  const [sheet, setSheet] = useState(false);
  function enter(target: "forest" | "plantation") {
    setModule(target); setShowRadar(target === "forest"); setSelectedId(null);
    setWelcome("leaving"); setGuiding(true);
    setTimeout(() => setWelcome("gone"), 900);
    setTimeout(() => setGuiding(false), 5200);
  }

  const totalHa = visible.reduce((s, a) => s + a.alert.areaHa, 0);
  const obsRow = (o: Obs) => <li key={o.id}>
    <button className="m-obs" onClick={() => setOpenObs(openObs === o.id ? null : o.id)}>
      <strong>{nf(o.km)} km · {o.count} éléphant(s)</strong>
      <span>{o.days === 0 ? "Aujourd'hui" : fmtDate(o.date)} · {o.source}</span>
      <span>Fiabilité : {o.reliability}</span>
    </button>
    {openObs === o.id && o.source.startsWith("Pléiades") && <OpticalChip />}
  </li>;

  return <div className={"m-app" + (guiding ? " guiding" : "")}>
    {welcome !== "gone" && <section className={"m-welcome" + (welcome === "leaving" ? " leaving" : "")} aria-label="Accueil">
      <div className="m-welcome-box">
        <span className="m-welcome-mark" aria-hidden="true">◈</span>
        <h1>E.S.I</h1>
        <p className="m-welcome-lead">Earth Surface Intelligence · outil de surveillance territoriale</p>
        <p className="m-welcome-power">Propulsé par NISAR et les SIG</p>
        <div className="m-welcome-actions">
          <button onClick={() => enter("forest")}><strong>Observation forestière</strong><span>Orus, agent d'analyse radar : il repère les pertes de couvert et classe les zones prioritaires</span></button>
          <button onClick={() => enter("plantation")}><strong>Protection des plantations</strong><span>Orus détecte les migrations d'éléphants autour de votre plantation</span></button>
        </div>
        <small>{ZONE.name}, {ZONE.region}</small>
      </div>
    </section>}
    <header className="m-top">
      <div className="m-brand"><span aria-hidden="true">◈</span><div><strong>ESI</strong><small>Surveillance territoriale · {ZONE.name}, {ZONE.region}</small></div></div>
      <nav aria-label="Modules">
        <button aria-pressed={module === "forest"} onClick={() => { setModule("forest"); setPick(null); setShowRadar(true); }}>Observation forestière</button>
        <button aria-pressed={module === "plantation"} onClick={() => { setModule("plantation"); setSelectedId(null); setShowRadar(false); }}>Protection des plantations</button>
      </nav>
      <span className="m-demo">Données NISAR réelles</span>
      <button className="m-sheet-open" onClick={() => setSheet(true)}>Fiche technique</button>
    </header>
    {sheet && <Fiche onClose={() => setSheet(false)} />}

    <aside className="m-side" ref={side}>
      <ol className="m-steps" aria-label="Étapes du parcours">{steps.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><i>{i < step ? "✓" : i + 1}</i><span>{label}</span></li>)}</ol>
      {module === "forest" && !selected && <>
        <section className="m-card">
          <h2>Orus · agent d'analyse radar</h2>
          <p>Orus compare {acquisitions.length} acquisitions NISAR réelles espacées de {REPEAT_DAYS} jours, du {fmtShort(acquisitions[0])} au {fmtDate(acquisitions[LAST])}, puis classe les baisses de rétrodiffusion.</p>
          <button className="m-primary" disabled={running} onClick={runAnalysis}>{running ? "Orus analyse…" : saved.analysed ? "Relancer Orus" : "Lancer Orus"}</button>
          {log.length > 0 && <ol className="m-log">{log.map(l => <li key={l}>{l}</li>)}</ol>}
        </section>
        {saved.analysed && !running && <>
          <div className="m-stats">
            <div><strong>{visible.length}</strong><span>zones détectées</span></div>
            <div><strong>{nf(totalHa)}</strong><span>hectares</span></div>
            <div><strong>{visible.filter(a => a.status === "verifier").length}</strong><span>à vérifier</span></div>
          </div>
          {visible[0] && <button className="m-primary" onClick={() => setSelectedId(visible[0].alert.id)}>Ouvrir la zone prioritaire : {visible[0].alert.id} →</button>}
          <ul className="m-list">{visible.map(({ alert, status }) => <li key={alert.id}>
            <button onClick={() => setSelectedId(alert.id)}>
              <span className="m-row"><strong>{alert.id}</strong><em style={{ background: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</em></span>
              <span>{nf(alert.areaHa)} ha · {alert.place}</span>
              <span className="m-score"><i style={{ width: alert.score + "%" }} /><b>Suspicion {alert.score}/100</b></span>
            </button>
          </li>)}</ul>
        </>}
        {!saved.analysed && !running && <p className="m-hint">Aucune alerte pour l'instant. Lancez Orus pour détecter les baisses de rétrodiffusion sur la zone pilote.</p>}
      </>}

      {module === "forest" && selected && (() => {
        const { alert: a, status } = selected;
        const done = saved.verifications[a.id];
        const max = Math.max(...a.areas);
        const position = visible.findIndex(v => v.alert.id === a.id);
        const previous = visible[position - 1], next = visible[position + 1];
        return <>
          <div className="m-nav">
            <button className="m-back" onClick={() => setSelectedId(null)}>← Toutes les alertes</button>
            <span>
              <button className="m-secondary" disabled={!previous} onClick={() => previous && setSelectedId(previous.alert.id)} aria-label="Zone précédente">‹</button>
              <b>{position + 1} / {visible.length}</b>
              <button className="m-secondary" disabled={!next} onClick={() => next && setSelectedId(next.alert.id)} aria-label="Zone suivante">›</button>
            </span>
          </div>
          <section className="m-card">
            <span className="m-row"><h2>Fiche {a.id}</h2><em style={{ background: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</em></span>
            <div className="m-metric">{nf(a.areaHa)} <small>ha</small></div>
            <p>{a.summary}</p>
            <dl className="m-facts">
              <div><dt>Coordonnées</dt><dd>{a.center[0].toFixed(4)}, {a.center[1].toFixed(4)}</dd></div>
              <div><dt>Variation radar</dt><dd>{nf(a.dB)} dB (HV)</dd></div>
              <div><dt>Évolution récente</dt><dd>{a.deltaHa >= 0 ? "+" : ""}{nf(a.deltaHa)} ha en {REPEAT_DAYS} jours</dd></div>
            </dl>
            <div className="m-bars" style={{ gridTemplateColumns: `repeat(${a.areas.length}, 1fr)` }} aria-label="Surface par acquisition">{a.areas.map((v, i) => <div key={i}><b>{v ? nf(v) : "-"}</b><i style={{ height: (v / max) * 46 + 2 }} /><span>{fmtShort(acquisitions[i])}</span></div>)}</div>
          </section>
          <section className="m-card">
            <h3>Score de suspicion d'activité humaine : {a.score}/100</h3>
            <ul className="m-crit">{a.criteria.map(c => <li key={c.label}><span><strong>{c.label}</strong><b>{c.pts}/{c.max}</b></span><small>{c.detail}</small></li>)}</ul>
          </section>
          <section className="m-card">
            <h3>Mission de l'écogarde</h3>
            <p>Accès conseillé : {a.access.name}, {kmText(a.access.km)} de la zone.</p>
            <div className="m-actions">
              <a className="m-secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${a.center[0].toFixed(5)},${a.center[1].toFixed(5)}`}>Itinéraire ↗</a>
              <button className="m-secondary" onClick={() => download(a, status)}>Télécharger la fiche</button>
            </div>
            {done ? <div className="m-done">
              <strong>Relevé enregistré le {fmtDate(new Date(done.date))}</strong>
              <span>Nature : {done.nature}</span><span>Autorisation : {done.permit}</span>
              {done.gps && <span>Position : {done.gps}</span>}{done.notes && <span>Notes : {done.notes}</span>}
              <button className="m-link" onClick={() => setSaved(s => { const v = { ...s.verifications }; delete v[a.id]; return { ...s, verifications: v }; })}>Modifier le relevé</button>
              {next && <button className="m-primary" onClick={() => setSelectedId(next.alert.id)}>Zone suivante : {next.alert.id} →</button>}
            </div> : <form className="m-form" onSubmit={submitVerification}>
              <label>Nature constatée<select value={form.nature} onChange={e => setForm({ ...form, nature: e.target.value })}>{NATURES.map(n => <option key={n}>{n}</option>)}</select></label>
              <label>Autorisation<select value={form.permit} onChange={e => setForm({ ...form, permit: e.target.value })}>{PERMITS.map(n => <option key={n}>{n}</option>)}</select></label>
              <label>Notes de terrain<textarea value={form.notes} maxLength={400} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Engins, souches, pistes, personnes rencontrées…" /></label>
              <button type="button" className="m-secondary" onClick={gps}>{form.gps || "Relever ma position GPS"}</button>
              <button className="m-primary">Enregistrer la vérification terrain</button>
            </form>}
          </section>
        </>;
      })()}

      {module === "plantation" && <>
        <section className="m-card">
          <h2>Scanner ma plantation</h2>
          <p>Placez-vous au centre de votre plantation, puis lancez le scan. La détection des migrations d'éléphants couvre {NEAR_KM} km (rapprochée) et {WIDE_KM} km (étendue).</p>
          <div className="m-form">
            <label>Nom de la plantation<input value={name} maxLength={50} onChange={e => setName(e.target.value)} /></label>
            <label>Culture<select value={crop} onChange={e => setCrop(e.target.value)}>{["Manioc", "Banane plantain", "Cacao", "Autre"].map(c => <option key={c}>{c}</option>)}</select></label>
            <button className="m-primary" onClick={locate}>Scanner ma position</button>
            <button className="m-secondary" aria-pressed={pick === "plantation"} onClick={() => setPick(pick === "plantation" ? null : "plantation")}>{pick === "plantation" ? "Cliquez sur la carte…" : "Choisir le centre sur la carte"}</button>
          </div>
          {message && <p className="m-msg" role="status">{message}</p>}
        </section>

        {saved.plantations.length > 1 && <div className="m-chips">{saved.plantations.map(p => <button key={p.id} aria-pressed={p.id === activeId} onClick={() => { setActiveId(p.id); rescan(); }}>{p.name}</button>)}</div>}

        {plantation && vigilance && (scanning ? <p className="m-hint">Scan des périmètres en cours…</p> : <>
          <section className={"m-card m-vig " + vigilance.level}>
            <span className="m-row"><h3>{plantation.name} · {plantation.crop}</h3><em>Zone à risque {{ Élevée: "élevé", Modérée: "modéré", Faible: "faible" }[vigilance.level]}</em></span>
            <ul>{vigilance.reasons.map(r => <li key={r}>{r}</li>)}</ul>
            <div className="m-actions">
              <button className="m-secondary" aria-pressed={pick === "report"} onClick={() => setPick(pick === "report" ? null : "report")}>{pick === "report" ? "Cliquez sur la carte…" : "Signaler un éléphant"}</button>
              <button className="m-secondary" onClick={rescan}>Relancer le scan</button>
            </div>
          </section>
          <section className="m-card">
            <h3>Migrations détectées · 0 à {NEAR_KM} km</h3>
            {vigilance.near.length ? <ul className="m-obslist">{vigilance.near.map(obsRow)}</ul> : <p>Aucune migration détectée.</p>}
            <h3>Migrations détectées · {NEAR_KM} à {WIDE_KM} km</h3>
            {vigilance.wide.length ? <ul className="m-obslist">{vigilance.wide.map(obsRow)}</ul> : <p>Aucune migration détectée.</p>}
          </section>
          <p className="m-hint">Les rayons définissent des zones de recherche. Le niveau de vigilance aide à s'organiser, il ne prédit pas le passage des éléphants.</p>
        </>)}
      </>}

      <footer className="m-foot">
        <p>Réel : scènes NISAR L2 GCOV (NASA/ISRO, via ASF), zones de baisse détectées, routes, rivières et périmètres OpenStreetMap, imagerie Esri. Données de démonstration : alertes RADD, observations d'éléphants, détections Pléiades Neo.</p>
        <button className="m-link" onClick={reset}>Réinitialiser la démonstration</button>
        <a className="m-link" href="/concept">Prototype conceptuel et sources ↗</a>
      </footer>
    </aside>

    <main className="m-mapwrap">
      <MapView module={module} showRadar={showRadar} dateIdx={dateIdx} composite={composite} showContext={showContext} satellite
        alerts={module === "forest" ? visible : []} selectedId={selectedId} plantation={plantation} scanTick={scanTick} observations={observations} picking={pick !== null}
        onSelect={id => { setModule("forest"); setSelectedId(id); }} onMapClick={onMapClick} />
      <div className="m-layers">
        <div className="m-views" role="group" aria-label="Mode de vue">
          <button aria-pressed={!showRadar} onClick={() => setShowRadar(false)}>Vue réelle (Esri)</button>
          <button aria-pressed={showRadar} onClick={() => setShowRadar(true)}>Vue radar NISAR</button>
        </div>
        {module === "forest" && <div className="m-dates">{acquisitions.map((d, i) => <button key={i} aria-pressed={dateIdx === i} onClick={() => setDateIdx(i)}>{fmtShort(d)}</button>)}</div>}
        {showRadar && module === "forest" && <label><input type="checkbox" checked={composite} onChange={e => setComposite(e.target.checked)} /> Baisse de rétrodiffusion détectée (rouge)</label>}
        <label><input type="checkbox" checked={showContext} onChange={e => setShowContext(e.target.checked)} /> {module === "forest" ? "Contexte : routes, rivières, périmètres, RADD" : "Contexte : routes, rivières, périmètres"}</label>
      </div>
      <details className="m-legend" open>
        <summary>Légende</summary>
        {module === "forest" ? <>
          <h4>Zones détectées</h4>
          <ul>
            <li><i className="lg-box" style={{ borderColor: STATUS_COLOR.verifier }} />À vérifier</li>
            <li><i className="lg-box" style={{ borderColor: STATUS_COLOR.surveiller }} />À surveiller</li>
            <li><i className="lg-box" style={{ borderColor: STATUS_COLOR.confirme }} />Confirmé sur le terrain</li>
            <li><i className="lg-box" style={{ borderColor: STATUS_COLOR.ecarte }} />Écartée après vérification</li>
          </ul>
          {showRadar && <>
            <h4>Couleurs de la vue radar NISAR</h4>
            <ul>
              <li><i className="lg-fill" style={{ background: "#b9c832" }} />Vert-jaune : forêt et végétation dense</li>
              <li><i className="lg-fill" style={{ background: "#5b2bd0" }} />Violet : sol nu ou végétation basse</li>
              <li><i className="lg-fill" style={{ background: "#e58be0" }} />Rose : bâtiments et zones construites</li>
              <li><i className="lg-fill" style={{ background: "#10106a" }} />Bleu sombre : eau</li>
              <li><i className="lg-fill" style={{ background: "#ff4230" }} />Rouge : baisse du signal détectée</li>
            </ul>
          </>}
          <h4>Contexte</h4>
          <ul>
            <li><i className="lg-line" style={{ borderColor: "#b7f5d2", borderTopStyle: "dashed" }} />Zone analysée</li>
            <li><i className="lg-line" style={{ borderColor: "#ffe9a8" }} />Route</li>
            <li><i className="lg-line" style={{ borderColor: "#f5f5f5", borderTopStyle: "dashed" }} />Voie ferrée</li>
            <li><i className="lg-line" style={{ borderColor: "#4aa8ff" }} />Rivière</li>
            <li><i className="lg-box" style={{ borderColor: "#62c9f2", borderStyle: "dashed" }} />Périmètre attribué</li>
            <li><i className="lg-box" style={{ borderColor: "#63f0bb", borderStyle: "dashed" }} />Aire protégée</li>
            <li><i className="lg-dot" style={{ background: "#e85dff" }} />Alerte RADD</li>
          </ul>
        </> : <>
          <h4>Plantation</h4>
          <ul>
            <li><span className="lg-emoji">🌱</span>Centre de la plantation</li>
            <li><i className="lg-ring" style={{ borderColor: "#ffb347" }} />0 à {NEAR_KM} km : surveillance rapprochée</li>
            <li><i className="lg-ring" style={{ borderColor: "#62c9f2", borderStyle: "dashed" }} />{NEAR_KM} à {WIDE_KM} km : surveillance étendue</li>
          </ul>
          <h4>Migrations d'éléphants</h4>
          <ul>
            <li><span className="lg-emoji" style={{ borderColor: "#ff7a45" }}>🐘</span>À moins de {NEAR_KM} km</li>
            <li><span className="lg-emoji" style={{ borderColor: "#2f9fd6" }}>🐘</span>Entre {NEAR_KM} et {WIDE_KM} km</li>
            <li><span className="lg-emoji" style={{ opacity: 0.55 }}>🐘</span>Au-delà de {WIDE_KM} km</li>
          </ul>
          <h4>Contexte</h4>
          <ul>
            <li><i className="lg-line" style={{ borderColor: "#ffe9a8" }} />Route</li>
            <li><i className="lg-line" style={{ borderColor: "#4aa8ff" }} />Rivière</li>
            <li><i className="lg-box" style={{ borderColor: "#63f0bb", borderStyle: "dashed" }} />Aire protégée</li>
          </ul>
        </>}
      </details>
    </main>
  </div>;
}
