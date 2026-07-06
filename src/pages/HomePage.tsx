import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  useTranslation,
  useLanguage,
  type SupportedLanguage,
} from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  clearStoredSession,
  readStoredSession,
  type ShopItem,
  type ShopSession,
} from "@/lib/valorant";

/* ─── Helpers ───────────────────────────────────── */

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function calcRemaining(original: number, loadTime: number): number {
  const elapsed = Math.floor((Date.now() - loadTime) / 1000);
  return Math.max(0, original - elapsed);
}

function formatPrice(value: number | undefined | null): string {
  if (value == null) return "--";
  return value.toLocaleString();
}

// In a Tauri webview a plain <a target="_blank"> just gets swallowed —
// openUrl() hands the URL to the OS's default browser instead.
function searchSkinOnGoogle(name: string) {
  void openUrl(`https://www.google.com/search?q=Valorant+${encodeURIComponent(name)}`);
}

/* ─── Language flags config ─────────────────────── */

const LANG_FLAGS: { code: SupportedLanguage; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "uk", flag: "🇺🇦", label: "Українська" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "pl", flag: "🇵🇱", label: "Polski" },
];

/* ─── Unified SkinCard ──────────────────────────── */

type CardVariant = "daily" | "night";
type TFn = ReturnType<typeof useTranslation>;

function SkinCard({
  item,
  loadTime,
  t,
  variant,
}: {
  item: ShopItem;
  loadTime: number;
  t: TFn;
  variant: CardVariant;
}) {
  const remaining = calcRemaining(item.remaining, loadTime);
  const isNight = variant === "night";

  const badge = isNight
    ? `-${item.discountPercent ?? 0}%`
    : item.discountPercent
    ? `-${item.discountPercent}%`
    : t("daily");

  return (
    <article className="shop-card">
      {/* Title + badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="card-title text-theme-primary">{item.name}</h3>
        <span
          className="card-badge"
          style={
            isNight
              ? {
                  color: "var(--accent-purple)",
                  background: "rgba(168,85,247,0.08)",
                  borderColor: "rgba(168,85,247,0.25)",
                }
              : {}
          }
        >
          {badge}
        </span>
      </div>

      {/* Skin image — clicking searches Google */}
      <button
        onClick={() => searchSkinOnGoogle(item.name)}
        className="rounded-lg border border-theme-subtle overflow-hidden flex items-center justify-center bg-theme-base block w-full transition-transform hover:scale-[1.02] cursor-pointer"
        style={{ aspectRatio: "16/9" }}
        title={`Search ${item.name} on Google`}
        aria-label={`Search ${item.name} on Google`}
      >
        <img
          src={item.image}
          alt={item.name}
          className="max-h-full max-w-full object-contain"
        />
      </button>

      {/* Price row */}
      {isNight ? (
        <div className="mt-4 text-sm">
          <div className="text-theme-secondary line-through">
            {formatPrice(item.originalPrice)} VP
          </div>
          <div className="font-bold text-accent-gold">
            {formatPrice(item.discountedPrice)} VP
          </div>
          <div className="mt-1 text-theme-muted">
            {t("endingIn")} {formatDuration(remaining)}
          </div>
        </div>
      ) : (
        <div className="card-price-row">
          <div className="text-theme-secondary text-sm">
            {item.originalPrice != null ? (
              <span className="line-through">
                {formatPrice(item.originalPrice)} VP
              </span>
            ) : (
              <span>
                {t("updatingIn")} {formatDuration(remaining)}
              </span>
            )}
          </div>
          <div className="font-bold text-accent-gold">
            {formatPrice(item.discountedPrice ?? item.price)} VP
          </div>
        </div>
      )}
    </article>
  );
}

/* ─── Night market placeholder ──────────────────── */

function NightMarketPlaceholder({ t }: { t: TFn }) {
  return (
    <div className="night-placeholder">
      <div
        style={{
          fontSize: "3.5rem",
          marginBottom: "1rem",
          filter: "drop-shadow(0 0 24px rgba(168,85,247,0.5))",
        }}
      >
        🌙
      </div>
      <h3
        className="text-xl font-bold mb-2"
        style={{ color: "var(--accent-purple)" }}
      >
        {t("nightMarketUnavailable")}
      </h3>
      <p className="text-theme-secondary text-sm max-w-xs">
        {t("nightMarketUnavailableDesc")}
      </p>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────── */

export default function HomePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ShopSession | null>(null);
  const [, setTick] = useState(0);
  // loadTimeRef holds the timestamp from when the session was originally
  // fetched (possibly in a previous run). This keeps timers accurate across
  // app restarts.
  const loadTimeRef = useRef<number>(0);
  const t = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    readStoredSession().then((stored) => {
      if (!stored) {
        navigate("/login", { replace: true });
      } else {
        setSession(stored.session);
        loadTimeRef.current = stored.loadedAt;
      }
    });
  }, [navigate]);

  // Tick every second so countdown timers re-render.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  const handleLogout = () => {
    clearStoredSession();
    navigate("/login", { replace: true });
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-theme-base flex items-center justify-center text-theme-primary">
        <div className="text-center space-y-4">
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{
              borderRightColor: "var(--accent-red)",
              borderBottomColor: "var(--accent-red)",
              borderLeftColor: "var(--accent-red)",
            }}
          />
          <p className="text-theme-secondary text-sm">{t("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-theme-base p-6 md:p-10 text-theme-primary">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-10 flex flex-col gap-4 rounded-2xl border border-theme bg-theme-surface p-6 shadow-xl md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">
            {session.player.name}
            <span className="ml-2 text-theme-muted">{session.player.tag}</span>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-accent-red">
            {t("region")} {session.region.toUpperCase()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-lg border border-theme bg-theme-base px-4 py-2 font-mono font-bold text-accent-gold">
            {formatPrice(session.player.vp)} {t("vp")}
          </div>

          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={
              t("theme") +
              ": " +
              t(
                ("theme" +
                  theme.charAt(0).toUpperCase() +
                  theme.slice(1)) as keyof ReturnType<typeof useTranslation> extends (
                  k: infer K
                ) => string
                  ? K
                  : never
              )
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "🌙" : theme === "white" ? "⚪" : "☕"}
          </button>

          <div className="flex items-center gap-1">
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

          <button
            onClick={handleLogout}
            className="rounded-lg border border-theme px-4 py-2 text-sm text-theme-secondary transition-colors hover:border-red-500/40 hover:text-accent-red"
          >
            {t("logout")}
          </button>
        </div>
      </header>

      {/* Daily shop */}
      <section className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--accent-red)" }}
          />
          <h2 className="text-xl font-bold uppercase tracking-wider text-theme-primary">
            {t("dailyShop")}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {session.shop.daily.map((item) => (
            <SkinCard
              key={item.uuid}
              item={item}
              loadTime={loadTimeRef.current}
              t={t}
              variant="daily"
            />
          ))}
        </div>
      </section>

      {/* Night market */}
      <section className="max-w-7xl mx-auto mt-12">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--accent-purple)" }}
          />
          <h2 className="text-xl font-bold uppercase tracking-wider text-theme-primary">
            {t("nightMarket")}
          </h2>
        </div>

        {session.shop.night.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {session.shop.night.map((item) => (
              <SkinCard
                key={item.uuid}
                item={item}
                loadTime={loadTimeRef.current}
                t={t}
                variant="night"
              />
            ))}
          </div>
        ) : (
          <NightMarketPlaceholder t={t} />
        )}
      </section>
    </main>
  );
}
