import React, { useState } from "react";
import "./ParticipantsPanel.css";

// Placeholder participants — replace with real session data later
const MOCK_PARTICIPANTS = [
  { id: 1, name: "You", isHost: true },
  { id: 2, name: "Amir" },
  { id: 3, name: "Sara" },
  { id: 4, name: "Devon" },
];

export default function ParticipantsPanel() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [participants, setParticipants] = useState(MOCK_PARTICIPANTS);

  const handleKick = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <button
        className="person-icon-btn"
        onClick={() => setPanelOpen(true)}
        aria-label="View session participants"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9z" />
        </svg>
      </button>

      <div
        className={`panel-overlay ${panelOpen ? "open" : ""}`}
        onClick={() => setPanelOpen(false)}
      />
      <div className={`participants-panel ${panelOpen ? "open" : ""}`}>
        <div className="panel-header">
          <h3>In this session</h3>
          <button
            className="panel-close-btn"
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>
        <ul className="participants-list">
          {participants.map((p) => (
            <li key={p.id} className="participant-row">
              <span className="participant-name">
                {p.name} {p.isHost && <span className="host-tag">Host</span>}
              </span>
              {!p.isHost && (
                <button className="kick-btn" onClick={() => handleKick(p.id)}>
                  Kick
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}