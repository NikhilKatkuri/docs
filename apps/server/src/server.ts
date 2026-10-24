import { flushLogger, installProcessHandlers } from 'express-secure-logger';
import { internalIpV4Sync } from 'internal-ip';
import app, { logger } from './app';
import { connectToDatabase, disconnectFromDatabase } from './config';
import configVars from './config/env';

async function boot() {
    try {
        await connectToDatabase();
    } catch (err) {
        logger.fatal({ err }, 'database connection failed; exiting');
        await flushLogger(logger);
        process.exit(1);
    }

    const onListening = () => {
        if (configVars.isDev) {
            const localIp = internalIpV4Sync();

            logger.info(
                {
                    port: configVars.PORT,
                    url: `http://${localIp}:${configVars.PORT}`,
                },
                'server started (development)'
            );
        } else {
            logger.info(
                { port: configVars.PORT },
                'server started (production)'
            );
        }
    };

    const server = configVars.isDev
        ? app.listen(configVars.PORT, configVars.HOST, onListening)
        : app.listen(configVars.PORT, onListening);

    installProcessHandlers(logger, {
        server,
        onShutdown: disconnectFromDatabase,
        timeoutMs: 10_000,
    });
}

boot().catch(async (err) => {
    logger.fatal({ err }, 'unexpected error during boot');
    await flushLogger(logger);
    process.exit(1);
});
