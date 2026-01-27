'use client';

import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@/lib/utils';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Hook to handle automatic updates in Tauri
 */
export function useUpdater() {
    const [checking, setChecking] = useState(false);

    async function checkForUpdates(silent = true) {
        if (!isTauri()) return;

        try {
            if (!silent) setChecking(true);

            const update = await check();

            if (update) {
                console.log(`Update available: ${update.version} from ${update.date}`);

                const yes = await ask(
                    `A new version (${update.version}) is available. Would you like to install it now?\n\nRelease notes:\n${update.body || 'No release notes provided.'}`,
                    {
                        title: 'Update Available',
                        kind: 'info',
                        okLabel: 'Update Now',
                        cancelLabel: 'Later'
                    }
                );

                if (yes) {
                    let downloaded = 0;
                    let contentLength: number | undefined = 0;

                    // Install the update
                    await update.downloadAndInstall((event) => {
                        switch (event.event) {
                            case 'Started':
                                contentLength = event.data.contentLength;
                                console.log(`Started downloading ${contentLength} bytes`);
                                break;
                            case 'Progress':
                                downloaded += event.data.chunkLength;
                                console.log(`Downloaded ${downloaded} from ${contentLength}`);
                                break;
                            case 'Finished':
                                console.log('Download finished');
                                break;
                        }
                    });

                    await message('Update installed successfully. The application will now restart.', {
                        title: 'Success',
                        kind: 'info'
                    });

                    // Relaunch the app
                    await relaunch();
                }
            } else if (!silent) {
                await message('You are already running the latest version.', {
                    title: 'No Update Found',
                    kind: 'info'
                });
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
            if (!silent) {
                await message(`Failed to check for updates: ${error}`, {
                    title: 'Error',
                    kind: 'error'
                });
            }
        } finally {
            if (!silent) setChecking(false);
        }
    }

    useEffect(() => {
        // Check for updates on mount (silent)
        const timer = setTimeout(() => {
            checkForUpdates(true);
        }, 5000); // Wait 5 seconds after launch

        return () => clearTimeout(timer);
    }, []);

    return { checkForUpdates, checking };
}
