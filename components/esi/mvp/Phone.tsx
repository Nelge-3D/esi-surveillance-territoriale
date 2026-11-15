"use client";

import { useEffect, useState } from "react";
import { kmText, nf, type Alert } from "./data";

// Aperçu du téléphone de l'écogarde : la notification envoyée par Orus arrive sur l'écran
// verrouillé, puis s'ouvre sur la mission. L'envoi réel (SMS ou notification mobile) reste à brancher.
export default function Phone({ alert, status, sentAt, onClose }: { alert: Alert; status: string; sentAt: string; onClose: () => void }) {
  const [arrived, setArrived] = useState(false);
  const [opened, setOpened] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setArrived(true), 700); return () => clearTimeout(timer); }, []);

  const time = new Date(sentAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const day = new Date(sentAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const route = `https://www.google.com/maps/dir/?api=1&destination=${alert.center[0].toFixed(5)},${alert.center[1].toFixed(5)}`;

  return <div className="m-phone-wrap" role="dialog" aria-modal="true" aria-label="Téléphone de l'écogarde" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="m-phone-side">
      <h2>Alerte envoyée à l'écogarde</h2>
      <p>Orus a transmis la zone {alert.id} à l'écogarde de permanence à {time}. Voici ce qu'il reçoit sur son téléphone.</p>
      <button className="m-secondary" onClick={onClose}>Fermer</button>
    </div>
    <div className="m-phone" aria-live="polite">
      <div className="m-phone-notch" />
      {!opened ? <div className="m-phone-lock">
        <strong>{time}</strong>
        <span>{day}</span>
        <button className={"m-phone-notif" + (arrived ? " in" : "")} onClick={() => setOpened(true)}>
          <span className="m-phone-app"><i>◈</i>ESI · Orus<small>maintenant</small></span>
          <b>Zone {status} : {alert.id}</b>
          <span>{nf(alert.areaHa)} ha, {alert.place}. Suspicion {alert.score}/100. Touchez pour ouvrir la mission.</span>
        </button>
      </div> : <div className="m-phone-mission">
        <header><i>◈</i> ESI · Mission</header>
        <h3>{alert.id}</h3>
        <em>{status}</em>
        <dl>
          <div><dt>Surface</dt><dd>{nf(alert.areaHa)} ha</dd></div>
          <div><dt>Suspicion</dt><dd>{alert.score}/100</dd></div>
          <div><dt>Lieu</dt><dd>{alert.place}</dd></div>
          <div><dt>Accès</dt><dd>{alert.access.name}, {kmText(alert.access.km)}</dd></div>
          <div><dt>Coordonnées</dt><dd>{alert.center[0].toFixed(4)}, {alert.center[1].toFixed(4)}</dd></div>
        </dl>
        <a className="m-primary" href={route} target="_blank" rel="noreferrer">Ouvrir l'itinéraire</a>
        <button className="m-secondary" disabled={accepted} onClick={() => setAccepted(true)}>{accepted ? "Mission acceptée ✓" : "J'accepte la mission"}</button>
      </div>}
    </div>
  </div>;
}
