import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./PlanSummary.css";

export default function PlanSummary({ sessionId, finalized, participants, myParticipantId, isAdmin }) {
  const navigate = useNavigate();
  const [confirmations, setConfirmations] = useState([]);
  const [copied, setCopied] = useState(false); // brief "Copied!" button feedback
  const [hasCopiedEver, setHasCopiedEver] = useState(false); // persists, gates the exit button
  const [showCopyReminder, setShowCopyReminder] = useState(false);
  const [exiting, setExiting] = useState(false);

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

  const { year, month, day, time, activity, location } = finalized;
  const summaryText = `${month} ${day}, ${year} \u2014 ${time}\n${activity} at ${location}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setHasCopiedEver(true);
      setShowCopyReminder(false);
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

  const handleExit = async () => {
    if (!hasCopiedEver) {
      setShowCopyReminder(true);
      return;
    }

    setExiting(true);

    await Promise.all([
      supabase.from("participants").delete().eq("session_id", sessionId),
      supabase.from("cycle_options").delete().eq("session_id", sessionId),
      supabase.from("cycle_votes").delete().eq("session_id", sessionId),
      supabase.from("cycle_progress").delete().eq("session_id", sessionId),
      supabase.from("plan_confirmations").delete().eq("session_id", sessionId),
    ]);
    await supabase.from("sessions").delete().eq("id", sessionId);

    navigate("/");
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

      {isAdmin ? (
        <>
          {showCopyReminder && (
            <p className="copy-reminder">Copy the plan text above before you exit!</p>
          )}

          <button className="exit-btn" onClick={handleExit} disabled={exiting}>
            {exiting ? "Ending session\u2026" : "All done here \u2014 exit"}
          </button>
        </>
      ) : (
        <p className="plan-waiting-text">Waiting for the admin to end the session&hellip;</p>
      )}
    </div>
  );
}