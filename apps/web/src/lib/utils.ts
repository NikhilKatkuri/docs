function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

    const toHex = (x: number) =>
        Math.round(x * 255)
            .toString(16)
            .padStart(2, '0');

    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

function colorFromIndex(index: number): string {
    const hue = (index * 137.508) % 360;
    const tier = Math.floor(index / 24);
    const saturation = 60 + ((tier * 7) % 26);
    const lightness = 45 + ((tier * 5) % 16);

    return hslToHex(hue, saturation, lightness);
}

export function generateRandomAvatarUrl(name: string) {
    const nameArray = name.split(' ');
    const firstName = nameArray[0].charAt(0).toUpperCase();
    const lastName = nameArray[nameArray.length - 1].charAt(0).toUpperCase();
    const color = colorFromIndex(Math.floor(Math.random() * 100));

    return `inner_profile$name=${firstName}${lastName}&color=${color}`;
}

type imageComponent = `inner_profile$name=${string}&color=${string}`;

export function getProfileImageComponents(inner_url: imageComponent) {
    const queryString = inner_url.replace('inner_profile$', '');
    const params = new URLSearchParams(queryString);

    return {
        name: params.get('name')!,
        color: params.get('color')!,
    };
}
