import { ListSpaceButton } from "@/components/interactive/experience-provider";

export function Hero() {
  return (
    <section
      className="hero site-shell grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12"
      aria-labelledby="hero-title"
    >
      <div className="hero-copy">
        <div className="eyebrow flex items-center gap-2">
          <span className="tiny-square"></span>FOR THE INDEPENDENT INTERNET
        </div>
        <h1 id="hero-title">
          Your space.
          <br />
          Your terms.
          <br />
          Your <em>sats.</em>
          <span className="headline-spark" aria-hidden="true">
            ✳
          </span>
        </h1>
        <p className="hero-description">
          Good people. Good places to be seen.
          <br />
          Buy a little ad space from independent publishers.
          <br className="desktop-break" /> Pay them directly in bitcoin.
        </p>
        <div className="hero-actions flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <a className="button button-ink" href="#spaces">
            Find your next audience{" "}
            <svg className="icon" aria-hidden="true">
              <use href="#arrow-up"></use>
            </svg>
          </a>
          <ListSpaceButton className="text-link">
            I have space to share <span aria-hidden="true">→</span>
          </ListSpaceButton>
        </div>
        <div className="hero-footnote flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <svg className="icon icon-small" aria-hidden="true">
              <use href="#asterisk"></use>
            </svg>
            Identity on Nostr
          </span>
          <span className="footnote-divider" aria-hidden="true"></span>
          <span className="flex items-center gap-2">
            <svg className="icon icon-small" aria-hidden="true">
              <use href="#bolt"></use>
            </svg>
            Payments on Lightning
          </span>
        </div>
      </div>
      <div
        className="hero-art"
        role="img"
        aria-label="Illustration of a publisher sponsorship and a direct payment receipt"
      >
        <div className="art-caption flex items-center justify-between">
          <span>A LITTLE SPACE. A DIRECT CONNECTION.</span>
          <span>FIG. 001</span>
        </div>
        <div className="art-corner corner-one"></div>
        <div className="art-corner corner-two"></div>
        <div className="browser-art">
          <div className="browser-chrome flex items-center justify-between">
            <div className="flex gap-1">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <span>THE INDEPENDENT WEB</span>
            <svg className="icon icon-tiny" aria-hidden="true">
              <use href="#arrow-up"></use>
            </svg>
          </div>
          <div className="publication-content">
            <div className="publication-masthead flex items-center justify-between">
              <span>
                FIELDNOTES<sup>®</sup>
              </span>
              <span>
                ISSUE 021
                <br />
                EST. ON THE INTERNET
              </span>
            </div>
            <div className="publication-title">
              Ideas worth
              <br />
              <em>passing on.</em>
            </div>
            <div className="publication-rule"></div>
            <div className="sample-sponsor">
              <div className="sponsor-top flex items-center justify-between">
                <span>THIS SPACE COULD BE YOURS</span>
                <svg className="icon icon-small" aria-hidden="true">
                  <use href="#arrow-up"></use>
                </svg>
              </div>
              <div className="sponsor-center flex items-center justify-between">
                <span>
                  A small slot.
                  <br />A big <em>hello.</em>
                </span>
                <svg
                  className="sponsor-flower"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <g fill="none" stroke="currentColor" strokeWidth="9">
                    <ellipse cx="50" cy="50" rx="15" ry="42"></ellipse>
                    <ellipse
                      cx="50"
                      cy="50"
                      rx="15"
                      ry="42"
                      transform="rotate(60 50 50)"
                    ></ellipse>
                    <ellipse
                      cx="50"
                      cy="50"
                      rx="15"
                      ry="42"
                      transform="rotate(120 50 50)"
                    ></ellipse>
                  </g>
                </svg>
              </div>
              <div className="sponsor-bottom flex justify-between">
                <span>INDEPENDENTLY SPONSORED</span>
                <span>NO TRACKING. JUST CONTEXT.</span>
              </div>
            </div>
            <div className="publication-text grid grid-cols-2 gap-4">
              <div>
                <b>Small is a feature.</b>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div>
                <b>A better kind of connection.</b>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        <div className="payment-receipt">
          <div className="receipt-heading flex items-center justify-between">
            <span>THE DIRECT ROUTE</span>
            <svg className="icon icon-small" aria-hidden="true">
              <use href="#bolt"></use>
            </svg>
          </div>
          <div className="receipt-amount">
            5,000 <span>sats</span>
          </div>
          <div className="receipt-route flex items-center gap-3">
            <span>Advertiser</span>
            <span className="route-line"></span>
            <span>Publisher</span>
          </div>
          <div className="receipt-bottom flex items-center justify-between">
            <span>ONE SLOT · 24 HOURS</span>
            <span className="receipt-badge">NO DETOURS ↗</span>
          </div>
        </div>
        <div className="art-footnote">
          AN ILLUSTRATION, NOT A LIVE TRANSACTION
        </div>
      </div>
    </section>
  );
}
