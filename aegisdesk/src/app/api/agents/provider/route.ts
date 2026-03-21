import { NextResponse } from 'next/server';
import { getProvider, setProvider } from '@/lib/provider-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    const provider = getProvider();
    return NextResponse.json({
        provider
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { provider } = body;

        if (provider !== 'openai' && provider !== 'gemini') {
            return NextResponse.json(
                { error: 'Invalid provider. Must be "openai" or "gemini"' },
                { status: 400 }
            );
        }

        setProvider(provider);

        return NextResponse.json({
            success: true,
            provider
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to update provider' },
            { status: 500 }
        );
    }
}
