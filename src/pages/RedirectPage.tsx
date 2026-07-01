import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

import { saveStoredSession, type ShopSession } from "@/lib/valorant";
import { useTranslation } from "@/context/LanguageContext";

export default function RedirectPage() {
  const navigate = useNavigate();
  const t = useTranslation();

  useEffect(() => {
    const hash = window.location.hash || window.location.search;
    const match = hash.match(/access_token=([^&]+)/);

    if (!match?.[1]) {
      navigate("/login", { replace: true });
      return;
    }

    const accessToken = decodeURIComponent(match[1]);
    const region = window.sessionStorage.getItem("valorant-region") || "auto";

    (async () => {
      try {
        const session = await invoke<ShopSession>("token_login", {
          accessToken,
          region,
        });
        saveStoredSession(session);
        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center text-theme-primary">
      <div className="text-center space-y-4">
        <div
          className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{
            borderRightColor: "var(--accent-red)",
            borderBottomColor: "var(--accent-red)",
            borderLeftColor: "var(--accent-red)",
          }}
        />
        <p className="text-theme-secondary text-sm">{t("redirecting")}</p>
      </div>
    </div>
  );
}
