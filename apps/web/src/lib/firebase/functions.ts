import app from './app';
import type { UserSnap } from '@docs/types';

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    type UserCredential,
    signInWithRedirect,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail,
    getAdditionalUserInfo,
} from 'firebase/auth';
import { generateRandomAvatarUrl } from '../utils';
import { AuthError, cancelledCodes, toAuthError } from './errors';
import { FirebaseError } from 'firebase/app';
import http, { ApiError } from '@/api/http';
import { endpoints } from '@/api/endpoints';
import { enqueueSignup } from '../db/apiQueue';
import { toast } from '@/components/ui/toast';

const auth = getAuth(app);

async function sendUserSignInToServer(
    user: UserSnap,
    token: string
): Promise<void> {
    try {
        await http.post(
            endpoints.auth.signIn,
            { uid: user.uid, provider: user.provider },
            {
                headers: { Authorization: `Bearer ${token}` },
                skipSessionGate: true,
            }
        );
    } catch (error) {
        const reason =
            error instanceof ApiError
                ? `${error.status ?? 'network'}: ${error.message}`
                : 'request failed';
        console.error('Failed to sync sign-in with server:', reason);
        throw error;
    }
}

async function seedUserToServer(user: UserSnap, token: string): Promise<void> {
    try {
        await http.post(endpoints.auth.signUp, user, {
            headers: { Authorization: `Bearer ${token}` },
            skipSessionGate: true,
        });
    } catch (error) {
        if (
            error instanceof ApiError &&
            error.status !== undefined &&
            error.status < 500
        ) {
            throw error;
        }

        try {
            await enqueueSignup(user);
        } catch (queueError) {
            throw new Error('Signup sync failed and could not be queued.', {
                cause: queueError,
            });
        }
    }
}

async function buildAuthResults(
    userCredential: UserCredential,
    provider: 'google' | 'password' | 'github',
    isNewUser: boolean = false
) {
    const { user } = userCredential;
    if (!user.email) {
        throw new AuthError(
            'missing-email',
            'Your Google account has no email address.'
        );
    }

    const displayName = user.displayName ?? user.email.split('@')[0];

    const userSnap = {
        uid: user.uid,
        email: user.email,
        displayName,
        avatarUrl:
            user.photoURL ?? generateRandomAvatarUrl(user.displayName ?? ''),
        provider,
    } satisfies UserSnap;

    const token = await user.getIdToken();

    if (isNewUser) {
        await seedUserToServer(userSnap, token);
    } else {
        await sendUserSignInToServer(userSnap, token);
    }

    return {
        user: userSnap,
        token,
    };
}

type ProviderAuthResult = Awaited<ReturnType<typeof buildAuthResults>>;

async function signInWithPassword(email: string, password: string) {
    try {
        const userCredential = (await signInWithEmailAndPassword(
            auth,
            email,
            password
        )) satisfies UserCredential;

        return await buildAuthResults(userCredential, 'password');
    } catch (error) {
        console.error('Error signing in with email and password:', error);
        throw toAuthError(error);
    }
}

async function signUpWithPassword(email: string, password: string) {
    try {
        const userCredential = (await createUserWithEmailAndPassword(
            auth,
            email,
            password
        )) satisfies UserCredential;

        return await buildAuthResults(userCredential, 'password', true);
    } catch (error) {
        console.error('Error signing up with email and password:', error);
        throw toAuthError(error);
    }
}

async function signInOrSignUpWithGoogle(
    isNewUser: boolean = false
): Promise<ProviderAuthResult | null> {
    const provider = new GoogleAuthProvider();
    try {
        const userCredentials = (await signInWithPopup(
            auth,
            provider
        )) satisfies UserCredential;
        let reviewIsNewUser = isNewUser;
        if (!isNewUser) {
            reviewIsNewUser =
                getAdditionalUserInfo(userCredentials)?.isNewUser ?? false;
        }
        return await buildAuthResults(
            userCredentials,
            'google',
            reviewIsNewUser
        );
    } catch (error: unknown) {
        if (!(error instanceof FirebaseError)) {
            const authError = toAuthError(error);
            if (authError.code === 'unknown')
                console.error('Google sign-in failed:', error);

            throw authError;
        }

        if (!cancelledCodes.has(error.code)) return null;
        if (error.code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, provider);
            return null;
        }

        return null;
    }
}

const signOutUser = async () => {
    try {
        Promise.all([
            signOut(auth),
            http.post(endpoints.auth.signOut, null, {
                skipSessionGate: true,
            }),
        ]);
    } catch (error) {
        console.error('Error signing out:', error);
        throw toAuthError(error);
    }
};

async function signInOrSignUpWithGithub(
    isNewUser: boolean
): Promise<ProviderAuthResult | null> {
    console.log('GitHub sign-in is not implemented yet.', isNewUser);
    return {} as Promise<ProviderAuthResult | null>;
}

async function sendPasswordReset(email: string): Promise<void> {
    try {
        console.log('Sending password reset email to:', email);
        await sendPasswordResetEmail(auth, email.trim());
        toast.add({
            title: 'Check your email',
            description:
                'If an account exists for this email, you will receive a password reset link.',
            type: 'success',
        });
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw toAuthError(error);
    }
}
type AuthStateChangedArgs = Parameters<typeof onAuthStateChanged>;

const subscribeToAuthState = (observer: AuthStateChangedArgs[1]) =>
    onAuthStateChanged(auth, observer);

export { type ProviderAuthResult };

export {
    auth,
    signInWithPassword,
    signUpWithPassword,
    signInOrSignUpWithGoogle,
    signInOrSignUpWithGithub,
    signOutUser,
    buildAuthResults,
    subscribeToAuthState,
    sendPasswordReset,
};
