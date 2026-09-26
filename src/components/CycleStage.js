import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./CycleStage.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Generic reusable stage for the planning cycle. Fed a different config
 * (title + option list + whether custom entries are allowed) for each of
 * month / day / time / activity / location — same cross-off + vote logic
 * powers all five. The day stage additionally renders as a real calendar,
 * using the year/month that were already finalized earlier in the cycle.
 */
export default function CycleStage({
  sessionId,
  stage,
  config,
  isAdmin,
  myParticipantId,
  finalizedContext,
  onFinalize,
  onSkip,
}) {
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [customInput, setCustomInput] = useState("");

  const isDayStage = stage === "day";
  const yearValue = finalizedContext?.year;
  const monthValue = finalizedContext?.month;
  const monthIndex = MONTH_NAMES.indexOf(monthValue);
  const hasRealCalendar = isDayStage && yearValue && monthIndex >= 0;

  const daysInMonth = hasRealCalendar ? new Date(Number(yearValue), monthIndex + 1, 0).getDate() : 31;
  const startWeekday = hasRealCalendar ? new Date(Number(yearValue), monthIndex, 1).getDay() : 0;
  const dayOptionsForSeeding = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const optionsToSeed = isDayStage ? dayOptionsForSeeding : config.options;

  // Live options + votes for this stage. Also seeds default options the
  // first time this stage is visited (admin-only, so two clients loading a
  // fresh stage at once don't both insert duplicates) — folded into the same
  // fetch instead of a separate existence-check query beforehand, so this
  // doesn't cost every participant an extra round trip on every stage.
  useEffect(() => {
    let cancelled = false;

    const fetchOptions = async () => {
      const { data } = await supabase
        .from("cycle_options")
        .select("*")
        .eq("session_id", sessionId)
        .eq("stage", stage)
        .order("created_at", { ascending: true });

      let rows = data || [];

      if (rows.length === 0 && isAdmin && optionsToSeed.length > 0) {
        const seedRows = optionsToSeed.map((label) => ({ session_id: sessionId, stage, label }));
        const { data: inserted } = await supabase
          .from("cycle_options")
          .upsert(seedRows, { onConflict: "session_id,stage,label", ignoreDuplicates: true })
          .select();
        rows = inserted || [];
      }

      // For the day stage, force a stable numeric order (1, 2, 3...) instead
      // of relying on created_at — bulk-seeded rows can share a timestamp,
      // which let tiles shuffle position and break the calendar alignment.
      if (isDayStage) {
        rows.sort((a, b) => Number(a.label) - Number(b.label));
      }

      if (!cancelled) setOptions(rows);
    };

    const fetchVotes = async () => {
      const { data } = await supabase
        .from("cycle_votes")
        .select("*")
        .eq("session_id", sessionId)
        .eq("stage", stage);
      if (!cancelled) setVotes(data || []);
    };

    fetchOptions();
    fetchVotes();

    const channel = supabase
      .channel(`cycle-${sessionId}-${stage}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cycle_options", filter: `session_id=eq.${sessionId}` },
        fetchOptions
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cycle_votes", filter: `session_id=eq.${sessionId}` },
        fetchVotes
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stage, isAdmin, isDayStage]);

  const voteCountFor = (label) => votes.filter((v) => v.option_label === label).length;
  const myVote = votes.find((v) => v.participant_id === myParticipantId);

  const handleToggleCross = async (option) => {
    if (!option.is_crossed) {
      await supabase.from("cycle_options").update({ is_crossed: true }).eq("id", option.id);
    } else if (isAdmin) {
      await supabase.from("cycle_options").update({ is_crossed: false }).eq("id", option.id);
    }
  };

  const handleVote = async (label) => {
    await supabase
      .from("cycle_votes")
      .upsert(
        { session_id: sessionId, stage, participant_id: myParticipantId, option_label: label },
        { onConflict: "session_id,stage,participant_id" }
      );
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    await supabase
      .from("cycle_options")
      .upsert(
        { session_id: sessionId, stage, label: customInput.trim() },
        { onConflict: "session_id,stage,label", ignoreDuplicates: true }
      );
    setCustomInput("");
  };

  const openOptions = options.filter((o) => !o.is_crossed);
  const winningOption = openOptions.length
    ? openOptions.reduce((best, o) => (voteCountFor(o.label) > voteCountFor(best.label) ? o : best), openOptions[0])
    : null;
  const canFinalize = isAdmin && winningOption && voteCountFor(winningOption.label) > 0;

  const renderTile = (o) => (
    <div
      key={o.id}
      className={`option-tile ${o.is_crossed ? "crossed" : ""} ${myVote?.option_label === o.label ? "voted" : ""}`}
    >
      <button
        className="option-cross-btn"
        onClick={() => handleToggleCross(o)}
        disabled={o.is_crossed && !isAdmin}
        aria-label={o.is_crossed ? "Bring back" : "Cross off"}
      >
        {o.is_crossed ? "\u2715" : ""}
      </button>
      <span className="option-label">{o.label}</span>
      <button
        className="option-vote-btn"
        onClick={() => handleVote(o.label)}
        style={{ visibility: o.is_crossed ? "hidden" : "visible" }}
        tabIndex={o.is_crossed ? -1 : 0}
      >
        Vote {voteCountFor(o.label) > 0 && `(${voteCountFor(o.label)})`}
      </button>
    </div>
  );

  return (
    <div className="cycle-stage">
      <h1 className="cycle-title">
        {isDayStage && hasRealCalendar ? `Pick a day in ${monthValue} ${yearValue}` : config.title}
      </h1>
      <p className="cycle-subtext">Cross off ones you don't want, then vote on what's left.</p>

      {isDayStage ? (
        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="calendar-weekday">
              {w}
            </div>
          ))}
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`pad-${i}`} className="calendar-pad" />
          ))}
          {options.map((o) => renderTile(o))}
        </div>
      ) : (
        <div className="option-grid">{options.map((o) => renderTile(o))}</div>
      )}

      {config.allowCustom && (
        <form className="custom-option-form" onSubmit={handleAddCustom}>
          <input
            type="text"
            placeholder={`Add a custom ${stage}`}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      )}

      {isAdmin ? (
        <div className="cycle-admin-controls">
          <button className="skip-btn" onClick={onSkip}>
            Skip this step
          </button>
          <button className="finalize-btn" disabled={!canFinalize} onClick={() => onFinalize(winningOption.label)}>
            Finalize{winningOption ? `: ${winningOption.label}` : ""}
          </button>
        </div>
      ) : (
        <p className="cycle-waiting-text">Waiting for the admin to finalize or skip this step&hellip;</p>
      )}
    </div>
  );
}