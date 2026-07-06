import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import { invoke } from "@tauri-apps/api/core";
import { saveStoredSession, readStoredRegion, type ShopSession } from "@/lib/valorant";

function extractToken(url: string): string | null {
  const match = url.match(/access_token=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const handleUrl = async (url: string) => {
      const accessToken = extractToken(url);
      if (!accessToken) return;

      const region = await readStoredRegion();

      try {
        const session = await invoke<ShopSession>("token_login", {
          accessToken,
          region,
        });
        if (cancelled) return;
        await saveStoredSession(session);
        navigate("/", { replace: true });
      } catch (e) {
        if (cancelled) return;
        // Show the error on the login page so the user knows what happened.
        navigate("/login", {
          replace: true,
          state: {
            error: `Deep link login failed: ${String(e)}. Please paste the URL manually.`,
          },
        });
      }
    };

    // Handle a deep-link URL that was present when the app cold-started
    // (e.g. the user double-clicked the scheme link while the app was closed).
    getCurrent()
      .then((urls) => {
        if (!cancelled && urls && urls.length > 0) {
          void handleUrl(urls[0]);
        }
      })
      .catch(() => {});

    // Handle deep-link URLs that arrive while the app is already running.
    let unlisten: (() => void) | undefined;
    onOpenUrl((urls) => {
      if (!cancelled && urls.length > 0) {
        void handleUrl(urls[0]);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);

  // This component is mounted at the root level and renders nothing.
  return null;
}
