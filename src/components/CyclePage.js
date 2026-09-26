import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./CyclePage.css";
import ParticipantsPanel from "./ParticipantsPanel";
import CycleStage from "./CycleStage";
import PlanSummary from "./PlanSummary";
import { STAGE_CONFIG } from "../stageConfig";

export default function CyclePage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const myParticipantId = location.state?.participantId ?? null;

  const [participants, setParticipants] = useState([]);
  const [progress, setProgress] = useState(null); // { queue, finalized }

  const me = participants.find((p) => p.id === myParticipantId);
  const isAdmin = Boolean(me?.is_admin);

  // Participants — reused for the side panel and to know who's admin
  useEffect(() => {
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("joined_at", { ascending: true });
      setParticipants(data || []);
    };

    fetchParticipants();

    const channel = supabase
      .channel(`cycle-participants-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        fetchParticipants
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId]);

  // Shared cycle progress (which stage is current, what's been finalized)
  useEffect(() => {
    const fetchProgress = async () => {
      const { data } = await supabase
        .from("cycle_progress")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      setProgress(data);
    };

    fetchProgress();

    const channel = supabase
      .channel(`cycle-progress-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cycle_progress", filter: `session_id=eq.${sessionId}` },
        fetchProgress
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId]);

  const updateProgress = async (updates) => {
    const { error } = await supabase.from("cycle_progress").update(updates).eq("session_id", sessionId);
    if (error) console.error("Couldn't update cycle progress:", error);
  };

  const handleFinalize = (value) => {
    if (!progress) return;
    const [current, ...rest] = progress.queue;
    updateProgress({ queue: rest, finalized: { ...progress.finalized, [current]: value } });
  };

  const handleSkip = () => {
    if (!progress) return;
    const [current, ...rest] = progress.queue;
    updateProgress({ queue: [...rest, current] });
  };

  if (!progress) {
    return (
      <div className="cycle-page">
        <ParticipantsPanel participants={participants} isAdmin={false} myParticipantId={myParticipantId} />
        <p className="cycle-loading">Loading&hellip;</p>
      </div>
    );
  }

  const currentStage = progress.queue[0];

  return (
    <div className="cycle-page">
      <ParticipantsPanel participants={participants} isAdmin={false} myParticipantId={myParticipantId} />

      {currentStage ? (
        <CycleStage
          key={currentStage}
          sessionId={sessionId}
          stage={currentStage}
          config={STAGE_CONFIG[currentStage]}
          isAdmin={isAdmin}
          myParticipantId={myParticipantId}
          finalizedContext={progress.finalized}
          onFinalize={handleFinalize}
          onSkip={handleSkip}
        />
      ) : (
        <PlanSummary
          sessionId={sessionId}
          finalized={progress.finalized}
          participants={participants}
          myParticipantId={myParticipantId}
        />
      )}
    </div>
  );
}