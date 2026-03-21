/**
 * Provider Cache - Shared cache for AI provider selection
 * Used by both the UI switcher and the agent API routes
 */

// In-memory cache for provider setting
// This is shared across the application and survives hot reloads in development
// Default to gemini unless USE_OPENAI is explicitly set
let cachedProvider: 'openai' | 'gemini' = process.env.USE_OPENAI === 'true' ? 'openai' : 'gemini';

export function getProvider(): 'openai' | 'gemini' {
    return cachedProvider;
}

export function setProvider(provider: 'openai' | 'gemini'): void {
    cachedProvider = provider;
    console.log(`[ProviderCache] Provider set to: ${provider}`);
}

export function getProviderModel() {
    const provider = getProvider();
    if (provider === 'openai') {
        return { provider: 'openai', modelId: 'gpt-4o-mini' };
    }
    return { provider: 'gemini', modelId: 'gemini-2.0-flash' };
}
