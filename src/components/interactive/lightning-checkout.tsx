export function LightningCheckout() {
  return (
    <section aria-labelledby="checkout-title">
      <h3 id="checkout-title">Lightning checkout</h3>
      <p id="booking-unavailable" className="form-disclaimer" role="status">
        Booking and Lightning checkout are unavailable until the backend
        booking, authentication, and payment contracts are connected. No booking
        is created and no payment is requested.
      </p>
      <p className="booking-warning">
        No invoice is available. A server-confirmed quote, availability check,
        publisher approval, and verified payment settlement are required before
        a campaign can run. A Nostr connection alone does not authorize payment.
      </p>
      <button
        type="button"
        className="button button-ink w-full"
        disabled
        aria-describedby="booking-unavailable"
      >
        Booking unavailable
      </button>
    </section>
  );
}
