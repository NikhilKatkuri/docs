import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { configVars } from '../../config';
export * from './utils';

const firebaseConfig = configVars.firebase satisfies FirebaseOptions;

const app = initializeApp(firebaseConfig);

export default app;

export * from './errors';
export * from './functions';
export * from './utils';
