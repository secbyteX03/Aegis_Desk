'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import for LocalAIStatus to avoid SSR issues with WebLLM
const LocalAIStatus = dynamic(() => import('@/components/LocalAIStatus'), {
    ssr: false,
    loading: () => (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-md">
            <div className="animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-20 bg-gray-800 rounded"></div>
            </div>
        </div>
    ),
});

export default function OfflineAIPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [lastChecked, setLastChecked] = useState(new Date());

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check every second
        const interval = setInterval(() => {
            setIsOnline(navigator.onLine);
            setLastChecked(new Date());
        }, 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/app"
                        className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block"
                    >
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold mb-2">
                        🤖 Offline AI Demo
                    </h1>
                    <p className="text-gray-400">
                        This feature demonstrates local AI capabilities that work WITHOUT internet connection.
                        Perfect for the PowerSync AI Hackathon's Best Local-First Submission category!
                    </p>
                </div>

                {/* Connection Status Banner */}
                <div className={`mb-8 p-4 rounded-lg border ${isOnline
                        ? 'bg-green-900/30 border-green-700'
                        : 'bg-red-900/30 border-red-700'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`} />
                        <div>
                            <div className="font-medium">
                                {isOnline ? '🌐 Online Mode' : '📴 Offline Mode'}
                            </div>
                            <div className="text-sm text-gray-400">
                                {isOnline
                                    ? 'Cloud AI (OpenAI) is available'
                                    : 'Only Local AI will work - perfect demo!'
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* How It Works */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">🚀 How It Works</h2>
                        <ol className="space-y-3 text-gray-300">
                            <li className="flex gap-3">
                                <span className="text-blue-400 font-bold">1.</span>
                                <span>Click "Initialize Local AI" to download the model (~2GB)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-400 font-bold">2.</span>
                                <span>Once loaded, the AI runs entirely in your browser</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-400 font-bold">3.</span>
                                <span>Disconnect your internet and test triage - it still works!</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-400 font-bold">4.</span>
                                <span>All AI actions are queued in PowerSync for later sync</span>
                            </li>
                        </ol>
                    </div>

                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">🏆 Hackathon Bonus Categories</h2>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2">
                                <span className="text-yellow-400">✓</span>
                                <span>Best Local-First Submission ($500)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-yellow-400">✓</span>
                                <span>Best Submission Using Mastra ($500)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-yellow-400">✓</span>
                                <span>Best Submission Using Neon ($2000 credits)</span>
                            </li>
                        </ul>
                        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
                            <div className="text-sm text-blue-300">
                                <strong>Total Potential:</strong> $500 + $500 + $2,000 + Core Prizes!
                            </div>
                        </div>
                    </div>
                </div>

                {/* Local AI Component */}
                <div className="mb-8">
                    <LocalAIStatus />
                </div>

                {/* Demo Scenarios */}
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">💡 Try These Offline Scenarios</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <button
                            onClick={() => {
                                const input = document.querySelector('textarea') as HTMLTextAreaElement;
                                if (input) input.value = 'API Gateway returning 503 errors for all requests. Users cannot access the application. Error rate is 100%.';
                            }}
                            className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
                        >
                            <div className="font-medium text-white">SEV-1: API Gateway Down</div>
                            <div className="text-sm text-gray-400">100% error rate, all users affected</div>
                        </button>
                        <button
                            onClick={() => {
                                const input = document.querySelector('textarea') as HTMLTextAreaElement;
                                if (input) input.value = 'Database connection pool exhausted. Some users experiencing slow responses. Error rate ~15%.';
                            }}
                            className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
                        >
                            <div className="font-medium text-white">SEV-2: DB Pool Exhausted</div>
                            <div className="text-sm text-gray-400">15% error rate, degraded performance</div>
                        </button>
                        <button
                            onClick={() => {
                                const input = document.querySelector('textarea') as HTMLTextAreaElement;
                                if (input) input.value = 'CDN cache purge failing intermittently. Some static assets not updating. Minor user impact.';
                            }}
                            className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
                        >
                            <div className="font-medium text-white">SEV-3: CDN Cache Issues</div>
                            <div className="text-sm text-gray-400">Intermittent, minor user impact</div>
                        </button>
                        <button
                            onClick={() => {
                                const input = document.querySelector('textarea') as HTMLTextAreaElement;
                                if (input) input.value = 'Auth service latency spike. Login requests taking 5+ seconds. No failures but degraded experience.';
                            }}
                            className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
                        >
                            <div className="font-medium text-white">SEV-2: Auth Latency</div>
                            <div className="text-sm text-gray-400">High latency, no complete failures</div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>Powered by WebLLM (Llama-3.2-3B-Instruct)</p>
                    <p className="mt-1">AegisDesk - PowerSync AI Hackathon 2026</p>
                </div>
            </div>
        </div>
    );
}
