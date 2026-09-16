const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function urlOrigin(value: string | null): string | null {
  if (!value || value === "null") return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export type CsrfRequestMetadata = {
  method: string;
  pathname: string;
  requestOrigin: string;
  origin: string | null;
  referer: string | null;
  secFetchSite: string | null;
};

export function isTrustedStateChangingRequest(metadata: CsrfRequestMetadata): boolean {
  if (!metadata.pathname.startsWith("/api/") || SAFE_METHODS.has(metadata.method.toUpperCase())) {
    return true;
  }

  const fetchSite = metadata.secFetchSite?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const expectedOrigin = urlOrigin(metadata.requestOrigin);
  if (!expectedOrigin) return false;

  const origin = urlOrigin(metadata.origin);
  if (metadata.origin !== null) {
    return origin === expectedOrigin;
  }

  const referer = urlOrigin(metadata.referer);
  if (metadata.referer !== null) {
    return referer === expectedOrigin;
  }

  // Modern browsers send Sec-Fetch-Site even when Origin/Referer is omitted.
  // Allow that explicit same-origin signal, but fail closed for requests with no
  // browser source metadata at all.
  return fetchSite === "same-origin" || fetchSite === "none";
}
