import React, { useState } from "react";
import "./ParticipantsPanel.css";

/**
 * Displays the icon + slide-out list of session participants.
 * This component is presentational only — it takes the live participant
 * data as props rather than fetching its own copy, so it always matches
 * whatever page it's dropped into (and doesn't open a second, redundant
 * DB subscription alongside whatever the parent page already has open).
 *
 * Props:
 *   participants   — array of { id, name, is_admin }
 *   isAdmin        — is the current user the admin? (controls kick buttons)
 *   myParticipantId — the current user's own participant id (hides kick on self)
 *   onKick(id)     — called when admin clicks Kick on someone else
 */
export default function ParticipantsPanel({
  participants = [],
  isAdmin = false,
  myParticipantId = null,
  onKick = () => {},
}) {
  const [panelOpen, setPanelOpen] = useState(false);

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

        {participants.length === 0 ? (
          <p className="panel-empty-state">No one's here yet.</p>
        ) : (
          <ul className="participants-list">
            {participants.map((p) => {
              const isSelf = p.id === myParticipantId;
              const canKick = isAdmin && !isSelf;
              return (
                <li key={p.id} className="participant-row">
                  <span className="participant-name">
                    {p.name} {p.is_admin && <span className="host-tag">Host</span>}
                  </span>
                  {canKick && (
                    <button className="kick-btn" onClick={() => onKick(p.id)}>
                      Kick
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}