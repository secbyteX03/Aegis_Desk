import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/client";
import { NeonAuth } from "@/lib/neon-auth";
import { randomBytes } from "crypto";

/**
 * Neon database client is used for all queries
 */

/**
 * GET /api/team/accept
 * Verify an invitation token (used by invite page)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Find the invitation using Neon SQL
    const invitationResult = await sql`
      SELECT * FROM team_invitations 
      WHERE token = ${token} AND status = 'pending'
    `;
    const invitation = invitationResult[0] as any;

    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Get organization name
    const orgResult = await sql`
      SELECT name FROM organizations WHERE id = ${invitation.organization_id}
    `;
    const organization = orgResult[0] as any;

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: organization?.name || "Unknown Organization",
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("[Team Accept] GET Error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to verify invitation" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/accept
 * Accept a team invitation and join the organization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Find the invitation using Neon SQL
    const invitationResult = await sql`
      SELECT * FROM team_invitations 
      WHERE token = ${token} AND status = 'pending'
    `;
    const invitation = invitationResult[0] as any;

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Get the authorization header to identify the current user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "You must be logged in to accept an invitation" },
        { status: 401 }
      );
    }

    // Verify the auth token using NeonAuth
    const authToken = authHeader.replace("Bearer ", "");
    const authResult = await NeonAuth.verifyToken(authToken);

    if (!authResult.success) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const userId = authResult.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid user" },
        { status: 401 }
      );
    }

    // Get profile for name
    const profileResult = await sql`
      SELECT full_name, email FROM profiles WHERE id = ${userId}
    `;
    const profile = profileResult[0] as any;

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check if user already has an organization
    const existingMemberResult = await sql`
      SELECT id FROM team_members WHERE user_id = ${userId}
    `;

    if (existingMemberResult.length > 0) {
      return NextResponse.json(
        { error: "You are already a member of an organization" },
        { status: 400 }
      );
    }

    // Add user to the organization as a member (include all required fields)
    const memberId = randomBytes(16).toString("hex");
    await sql`
      INSERT INTO team_members (id, user_id, organization_id, email, name, full_name, role, status, invited_by, joined_at, created_at, updated_at)
      VALUES (${memberId}, ${userId}, ${invitation.organization_id}, ${profile.email}, ${profile.full_name || 'User'}, ${profile.full_name || 'User'}, ${invitation.role || 'Member'}, 'active', ${invitation.invited_by}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${new Date().toISOString()})
    `;

    // Update the invitation status
    await sql`
      UPDATE team_invitations SET status = 'accepted' WHERE id = ${invitation.id}
    `;

    // Update user profile with organization
    await sql`
      UPDATE profiles SET organization_id = ${invitation.organization_id} WHERE id = ${userId}
    `;

    // Get organization name
    const orgResult = await sql`
      SELECT name FROM organizations WHERE id = ${invitation.organization_id}
    `;
    const organization = orgResult[0] as any;

    return NextResponse.json({
      success: true,
      message: `You have joined ${organization?.name || 'the organization'}`,
      organizationId: invitation.organization_id,
      organizationName: organization?.name,
    });
  } catch (error) {
    console.error("[Team Accept] Error:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
