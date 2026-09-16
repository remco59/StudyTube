import { NextRequest, NextResponse } from "next/server";

import { constantTimeStringEqual, parseBasicAuthorization } from "./lib/basicAuth";
import { isTrustedStateChangingRequest } from "./lib/csrf";

const AUTH_USER = process.env.STUDYTUBE_AUTH_USER?.trim() || "admin";
const AUTH_PASSWORD = process.env.STUDYTUBE_AUTH_PASSWORD;

function unauthorizedResponse() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="StudyTube", charset="UTF-8"',
    },
  });
}

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function getRequestOrigin(request: NextRequest): string {
  const host = firstForwardedValue(request.headers.get("x-forwarded-host")) ?? request.headers.get("host");
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ?? request.nextUrl.protocol.replace(/:$/, "");

  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  if (!AUTH_PASSWORD) {
    return new NextResponse(
      "StudyTube authentication is not configured. Set STUDYTUBE_AUTH_PASSWORD and restart the app.",
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const credentials = parseBasicAuthorization(request.headers.get("authorization"));
  if (
    !credentials ||
    !constantTimeStringEqual(credentials.username, AUTH_USER) ||
    !constantTimeStringEqual(credentials.password, AUTH_PASSWORD)
  ) {
    return unauthorizedResponse();
  }

  if (
    !isTrustedStateChangingRequest({
      method: request.method,
      pathname: request.nextUrl.pathname,
      requestOrigin: getRequestOrigin(request),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    return new NextResponse("Cross-site state-changing requests are not allowed.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
