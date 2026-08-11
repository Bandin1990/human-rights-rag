"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Menu, X } from "@/components/icons";

const links = [
  { href: "/", label: "ค้นเอกสาร", matches: (path: string) => path === "/" || path.startsWith("/case") || path.startsWith("/documents") },
  { href: "/knowledge/dashboard", label: "สถิติระบบ", matches: (path: string) => path.startsWith("/knowledge/dashboard") },
  { href: "/knowledge/graph", label: "แผนที่ประเด็นสิทธิ", matches: (path: string) => path.startsWith("/knowledge/graph") },
  { href: "/help", label: "วิธีใช้งาน", matches: (path: string) => path.startsWith("/help") },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // chat-workspace.css's .cw-container (the fixed-position chat home page)
  // used to hardcode this header's height as a second, separately-maintained
  // "76px / 65px under 600px" number, duplicating globals.css's own
  // .header-inner height - the two only ever matched by coincidence. Any
  // real-device difference the CSS breakpoint doesn't account for (OS-level
  // "larger text" accessibility settings scaling the brand text, a browser
  // that renders the Bai Jamjuree webfont metrics slightly differently,
  // etc.) makes the header taller than the hardcoded value without a
  // matching update on the other side, so .cw-container starts underneath
  // the real header instead of below it - the exact "menu covers the
  // heading" bug reported on a real phone that this headless browser
  // couldn't reproduce with default font scaling. Measuring the header's
  // actual rendered height and publishing it as a CSS variable lets
  // .cw-container track it exactly, on every device, with no number to keep
  // in sync by hand.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const setVar = () => document.documentElement.style.setProperty("--site-header-h", `${el.offsetHeight}px`);
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        <div className="brand-group">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand-mark"><BookOpen size={23} /></span>
            <span><b>ค้นหาสิทธิ</b><small>HUMAN RIGHTS KNOWLEDGE</small></span>
          </Link>
          {/* Visible in one clear, sitewide spot per the transparency requirement
              (see /help#about-system) - not tucked into a footer line nobody reads. */}
          <Link
            href="/help#about-system"
            className="beta-badge"
            title="ระบบอยู่ในระยะทดลอง (Beta) - อ่านคำอธิบายสถาปัตยกรรมและข้อจำกัดของ AI ได้ที่หน้าวิธีใช้งาน"
            onClick={() => setOpen(false)}
          >
            <span className="beta-badge-full">เวอร์ชันทดลอง</span>
            <span className="beta-badge-short">BETA</span>
          </Link>
        </div>
        <nav className={open ? "is-open" : ""} aria-label="เมนูหลัก">
          {links.map((link) => (
            <Link
              href={link.href}
              className={link.matches(pathname) ? "active" : undefined}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="menu" aria-label={open ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
