export function Manifesto() {
  return (
    <section
      className="manifesto"
      id="why-satslots"
      aria-labelledby="manifesto-title"
    >
      <div className="site-shell">
        <div className="manifesto-top flex justify-between items-center">
          <span className="eyebrow">03 / BUILT DIFFERENT, ON PURPOSE</span>
          <svg className="manifesto-star" aria-hidden="true">
            <use href="#asterisk"></use>
          </svg>
        </div>
        <div className="manifesto-grid grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          <div>
            <h2 id="manifesto-title">
              More owners.
              <br />
              Fewer
              <br />
              <em>landlords.</em>
            </h2>
            <p className="manifesto-summary">
              The internet was supposed to be a place we built together. Let’s
              keep a little of it that way.
            </p>
          </div>
          <div className="principles">
            <article>
              <span className="mono">01 — NOSTR IDENTITY</span>
              <h3>A key. Not another account.</h3>
              <p>
                The goal: signed listings and a publisher identity you can take
                to another compatible app. Your reputation shouldn’t be locked
                in our database.
              </p>
            </article>
            <article>
              <span className="mono">02 — LIGHTNING PAYMENTS</span>
              <h3>A payment. Not a payout queue.</h3>
              <p>
                Small bitcoin payments, advertiser to publisher. SatSlots
                doesn’t need to sit in the middle of your money.
              </p>
            </article>
            <article>
              <span className="mono">03 — CONTEXT, NOT SURVEILLANCE</span>
              <h3>An audience. Not a data product.</h3>
              <p>
                Sponsor a site because of what it stands for. No cross-site
                tracking cookies. No following people around the web.
              </p>
            </article>
          </div>
        </div>
        <div className="manifesto-footer flex flex-col sm:flex-row justify-between gap-3">
          <span>OPEN PROTOCOLS. HUMAN-SIZED COMMERCE.</span>
          <span>THE DESIGN PRINCIPLES BEHIND SATSLOTS ↗</span>
        </div>
      </div>
    </section>
  );
}
