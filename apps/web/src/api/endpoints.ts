export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export interface EndpointConfig {
    path: string;
    method: HttpMethod;
}

export interface ResponseQuery {
    page: number;
    limit: number;
    q?: string;
    questionId?: string;
    sort?: 'newest' | 'oldest';
}

export function toQuery(
    params: Record<string, string | number | undefined>
): string {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === '') return;
        search.set(key, String(value));
    });

    const query = search.toString();

    return query ? `?${query}` : '';
}

export const endpoints = {
    auth: {
        signIn: '/auth/sign-in',
        signUp: '/auth/sign-up',
        signOut: '/auth/sign-out',
        me: '/auth/me',
    },
} as const;
