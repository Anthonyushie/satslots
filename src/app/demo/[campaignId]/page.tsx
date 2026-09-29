import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Publisher embed demo — SatSlots",
  description:
    "A production-like publisher page proving SatSlots iframe delivery.",
};

export default async function DemoPublisherPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <main className="demo-publication">
      <header>
        <Link href="/" className="brand">
          THE DAILY NODE
        </Link>
        <span className="mono">INDEPENDENT · OPEN · READER-SUPPORTED</span>
      </header>
      <article>
        <p className="eyebrow">TECHNOLOGY / CULTURE</p>
        <h1>A smaller web can still make room for good work.</h1>
        <p className="demo-deck">
          This dummy publisher page loads the selected paid campaign through the
          same iframe a real publication would install.
        </p>
        <div className="demo-copy-grid">
          <p>
            Independent websites deserve sponsorship tools that do not turn
            every reader into a profile. SatSlots keeps the placement legible
            and the commercial relationship direct.
          </p>
          <aside aria-label="Sponsor placement">
            <span className="eyebrow">FROM OUR SPONSOR</span>
            <iframe
              src={`/embed/${campaignId}`}
              title="Sponsored message"
              loading="eager"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
            />
          </aside>
        </div>
      </article>
    </main>
  );
}
