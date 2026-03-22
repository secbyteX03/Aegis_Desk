import { NextRequest, NextResponse } from "next/server";
import { NeonAuth } from "@/lib/neon-auth";
import { sql } from "@/lib/neon/client";
import { randomBytes } from "crypto";
import { Resend } from "resend";

// Note: Database availability is handled through hybrid-db fallback
// No need for explicit Neon configuration check here

// Initialize Resend for sending emails
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Email sender address
const FROM_EMAIL = process.env.FROM_EMAIL || "AegisDesk <onboarding@resend.dev>";

// Helper function to generate UUID
function generateUUID(): string {
  return randomBytes(16).toString("hex");
}

/**
 * POST /api/team/invite
 * Send an invitation to join an organization
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify the token
    const token = authHeader.replace("Bearer ", "");
    const authResult = await NeonAuth.verifyToken(token);

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

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user's organization
    const profiles = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `;

    console.log("[Team Invite] Profile org:", profiles[0]?.organization_id);

    // Also check team_members table
    const teamMembers = await sql`
      SELECT * FROM team_members 
      WHERE user_id = ${userId} 
      AND organization_id = ${profiles[0]?.organization_id}
      AND status IN ('active', 'confirmed')
    `;

    console.log("[Team Invite] Team member org:", teamMembers[0]?.organization_id);

    // Use the org from profile or team member
    let orgId = teamMembers[0]?.organization_id || profiles[0]?.organization_id;

    if (orgId) {
      console.log("[Team Invite] Using organization:", orgId);

      // Ensure inviter is in team_members table
      if (teamMembers.length === 0) {
        console.log("[Team Invite] Adding inviter to team_members table");
        await sql`
          INSERT INTO team_members (id, user_id, organization_id, email, name, full_name, role, status, joined_at, created_at, updated_at)
          VALUES (${generateUUID()}, ${userId}, ${orgId}, ${profiles[0]?.email || ""}, ${profiles[0]?.full_name || "User"}, ${profiles[0]?.full_name || "User"}, ${"Owner"}, ${"active"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${new Date().toISOString()})
        `;
      }
    } else {
      // Create new organization if none exists
      console.log("[Team Invite] No organization found, creating new one");
      const newOrgId = generateUUID();
      await sql`
        INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
        VALUES (${newOrgId}, ${"My Organization"}, ${"my-organization-" + newOrgId.substring(0, 8)}, ${userId}, ${new Date().toISOString()}, ${new Date().toISOString()})
      `;

      orgId = newOrgId;
      // Update profile with correct org ID
      await sql`UPDATE profiles SET organization_id = ${orgId} WHERE id = ${userId}`;
      // Add user as team member
      await sql`
        INSERT INTO team_members (id, user_id, organization_id, email, name, full_name, role, status, joined_at, created_at, updated_at)
        VALUES (${generateUUID()}, ${userId}, ${orgId}, ${profiles[0]?.email || ""}, ${profiles[0]?.full_name || "User"}, ${profiles[0]?.full_name || "User"}, ${"Owner"}, ${"active"}, ${new Date().toISOString()}, ${new Date().toISOString()}, ${new Date().toISOString()})
      `;
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Failed to get or create organization" },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const existingUsers = await sql`
      SELECT id, email FROM users WHERE email = ${email.toLowerCase()}
    `;

    // Check for existing invitation
    const existingInvites = await sql`
      SELECT id, status FROM team_invitations 
      WHERE email = ${email.toLowerCase()} 
      AND organization_id = ${orgId} 
      AND status = 'pending'
    `;

    if (existingInvites.length > 0) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 409 }
      );
    }

    // Generate invitation token
    const invitationToken = generateUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation record
    const invitation = await sql`
      INSERT INTO team_invitations (id, organization_id, email, role, invited_by, token, status, expires_at, created_at)
      VALUES (${generateUUID()}, ${orgId}, ${email.toLowerCase()}, ${role || "member"}, ${userId}, ${invitationToken}, ${"pending"}, ${expiresAt.toISOString()}, ${new Date().toISOString()})
      RETURNING *
    `;

    // Get organization name for the notification
    const orgs = await sql`
      SELECT name FROM organizations WHERE id = ${orgId}
    `;

    // Check if invited user exists in the system
    const invitedUserProfiles = await sql`
      SELECT id FROM profiles WHERE id IN (SELECT id FROM users WHERE email = ${email.toLowerCase()})
    `;

    // If the invited user exists, create a notification for them
    if (invitedUserProfiles.length > 0) {
      await sql`
        INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at)
        VALUES (${generateUUID()}, ${invitedUserProfiles[0].id}, ${"team_invite"}, ${"Team Invitation"}, ${`You have been invited to join ${orgs[0]?.name || 'an organization'}`}, ${JSON.stringify({ invite_token: invitationToken, organization_id: orgId, organization_name: orgs[0]?.name || 'Unknown Organization' })}, ${false}, ${new Date().toISOString()})
      `;
    }

    // Generate invitation link
    const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173"}/invite/${invitationToken}`;

    // Send invitation email if Resend is configured
    if (resend) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [email],
          subject: `You're invited to join ${orgs[0]?.name || 'an organization'} on AegisDesk`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been invited!</h2>
              <p><strong>${authResult.user?.full_name || 'Someone'}</strong> has invited you to join <strong>${orgs[0]?.name || 'their organization'}</strong> on AegisDesk.</p>
              <p>Click the button below to accept the invitation:</p>
              <a href="${invitationLink}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a>
              <p>Or copy this link: <span style="color: #4F46E5;">${invitationLink}</span></p>
              <p style="color: #6B7280; font-size: 14px;">This invitation expires in 7 days.</p>
            </div>
          `,
        });
        console.log("[Team Invite] Email sent to:", email);
      } catch (emailError) {
        console.error("[Team Invite] Failed to send email:", emailError);
      }
    } else {
      console.log("[Team Invite] Email not sent - RESEND_API_KEY not configured");
      console.log("[Team Invite] Invitation link:", invitationLink);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation[0].id,
        email: invitation[0].email,
        role: invitation[0].role,
        expiresAt: invitation[0].expires_at,
      },
      message: "Invitation sent successfully. The invitee will receive an email with instructions to join.",
    });
  } catch (error) {
    console.error("[Team Invite] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: "Failed to send invitation: " + errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/invite
 * Cancel a pending invitation
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

    // Verify the token
    const token = authHeader.replace("Bearer ", "");
    const authResult = await NeonAuth.verifyToken(token);

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

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Get user's organization
    const profiles = await sql`
      SELECT organization_id FROM profiles WHERE id = ${userId}
    `;

    if (!profiles[0]?.organization_id) {
      return NextResponse.json(
        { error: "You are not part of any organization" },
        { status: 400 }
      );
    }

    // Delete the invitation
    await sql`
      DELETE FROM team_invitations 
      WHERE id = ${invitationId} 
      AND organization_id = ${profiles[0].organization_id}
    `;

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully",
    });
  } catch (error) {
    console.error("[Team Invite] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to cancel invitation" },
      { status: 500 }
    );
  }
}
