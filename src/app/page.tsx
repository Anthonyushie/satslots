import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { PrincipleStrip } from "@/components/principle-strip";
import { Manifesto } from "@/components/manifesto";
import { FAQ } from "@/components/faq";
import { Closing } from "@/components/closing";
import { Footer } from "@/components/footer";
import { IconSprite } from "@/components/icon-sprite";
import { ExperienceProvider } from "@/components/interactive/experience-provider";
import { Marketplace } from "@/components/interactive/marketplace";
import { HowItWorks } from "@/components/interactive/how-it-works";

export default function HomePage() {
  return (
    <ExperienceProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <IconSprite />
      <Header />
      <main id="main">
        <Hero />
        <PrincipleStrip />
        <Marketplace />
        <HowItWorks />
        <Manifesto />
        <FAQ />
        <Closing />
      </main>
      <Footer />
    </ExperienceProvider>
  );
}
