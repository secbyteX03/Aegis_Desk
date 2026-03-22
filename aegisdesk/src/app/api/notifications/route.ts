import { NextRequest, NextResponse } from "next/server";
import { hybridQuery, isNeonConfigured } from "@/lib/hybrid-db";

/**
 * GET /api/notifications
 * Fetch notifications for the user using hybrid database (Neon + local fallback)
 * Uses x-user-id header or Authorization header for user identification
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from header - check x-user-id first, then try to extract from Authorization header
    let userId = request.headers.get("x-user-id");

    // If no x-user-id, try to extract from Authorization header (Bearer token)
    if (!userId) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        try {
          // Try to decode token payload - it's base64 encoded JSON
          const payload = JSON.parse(Buffer.from(token, "base64").toString());
          userId = payload.userId || payload.sub || "demo-user-001";
        } catch {
          // If token decode fails, use default
          userId = "demo-user-001";
        }
      }
    }

    // Fallback to default user
    userId = userId || "demo-user-001";

    // Try to fetch notifications using hybrid query (Neon with local fallback)
    try {
      const result = await hybridQuery('notifications', {
        where: { user_id: userId },
        orderBy: 'created_at DESC',
        limit: 50
      });

      if (result.data && result.data.length > 0) {
        const notifications = result.data.map((n: any) => ({
          id: n.id,
          type: n.type,
          message: n.message,
          created_at: n.created_at,
          read: n.read,
          invite_token: n.invite_token,
          organization_id: n.organization_id,
          organization_name: n.organization_name
        }));

        return NextResponse.json({
          notifications,
          source: result.source
        });
      }

      // No notifications found
      return NextResponse.json({
        notifications: [],
        source: result.source
      });

    } catch (dbError) {
      console.error('[Notifications] Database query error:', dbError);
      // Return empty notifications on error instead of 401
      return NextResponse.json({
        notifications: [],
        source: 'local',
        warning: 'Using local storage'
      });
    }

  } catch (error) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json({
      notifications: [],
      error: 'Failed to fetch notifications'
    }, { status: 200 });
  }
}

/**
 * POST /api/notifications
 * Create a new notification (for team invites, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, type, message, invite_token, organization_id, organization_name } = body;

    if (!user_id || !type || !message) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id,
      type,
      message,
      invite_token: invite_token || null,
      organization_id: organization_id || null,
      organization_name: organization_name || null,
      read: 0,
      created_at: new Date().toISOString()
    };

    // For now, return success - in production, save to database
    return NextResponse.json({
      success: true,
      notification
    });

  } catch (error) {
    console.error('[Notifications] POST Error:', error);
    return NextResponse.json({
      error: 'Failed to create notification'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_ids } = body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json({
        error: 'Missing notification_ids'
      }, { status: 400 });
    }

    // In production, update the database
    return NextResponse.json({
      success: true,
      updated: notification_ids.length
    });

  } catch (error) {
    console.error('[Notifications] PATCH Error:', error);
    return NextResponse.json({
      error: 'Failed to update notifications'
    }, { status: 500 });
  }
}
