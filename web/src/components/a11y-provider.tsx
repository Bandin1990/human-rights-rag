"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type FontSizeScale = "normal" | "large" | "xlarge";
type ThemeContrast = "normal" | "high" | "dark";

interface A11yContextType {
  fontSizeScale: FontSizeScale;
  themeContrast: ThemeContrast;
  setFontSizeScale: (scale: FontSizeScale) => void;
  setThemeContrast: (theme: ThemeContrast) => void;
}

const A11yContext = createContext<A11yContextType | undefined>(undefined);

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const [fontSizeScale, setFontSizeScale] = useState<FontSizeScale>("normal");
  const [themeContrast, setThemeContrast] = useState<ThemeContrast>("normal");

  useEffect(() => {
    try {
      const storedFontSize = localStorage.getItem("a11y_fontSize") as FontSizeScale;
      const storedTheme = localStorage.getItem("a11y_theme") as ThemeContrast;
      if (storedFontSize) setFontSizeScale(storedFontSize);
      if (storedTheme) setThemeContrast(storedTheme);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Font-size classes go on <html>, not <body>: nearly every font-size in
    // this codebase is set in `rem`, which is always relative to the root
    // (html) element's computed font-size, never body's - so `body{font-
    // size:125%}` changed body's own text (and any element that inherits
    // font-size with no rem/px override of its own) but left virtually
    // every rem-sized heading, button, and label completely unaffected.
    // Scaling html's own font-size instead means every rem value site-wide
    // scales proportionally, with no other change needed.
    const htmlCl = document.documentElement.classList;
    htmlCl.remove("font-large", "font-xlarge");
    if (fontSizeScale === "large") htmlCl.add("font-large");
    if (fontSizeScale === "xlarge") htmlCl.add("font-xlarge");

    // Contrast/dark stay on body - see globals.css's "A11y Settings" block
    // (the :root-variable pages) and chat-workspace.css's "Accessibility
    // overrides" block (the homepage chat UI, graph/help/stats pages, and
    // site header/footer, which all define their own separately-scoped
    // colors instead of reading the global --ink/--paper variables).
    const bodyCl = document.body.classList;
    bodyCl.remove("theme-high-contrast", "theme-dark");
    if (themeContrast === "high") bodyCl.add("theme-high-contrast");
    if (themeContrast === "dark") bodyCl.add("theme-dark");

    localStorage.setItem("a11y_fontSize", fontSizeScale);
    localStorage.setItem("a11y_theme", themeContrast);
  }, [fontSizeScale, themeContrast]);

  return (
    <A11yContext.Provider value={{ fontSizeScale, themeContrast, setFontSizeScale, setThemeContrast }}>
      {children}
    </A11yContext.Provider>
  );
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be used within an A11yProvider");
  return ctx;
}
