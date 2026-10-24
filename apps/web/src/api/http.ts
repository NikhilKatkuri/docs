import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
    isCancel,
    type Method,
} from 'axios';
import { getErrorMessage } from './errors';
import { getClientMetadataHeaderValue } from '@/lib/requestMetadata';
import { CLIENT_METADATA_HEADER } from '@/types/types.metadata';
import { configVars } from '@/config';

const API_BASE_PATH = configVars.serverUrl.replace(/\/$/, '');

export type ApiResponse<T> = { data: T; status: number; raw?: unknown };

type TokenGetter = () => string | null;

export interface RequestConfig extends Omit<
    AxiosRequestConfig,
    'method' | 'url' | 'data'
> {
    signal?: AbortSignal;
    skipSessionGate?: boolean;
}

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number | undefined,
        readonly issues: { path: string; message: string }[] = []
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

class HttpClient {
    private readonly client: AxiosInstance;
    private getToken: TokenGetter = () => null;
    private releaseSessionGateFn: (() => void) | null = null;

    private readonly sessionGate = new Promise<void>((resolve) => {
        this.releaseSessionGateFn = resolve;
    });

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_PATH,
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' },
        });

        this.client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                const token = this.getToken();
                if (token) {
                    config.headers.set('Authorization', `Bearer ${token}`);
                }

                const metadata = getClientMetadataHeaderValue();
                if (metadata) {
                    config.headers.set(CLIENT_METADATA_HEADER, metadata);
                }
                return config;
            },
            (error) => Promise.reject(error)
        );
    }

    public registerTokenGetter(getter: TokenGetter) {
        this.getToken = getter;
    }

    public releaseSessionGate(): void {
        this.releaseSessionGateFn?.();
        this.releaseSessionGateFn = null;
    }

    public createAbortController(): AbortController {
        return new AbortController();
    }

    private async request<T>(
        method: Method,
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<ApiResponse<T>> {
        const { skipSessionGate, ...requestConfig } = config;

        if (!skipSessionGate) {
            await this.sessionGate;
        }

        try {
            const response: AxiosResponse<T> = await this.client.request({
                ...requestConfig,
                method,
                url: path,
                data,
            });

            return {
                status: response.status,
                data: response.data as T,
            };
        } catch (error) {
            if (isCancel(error)) {
                throw new Error('Request was aborted', { cause: error });
            }

            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                const responseData = error.response?.data as
                    | {
                          message?: string;
                          issues?: { path: string; message: string }[];
                      }
                    | undefined;

                const issues = responseData?.issues ?? [];

                const message = responseData?.message
                    ? String(responseData.message)
                    : getErrorMessage(status, responseData);

                throw new ApiError(message, status, issues);
            }

            throw error;
        }
    }

    public get<T>(path: string, config?: RequestConfig) {
        return this.request<T>('GET', path, undefined, config);
    }

    public post<T>(path: string, body?: unknown, config?: RequestConfig) {
        return this.request<T>('POST', path, body, config);
    }

    public put<T>(path: string, body?: unknown, config?: RequestConfig) {
        return this.request<T>('PUT', path, body, config);
    }

    public patch<T>(path: string, body?: unknown, config?: RequestConfig) {
        return this.request<T>('PATCH', path, body, config);
    }

    public delete<T>(path: string, config?: RequestConfig) {
        return this.request<T>('DELETE', path, undefined, config);
    }

    public async getBlob(path: string, config?: RequestConfig): Promise<Blob> {
        const { skipSessionGate, ...requestConfig } = config ?? {};

        if (!skipSessionGate) {
            await this.sessionGate;
        }

        try {
            const response = await this.client.get(path, {
                ...requestConfig,
                responseType: 'blob',
            });
            return response.data as Blob;
        } catch (error) {
            if (isCancel(error)) {
                throw new Error('Request was aborted', { cause: error });
            }
            if (axios.isAxiosError(error)) {
                throw new ApiError(
                    getErrorMessage(error.response?.status, undefined),
                    error.response?.status
                );
            }
            throw error;
        }
    }
}

const http = new HttpClient();
export default http;
