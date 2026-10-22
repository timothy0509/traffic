import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "tc";

const KEY = "hk-traffic:locale";

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "tc" || saved === "en") return saved;
  } catch { /* ignore */ }
  if (typeof navigator !== "undefined" && /^zh/i.test(navigator.language ?? "")) return "tc";
  return "en";
}

const Ctx = createContext<{ lang: Locale; setLang: (l: Locale) => void }>({ lang: "en", setLang: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(initial);
  const setLang = (l: Locale) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  };
  useEffect(() => {
    document.documentElement.lang = lang === "tc" ? "zh-Hant-HK" : "en";
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}

// Pick the localized variant of a record field. Conventions seen across
// DATA.GOV.HK feeds: _tc (KMB, GMB, Citybus, Sun Ferry...), _ch (Light Rail),
// _c (New Lantao Bus). Falls back to English, then the bare base key.
export function lf(obj: Record<string, unknown> | undefined | null, base: string, lang: Locale): string {
  if (!obj) return "";
  const v = (k: string) => {
    const x = obj[k];
    return typeof x === "string" || typeof x === "number" ? String(x) : "";
  };
  if (lang === "tc") {
    return v(`${base}_tc`) || v(`${base}_ch`) || v(`${base}_c`) || v(`${base}_en`) || v(`${base}_e`) || v(base);
  }
  return v(`${base}_en`) || v(`${base}_e`) || v(base) || v(`${base}_tc`) || v(`${base}_ch`) || v(`${base}_c`);
}
