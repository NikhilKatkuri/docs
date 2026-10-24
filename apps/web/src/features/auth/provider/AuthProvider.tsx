import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    subscribeToAuthState,
    type ProviderAuthResult,
} from '../../../lib/firebase';
import type { UserSnap } from '@docs/types';
import { toast } from '@/components/ui/toast';

interface AuthContextType {
    isAuthenticated: boolean;
    loading: boolean;
    makeAuth: (
        providerAuthFunction: () => Promise<ProviderAuthResult | null>
    ) => Promise<void>;
    user: UserSnap | null;
    token: string | null;
    authReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [user, setUser] = useState<UserSnap | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        if (!error) return;
        toast.add({
            title: 'Authentication Error',
            description: error.message,
            type: 'error',
        });
    }, [error]);

    function clear() {
        setError(null);
        setUser(null);
        setToken(null);
    }
    const authInProgress = useRef(false);

    const makeAuth = async (
        providerAuthFunction: () => Promise<ProviderAuthResult | null>
    ) => {
        if (authInProgress.current) return;
        authInProgress.current = true;
        try {
            setLoading(true);
            setError(null);

            const result = await providerAuthFunction();
            if (!result) return;
            toast.add({
                title: 'Authentication Successful',
                description: 'You have been successfully authenticated.',
                type: 'success',
            });
            setUser(result.user);
            setToken(result.token);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error
                    : new Error('An unknown error occurred.')
            );
        } finally {
            setLoading(false);
            authInProgress.current = false;
        }
    };

    const authContextValue: AuthContextType = {
        isAuthenticated: user !== null,
        loading,
        makeAuth,
        user,
        token,
        authReady,
    };

    useEffect(() => {
        const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
            try {
                if (!firebaseUser) {
                    clear();
                    return;
                }

                const userSnap = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email!,
                    displayName: firebaseUser.displayName!,
                    avatarUrl: firebaseUser.photoURL!,
                    provider: firebaseUser.providerData[0].providerId.includes(
                        'google'
                    )
                        ? 'google'
                        : 'password',
                } satisfies UserSnap;

                const idToken = await firebaseUser.getIdToken();
                setUser(userSnap);
                setToken(idToken);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error
                        : new Error(
                              'An unknown error occurred during auth state change.'
                          )
                );
                clear();
            } finally {
                setAuthReady(true);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { AuthProvider, useAuth };
