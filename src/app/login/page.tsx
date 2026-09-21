import { Header } from "@/components/header";
import { ExperienceProvider } from "@/components/interactive/experience-provider";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — SatSlots",
  description: "Sign in with your Nostr key or email and password.",
};

export default function LoginPage() {
  return (
    <ExperienceProvider>
      <Header />
      <LoginClient />
    </ExperienceProvider>
  );
}
