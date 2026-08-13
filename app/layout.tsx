import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { AppStateProvider } from "@/lib/actions/store";
import { HtmlLang } from "@/components/html-lang";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "OpenPath, AI Career Coach",
  description:
    "Personalised AI career coach for Vietnamese students and new graduates. " +
    "AI Career Coach cá nhân hoá cho người trẻ Việt: hiểu bản thân, chọn hướng đi phù hợp, biết bắt đầu từ đâu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `lang` starts at Vietnamese, the default, and `HtmlLang` corrects it on
    // the client once the stored language is known. Screen readers pick their
    // pronunciation from this attribute, so leaving it wrong makes English
    // read aloud with Vietnamese phonetics.
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
      {/* The store wraps every route, not just the app shell: onboarding sits
          outside (app) and must write the user's answers into the same state
          the profile then reads. */}
      <body className="min-h-full flex flex-col">
        <AppStateProvider>
          <HtmlLang />
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
