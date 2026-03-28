/**
 * Draw legend-defined geometry (fill + stroke) for floor elements and sidebar previews.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function strokeDashForStyle(borderStyle, strokeWidth) {
    const w = Math.max(0.5, strokeWidth);
    if (borderStyle === 'dashed') return `${4 * w} ${3 * w}`;
    if (borderStyle === 'dotted') return `${w} ${2 * w}`;
    return null;
}

/**
 * @param {SVGGElement} group
 * @param {string} ns
 * @param {number} px
 * @param {number} py
 * @param {number} pw
 * @param {number} ph
 * @param {{ shape: string, fillColor: string, strokeColor: string, strokeWidth: number, borderStyle: string }} opts
 */
export function appendStyledShape(group, ns, px, py, pw, ph, opts) {
    const { shape, fillColor, strokeColor, strokeWidth, borderStyle } = opts;
    const base = (fillColor && fillColor.length >= 7) ? fillColor.slice(0, 7) : '#999999';
    const fill = base + '33';
    const dash = strokeDashForStyle(borderStyle, strokeWidth);

    const applyCommon = (el) => {
        el.setAttribute('fill', fill);
        el.setAttribute('stroke', strokeColor);
        el.setAttribute('stroke-width', String(strokeWidth));
        if (dash) el.setAttribute('stroke-dasharray', dash);
        else el.removeAttribute('stroke-dasharray');
    };

    const cx = px + pw / 2;
    const cy = py + ph / 2;

    switch (shape) {
        case 'circle': {
            const r = Math.min(pw, ph) / 2;
            const c = document.createElementNS(ns, 'circle');
            c.setAttribute('cx', String(cx));
            c.setAttribute('cy', String(cy));
            c.setAttribute('r', String(r));
            applyCommon(c);
            group.appendChild(c);
            break;
        }
        case 'ellipse': {
            const e = document.createElementNS(ns, 'ellipse');
            e.setAttribute('cx', String(cx));
            e.setAttribute('cy', String(cy));
            e.setAttribute('rx', String(pw / 2));
            e.setAttribute('ry', String(ph / 2));
            applyCommon(e);
            group.appendChild(e);
            break;
        }
        case 'square': {
            const s = Math.min(pw, ph);
            const r = document.createElementNS(ns, 'rect');
            r.setAttribute('x', String(cx - s / 2));
            r.setAttribute('y', String(cy - s / 2));
            r.setAttribute('width', String(s));
            r.setAttribute('height', String(s));
            applyCommon(r);
            group.appendChild(r);
            break;
        }
        case 'rectangle': {
            const r = document.createElementNS(ns, 'rect');
            r.setAttribute('x', String(px));
            r.setAttribute('y', String(py));
            r.setAttribute('width', String(pw));
            r.setAttribute('height', String(ph));
            applyCommon(r);
            group.appendChild(r);
            break;
        }
        case 'triangle': {
            const p = document.createElementNS(ns, 'polygon');
            p.setAttribute('points', `${cx},${py} ${px},${py + ph} ${px + pw},${py + ph}`);
            applyCommon(p);
            group.appendChild(p);
            break;
        }
        case 'pentagon':
        case 'hexagon':
        case 'octagon': {
            const n = shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 8;
            const rad = Math.min(pw, ph) / 2;
            const pts = [];
            for (let i = 0; i < n; i++) {
                const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
                pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
            }
            const pol = document.createElementNS(ns, 'polygon');
            pol.setAttribute('points', pts.join(' '));
            applyCommon(pol);
            group.appendChild(pol);
            break;
        }
        case 'parallelogram': {
            const skew = pw * 0.22;
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d',
                `M ${px + skew} ${py} L ${px + pw} ${py} L ${px + pw - skew} ${py + ph} L ${px} ${py + ph} Z`);
            applyCommon(path);
            group.appendChild(path);
            break;
        }
        case 'trapezoid': {
            const inset = pw * 0.18;
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d',
                `M ${px + inset} ${py} L ${px + pw - inset} ${py} L ${px + pw} ${py + ph} L ${px} ${py + ph} Z`);
            applyCommon(path);
            group.appendChild(path);
            break;
        }
        default: {
            const r = document.createElementNS(ns, 'rect');
            r.setAttribute('x', String(px));
            r.setAttribute('y', String(py));
            r.setAttribute('width', String(pw));
            r.setAttribute('height', String(ph));
            applyCommon(r);
            group.appendChild(r);
        }
    }
}
