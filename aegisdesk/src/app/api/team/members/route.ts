import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/client";

/**
 * Neon database client is used for all queries
 */

/**
 * GET /api/team/members
 * List all members of the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Decode the token
    try {
      const tokenPayload = JSON.parse(
        Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString()
      );
      const userId = tokenPayload.userId;

      if (!userId) {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }

      // Get user's organization from profile
      const profileResult = await sql`
        SELECT org FROM profiles WHERE id = ${userId}
      `;
      const profile = profileResult[0];

      if (!profile?.org) {
        return NextResponse.json(
          { error: "You are not part of any organization" },
          { status: 400 }
        );
      }

      // Validate that org is a valid UUID (not a legacy string like "My Team")
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(profile.org)) {
        return NextResponse.json(
          { error: "Invalid organization configuration. Please contact support." },
          { status: 400 }
        );
      }

      // Get all team members from team_members table
      const membersResult = await sql`
        SELECT * FROM team_members 
        WHERE organization_id = ${profile.org} 
        AND status IN ('active', 'confirmed')
        ORDER BY created_at ASC
      `;

      const members = membersResult as unknown as Array<{
        id: string;
        user_id: string;
        organization_id: string;
        role: string;
        status: string;
        invited_by: string | null;
        created_at: Date;
      }>;

      // Add "isCurrentUser" flag to each member
      const membersWithFlag = (members || []).map((member: any) => ({
        ...member,
        isCurrentUser: member.user_id === userId,
      }));

      // Also get pending invitations
      const invitationsResult = await sql`
        SELECT * FROM team_invitations 
        WHERE organization_id = ${profile.org} 
        AND status = 'pending'
        ORDER BY created_at ASC
      `;

      const invitations = invitationsResult as unknown as Array<{
        id: string;
        email: string;
        organization_id: string;
        status: string;
        created_at: Date;
      }>;

      return NextResponse.json({
        members: membersWithFlag,
        pendingInvitations: invitations || [],
        currentUserId: userId,
      });
    } catch (e) {
      console.error("[Team Members] Token decode error:", e);
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("[Team Members] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members
 * Remove a team member from the organization
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Decode the token
    try {
      const tokenPayload = JSON.parse(
        Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString()
      );
      const userId = tokenPayload.userId;

      if (!userId) {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }

      const body = await request.json();
      const { memberId } = body;

      if (!memberId) {
        return NextResponse.json(
          { error: "Member ID is required" },
          { status: 400 }
        );
      }

      // Get user's organization from profile
      const profileResult = await sql`
        SELECT org FROM profiles WHERE id = ${userId}
      `;
      const profile = profileResult[0];

      if (!profile?.org) {
        return NextResponse.json(
          { error: "You are not part of any organization" },
          { status: 400 }
        );
      }

      // Get the member to be deleted
      const memberResult = await sql`
        SELECT * FROM team_members 
        WHERE id = ${memberId} 
        AND organization_id = ${profile.org}
        AND status IN ('active', 'confirmed')
      `;
      const member = memberResult[0] as any;

      if (!member) {
        console.log("[Team Delete] Member not found. ID:", memberId, "Org:", profile.org);
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }

      // Get user's role to check permissions
      const currentUserResult = await sql`
        SELECT role, organization_id FROM team_members 
        WHERE user_id = ${userId}
        AND status IN ('active', 'confirmed')
        LIMIT 1
      `;
      const currentUserMember = currentUserResult[0] as any;

      // Check if user is owner of the organization
      const orgResult = await sql`
        SELECT owner_id FROM organizations WHERE id = ${member.organization_id}
      `;
      const organization = orgResult[0] as any;

      const isOrgOwner = organization?.owner_id === userId;
      const isInviter = member.invited_by === userId;
      const isCurrentUserMember = currentUserMember?.role === "Owner" || currentUserMember?.role === "Admin";

      // Allow deletion if user is org owner, the inviter, or has Admin role
      if (!isOrgOwner && !isInviter && !isCurrentUserMember) {
        return NextResponse.json(
          { error: "You don't have permission to remove this team member" },
          { status: 403 }
        );
      }

      // Don't allow deleting yourself
      if (member.user_id === userId) {
        return NextResponse.json(
          { error: "You cannot remove yourself from the team" },
          { status: 400 }
        );
      }

      // Delete the member
      await sql`
        DELETE FROM team_members WHERE id = ${memberId}
      `;

      return NextResponse.json({
        success: true,
        message: "Team member removed successfully",
      });
    } catch (e) {
      console.error("[Team Delete] Token decode error:", e);
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("[Team Delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
