import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./LobbyPage.css";
import ParticipantsPanel from "./ParticipantsPanel";

const STALE_AFTER_MS = 60_000; // consider a participant gone if no heartbeat in this long
const HEARTBEAT_INTERVAL_MS = 20_000;
const REMOVE_ANIM_MS = 350; // must match the CSS animation duration

export default function LobbyPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  // Host arrives from WelcomePage's "Go to the lobby" button with isAdmin in nav state
  const isHost = Boolean(location.state?.isAdmin);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());

  // Entries that were just removed from the DB but are still animating out
  const [removingEntries, setRemovingEntries] = useState([]);
  const prevParticipantsRef = useRef([]);

  // Derive "me" and admin status from the live participants list, rather than
  // tracking admin as separate state — this way an automatic handoff (below)
  // is reflected immediately for everyone, not just set once at join time.
  const me = participants.find((p) => p.id === myParticipantId);
  const isAdmin = Boolean(me?.is_admin);

  // Detect participants that just disappeared from the DB list and keep them
  // rendered briefly (with a "removing" flag) so they can animate out instead
  // of vanishing instantly.
  useEffect(() => {
    const prev = prevParticipantsRef.current;
    const newIds = new Set(participants.map((p) => p.id));
    const justRemoved = prev.filter((p) => !newIds.has(p.id));

    if (justRemoved.length > 0) {
      setRemovingEntries((current) => [...current, ...justRemoved]);
      justRemoved.forEach((p) => {
        setTimeout(() => {
          setRemovingEntries((current) => current.filter((e) => e.id !== p.id));
        }, REMOVE_ANIM_MS);
      });
    }

    prevParticipantsRef.current = participants;
  }, [participants]);

  const displayList = [
    ...participants.map((p) => ({ ...p, removing: false })),
    ...removingEntries
      .filter((e) => !participants.some((p) => p.id === e.id))
      .map((e) => ({ ...e, removing: true })),
  ];

  // One-time cleanup: purge anyone who hasn't checked in recently.
  // Runs whenever a lobby link is opened, so a dead session gets swept
  // even if nobody was around to react to the last person leaving.
  useEffect(() => {
    const purgeStale = async () => {
      const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
      await supabase
        .from("participants")
        .delete()
        .eq("session_id", sessionId)
        .lt("last_seen", cutoff);
    };
    purgeStale();
  }, [sessionId]);

  // Fetch + subscribe to live participant changes for this session
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

  // Presence: tracks who is actually connected right now (separate from the
  // participants table, which just stores who has ever joined).
  useEffect(() => {
    if (!joined || !myParticipantId) return;

    const presenceChannel = supabase.channel(`presence-${sessionId}`, {
      config: { presence: { key: myParticipantId } },
    });

    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    });

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [joined, myParticipantId, sessionId]);

  // Heartbeat: keep last_seen fresh while this tab is open and joined
  useEffect(() => {
    if (!joined || !myParticipantId) return;

    const ping = () =>
      supabase.from("participants").update({ last_seen: new Date().toISOString() }).eq("id", myParticipantId);

    ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [joined, myParticipantId]);

  // Automatic admin handoff: if the current admin is no longer online,
  // the earliest-joined online participant promotes themselves.
  // Only that one client performs the write, so there's no race between
  // everyone trying to self-promote at once.
  useEffect(() => {
    if (!joined || participants.length === 0) return;

    const admin = participants.find((p) => p.is_admin);
    if (!admin || onlineIds.has(admin.id)) return; // admin still here, nothing to do

    const onlineOthers = participants
      .filter((p) => p.id !== admin.id && onlineIds.has(p.id))
      .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

    if (onlineOthers.length === 0) return; // nobody online to hand off to yet

    const successor = onlineOthers[0];
    if (successor.id !== myParticipantId) return; // only the successor acts

    // Debounce: don't act the instant admin looks offline. The gap is usually
    // just the moment right after they join — their DB row lands before their
    // presence connection finishes syncing to other tabs. Wait a few seconds
    // and cancel if admin shows up in onlineIds before the timer fires.
    const timeoutId = setTimeout(async () => {
      await supabase.from("participants").update({ is_admin: true }).eq("id", successor.id);
      await supabase.from("participants").delete().eq("id", admin.id);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [participants, onlineIds, joined, myParticipantId]);

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
    setJoined(true);
  };

  const handleKick = async (participantId) => {
    // Only admin can remove people, and never themselves
    if (!isAdmin || participantId === myParticipantId) return;
    const { error } = await supabase.from("participants").delete().eq("id", participantId);
    if (error) console.error("Couldn't remove participant:", error);
  };

  const handleContinue = () => {
    // Placeholder — wire this up to the next page (planning screen) once it exists
    console.log("Continuing to next step with participants:", participants);
  };

  return (
    <div className="lobby-page">
      <ParticipantsPanel
        participants={participants}
        isAdmin={isAdmin}
        myParticipantId={myParticipantId}
        onKick={handleKick}
      />

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
              {displayList.map((p) => {
                const isSelf = p.id === myParticipantId;
                const canKick = isAdmin && !isSelf && !p.removing;
                return (
                  <button
                    key={p.id}
                    className={[
                      "name-tile",
                      isSelf ? "me" : "",
                      canKick ? "kickable" : "",
                      p.removing ? "removing" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => canKick && handleKick(p.id)}
                    disabled={!canKick}
                  >
                    {p.name}
                    {p.is_admin && <span className="admin-badge">Admin</span>}
                  </button>
                );
              })}
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