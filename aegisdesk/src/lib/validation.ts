// Validation utilities for incident data
export function validateIncident(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;

    const incident = data as Record<string, unknown>;

    return (
        typeof incident.title === 'string' &&
        typeof incident.description === 'string' &&
        ['low', 'medium', 'high', 'critical'].includes(incident.priority as string)
    );
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function sanitizeInput(input: string): string {
    return input.replace(/[<>]/g, '').trim();
}