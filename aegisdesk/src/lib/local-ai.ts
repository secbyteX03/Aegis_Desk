'use client';

import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';

// Model configuration - using a smaller model for faster loading
const MODEL_CONFIG = {
    model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    // Fallback to smaller model if needed
    fallbackModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
};

export interface LocalAIStatus {
    isInitialized: boolean;
    isLoading: boolean;
    progress: number;
    model: string | null;
    error: string | null;
}

export interface TriageResult {
    severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
    category: string;
    rootCause: string;
    recommendedActions: string[];
    confidence: number;
}

class LocalAIService {
    private engine: MLCEngine | null = null;
    private status: LocalAIStatus = {
        isInitialized: false,
        isLoading: false,
        progress: 0,
        model: null,
        error: null,
    };
    private statusCallbacks: Set<(status: LocalAIStatus) => void> = new Set();

    getStatus(): LocalAIStatus {
        return { ...this.status };
    }

    subscribe(callback: (status: LocalAIStatus) => void): () => void {
        this.statusCallbacks.add(callback);
        callback(this.getStatus());
        return () => this.statusCallbacks.delete(callback);
    }

    private updateStatus(updates: Partial<LocalAIStatus>) {
        this.status = { ...this.status, ...updates };
        this.statusCallbacks.forEach(cb => cb(this.getStatus()));
    }

    async initialize(): Promise<void> {
        if (this.engine) return;
        if (this.status.isLoading) return;

        this.updateStatus({ isLoading: true, error: null, progress: 0 });

        try {
            // Initialize the MLC Engine with progress callback
            this.engine = await CreateMLCEngine(
                MODEL_CONFIG.model,
                {
                    initProgressCallback: (progress) => {
                        this.updateStatus({ progress: Math.round(progress * 100) });
                    },
                }
            );

            this.updateStatus({
                isInitialized: true,
                isLoading: false,
                progress: 100,
                model: MODEL_CONFIG.model,
            });

            console.log('[LocalAI] Initialized successfully with model:', MODEL_CONFIG.model);
        } catch (error) {
            console.error('[LocalAI] Failed to initialize with primary model, trying fallback:', error);

            try {
                this.engine = await CreateMLCEngine(
                    MODEL_CONFIG.fallbackModel,
                    {
                        initProgressCallback: (progress) => {
                            this.updateStatus({ progress: Math.round(progress * 100) });
                        },
                    }
                );

                this.updateStatus({
                    isInitialized: true,
                    isLoading: false,
                    progress: 100,
                    model: MODEL_CONFIG.fallbackModel,
                });

                console.log('[LocalAI] Initialized with fallback model');
            } catch (fallbackError) {
                const errorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
                this.updateStatus({
                    isLoading: false,
                    error: errorMsg,
                    progress: 0,
                });
                throw fallbackError;
            }
        }
    }

    async triageIncident(incidentDescription: string): Promise<TriageResult> {
        if (!this.engine) {
            throw new Error('Local AI not initialized');
        }

        const prompt = `You are an expert incident triage AI. Analyze the following incident and provide triage assessment.

Incident Description:
${incidentDescription}

Respond ONLY with valid JSON in this exact format:
{
  "severity": "SEV-1" | "SEV-2" | "SEV-3",
  "category": "single word category",
  "rootCause": "brief root cause analysis",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "confidence": 0.0-1.0
}

Rules:
- SEV-1: Critical, immediate action required, customer impact
- SEV-2: High priority, within hours, significant impact  
- SEV-3: Low priority, within days, minor impact
- Be concise but accurate
- confidence should reflect how certain you are (0.5-0.95)

JSON Response:`;

        try {
            const response = await this.engine.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500,
            });

            const content = response.choices[0]?.message?.content || '';

            // Parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid response format');
            }

            const result = JSON.parse(jsonMatch[0]) as TriageResult;

            // Validate severity
            if (!['SEV-1', 'SEV-2', 'SEV-3'].includes(result.severity)) {
                result.severity = 'SEV-2'; // Default
            }

            return result;
        } catch (error) {
            console.error('[LocalAI] Triage failed:', error);
            throw error;
        }
    }

    async generateRemediation(incident: string, severity: string): Promise<string> {
        if (!this.engine) {
            throw new Error('Local AI not initialized');
        }

        const prompt = `You are an expert SRE. Generate immediate remediation steps for this incident.

Incident: ${incident}
Severity: ${severity}

Provide 3-5 immediate actions to take. Be specific and actionable.
Format as a numbered list:`;

        const response = await this.engine.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 300,
        });

        return response.choices[0]?.message?.content || 'No remediation steps generated';
    }

    async analyzeLogs(logs: string): Promise<{ issues: string[], recommendations: string[] }> {
        if (!this.engine) {
            throw new Error('Local AI not initialized');
        }

        const prompt = `Analyze these logs for issues and problems.

Logs:
${logs.slice(0, 2000)}

Provide JSON response:
{
  "issues": ["issue 1", "issue 2"],
  "recommendations": ["fix 1", "fix 2"]
}`;

        const response = await this.engine.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 300,
        });

        try {
            const content = response.choices[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Fallback
        }

        return { issues: ['Unable to parse logs'], recommendations: ['Check logs manually'] };
    }

    async generatePostMortem(incident: string, timeline: string): Promise<string> {
        if (!this.engine) {
            throw new Error('Local AI not initialized');
        }

        const prompt = `Generate a brief post-mortem document for this incident.

Incident Summary: ${incident}

Timeline: ${timeline}

Provide a professional post-mortem with:
1. Summary (2-3 sentences)
2. Root Cause
3. Impact
4. Resolution
5. Lessons Learned

Be concise and actionable:`;

        const response = await this.engine.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 500,
        });

        return response.choices[0]?.message?.content || 'Post-mortem generation failed';
    }

    destroy() {
        this.engine = null;
        this.updateStatus({
            isInitialized: false,
            isLoading: false,
            progress: 0,
            model: null,
        });
    }
}

// Singleton instance
export const localAI = new LocalAIService();
