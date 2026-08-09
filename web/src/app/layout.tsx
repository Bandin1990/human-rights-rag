import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Noto_Serif_Thai } from "next/font/google";
import { Header } from "@/components/header";
import "./globals.css";
import "./knowledge.css";
import "./case-management.css";
import "./chat-workspace.css";

const bai = localFont({
  src: [
    { path: "../../public/fonts/BaiJamjuree-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/BaiJamjuree-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/BaiJamjuree-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/BaiJamjuree-Bold.ttf", weight: "700" },
  ],
  variable: "--font-bai",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Display serif used on the topic-map page only - echoes the letterhead
// typography of กสม.'s own published reports (see cw-graph-* in
// chat-workspace.css) rather than reaching for the same geometric sans
// used everywhere else in the app.
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif-th",
});

export const metadata: Metadata = {
  title: "ค้นหาสิทธิ | กสม.",
  description: "คลังความรู้สิทธิมนุษยชนของสำนักงาน กสม. - ค้นหาและถามคำถามจากกรณีตรวจสอบ งานวิจัย กฎหมายไทย และตราสารสิทธิมนุษยชนระหว่างประเทศ",
};

import Link from "next/link";
import { A11yProvider } from "@/components/a11y-provider";
import { A11yToggle } from "@/components/a11y-toggle";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${bai.variable} ${inter.variable} ${notoSerifThai.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <A11yProvider>
          <Header />
          {children}
          <footer>
            <div className="container">
              {/* "Human Rights Knowledge & Case Workspace" (English, referencing
                  the dormant complaint-management subsystem) didn't match the
                  "ค้นหาสิทธิ" / "HUMAN RIGHTS KNOWLEDGE" branding used
                  everywhere else in the app - see header.tsx. */}
              <div className="footer-brand">
                <b>ค้นหาสิทธิ</b>
                <Link href="/help">วิธีใช้งาน</Link>
              </div>
              <span>AI ช่วยค้นและจัดทำร่างเท่านั้น · การวินิจฉัยและอนุมัติเป็นอำนาจของผู้รับผิดชอบ</span>
            </div>
          </footer>
          <A11yToggle />
        </A11yProvider>
      </body>
    </html>
  );
}
