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
    // Apply classes to body
    const cl = document.body.classList;
    cl.remove("font-large", "font-xlarge", "theme-high-contrast", "theme-dark");

    if (fontSizeScale === "large") cl.add("font-large");
    if (fontSizeScale === "xlarge") cl.add("font-xlarge");
    if (themeContrast === "high") cl.add("theme-high-contrast");
    if (themeContrast === "dark") cl.add("theme-dark");

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
