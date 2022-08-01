// From https://github.com/niklasvh/html2canvas/tree/eeda86bd5e81fb4e97675fe9bee3d4d15899997f

type Bounds = { width: number; height: number };
type Direction = {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
};

const ANGLE = /([+-]?\d*\.?\d+)(deg|grad|rad|turn)/i;

const SIDE_OR_CORNER =
    /^(to )?(left|top|right|bottom)( (left|top|right|bottom))?$/i;
const PERCENTAGE_ANGLES = /^([+-]?\d*\.?\d+)% ([+-]?\d*\.?\d+)%$/i;
const ENDS_WITH_LENGTH = /(px)|%|( 0)$/i;
const FROM_TO_COLORSTOP =
    /^(from|to|color-stop)\((?:([\d.]+)(%)?,\s*)?(.+?)\)$/i;

const parseAngle = (angle: string): number | null => {
    const match = angle.match(ANGLE);

    if (match) {
        const value = parseFloat(match[1]);
        switch (match[2].toLowerCase()) {
            case "deg":
                return (Math.PI * value) / 180;
            case "grad":
                return (Math.PI / 200) * value;
            case "rad":
                return value;
            case "turn":
                return Math.PI * 2 * value;
        }
    }

    return null;
};

const distance = (a: number, b: number): number =>
    Math.sqrt(a * a + b * b);

const parseGradient = (
    {
        args,
        method,
        prefix,
    }: { args: Array<string>; method: string; prefix: string },
    bounds: Bounds
) => {
    if (method === "linear-gradient") {
        return parseLinearGradient(args, bounds, !!prefix);
    } else if (method === "gradient" && args[0] === "linear") {
        // TODO handle correct angle
        return parseLinearGradient(
            ["to bottom"].concat(transformObsoleteColorStops(args.slice(3))),
            bounds,
            !!prefix
        );
    } else if (
        method === "radial-gradient" ||
        (method === "gradient" && args[0] === "radial")
    ) {
        throw new Error("radial gradients are not supported");
    }
    throw new Error("unknown gradient type: " + method);
};

const parseColorStops = (args: Array<string>, firstColorStopIndex: number) => {
    const colorStops: Array<{ color: string; stop: string | null }> = [];

    for (let i = firstColorStopIndex; i < args.length; i++) {
        const value = args[i];
        const HAS_LENGTH = ENDS_WITH_LENGTH.test(value);
        const lastSpaceIndex = value.lastIndexOf(" ");
        const color = HAS_LENGTH ? value.substring(0, lastSpaceIndex) : value;
        const stop = HAS_LENGTH
            ? value.substring(lastSpaceIndex + 1)
            : i === firstColorStopIndex
                ? "0%"
                : i === args.length - 1
                    ? "100%"
                    : null;
        colorStops.push({ color, stop });
    }

    const parsePosition = (p) => {
        const percentage = parseInt(p.replace(/%$/, ""), 10);
        const normal = percentage / 100;
        return normal;
    };

    const colors: string[] = [];
    const locations: number[] = [];
    colorStops.forEach(({ color, stop }) => {
        colors.push(color);
        locations.push(parsePosition(stop));
    });

    return { colors, locations };
};

const parseLinearGradient = (
    args: Array<string>,
    bounds: Bounds,
    hasPrefix: boolean
) => {
    const angle = parseAngle(args[0]);
    const HAS_SIDE_OR_CORNER = SIDE_OR_CORNER.test(args[0]);
    const HAS_DIRECTION =
        HAS_SIDE_OR_CORNER || angle !== null || PERCENTAGE_ANGLES.test(args[0]);
    const direction = HAS_DIRECTION
        ? angle !== null
            ? calculateGradientDirection(
                // if there is a prefix, the 0° angle points due East (instead of North per W3C)
                hasPrefix ? angle - Math.PI * 0.5 : angle,
                bounds
            )
            : HAS_SIDE_OR_CORNER
                ? parseSideOrCorner(args[0], bounds)
                : parsePercentageAngle(args[0], bounds)
        : calculateGradientDirection(Math.PI, bounds);
    const firstColorStopIndex = HAS_DIRECTION ? 1 : 0;

    return {
        ...parseColorStops(args, firstColorStopIndex),
        start: { x: direction.x0, y: direction.y0 },
        end: { x: direction.x1, y: direction.y1 },
    };
};

