import { createContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import PageLoader from '../../../components/ui/PageLoader';

const RouterGuardContext = createContext<null>(null);

const PUBLIC_ROUTES = ['/auth'] as const;
const AUTH_REDIRECT_PATH = '/docs';
const SIGN_IN_PATH = '/auth/sign-in';
const MIN_LOADER_MS = 2500;

function isPublicRoute(path: string): boolean {
    return PUBLIC_ROUTES.some(
        (route) => path === route || path.startsWith(`${route}/`)
    );
}

const RouterGuardProvider = ({
    children,
    isAuthenticated,
    loading,
}: {
    children: React.ReactNode;
    isAuthenticated: boolean;
    loading: boolean;
}) => {
    const location = useLocation();
    const { pathname, search } = location;

    const [minDelayDone, setMinDelayDone] = useState(false);

    // Start the 300ms timer only after auth has finished loading
    useEffect(() => {
        if (loading) return;
        const id = setTimeout(() => setMinDelayDone(true), MIN_LOADER_MS);
        return () => clearTimeout(id);
    }, [loading]);

    if (loading || !minDelayDone) {
        return <PageLoader />;
    }

    const publicRoute = isPublicRoute(pathname);

    if (pathname === '/') {
        return (
            <Navigate
                to={isAuthenticated ? AUTH_REDIRECT_PATH : SIGN_IN_PATH}
                replace
            />
        );
    }

    if (!isAuthenticated && !publicRoute) {
        return (
            <Navigate
                to={SIGN_IN_PATH}
                replace
                state={{ from: pathname + search }}
            />
        );
    }

    if (isAuthenticated && pathname.startsWith('/auth')) {
        const from = (location.state as { from?: string } | null)?.from;
        return <Navigate to={from ?? AUTH_REDIRECT_PATH} replace />;
    }

    return (
        <RouterGuardContext.Provider value={null}>
            {children}
        </RouterGuardContext.Provider>
    );
};

export default RouterGuardProvider;
