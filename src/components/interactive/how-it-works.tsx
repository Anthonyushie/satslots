"use client";

import { useState } from "react";
import { roleSteps, type Role } from "@/lib/marketplace";
import { Icon } from "@/components/interactive/experience-context";

export function HowItWorks() {
  const [role, setRole] = useState<Role>("advertiser");
  return (
    <section
      id="how-it-works"
      className="how-section site-shell section-space"
      aria-labelledby="how-title"
    >
      <div className="how-grid grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
        <div className="how-left">
          <div className="eyebrow section-label">02 / A BETTER ARRANGEMENT</div>
          <h2 id="how-title">
            A handshake.
            <br />
            <em>Not an ad network.</em>
          </h2>
          <p className="how-description">
            No bidding against bots. No mysterious dashboards. Just two people
            agreeing on a little space.
          </p>
          <div
            className="role-toggle flex"
            role="group"
            aria-label="Choose your perspective"
          >
            {(["advertiser", "publisher"] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={role === option ? "active" : undefined}
                data-role={option}
                aria-pressed={role === option}
                onClick={() => setRole(option)}
              >
                {option === "advertiser"
                  ? "I’m an advertiser"
                  : "I’m a publisher"}{" "}
                <Icon name="arrow-up" small />
              </button>
            ))}
          </div>
          <div className="little-note">
            <Icon name="asterisk" />
            <span>
              Same internet.
              <br />
              Better incentives.
            </span>
          </div>
        </div>
        <div id="steps" className="steps" aria-live="polite">
          {roleSteps[role].map(([title, description], index) => (
            <div className="step flex gap-6" key={title}>
              <span className="step-number mono">0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
