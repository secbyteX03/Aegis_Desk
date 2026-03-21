import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

// Secret key for JWT signing - MUST be at least 32 characters
// Use JWT_SECRET consistently across all auth routes
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "aegisdesk-secret-key-change-in-production-min-32-chars"
);

// PowerSync URL from environment
const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL || "https://69b02e9f549ff47bf1e3fbb7.powersync.journeyapps.com";

// Token expiry time - PowerSync tokens should be short-lived
const TOKEN_EXPIRY = "1h";

/**
 * Generate a JWT token for PowerSync authentication
 */
async function generateToken(payload: object): Promise<string> {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify a JWT token
 */
async function verifyToken(token: string): Promise<object | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/token
 * PowerSync calls this to get authentication credentials
 * Returns { token, powersync_url } - the format PowerSync expects
 */
export async function GET(request: NextRequest) {
  try {
    // For development, use a static user ID
    // In production, get the user ID from your auth session
    const userId = request.headers.get("x-user-id") || "demo-user-001";

    console.log("[Auth Token] Generating token for user:", userId);

    // Generate token with user info
    const token = await generateToken({
      sub: userId, // 'sub' is required by PowerSync
      userId,
      type: "powersync",
    });

    return NextResponse.json({
      token,
      powersync_url: POWERSYNC_URL,
    });
  } catch (error) {
    console.error("[Auth Token] Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate token", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/token
 * Generate a new authentication token (for manual use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    // Generate token with user info
    const token = await generateToken({
      userId,
      email: email || "",
      role: role || "user",
      type: "powersync",
    });

    return NextResponse.json({
      token,
      powersync_url: POWERSYNC_URL,
      expiresIn: TOKEN_EXPIRY,
    });
  } catch (error) {
    console.error("[Auth Token] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
