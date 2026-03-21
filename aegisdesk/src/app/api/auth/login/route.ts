import { NextRequest, NextResponse } from "next/server";
import { NeonAuth } from "@/lib/neon-auth";

/**
 * POST /api/auth/login
 * Authenticate user with email and password using Neon
 * Also supports OAuth providers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, provider } = body;

    // Handle OAuth providers (Google, GitHub)
    if (provider && ["google", "github"].includes(provider)) {
      // For OAuth, we'll create a mock user for demo purposes
      // In production, this would redirect to OAuth flow
      const result = await NeonAuth.createOAuthUser({
        provider,
        providerAccountId: `${provider}-${Date.now()}`,
        email: `user@${provider}.com`,
        fullName: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        avatarUrl: `https://avatars.githubusercontent.com/${provider}`,
        providerUserData: {
          provider,
          login: `${provider}user`,
        },
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "OAuth login failed" },
          { status: 401 }
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
      });
    }

    // Handle email/password login
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Authenticate with Neon
    const result = await NeonAuth.login(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      token: result.token,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.full_name,
        avatarUrl: result.user?.avatar_url,
        organizationId: result.profile?.organization_id,
        organizationName: result.organization?.name,
        role: result.profile?.role,
      },
    });
  } catch (error) {
    console.error("[Login] Error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
