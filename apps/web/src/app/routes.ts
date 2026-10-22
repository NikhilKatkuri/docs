import {
    type RouteConfig,
    index,
    layout,
    prefix,
    route,
} from '@react-router/dev/routes';

const paths = {
    page: './page.tsx',
    auth: {
        layout: './auth/layout.tsx',
        page: './auth/page.tsx',
        signIn: './auth/sign-in.tsx',
        signUp: './auth/sign-up.tsx',
    },
};

export default [
    index(paths.page),
    ...prefix('auth', [
        layout(paths.auth.layout, [
            index(paths.auth.page),
            route('sign-in', paths.auth.signIn),
            route('sign-up', paths.auth.signUp),
        ]),
    ]),
] satisfies RouteConfig;
