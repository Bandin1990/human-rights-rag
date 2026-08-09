"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  return (
    <header className="site-header">
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
