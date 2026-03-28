/**
 * Legend-driven geometric shapes and border styling for floor elements and sidebar previews.
 */

export const LEGEND_SHAPE_KEYS = [
    'circle',
    'triangle',
    'square',
    'rectangle',
    'pentagon',
    'hexagon',
    'octagon',
    'ellipse',
    'parallelogram',
    'trapezoid',
];

export const LEGEND_SHAPE_LABELS = {
    circle: 'Circle',
    triangle: 'Triangle',
    square: 'Square',
    rectangle: 'Rectangle',
    pentagon: 'Pentagon',
    hexagon: 'Hexagon',
    octagon: 'Octagon',
    ellipse: 'Ellipse',
    parallelogram: 'Parallelogram',
    trapezoid: 'Trapezoid',
};

export const LEGEND_BORDER_STYLES = ['solid', 'dashed', 'dotted'];

export const LEGEND_BORDER_LABELS = {
    solid: 'Solid',
    dashed: 'Dashed',
    dotted: 'Dotted',
};

export function normalizeLegendShape(shape) {
    const s = (shape || '').toLowerCase().trim();
    return LEGEND_SHAPE_KEYS.includes(s) ? s : 'rectangle';
}

export function normalizeBorderStyle(style) {
    const s = (style || '').toLowerCase().trim();
    return LEGEND_BORDER_STYLES.includes(s) ? s : 'solid';
}

export function strokeDasharray(borderStyle, scale = 1) {
    const sc = Math.max(0.35, scale);
    switch (normalizeBorderStyle(borderStyle)) {
        case 'dashed':
            return `${4 * sc} ${3 * sc}`;
        case 'dotted':
            return `${0.9 * sc} ${2.8 * sc}`;
        default:
            return null;
    }
}

export function applyStrokeDashAttr(el, borderStyle, scale = 1) {
    const dash = strokeDasharray(borderStyle, scale);
    if (dash) el.setAttribute('stroke-dasharray', dash);
    else el.removeAttribute('stroke-dasharray');
}

function regularPolygonPath(sides, cx, cy, r, startAngleDeg = -90) {
    const pts = [];
    const a0 = (startAngleDeg * Math.PI) / 180;
    for (let i = 0; i < sides; i++) {
        const a = a0 + (2 * Math.PI * i) / sides;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return `M ${pts.map(p => `${p[0]},${p[1]}`).join(' L ')} Z`;
}

/**
 * Geometry in SVG coords: (px, py) top-left, y increases downward.
 */
export function getGeometrySpec(shape, px, py, pw, ph) {
    const sh = normalizeLegendShape(shape);
    const inset = 0.04 * Math.min(pw, ph);
    const spx = px + inset;
    const spy = py + inset;
    const w = Math.max(0.5, pw - 2 * inset);
    const h = Math.max(0.5, ph - 2 * inset);
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    const rm = Math.min(w, h) * 0.48;

    switch (sh) {
        case 'circle': {
            const r = Math.min(w, h) / 2;
            return { type: 'circle', cx, cy, r };
        }
        case 'ellipse':
            return { type: 'ellipse', cx, cy, rx: w / 2, ry: h / 2 };
        case 'square': {
            const s = Math.min(w, h);
            return { type: 'rect', x: cx - s / 2, y: cy - s / 2, width: s, height: s, rx: 0 };
        }
        case 'rectangle':
            return { type: 'rect', x: spx, y: spy, width: w, height: h, rx: Math.min(2, w * 0.06) };
        case 'triangle':
            return {
                type: 'path',
                d: `M ${cx} ${spy} L ${spx} ${spy + h} L ${spx + w} ${spy + h} Z`,
            };
        case 'pentagon':
            return { type: 'path', d: regularPolygonPath(5, cx, cy, rm) };
        case 'hexagon':
            return { type: 'path', d: regularPolygonPath(6, cx, cy, rm) };
        case 'octagon':
            return { type: 'path', d: regularPolygonPath(8, cx, cy, rm) };
        case 'parallelogram': {
            const skew = w * 0.24;
            const d = `M ${spx + skew} ${spy} L ${spx + w} ${spy} L ${spx + w - skew} ${spy + h} L ${spx} ${spy + h} Z`;
            return { type: 'path', d };
        }
        case 'trapezoid': {
            const topW = w * 0.52;
            const ox = (w - topW) / 2;
            const d = `M ${spx + ox} ${spy} L ${spx + ox + topW} ${spy} L ${spx + w} ${spy + h} L ${spx} ${spy + h} Z`;
            return { type: 'path', d };
        }
        default:
            return { type: 'rect', x: spx, y: spy, width: w, height: h, rx: Math.min(2, w * 0.06) };
    }
}

/**
 * Resolves stroke color: explicit borderColor or fallback to fill base (hex without alpha).
 */
export function resolveStrokeColor(fillHex, borderColor) {
    const bc = (borderColor || '').trim();
    if (bc && /^#/.test(bc)) return bc;
    return hexToOpaque(fillHex);
}

function hexToOpaque(hex) {
    if (!hex || typeof hex !== 'string') return '#374151';
    const h = hex.replace(/^#/, '');
    if (h.length >= 6) return `#${h.slice(0, 6)}`;
    return '#374151';
}

/**
 * Create one SVG sub-element (rect, circle, ellipse, or path) with fill + stroke.
 * fillHex: #rrggbb — alpha appended for interior (e.g. '40').
 */
export function createGeometryNode(ns, px, py, pw, ph, options) {
    const {
        shape,
        fillHex,
        borderColor,
        borderSize,
        borderStyle,
        fillAlpha = '40',
    } = options;

    const spec = getGeometrySpec(shape, px, py, pw, ph);
    const fillBase = hexToOpaque(fillHex);
    const fill = fillBase + fillAlpha;
    const stroke = resolveStrokeColor(fillHex, borderColor);
    const sw = Math.max(0.35, Number(borderSize) || 1.5);
    const dashScale = Math.min(pw, ph) / 14;

    let el;
    if (spec.type === 'rect') {
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', String(spec.x));
        el.setAttribute('y', String(spec.y));
        el.setAttribute('width', String(spec.width));
        el.setAttribute('height', String(spec.height));
        if (spec.rx) el.setAttribute('rx', String(spec.rx));
    } else if (spec.type === 'circle') {
        el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', String(spec.cx));
        el.setAttribute('cy', String(spec.cy));
        el.setAttribute('r', String(spec.r));
    } else if (spec.type === 'ellipse') {
        el = document.createElementNS(ns, 'ellipse');
        el.setAttribute('cx', String(spec.cx));
        el.setAttribute('cy', String(spec.cy));
        el.setAttribute('rx', String(spec.rx));
        el.setAttribute('ry', String(spec.ry));
    } else {
        el = document.createElementNS(ns, 'path');
        el.setAttribute('d', spec.d);
    }

    el.setAttribute('fill', fill);
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(sw));
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-linecap', 'round');
    applyStrokeDashAttr(el, borderStyle, dashScale);
    return el;
}

/** Default shape per built-in type key (seed / migration). */
export function defaultLegendShapeForTypeKey(key) {
    const map = {
        computerChair: 'circle',
        door: 'rectangle',
        zone: 'rectangle',
        cluster: 'hexagon',
        table: 'rectangle',
        storage: 'rectangle',
        library: 'square',
        furniture: 'ellipse',
    };
    return map[key] || 'rectangle';
}

export function defaultBorderStyleForTypeKey(key) {
    return key === 'zone' ? 'dashed' : 'solid';
}
