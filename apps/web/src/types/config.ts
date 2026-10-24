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
    serverUrl: string;
}

export type { ConfigVars, firebase };