const calculateGradientDirection = (
    radian: number,
    bounds: Bounds
): Direction => {
    const width = bounds.width;
    const height = bounds.height;
    const HALF_WIDTH = width * 0.5;
    const HALF_HEIGHT = height * 0.5;
    const lineLength =
        Math.abs(width * Math.sin(radian)) + Math.abs(height * Math.cos(radian));
    const HALF_LINE_LENGTH = lineLength / 2;

    const x0 = HALF_WIDTH + Math.sin(radian) * HALF_LINE_LENGTH;
    const y0 = HALF_HEIGHT - Math.cos(radian) * HALF_LINE_LENGTH;
    const x1 = width - x0;
    const y1 = height - y0;

    return { x0, x1, y0, y1 };
};

const parseTopRight = (bounds: Bounds) =>
    Math.acos(bounds.width / 2 / (distance(bounds.width, bounds.height) / 2));

const parseSideOrCorner = (side: string, bounds: Bounds): Direction => {
    switch (side) {
        case "bottom":
        case "to top":
            return calculateGradientDirection(0, bounds);
        case "left":
        case "to right":
            return calculateGradientDirection(Math.PI / 2, bounds);
        case "right":
        case "to left":
            return calculateGradientDirection((3 * Math.PI) / 2, bounds);
        case "top right":
        case "right top":
        case "to bottom left":
        case "to left bottom":
            return calculateGradientDirection(
                Math.PI + parseTopRight(bounds),
                bounds
            );
        case "top left":
        case "left top":
        case "to bottom right":
        case "to right bottom":
            return calculateGradientDirection(
                Math.PI - parseTopRight(bounds),
                bounds
            );
        case "bottom left":
        case "left bottom":
        case "to top right":
        case "to right top":
            return calculateGradientDirection(parseTopRight(bounds), bounds);
        case "bottom right":
        case "right bottom":
        case "to top left":
        case "to left top":
            return calculateGradientDirection(
                2 * Math.PI - parseTopRight(bounds),
                bounds
            );
        case "top":
        case "to bottom":
        default:
            return calculateGradientDirection(Math.PI, bounds);
    }
};

const parsePercentageAngle = (angle: string, bounds: Bounds): Direction => {
    const [left, top] = angle.split(" ").map(parseFloat);
    const ratio = ((left / 100) * bounds.width) / ((top / 100) * bounds.height);

    return calculateGradientDirection(
        Math.atan(isNaN(ratio) ? 1 : ratio) + Math.PI / 2,
        bounds
    );
};

const transformObsoleteColorStops = (args: Array<string>): string[] => {
    // @ts-expect-error
    return (
        args
            .map((color) => color.match(FROM_TO_COLORSTOP))
            // @ts-expect-error
            .map((v: string[], index: number) => {
                if (!v) {
                    return args[index];
                }

                switch (v[1]) {
                    case "from":
                        return `${v[4]} 0%`;
                    case "to":
                        return `${v[4]} 100%`;
                    case "color-stop":
                        if (v[3] === "%") {
                            return `${v[4]} ${v[2]}`;
                        }
                        return `${v[4]} ${parseFloat(v[2]) * 100}%`;
                }
            })
    );
};

/** 
 * Given a CSS string, returns props for rendering with `expo-linear-gradient`.
 * 
 * ```tsx
 * fromCSS('linear-gradient(180deg, #ff008450 0%, #fca40040 25%, #ffff0030 40%, #00ff8a20 60%, #00cfff40 75%, #cc4cfa50 100%);')
 * ```
 */
export function fromCSS(str: string) {
    const values = str.match(/([a-zA-Z0-9_-]+)\((.*)\).*/);
    if (!values) throw new Error("Invalid CSS Gradient function: " + str);

    const [, method, argString] = values;
    const args = argString.split(",").map((v) => v.trim());
    return parseGradient(
        // @ts-expect-error
        { args, method }, { width: 1, height: 1 });
}
