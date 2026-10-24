import configVars from '@/config/env';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app =
    getApps()[0] ??
    initializeApp({
        credential: applicationDefault(),
        projectId: configVars.firebase.projectId,
    });

export const adminAuth = getAuth(app);
