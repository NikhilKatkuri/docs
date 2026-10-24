import http from '@/api/http';
import { db } from './index';
import { auth } from '@/lib/firebase';
import { endpoints } from '@/api/endpoints';

let running = false;

export async function processApiQueue(): Promise<void> {
    if (running || !navigator.onLine) return;

    running = true;

    try {
        const jobs = await db.apiQueue
            .where('status')
            .equals('pending')
            .toArray();

        for (const job of jobs) {
            if (!navigator.onLine) break;
            if (job.nextRetryAt > Date.now()) continue;

            try {
                const user = auth.currentUser;

                if (!user || user.uid !== job.payload.user.uid) continue;

                const token = await user.getIdToken();

                await http.post(endpoints.auth.signUp, job.payload.user, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    skipSessionGate: true,
                });

                await db.apiQueue.delete(job.id);
            } catch (error) {
                const attempts = job.attempts + 1;

                if (attempts >= 5) {
                    await db.apiQueue.delete(job.id);
                    console.error(
                        `API queue job ${job.id} deleted after 5 failed attempts.`,
                        error
                    );
                    continue;
                }

                await db.apiQueue.update(job.id, {
                    attempts,
                    nextRetryAt:
                        Date.now() +
                        Math.min(1000 * 2 ** job.attempts, 5 * 60 * 1000),
                });
            }
        }
    } finally {
        running = false;
    }
}
