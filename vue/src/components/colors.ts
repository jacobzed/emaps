
/**
 * Color Brewer provides a nice set of color schemes.
 * https://colorbrewer2.org/#type=sequential&scheme=BuGn&n=3
*/

const colorSchemes: Record<string, string[]> = {
    // 2 Green, 2 Blue
    'GreenBlue4': ['#33a02c', '#b2df8a', '#1f78b4', '#a6cee3'],
    // Diverging Blue to Red, White in the middle
    // https://colorbrewer2.org/#type=diverging&scheme=RdBu&n=5
    'BlueRedDiverging5': ['#0571b0', '#92c5de', '#f7f7f7', '#f4a582', '#ca0020'],
    // Sequential Green to White
    // https://colorbrewer2.org/#type=sequential&scheme=BuGn&n=4
    'GreenWhite4': ['#238b45', '#66c2a4', '#b2e2e2', '#edf8fb'],
}

const colorCodes: Record<string, string> = {
    // 'Conservative': '#142f52',
    // 'Liberal': '#d71b1e',
    // 'NDP': '#f58220',
    // 'Green': '#24b24a',
    // 'Bloc': '#51a5e1',
    // 'CAQ': '#51a5e1',
    'Conservative': 'hsl(214, 61%, 20%)',
    'Liberal': 'hsl(359, 78%, 47%)',
    'NDP': 'hsl(28, 91%, 54%)',
    'Green': 'hsl(136, 66%, 42%)',
    'Bloc': 'hsl(205, 71%, 60%)',
    'CAQ': 'hsl(205, 71%, 60%)',
    'Other': 'hsl(0, 0%, 60%)',
}

/** Get branding color for a party. */
export function getPartyColor(name: string): string {
    return colorCodes[name] ?? colorCodes.Other;
}

/** Get a color scheme closely related to a base color.  */
export function getColorScheme(base: string): string[] {
    const hsl = base.match(/hsl\((\d+),\s?(\d+)%,\s?(\d+)%\)/);
    if (!hsl) {
        return getColorScheme(colorCodes[base] ?? colorCodes.Other);
    }
    const colors = [];
    const h = parseInt(hsl[1]);
    const s = parseInt(hsl[2]) / 100;
    const l = parseInt(hsl[3]) / 100;

    // create 3 lighter variants of the base color
    for (let i = 0; i < 3; i++) {
        colors.push(hslToRgb(h, s - i * 0.05, l + i * 0.2));
    }
    // worst segment should be light grey
    colors.push('#dddddd');

    return colors;
}

/** Convert HSL to RGB. */
function hslToRgb(h: number, s: number, l: number): string {
    // https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
    // h as an angle in [0,360] and s,l in [0,1] - output: r,g,b in [0,1]
    const a = s * Math.min(l, 1 - l);
    const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const hex = (c: number) => Math.floor(c * 255).toString(16).padStart(2, '0');
    return '#' + hex(f(0)) + hex(f(8)) + hex(f(4));
}



