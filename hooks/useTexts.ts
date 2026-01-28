'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to access localized texts from texts.json
 */
export function useTexts() {
    const [texts, setTexts] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTexts() {
            try {
                const response = await fetch('/texts.json');
                const data = await response.json();
                setTexts(data);
            } catch (error) {
                console.error('Failed to load texts:', error);
            } finally {
                setLoading(false);
            }
        }

        loadTexts();
    }, []);

    /**
     * Get a text by its path (e.g., 'profile.title')
     */
    const t = (path: string, defaultValue: string = '') => {
        if (!texts) return defaultValue || path;

        const keys = path.split('.');
        let current = texts;

        for (const key of keys) {
            if (current[key] === undefined) {
                return defaultValue || path;
            }
            current = current[key];
        }

        return current as string;
    };

    return { t, loading, texts };
}
