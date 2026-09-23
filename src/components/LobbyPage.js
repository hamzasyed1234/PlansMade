import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./LobbyPage.css";
import ParticipantsPanel from "./ParticipantsPanel";

export default function LobbyPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  // Host arrives from WelcomePage's "Go to the lobby" button with isAdmin in nav state
  const isHost = Boolean(location.state?.isAdmin);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participants, setParticipants] = useState([]);

  // Subscribe to live participant changes for this session
  useEffect(() => {
    if (!joined) return;

    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("joined_at", { ascending: true });
      if (!error) setParticipants(data);
    };

    fetchParticipants();

    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        () => fetchParticipants()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [joined, sessionId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { data, error } = await supabase
      .from("participants")
      .insert({ session_id: sessionId, name: name.trim(), is_admin: isHost })
      .select()
      .single();

    if (error) {
      console.error("Couldn't join session:", error);
      return;
    }

    setMyParticipantId(data.id);
    setIsAdmin(data.is_admin);
    setJoined(true);
  };

  const handleKick = async (participantId) => {
    if (!isAdmin) return; // only admin can remove anyone, including themselves
    const { error } = await supabase.from("participants").delete().eq("id", participantId);
    if (error) console.error("Couldn't remove participant:", error);
  };

  const handleContinue = () => {
    // Placeholder — wire this up to the next page (planning screen) once it exists
    console.log("Continuing to next step with participants:", participants);
  };

  return (
    <div className="lobby-page">
      <ParticipantsPanel />

      <div className="lobby-content">
        {!joined ? (
          <div className="name-bubble">
            <h1 className="lobby-title">Join the session</h1>
            <p className="lobby-subtext">Enter your name to hop in.</p>
            <form onSubmit={handleJoin} className="name-form">
              <input
                type="text"
                className="name-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="join-btn">
                Join
              </button>
            </form>
          </div>
        ) : (
          <div className="lobby-joined-view">
            <h1 className="lobby-title">Who's here</h1>
            <p className="lobby-subtext">
              {isAdmin
                ? "Tap a name to remove them from the session."
                : "Waiting for everyone to join\u2026"}
            </p>

            <div className="participant-grid">
              {participants.map((p) => (
                <button
                  key={p.id}
                  className={`name-tile ${p.id === myParticipantId ? "me" : ""} ${isAdmin ? "kickable" : ""}`}
                  onClick={() => handleKick(p.id)}
                  disabled={!isAdmin}
                >
                  {p.name}
                  {p.is_admin && <span className="admin-badge">Admin</span>}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button className="continue-btn" onClick={handleContinue}>
                Continue &rsaquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}