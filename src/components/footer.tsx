import { ProjectNotesButton } from "@/components/interactive/experience-provider";

export function Footer() {
  return (
    <footer className="site-footer site-shell">
      <div className="footer-main flex flex-col sm:flex-row justify-between gap-6">
        <a
          className="brand flex items-center gap-2"
          href="#"
          aria-label="SatSlots home"
        >
          <svg className="brand-mark" aria-hidden="true">
            <use href="#mark"></use>
          </svg>
          <span>
            satslots<span className="brand-period">.</span>
          </span>
        </a>
        <p>
          Good space. Good company.
          <br />
          <span>The independent ad marketplace.</span>
        </p>
        <nav className="flex gap-6" aria-label="Footer navigation">
          <a href="#spaces">Explore</a>
          <a href="#questions">Questions</a>
          <ProjectNotesButton>Project notes ↗</ProjectNotesButton>
        </nav>
      </div>
      <div className="footer-bottom flex flex-col sm:flex-row justify-between gap-3">
        <span>© 2026 SATSLOTS · LANDING-PAGE PROTOTYPE</span>
        <span>NOSTR FOR IDENTITY. LIGHTNING FOR VALUE.</span>
      </div>
    </footer>
  );
}
