import { NextRequest, NextResponse } from "next/server";
import { NeonAuth } from "@/lib/neon-auth";

/**
 * POST /api/auth/register
 * Register a new user with email and password using Neon
 * Also creates an organization for the user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, organizationName, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Register user with Neon
    const result = await NeonAuth.register({
      email,
      password,
      fullName,
      organizationName,
      role,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Registration failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      token: result.token,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.full_name,
        organizationId: result.profile?.organization_id,
        organizationName: result.organization?.name,
        role: result.profile?.role,
      },
      message: result.organization
        ? "Account and organization created successfully"
        : "Account created successfully",
    });
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
