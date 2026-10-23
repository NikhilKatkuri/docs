import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { configVars } from '../../config';

const firebaseConfig = configVars.firebase satisfies FirebaseOptions;

const app = initializeApp(firebaseConfig);

export default app;
