import { NextResponse } from 'next/server';
import { getSyncQueue } from '@/lib/hybrid-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const queue = getSyncQueue();

        // Calculate total data size
        const totalSize = queue.reduce((acc, item) => {
            return acc + JSON.stringify(item.data).length;
        }, 0);

        // Format queue items for display
        const items = queue.map(item => ({
            id: item.id,
            source: item.data.createdBy || item.data.source || 'User',
            actionType: item.operation,
            table: item.table,
            payload: item.data,
            payloadPreview: getPayloadPreview(item.data, item.table),
            timestamp: item.timestamp,
            retries: item.retries,
            status: item.retries > 0 ? 'conflict' : 'pending'
        }));

        return NextResponse.json({
            items,
            count: items.length,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize)
        });
    } catch (error) {
        console.error('[Sync Queue] Error:', error);
        return NextResponse.json({ items: [], count: 0, totalSize: 0, totalSizeFormatted: '0B' }, { status: 500 });
    }
}

function getPayloadPreview(data: Record<string, unknown>, table: string): string {
    if (table === 'incidents') {
        return (data.title as string) || (data.description as string)?.substring(0, 50) || 'New incident';
    }
    if (table === 'timeline_events') {
        return (data.message as string)?.substring(0, 50) || 'Timeline event';
    }
    if (table === 'agents') {
        return (data.name as string) || (data.agent_id as string) || 'Agent update';
    }
    return JSON.stringify(data).substring(0, 50);
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
