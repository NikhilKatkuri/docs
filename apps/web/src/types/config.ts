interface firebase {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

interface ConfigVars {
    firebase: firebase;
}

export type { ConfigVars, firebase };
