import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {
    loadLoggerConfig,
    createLogger,
    createRequestLogger,
    createErrorHandler,
    createSecurityLogger,
} from 'express-secure-logger';

import configVars from './config/env';
import router from './routes';
import corsOptions from './config/cors';

const app: express.Application = express();

const config = loadLoggerConfig();
const logger = createLogger(config);
const security = createSecurityLogger(logger, { ipMode: config.ipMode });

app.set('trust proxy', configVars.TRUST_PROXY);

app.use(createRequestLogger({ logger, config }));

app.use(helmet());
app.use(cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use(router);
app.use(createErrorHandler({ logger, security }));

export { logger, security };
export default app;
