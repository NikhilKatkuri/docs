const loading = new Map<string, Promise<void>>();

function loadFont(family: string): Promise<void> {
    const existing = loading.get(family);
    if (existing) return existing;

    const promise = new Promise<void>((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href =
            'https://fonts.googleapis.com/css2?family=' +
            encodeURIComponent(family).replace(/%20/g, '+') +
            ':ital,wght@0,400;0,700;1,400;1,700&display=swap';
        link.onload = async () => {
            try {
                await document.fonts.load(`16px "${family}"`);
                await document.fonts.load(`bold 16px "${family}"`);
                resolve();
            } catch {
                resolve();
            }
        };

        link.onerror = () => {
            loading.delete(family);
            link.remove();
            reject(new Error(`Failed to load font: ${family}`));
        };
        document.head.appendChild(link);
    });

    loading.set(family, promise);
    return promise;
}

export { loadFont };
