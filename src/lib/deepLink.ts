/**
 * Riot's redirect carries the token in a URL fragment, e.g.
 *   valorant-store://auth#access_token=...&token_type=Bearer&...
 * or, if someone pastes the original Riot URL with the scheme swapped:
 *   valorant-store://auth?access_token=...
 *
 * This mirrors the same regex-based extraction used for the manual
 * paste flow in LoginPage, so both paths accept the same input shapes.
 */
export function extractAccessToken(url: string): string | null {
  const match = url.match(/access_token=([^&]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
