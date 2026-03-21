import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/client";
import { randomBytes } from "crypto";

/**
 * Neon database client is used for all queries
 */

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

    // Decode the token
    let userId: string;
    try {
      const tokenPayload = JSON.parse(
        Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString()
      );
      userId = tokenPayload.userId;

      if (!userId) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid token format" },
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

    // Add user to the organization as a member
    await sql`
      INSERT INTO team_members (user_id, organization_id, role, status, invited_by)
      VALUES (${userId}, ${invitation.organization_id}, 'Member', 'active', ${invitation.invited_by})
    `;

    // Update the invitation status
    await sql`
      UPDATE team_invitations SET status = 'accepted' WHERE id = ${invitation.id}
    `;

    // Update user profile with organization
    await sql`
      UPDATE profiles SET org = ${invitation.organization_id} WHERE id = ${userId}
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
