import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/client";

interface Profile {
  id: string;
  email: string;
  org: string | null;
}

/**
 * DELETE /api/cleanup
 * Clean up demo data and old profiles for a fresh start
 * Use with caution - this deletes all incidents, timeline events, and resets profiles
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, confirm } = body;

    if (!confirm || confirm !== "yes-delete-all") {
      return NextResponse.json(
        { error: "Please provide { confirm: 'yes-delete-all' } to confirm deletion" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user's profile to find their organization
    const profileResult: any = await sql`
      SELECT id, email, org FROM profiles WHERE id = ${userId}
    `;
    const profile = profileResult[0] as Profile | undefined;

    // Delete timeline events for this user's organization
    if (profile?.org) {
      await sql`
        DELETE FROM timeline_events WHERE organization_id = ${profile.org}
      `;

      // Delete incidents for this organization
      await sql`
        DELETE FROM incidents WHERE created_by = ${userId}
      `;
    }

    // Delete the user's profile (they'll need to re-register)
    await sql`
      DELETE FROM profiles WHERE id = ${userId}
    `;

    // Delete team memberships
    await sql`
      DELETE FROM team_members WHERE user_id = ${userId}
    `;

    // Delete organization if user owns it
    if (profile?.org) {
      await sql`
        DELETE FROM organizations WHERE id = ${profile.org}
      `;

      await sql`
        DELETE FROM team_members WHERE organization_id = ${profile.org}
      `;

      await sql`
        DELETE FROM team_invitations WHERE organization_id = ${profile.org}
      `;
    }

    // Note: We cannot delete from Neon auth directly as it requires special handling
    // The user will need to contact support or use Neon console to delete auth users

    return NextResponse.json({
      success: true,
      message: "User data deleted successfully. Please re-register.",
      deletedProfile: profile?.email
    });

  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cleanup
 * Check cleanup status
 */
export async function GET() {
  return NextResponse.json({
    message: "Send POST with { userId: 'uuid', confirm: 'yes-delete-all' } to delete user data"
  });
}
