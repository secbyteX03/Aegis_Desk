import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/client';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Get agent statuses from the database
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
        `;

        // Get model/provider info from environment
        const useOpenAI = process.env.USE_OPENAI === 'true';
        const provider = useOpenAI ? 'openai' : 'gemini';

        // Transform agent data into status format
        const agents = agentsResult.map(agent => {
            // Determine if agent is online based on last heartbeat (within last 5 minutes)
            // If no heartbeat exists, default to online (agent was just initialized)
            const heartbeat = agent.last_heartbeat;
            const isOnline = heartbeat
                ? new Date(heartbeat).getTime() > Date.now() - 5 * 60 * 1000
                : true;

            return {
                id: agent.id,
                name: agent.name,
                status: agent.status || 'offline',
                progress: agent.progress || 0,
                provider: agent.provider || provider,
                currentTask: agent.current_task,
                lastHeartbeat: heartbeat,
                isOnline
            };
        });

        // Calculate overall status
        const workingCount = agents.filter(a => a.status === 'working').length;
        const errorCount = agents.filter(a => a.status === 'error').length;
        const onlineCount = agents.filter(a => a.isOnline).length;

        return NextResponse.json({
            agents,
            summary: {
                total: agents.length,
                online: onlineCount,
                working: workingCount,
                error: errorCount,
                offline: agents.length - onlineCount,
                provider
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[AgentStatus API] Error:', error);

        // Return default status if database unavailable
        return NextResponse.json({
            agents: [
                { id: 'triage', name: 'Triage-7', status: 'online', progress: 0, provider: 'openai', isOnline: true },
                { id: 'remedy', name: 'Remedy-3', status: 'online', progress: 0, provider: 'openai', isOnline: true },
                { id: 'comms', name: 'Comms-1', status: 'online', progress: 0, provider: 'openai', isOnline: true },
                { id: 'postmort', name: 'PostMort-2', status: 'online', progress: 0, provider: 'openai', isOnline: true }
            ],
            summary: {
                total: 4,
                online: 4,
                working: 0,
                error: 0,
                offline: 0,
                provider: 'openai'
            },
            timestamp: new Date().toISOString(),
            fallback: true
        });
    }
}
