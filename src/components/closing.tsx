import { ListSpaceButton } from "@/components/interactive/experience-provider";

export function Closing() {
  return (
    <section className="closing site-shell" aria-labelledby="closing-title">
      <div className="closing-inner">
        <div className="eyebrow">MAKE ROOM FOR SOMETHING GOOD.</div>
        <div className="closing-main flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <h2 id="closing-title">
            A little space.
            <br />A more <em>human internet.</em>
          </h2>
          <a className="button button-orange" href="#spaces">
            Find your people{" "}
            <svg className="icon" aria-hidden="true">
              <use href="#arrow-up"></use>
            </svg>
          </a>
        </div>
        <div className="closing-rule"></div>
        <div className="closing-bottom flex flex-col sm:flex-row justify-between gap-3">
          <span>START SMALL. STAY INDEPENDENT.</span>
          <ListSpaceButton className="text-link">
            Or make your own listing preview <span aria-hidden="true">↗</span>
          </ListSpaceButton>
        </div>
      </div>
    </section>
  );
}
