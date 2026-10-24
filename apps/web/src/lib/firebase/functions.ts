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
    getAdditionalUserInfo,
    onAuthStateChanged,
    signOut,
} from 'firebase/auth';
import { generateRandomAvatarUrl } from '../utils';
import { AuthError, cancelledCodes, toAuthError } from './errors';
import { FirebaseError } from 'firebase/app';

const auth = getAuth(app);

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

    if (isNewUser) {
        // setup new user in database
    }
    return {
        user: userSnap,
        token: await user.getIdToken(),
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

async function signInOrSignUpWithGoogle(): Promise<ProviderAuthResult | null> {
    const provider = new GoogleAuthProvider();
    try {
        const userCredentials = (await signInWithPopup(
            auth,
            provider
        )) satisfies UserCredential;

        const isNewUser =
            getAdditionalUserInfo(userCredentials)?.isNewUser ?? false;

        return await buildAuthResults(userCredentials, 'google', isNewUser);
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

const signOutUser = async () => await signOut(auth);

async function signInOrSignUpWithGithub(): Promise<ProviderAuthResult | null> {
    return {} as Promise<ProviderAuthResult | null>;
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
};
