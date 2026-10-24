import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export interface TestServer {
    url: string;
    close: () => Promise<void>;
}

export async function startServer(app: Express): Promise<TestServer> {
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }),
    };
}
