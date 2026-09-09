"use client";

import { useRef } from "react";

const questions = [
  {
    question: "Can I book a placement right now?",
    answer:
      "Not yet. This is an interactive landing-page demo. Explore the sample placements or create a local listing preview. There are no live publishers, wallet connections, or real payments here.",
  },
  {
    question: "Why bitcoin? Why sats?",
    answer:
      "A satoshi, or sat, is one hundred-millionth of a bitcoin. Lightning can make small, cross-border sponsorship payments practical. Fees, availability, and payment privacy still depend on the wallets and services used. Bitcoin’s value can change.",
  },
  {
    question: "Who holds the money?",
    answer:
      "The planned first version uses upfront Lightning payments directly to the publisher. That is not escrow or a delivery guarantee. Advertisers accept non-delivery risk; refunds require the publisher’s cooperation. Start with small, short bookings.",
  },
  {
    question: "Am I buying views or a placement?",
    answer:
      "A placement for an agreed period—not guaranteed views, clicks, or sales. Timestamped checks can show that a banner was observed, but cannot prove that real people saw it. Publishers should clearly label sponsored content and support any audience claims with evidence.",
  },
  {
    question: "What if the marketplace disappears?",
    answer:
      "The intended design publishes signed listings to multiple Nostr relays, so another compatible app can read available copies using the same identity. This portability is a project goal, not a feature implemented in this demo. Relays, publishers, and hosting services can still go offline.",
  },
  {
    question: "Do I need a huge audience?",
    answer:
      "No. A focused site can be valuable to the right sponsor. What matters is a clear topic, an honest description of your audience, and a placement you control and can reliably deliver.",
  },
];

export function FAQ() {
  const refs = useRef<(HTMLDetailsElement | null)[]>([]);
  return (
    <section
      className="faq-section site-shell section-space grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16"
      id="questions"
      aria-labelledby="faq-title"
    >
      <div>
        <div className="eyebrow section-label">04 / BEFORE YOU ASK</div>
        <h2 id="faq-title">
          Fair questions.
          <br />
          <em>Straight answers.</em>
        </h2>
        <div className="build-note">
          <span className="status-dot" />
          <p>
            A work in progress.
            <br />
            <span>A concept for BOSS Battle 2026.</span>
          </p>
        </div>
      </div>
      <div className="faq-list">
        {questions.map(({ question, answer }, index) => (
          <details
            key={question}
            ref={(element) => {
              refs.current[index] = element;
            }}
            open={index === 0 ? true : undefined}
            onToggle={(event) => {
              if (event.currentTarget.open)
                refs.current.forEach((detail, i) => {
                  if (detail && i !== index) detail.open = false;
                });
            }}
          >
            <summary>
              {question}
              <span className="faq-plus" aria-hidden="true" />
            </summary>
            <div className="faq-answer">{answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
