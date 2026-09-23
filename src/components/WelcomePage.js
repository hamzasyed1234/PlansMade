import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WelcomePage.css";
import ParticipantsPanel from "./ParticipantsPanel";

// Placeholder slideshow content — swap image paths for your own art later
const SLIDES = [
  {
    image: "/slides/slide1.png",
    title: "Stuck in the group chat?",
    text: "Plans get talked about forever and never happen. Let's fix that.",
  },
  {
    image: "/slides/slide2.png",
    title: "Pick a time, together",
    text: "Everyone drops their availability and PlansMade finds what works.",
  },
  {
    image: "/slides/slide3.png",
    title: "Lock in the details",
    text: "Day, time, activity — settled in one place, not fifty texts.",
  },
  {
    image: "/slides/slide4.png",
    title: "Invite your crew",
    text: "Share one link. Anyone who clicks it joins your session instantly.",
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const goToSlide = (index) => {
    const total = SLIDES.length;
    setSlideIndex(((index % total) + total) % total);
  };

  const handlePrev = () => goToSlide(slideIndex - 1);
  const handleNext = () => goToSlide(slideIndex + 1);

  const handleGenerateLink = async () => {
    // Placeholder session id — swap for a real generated/stored session id later
    const newSessionId = Math.random().toString(36).slice(2, 9);
    const inviteLink = `${window.location.origin}/lobby/${newSessionId}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setSessionId(newSessionId);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Couldn't copy link:", err);
    }
  };

  const handleGoToLobby = () => {
    navigate(`/lobby/${sessionId}`, { state: { isAdmin: true } });
  };

  const slide = SLIDES[slideIndex];

  return (
    <div className="welcome-page">
      <ParticipantsPanel />

      <div className="welcome-content">
        <img src="/logo512.png" alt="PlansMade logo" className="welcome-logo" />
        <h1 className="welcome-title">
          Welcome to Plans<span className="title-accent">Made</span>
        </h1>

        <div className="slideshow-bubble">
          <button
            className="slide-arrow slide-arrow-left"
            onClick={handlePrev}
            aria-label="Previous slide"
          >
            &#8249;
          </button>

          <div className="slide-content">
            <img src={slide.image} alt={slide.title} className="slide-image" />
            <h2 className="slide-title">{slide.title}</h2>
            <p className="slide-text">{slide.text}</p>
          </div>

          <button
            className="slide-arrow slide-arrow-right"
            onClick={handleNext}
            aria-label="Next slide"
          >
            &#8250;
          </button>
        </div>

        <div className="slide-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`slide-dot ${i === slideIndex ? "active" : ""}`}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button className="invite-btn" onClick={handleGenerateLink}>
          {linkCopied ? "Link copied!" : "Generate a link to invite friends"}
        </button>

        {sessionId && (
          <button className="lobby-btn" onClick={handleGoToLobby}>
            Go to the lobby
          </button>
        )}
      </div>
    </div>
  );
}