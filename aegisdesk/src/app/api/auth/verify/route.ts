import { NextRequest, NextResponse } from "next/server";
import { NeonAuth } from "@/lib/neon-auth";

/**
 * POST /api/auth/verify
 * Verify a session token and return user data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify token with Neon
    const result = await NeonAuth.verifyToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Cast to any to handle potential type mismatches from NeonAuth
    const resultData = result as any;

    return NextResponse.json({
      valid: true,
      user: {
        id: resultData.user?.id,
        email: resultData.user?.email,
        name: resultData.user?.full_name,
        avatarUrl: resultData.user?.avatar_url,
        organizationId: resultData.profile?.organization_id,
        organizationName: resultData.organization?.name,
        role: resultData.profile?.role,
      },
    });
  } catch (error) {
    console.error("[Verify] Error:", error);
    return NextResponse.json(
      { error: "Token verification failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify
 * Check if token is valid (for middleware)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token with Neon
    const result = await NeonAuth.verifyToken(token);

    if (!result.success) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 401 }
      );
    }

    // Cast to any to handle potential type mismatches from NeonAuth
    const resultData = result as any;

    return NextResponse.json({
      valid: true,
      userId: resultData.user?.id,
      organizationId: resultData.profile?.organization_id,
    });
  } catch (error) {
    console.error("[Verify] GET Error:", error);
    return NextResponse.json(
      { valid: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
