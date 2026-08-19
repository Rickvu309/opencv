import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LandingPage } from "@/features/landing/components/landing-page";
import { joinWaitlistFn } from "@/features/landing/server";

export function LandingScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);

  async function onWaitlist(e: FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!email.includes("@")) {
      setEmailError("Enter an email.");
      return;
    }
    setPending(true);
    try {
      const result = await joinWaitlistFn({ data: { email } });
      if (result.ok) setJoined(true);
      else setEmailError(result.error);
    } catch {
      setEmailError("That did not go through. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <LandingPage
      onComposerSend={() => navigate({ to: "/sign-up" })}
      waitlist={{
        email,
        emailError,
        joined,
        pending,
        onEmail: setEmail,
        onSubmit: (e) => void onWaitlist(e),
      }}
    />
  );
}
