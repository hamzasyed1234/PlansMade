import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./PlanSummary.css";

const STAGE_LABELS = { year: "Year", month: "Month", day: "Day", time: "Time", activity: "Activity", location: "Location" };

export default function PlanSummary({ sessionId, finalized, participants, myParticipantId }) {
  const [confirmations, setConfirmations] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchConfirmations = async () => {
      const { data } = await supabase.from("plan_confirmations").select("*").eq("session_id", sessionId);
      setConfirmations(data || []);
    };

    fetchConfirmations();

    const channel = supabase
      .channel(`plan-confirmations-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_confirmations", filter: `session_id=eq.${sessionId}` },
        fetchConfirmations
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId]);

  const summaryText = Object.entries(finalized)
    .map(([stage, value]) => `${STAGE_LABELS[stage] || stage}: ${value}`)
    .join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Couldn't copy plan:", err);
    }
  };

  const handleVote = async (vote) => {
    await supabase
      .from("plan_confirmations")
      .upsert({ session_id: sessionId, participant_id: myParticipantId, vote }, { onConflict: "session_id,participant_id" });
  };

  const myConfirmation = confirmations.find((c) => c.participant_id === myParticipantId);

  return (
    <div className="plan-summary">
      <h1 className="cycle-title">The Plan</h1>

      <pre className="plan-text">{summaryText}</pre>

      <button className="copy-plan-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy plan text"}
      </button>

      <div className="confirm-buttons">
        <button className={`confirm-btn yes ${myConfirmation?.vote === "yes" ? "active" : ""}`} onClick={() => handleVote("yes")}>
          &#10003; I'm in
        </button>
        <button className={`confirm-btn no ${myConfirmation?.vote === "no" ? "active" : ""}`} onClick={() => handleVote("no")}>
          &#10007; I'm out
        </button>
      </div>

      <div className="confirmation-grid">
        {participants.map((p) => {
          const c = confirmations.find((c) => c.participant_id === p.id);
          return (
            <div key={p.id} className={`confirm-tile ${c ? c.vote : "pending"}`}>
              {p.name}
              <span className="confirm-icon">{c?.vote === "yes" ? "\u2713" : c?.vote === "no" ? "\u2717" : "\u2026"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}