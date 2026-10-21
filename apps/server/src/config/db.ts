import pg from 'pg';
import configVars from './env';

const dbClient = new pg.Client({
    host: configVars.POSTGRES_HOST,
    user: configVars.POSTGRES_USER,
    password: configVars.POSTGRES_PASSWORD,
    database: configVars.POSTGRES_DB,
    port: configVars.POSTGRES_PORT,
});

function dbUrl(): string {
    const {
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB,
    } = configVars;
    return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

async function connectToDb() {
    try {
        await dbClient.connect();
        console.log('Connected to the database successfully.');
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

export { dbClient, dbUrl };
export default connectToDb;
