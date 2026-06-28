// Cryptographically secure token generation + hashing for invitations and
// password resets.
//
// The raw token is 32 bytes (256 bits) from the platform CSPRNG, base64url-
// encoded so it's safe in a URL with no escaping. Only its SHA-256 hash is ever
// persisted; lookups recompute the hash and match on it. Because the token is
// already high-entropy (unlike a password), an unsalted SHA-256 is the correct,
// standard choice for a fast indexed lookup with no replay value if leaked.

/** Generate a 256-bit URL-safe random token (the raw secret for the email). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 hex digest of a raw token — the only form stored in the database. */
export async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
