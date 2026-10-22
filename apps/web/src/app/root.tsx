import './global.css';

import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

// eslint-disable-next-line react-refresh/only-export-components
export function meta() {
    return [
        { title: 'Docs — Real-Time Collaborative Editor' },
        {
            name: 'description',
            content:
                'Create, edit, and collaborate on documents in real time with Docs by Startify Minds.',
        },
        { name: 'application-name', content: 'Docs' },
        { name: 'theme-color', content: '#ffffff' },
        { name: 'color-scheme', content: 'light' },
        { property: 'og:type', content: 'website' },
        {
            property: 'og:title',
            content: 'Docs — Real-Time Collaborative Editor',
        },
        {
            property: 'og:description',
            content: 'A collaborative document editor built for teams.',
        },
        { property: 'og:site_name', content: 'Docs by Startify Minds' },
        { name: 'twitter:card', content: 'summary_large_image' },
        {
            name: 'twitter:title',
            content: 'Docs — Real-Time Collaborative Editor',
        },
        {
            name: 'twitter:description',
            content: 'Create and collaborate on documents in real time.',
        },
    ];
}

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}
