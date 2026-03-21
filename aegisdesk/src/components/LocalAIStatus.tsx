'use client';

import { useEffect, useState } from 'react';
import { localAI, LocalAIStatus, TriageResult } from '@/lib/local-ai';

interface LocalAIStatusProps {
    onTriageComplete?: (result: TriageResult) => void;
}

export default function LocalAIStatusComponent({ onTriageComplete }: LocalAIStatusProps) {
    const [status, setStatus] = useState<LocalAIStatus>(localAI.getStatus());
    const [testInput, setTestInput] = useState('');
    const [result, setResult] = useState<TriageResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const unsubscribe = localAI.subscribe(setStatus);
        return () => unsubscribe();
    }, []);

    const handleInitialize = async () => {
        try {
            await localAI.initialize();
        } catch (error) {
            console.error('Failed to initialize:', error);
        }
    };

    const handleTestTriage = async () => {
        if (!testInput.trim() || !status.isInitialized) return;

        setIsRunning(true);
        try {
            const triageResult = await localAI.triageIncident(testInput);
            setResult(triageResult);
            onTriageComplete?.(triageResult);
        } catch (error) {
            console.error('Triage failed:', error);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="local-ai-widget" style={{
            background: 'rgba(30, 30, 40, 0.95)',
            border: '1px solid #3a3a4a',
            borderRadius: '8px',
            padding: '8px',
            fontSize: '11px',
            width: '220px',
            maxHeight: expanded ? '280px' : '36px',
            overflow: 'hidden'
        }}>
            {/* Header - Compact */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* SVG Icon - Brain/AI */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a9 9 0 0 1 9 9c0 3.5-2 6.5-5 8l-1 4h-6l-1-4c-3-1.5-5-4.5-5-8a9 9 0 0 1 9-9z" />
                        <circle cx="9" cy="10" r="1.5" fill="#58a6ff" />
                        <circle cx="15" cy="10" r="1.5" fill="#58a6ff" />
                        <path d="M9 14h6" />
                    </svg>
                    <span style={{ color: '#e0e0e0', fontWeight: '600', fontSize: '13px' }}>Local AI</span>
                    <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        background: status.isInitialized ? 'rgba(63, 185, 80, 0.2)' : status.isLoading ? 'rgba(210, 153, 34, 0.2)' : 'rgba(100, 100, 120, 0.3)',
                        color: status.isInitialized ? '#3fb950' : status.isLoading ? '#d29922' : '#888',
                        fontWeight: '500'
                    }}>
                        {status.isInitialized ? 'Ready' : status.isLoading ? 'Loading...' : 'Offline'}
                    </span>
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </div>

            {/* Progress Bar - Only when loading */}
            {status.isLoading && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#888' }}>
                        <span>Downloading model...</span>
                        <span>{isNaN(status.progress) ? 0 : status.progress}%</span>
                    </div>
                    <div style={{ height: '4px', background: '#2a2a3a', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #58a6ff, #3fb950)',
                            transition: 'width 0.3s',
                            width: `${status.progress}%`
                        }} />
                    </div>
                </div>
            )}

            {/* Expanded Content */}
            {expanded && (
                <>
                    {/* Play Button to Initialize */}
                    {!status.isInitialized && !status.isLoading && (
                        <button
                            onClick={handleInitialize}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                padding: '6px 10px',
                                background: 'linear-gradient(135deg, #58a6ff, #3d8bfd)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                marginBottom: '6px'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Start Local AI
                        </button>
                    )}

                    {/* Error */}
                    {status.error && (
                        <div style={{
                            padding: '8px',
                            background: 'rgba(220, 50, 50, 0.15)',
                            border: '1px solid rgba(220, 50, 50, 0.3)',
                            borderRadius: '6px',
                            color: '#f87171',
                            fontSize: '11px',
                            marginBottom: '8px'
                        }}>
                            {status.error}
                        </div>
                    )}

                    {/* Demo Section */}
                    {status.isInitialized && (
                        <div style={{ borderTop: '1px solid #3a3a4a', paddingTop: '12px' }}>
                            <div style={{ marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    value={testInput}
                                    onChange={(e) => setTestInput(e.target.value)}
                                    placeholder="Quick triage: describe incident..."
                                    disabled={isRunning}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: '#1a1a24',
                                        border: '1px solid #3a3a4a',
                                        borderRadius: '6px',
                                        color: '#e0e0e0',
                                        fontSize: '11px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleTestTriage}
                                disabled={isRunning || !testInput.trim()}
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    background: isRunning ? '#4a4a5a' : 'linear-gradient(135deg, #3fb950, #2ea043)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'white',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: isRunning ? 'default' : 'pointer',
                                    opacity: isRunning || !testInput.trim() ? 0.6 : 1
                                }}
                            >
                                {isRunning ? 'Analyzing...' : 'Run Triage'}
                            </button>

                            {/* Results - Compact */}
                            {result && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '10px',
                                    background: '#1a1a24',
                                    borderRadius: '6px',
                                    border: '1px solid #3a3a4a'
                                }}>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '11px' }}>
                                        <span style={{ color: '#888' }}>Severity:</span>
                                        <span style={{
                                            color: result.severity === 'SEV-1' ? '#f87171' : result.severity === 'SEV-2' ? '#fbbf24' : '#60a5fa',
                                            fontWeight: '600'
                                        }}>{result.severity}</span>
                                        <span style={{ color: '#888' }}>|</span>
                                        <span style={{ color: '#888' }}>Category:</span>
                                        <span style={{ color: '#e0e0e0' }}>{result.category}</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                        Root Cause: <span style={{ color: '#e0e0e0' }}>{result.rootCause}</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>
                                        Actions: <span style={{ color: '#3fb950' }}>{result.recommendedActions.slice(0, 2).join(', ')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
