// PowerSync configuration for local-first data synchronization
export const SYNC_CONFIG = {
    powersync: {
        schemaVersion: 1,
        syncInterval: 5000, // 5 seconds
        maxRetries: 3,
        retryDelay: 1000,
    },
    neon: {
        connectionTimeout: 10000,
        queryTimeout: 30000,
        poolSize: 10,
    },
    offline: {
        queueEnabled: true,
        maxQueueSize: 1000,
        syncOnReconnect: true,
    },
};

export const SYNC_TABLES = [
    'users',
    'teams',
    'incidents',
    'activities',
    'notifications',
    'workflows',
];