import app from './app';
import connectToDb, { dbUrl } from './config/db';
import configVars from './config/env';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: dbUrl() });
const prisma = new PrismaClient({ adapter });

async function boot() {
    await connectToDb();
    if (configVars.isDev) {
        app.listen(configVars.PORT, configVars.HOST, () => {
            console.log(
                `Server is running in development mode on http://${configVars.HOST}:${configVars.PORT}`
            );
        });
    } else {
        app.listen(configVars.PORT, () => {
            console.log(
                `Server is running in production mode on port ${configVars.PORT}`
            );
        });
    }
}

boot()
    .then(async () => {
        await prisma.$connect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
