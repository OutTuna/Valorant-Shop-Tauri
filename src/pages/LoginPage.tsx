import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  useTranslation,
  useLanguage,
  type SupportedLanguage,
} from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  saveStoredSession,
  saveStoredRegion,
  readStoredRegion,
  type ShopSession,
} from "@/lib/valorant";

const REGIONS = ["auto", "na", "eu", "ap", "kr", "br", "latam", "pbe"];

const LANG_FLAGS: { code: SupportedLanguage; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "uk", flag: "🇺🇦", label: "Українська" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "pl", flag: "🇵🇱", label: "Polski" },
];

type LocationState = { error?: string } | null;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeError = (location.state as LocationState)?.error ?? null;

  const t = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [region, setRegion] = useState("auto");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  // Initialise error with any message passed via router state
  // (e.g. a failed deep-link login attempt from DeepLinkListener).
  const [error, setError] = useState<string | null>(routeError);

  // Restore the previously used region from persistent storage.
  useEffect(() => {
    readStoredRegion().then(setRegion);
  }, []);

  // Persist region whenever the user changes it.
  const handleRegionChange = (r: string) => {
    setRegion(r);
    saveStoredRegion(r);
  };

  const submitBrowserLogin = async () => {
    const raw = token.trim();
    if (!raw) return;

    const match =
      raw.match(/access_token=([^&#]+)/) ||
      raw.match(/^(ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    const accessToken = match ? decodeURIComponent(match[1]) : raw;

    setLoading(true);
    setError(null);
    try {
      const session = await invoke<ShopSession>("token_login", {
        accessToken,
        region,
      });
      await saveStoredSession(session);
      navigate("/", { replace: true });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const openRiotLogin = () => {
    void openUrl(
      "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20ban%20link%20lol%20offline_access%20openid"
    );
  };

  return (
    <main className="min-h-screen bg-theme-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="h-1 w-8 rounded-full" style={{ background: "var(--accent-red)" }} />
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "🌙" : theme === "white" ? "⚪" : "☕"}
            </button>
            {LANG_FLAGS.map(({ code, flag, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`lang-btn${language === code ? " active" : ""}`}
                title={label}
                aria-label={label}
              >
                {flag}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-theme-primary">{t("loginTitle")}</h1>
          <p className="mt-2 text-sm text-theme-secondary">{t("loginDesc")}</p>
        </div>

        {/* Region selector */}
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-theme-secondary">
            {t("loginRegion")}
          </label>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => handleRegionChange(r)}
                className={`rounded-md border px-3 py-1.5 text-xs font-mono uppercase transition-colors ${
                  region === r
                    ? "border-red-500/60 bg-red-500/10 text-accent-red"
                    : "border-theme bg-theme-elevated text-theme-secondary hover:border-theme-subtle"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Browser fallback */}
        <div className="space-y-3">
          <button
            onClick={openRiotLogin}
            className="w-full rounded-xl border border-theme bg-theme-surface py-3 text-sm font-medium text-theme-primary transition-all hover:border-red-500/40 hover:bg-red-500/5"
          >
            {t("loginBrowserBtn")}
          </button>

          <label className="block text-xs font-medium uppercase tracking-wider text-theme-secondary">
            {t("loginPasteLabel")}
          </label>
          <textarea
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setError(null);
            }}
            rows={3}
            className="w-full resize-none rounded-xl border border-theme bg-theme-input px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted focus:border-red-500/40 focus:outline-none"
            placeholder="https://playvalorant.com/opt_in#access_token=..."
          />

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-accent-red">
              {error}
            </p>
          )}

          <button
            onClick={submitBrowserLogin}
            disabled={loading || !token.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--accent-red)" }}
          >
            {loading ? t("loginPasteBtnLoading") : t("loginPasteBtn")}
          </button>
        </div>

        {/* Notes */}
        <p className="text-center text-xs text-theme-muted">{t("loginNote")}</p>
        <p className="rounded-xl border border-theme-subtle bg-theme-surface px-4 py-3 text-xs text-theme-secondary leading-relaxed">
          {t("loginDeepLinkTip")}
        </p>
      </div>
    </main>
  );
}
