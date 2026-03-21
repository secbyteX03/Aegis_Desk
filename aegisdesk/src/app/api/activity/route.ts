import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/client';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Get recent timeline events as general activity
        const timelineEventsResult = await sql`
      SELECT 
        t.id,
        t.incident_id,
        t.actor,
        t.actor_type,
        t.event_type,
        t.message,
        t.timestamp,
        i.title as incident_title
      FROM timeline_events t
      LEFT JOIN incidents i ON t.incident_id = i.id
      ORDER BY t.timestamp DESC
      LIMIT 20
    `;

        // Also get agent activities
        const agentsResult = await sql`
      SELECT 
        id,
        name,
        specialty,
        status,
        current_task,
        progress,
        last_heartbeat
      FROM agents
      ORDER BY last_heartbeat DESC
      LIMIT 10
    `;

        const timelineEvents = timelineEventsResult;
        const agents = agentsResult;

        // Combine timeline events into activities
        const activities = timelineEvents.map(event => ({
            id: event.id,
            type: event.actor_type || 'system',
            agent: event.actor_type === 'agent' ? event.actor : null,
            action: event.event_type || 'update',
            message: event.message || `Event on ${event.incident_title || 'incident'}`,
            incidentId: event.incident_id,
            incidentTitle: event.incident_title,
            timestamp: event.timestamp,
            status: event.event_type === 'resolved' ? 'completed' : 'in_progress'
        }));

        // Add agent status as activities
        agents.forEach(agent => {
            activities.push({
                id: `agent-${agent.id}`,
                type: 'agent',
                agent: agent.name,
                action: agent.status,
                message: agent.current_task || `${agent.name} is ${agent.status}`,
                incidentId: null,
                incidentTitle: null,
                timestamp: agent.last_heartbeat || new Date().toISOString(),
                status: agent.status === 'working' ? 'in_progress' : 'idle',
                progress: agent.progress
            });
        });

        // Sort by timestamp descending
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({
            activities: activities.slice(0, 20),
            agentCount: agents.length,
            eventCount: timelineEvents.length
        });
    } catch (error) {
        console.error('[Activity] Error:', error);
        // Return empty data instead of mock data - this ensures no demo data is shown
        return NextResponse.json({
            activities: [],
            agentCount: 0,
            eventCount: 0,
            source: 'empty',
            error: 'Database unavailable'
        });
    }
}
