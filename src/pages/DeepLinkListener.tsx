import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

import { extractAccessToken } from "@/lib/deepLink";
import { saveStoredSession, type ShopSession } from "@/lib/valorant";

export default function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const handleUrls = async (urls: string[]) => {
      const region = window.sessionStorage.getItem("valorant-region") || "auto";
      for (const url of urls) {
        const accessToken = extractAccessToken(url);
        if (!accessToken) continue;

        try {
          const session = await invoke<ShopSession>("token_login", {
            accessToken,
            region,
          });
          if (cancelled) return;
          saveStoredSession(session);
          navigate("/");
        } catch (error) {
          console.error("Deep link login failed:", error);
        }
        return;
      }
    };

    // Cold-start check.
    getCurrent()
      .then((urls) => {
        if (urls && urls.length > 0) {
          void handleUrls(urls);
        }
      })
      .catch(() => {});

    const unlistenPromise = onOpenUrl((urls) => {
      void handleUrls(urls);
    });

    return () => {
      cancelled = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [navigate]);

  return null;
}
