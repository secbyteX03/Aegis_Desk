import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/client";
import { jwtVerify } from "jose";

// Use the same JWT secret as auth/token route for consistency
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "aegisdesk-secret-key-change-in-production-min-32-chars"
);

/**
 * Neon database client is used for all queries
 * The client is configured in src/lib/neon/client.ts
 */

// Helper function to verify JWT token
async function verifyToken(authHeader: string): Promise<string | null> {
  try {
    const token = authHeader.replace("Bearer ", "");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // The token contains user ID in the 'sub' claim
    return (payload.sub as string) || null;
  } catch (e) {
    console.error("[Notifications] Token verification failed:", e);
    return null;
  }
}

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
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

    // Verify the JWT token
    const userId = await verifyToken(authHeader);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check if Neon is configured
    if (!isNeonConfigured()) {
      return NextResponse.json({
        notifications: [],
        warning: "Database not configured"
      });
    }

    // Fetch notifications for the user using Neon SQL
    const result = await sql`
      SELECT id, type, message, created_at, read, invite_token, organization_id, organization_name
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const notifications = result as unknown as Array<{
      id: string;
      type: string;
      message: string;
      created_at: Date;
      read: number;
      invite_token: string | null;
      organization_id: string | null;
      organization_name: string | null;
    }>;

    // Transform notifications to the format expected by the frontend
    const transformedNotifications = (notifications || []).map(n => ({
      id: n.id,
      title: n.type === 'team_invite' ? 'Team Invitation' : 'Notification',
      message: n.message,
      time: new Date(n.created_at).toLocaleString(),
      read: n.read === 1,
      type: n.type === 'team_invite' ? 'warning' : 'info',
      inviteToken: n.invite_token,
      organizationId: n.organization_id,
      organizationName: n.organization_name,
    }));

    return NextResponse.json({
      notifications: transformedNotifications,
    });
  } catch (error: any) {
    // On network errors or Neon connection issues, return empty array instead of 500
    console.error("[Notifications] Error:", error?.message || error);

    // Check if it's a connection/network error - return empty notifications
    const isConnectionError = error?.message?.includes('fetch failed') ||
      error?.message?.includes('connect') ||
      error?.code === 'UND_ERR_CONNECT_TIMEOUT';

    if (isConnectionError) {
      return NextResponse.json({
        notifications: [],
        warning: "Notifications temporarily unavailable"
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * Mark notifications as read
 */
export async function PUT(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify the JWT token
    const userId = await verifyToken(authHeader);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    // Check if Neon is configured
    if (!isNeonConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    if (markAllRead) {
      // Mark all notifications as read using Neon
      await sql`
        UPDATE notifications 
        SET read = 1 
        WHERE user_id = ${userId} 
        AND read = 0
      `;
    } else if (notificationId) {
      // Mark single notification as read using Neon
      await sql`
        UPDATE notifications 
        SET read = 1 
        WHERE id = ${notificationId} 
        AND user_id = ${userId}
      `;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
