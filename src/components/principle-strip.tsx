export function PrincipleStrip() {
  return (
    <div className="principle-strip" aria-label="SatSlots principles">
      <div className="site-shell flex flex-wrap items-center justify-between gap-5">
        <span>LESS AD TECH. MORE HANDSHAKE.</span>
        <svg className="icon" aria-hidden="true">
          <use href="#asterisk"></use>
        </svg>
        <span>YOUR KEYS. YOUR IDENTITY.</span>
        <svg className="icon strip-star" aria-hidden="true">
          <use href="#asterisk"></use>
        </svg>
        <span>SMALL PAYMENTS. BIG POSSIBILITIES.</span>
        <svg className="icon strip-star" aria-hidden="true">
          <use href="#asterisk"></use>
        </svg>
      </div>
    </div>
  );
}
