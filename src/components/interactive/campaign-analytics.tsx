export function CampaignAnalytics() {
  return (
    <section className="feature-section" aria-labelledby="analytics-title">
      <h3 id="analytics-title">Campaign analytics</h3>
      <p className="dialog-lead" role="status">
        Analytics not connected. Impressions, clicks, and spend are unavailable;
        no measurements have been loaded. Missing data is not a zero result.
      </p>
      <p className="booking-warning">
        Reporting needs authorized campaign access, metric definitions, date
        ranges and timezone, and a privacy-safe collection contract. This
        preview sends no impression or click events.
      </p>
      <button type="button" className="text-link" disabled>
        Report export unavailable
      </button>
    </section>
  );
}
