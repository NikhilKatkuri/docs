import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { logger } from '@/app';
import configVars from './env';

function databaseUrl(): string {
    const {
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB,
    } = configVars;
    return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

async function connectToDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info(
            { event: 'database_connected' },
            'connected to the database'
        );
    } catch (error) {
        throw new Error('Failed to connect to the database.', { cause: error });
    }
}

async function disconnectFromDatabase(): Promise<void> {
    try {
        await prisma.$disconnect();
        logger.info(
            { event: 'database_disconnected' },
            'disconnected from the database'
        );
    } catch (error) {
        throw new Error('Failed to disconnect from the database.', {
            cause: error,
        });
    }
}

export { databaseUrl, connectToDatabase, disconnectFromDatabase, prisma };
