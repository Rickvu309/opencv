import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { AppStateProvider } from "@/lib/actions/store";
import { initialAppState } from "@/lib/state/server";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "OpenPath, AI Career Coach",
  description:
    "A career coach for students and new graduates who do not have a direction yet.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read here, at the top, rather than in each gated layout: the store lives
  // above every route and a child cannot hand a prop upwards.
  //
  // The cost is that reading the session makes every route render on demand,
  // including the landing page, which used to be static. That is the honest
  // shape of a product where the answer to "what does this page show" now
  // depends on who is asking. An anonymous request pays a cookie read and no
  // database call.
  const { state: initial, signedIn } = await initialAppState();

  return (
    // `lang` is English. Screen readers pick pronunciation from this.
    <html lang="en" className={`${beVietnam.variable} h-full antialiased`}>
      {/* The store wraps every route, not just the app shell: onboarding sits
          outside (app) and must write the user's answers into the same state
          the profile then reads. */}
      <body className="min-h-full flex flex-col">
        <AppStateProvider initial={initial} signedIn={signedIn}>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
