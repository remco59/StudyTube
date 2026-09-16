import { NextRequest, NextResponse } from "next/server";

import { constantTimeStringEqual, parseBasicAuthorization } from "./lib/basicAuth";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
