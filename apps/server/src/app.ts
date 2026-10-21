import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import configVars from './config/env';
import router from './routes';
import corsOptions from './config/cors';

const app: express.Application = express();

app.set('trust proxy', configVars.TRUST_PROXY);

app.use(helmet());
app.use(cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use(router);

export default app;
