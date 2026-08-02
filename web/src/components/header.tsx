"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, Menu, X } from "@/components/icons";

const links = [
  { href: "/", label: "ค้นเอกสาร", matches: (path: string) => path === "/" || path.startsWith("/case") || path.startsWith("/documents") },
  { href: "/knowledge/dashboard", label: "สถิติ กสม.", matches: (path: string) => path.startsWith("/knowledge/dashboard") },
  { href: "/knowledge/graph", label: "แผนที่ประเด็นสิทธิ", matches: (path: string) => path.startsWith("/knowledge/graph") },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><BookOpen size={23} /></span>
          <span><b>ค้นหาสิทธิ</b><small>HUMAN RIGHTS KNOWLEDGE</small></span>
        </Link>
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
