/**
 * SVG renderer for the floor plan coordinate plane.
 * Draws grid, axes, walls, doors, and all furniture elements.
 */

import { FLOOR, ELEMENT_TYPES, mergeElementDrawStyle } from './coordinates.js';
import { appendStyledShape } from './legendDrawHelpers.js';

export class FloorPlanRenderer {
    constructor(svgElement, mapper, options) {
        this.svg = svgElement;
        this.mapper = mapper;
        this.options = Object.assign({
            showGrid: true,
            showLabels: true,
            showDimensions: true
        }, options);

        this.ns = 'http://www.w3.org/2000/svg';
        this.layers = {};
        this.groupMetas = [];
    }

    init() {
        this.svg.setAttribute('viewBox', `0 0 ${this.mapper.svgW} ${this.mapper.svgH}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        /* User space stays svgW × svgH; on-screen size fills .canvas-container (CSS). */
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');

        ['grid', 'axes', 'dimensions', 'zones', 'groups', 'elements', 'labels', 'selection'].forEach(name => {
            const g = document.createElementNS(this.ns, 'g');
            g.setAttribute('class', `layer-${name}`);
            g.dataset.layer = name;
            this.svg.appendChild(g);
            this.layers[name] = g;
        });
    }

    clear() {
        Object.values(this.layers).forEach(g => { g.innerHTML = ''; });
    }

    render(elements) {
        this.clear();
        if (this.options.showGrid) this.drawGrid();
        this.drawAxes();
        if (this.options.showDimensions) this.drawDimensions();
        this.drawFloorScaleHandles();
        this.drawWalls();
        this.drawDoors(elements.filter(e => e.type === 'door'));

        const zones = elements.filter(e => e.type === 'zone');
        zones.forEach(el => this.drawZone(el));

        this.drawGroupOverlays(elements);

        const rest = elements.filter(e => e.type !== 'door' && e.type !== 'zone');
        rest.forEach(el => this.drawElement(el));

        if (this.options.showLabels) {
            elements.forEach(el => this.drawLabel(el));
        }
    }

    /* ---- Grid & Axes ---- */

    drawGrid() {
        const g = this.layers.grid;
        const m = this.mapper;

        for (let x = 0; x <= FLOOR.width; x++) {
            const px = m.toPixelX(x);
            const cls = (x % 5 === 0) ? 'grid-line grid-line-major' : 'grid-line';
            this.line(g, px, m.toPixelY(FLOOR.height), px, m.toPixelY(0), cls);
        }
        for (let y = 0; y <= FLOOR.height; y++) {
            const py = m.toPixelY(y);
            const cls = (y % 5 === 0) ? 'grid-line grid-line-major' : 'grid-line';
            this.line(g, m.toPixelX(0), py, m.toPixelX(FLOOR.width), py, cls);
        }
    }

    drawAxes() {
        const g = this.layers.axes;
        const m = this.mapper;

        for (let x = 0; x <= FLOOR.width; x += 2) {
            const px = m.toPixelX(x);
            const py = m.toPixelY(0) + 14;
            this.text(g, px, py, x.toString(), 'axis-label');
        }
        for (let y = 0; y <= FLOOR.height; y += 2) {
            const px = m.toPixelX(0) - 8;
            const py = m.toPixelY(y) + 3;
            this.text(g, px, py, y.toString(), 'axis-label', 'end');
        }
    }

    drawDimensions() {
        const g = this.layers.dimensions;
        const m = this.mapper;

        const topY = m.toPixelY(FLOOR.height) - 14;
        const leftX = m.toPixelX(0);
        const rightX = m.toPixelX(FLOOR.width);
        this.line(g, leftX, topY, rightX, topY, 'dim-line');
        this.dimArrows(g, leftX, topY, rightX, topY);
        this.text(g, (leftX + rightX) / 2, topY - 4, `${FLOOR.width} ${FLOOR.unit}`, 'dim-label');

        const sideX = m.toPixelX(FLOOR.width) + 14;
        const topPy = m.toPixelY(FLOOR.height);
        const botPy = m.toPixelY(0);
        this.line(g, sideX, topPy, sideX, botPy, 'dim-line');
        this.dimArrows(g, sideX, topPy, sideX, botPy);
        this.text(g, sideX + 4, (topPy + botPy) / 2, `${FLOOR.height} ${FLOOR.unit}`, 'dim-label', 'start', -90);
    }

    /**
     * Narrow hit targets at the free edge of each overall dimension (always visible).
     * Drag horizontally on the width handle, vertically on the height handle.
     */
    drawFloorScaleHandles() {
        const g = this.layers.dimensions;
        const m = this.mapper;

        const topY = m.toPixelY(FLOOR.height) - 14;
        const rightX = m.toPixelX(FLOOR.width);
        const halfW = 4;
        const along = 16;
        const wHandle = document.createElementNS(this.ns, 'rect');
        wHandle.setAttribute('x', rightX - halfW);
        wHandle.setAttribute('y', topY - along / 2);
        wHandle.setAttribute('width', halfW * 2);
        wHandle.setAttribute('height', along);
        wHandle.setAttribute('rx', '2');
        wHandle.setAttribute('class', 'dim-scale-handle dim-scale-handle--width');
        wHandle.dataset.floorResizeAxis = 'width';
        const wTitle = document.createElementNS(this.ns, 'title');
        wTitle.textContent = 'Drag to resize floor width';
        wHandle.appendChild(wTitle);
        g.appendChild(wHandle);

        const sideX = m.toPixelX(FLOOR.width) + 14;
        const topPy = m.toPixelY(FLOOR.height);
        const halfH = 4;
        const alongX = 16;
        const hHandle = document.createElementNS(this.ns, 'rect');
        hHandle.setAttribute('x', sideX - alongX / 2);
        hHandle.setAttribute('y', topPy - halfH);
        hHandle.setAttribute('width', alongX);
        hHandle.setAttribute('height', halfH * 2);
        hHandle.setAttribute('rx', '2');
        hHandle.setAttribute('class', 'dim-scale-handle dim-scale-handle--height');
        hHandle.dataset.floorResizeAxis = 'height';
        const hTitle = document.createElementNS(this.ns, 'title');
        hTitle.textContent = 'Drag to resize floor height';
        hHandle.appendChild(hTitle);
        g.appendChild(hHandle);
    }

    drawWalls() {
        const m = this.mapper;
        const g = this.layers.elements;
        const x0 = m.toPixelX(0), y0 = m.toPixelY(0);
        const x1 = m.toPixelX(FLOOR.width), y1 = m.toPixelY(FLOOR.height);
        this.rect(g, x0, y1, x1 - x0, y0 - y1, 'wall', { fill: 'none' });
    }

    /* ---- Doors ---- */

    drawDoors(doors) {
        const g = this.layers.elements;
        const m = this.mapper;

        doors.forEach(door => {
            const group = document.createElementNS(this.ns, 'g');
            group.setAttribute('class', 'floor-element');
            group.dataset.id = door.id;
            if (door.groupId) group.dataset.group = door.groupId;

            const px = m.toPixelX(door.x);
            const py = m.toPixelY(door.y + door.height);
            const pw = m.toPixelW(door.width);
            const ph = m.toPixelH(door.height);

            const ti = ELEMENT_TYPES.door || { color: '#92400e' };
            const style = mergeElementDrawStyle(null, ti);
            appendStyledShape(group, this.ns, px, py, pw, ph, style);

            const arc = document.createElementNS(this.ns, 'path');
            const radius = pw;
            if (door.swing === 'inward') {
                const startX = px;
                const startY = py + ph;
                arc.setAttribute('d', `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${startX + radius} ${startY - radius}`);
            } else {
                const startX = px;
                const startY = py;
                arc.setAttribute('d', `M ${startX} ${startY} A ${radius} ${radius} 0 0 0 ${startX + radius} ${startY + radius}`);
            }
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke', style.strokeColor);
            arc.setAttribute('stroke-width', '1');
            arc.setAttribute('stroke-dasharray', '4,3');
            group.appendChild(arc);

            if (door.rotation) {
                const rcx = px + pw / 2;
                const rcy = py + ph / 2;
                group.setAttribute('transform', `rotate(${door.rotation}, ${rcx}, ${rcy})`);
            }

            g.appendChild(group);
        });
    }

    /* ---- Zones (translucent areas) ---- */

    drawZone(el) {
        const g = this.layers.zones;
        const m = this.mapper;
        const group = document.createElementNS(this.ns, 'g');
        group.setAttribute('class', 'floor-element');
        group.dataset.id = el.id;
        if (el.groupId) group.dataset.group = el.groupId;

        const px = m.toPixelX(el.x);
        const py = m.toPixelY(el.y + el.height);
        const pw = m.toPixelW(el.width);
        const ph = m.toPixelH(el.height);

        const ti = ELEMENT_TYPES[el.type] || { color: '#999' };
        appendStyledShape(group, this.ns, px, py, pw, ph, mergeElementDrawStyle(null, ti));

        if (el.rotation) {
            const rcx = px + pw / 2;
            const rcy = py + ph / 2;
            group.setAttribute('transform', `rotate(${el.rotation}, ${rcx}, ${rcy})`);
        }

        g.appendChild(group);
    }

    /* ---- Generic Elements ---- */

    drawElement(el) {
        const g = this.layers.elements;
        const m = this.mapper;
        const group = document.createElementNS(this.ns, 'g');
        group.setAttribute('class', 'floor-element');
        group.dataset.id = el.id;
        if (el.groupId) group.dataset.group = el.groupId;

        const px = m.toPixelX(el.x);
        const py = m.toPixelY(el.y + el.height);
        const pw = m.toPixelW(el.width);
        const ph = m.toPixelH(el.height);
        const typeInfo = ELEMENT_TYPES[el.type] || { color: '#999' };
        appendStyledShape(group, this.ns, px, py, pw, ph, mergeElementDrawStyle(null, typeInfo));

        if (el.rotation) {
            const rcx = px + pw / 2;
            const rcy = py + ph / 2;
            group.setAttribute('transform', `rotate(${el.rotation}, ${rcx}, ${rcy})`);
        }

        g.appendChild(group);
    }

    drawDeskCluster(group, px, py, pw, ph, color) {
        const gap = 2;
        const dw = (pw - gap) / 2;
        const dh = (ph - gap) / 2;
        const positions = [
            [px, py],
            [px + dw + gap, py],
            [px, py + dh + gap],
            [px + dw + gap, py + dh + gap]
        ];
        positions.forEach(([x, y]) => {
            const r = document.createElementNS(this.ns, 'rect');
            r.setAttribute('x', x);
            r.setAttribute('y', y);
            r.setAttribute('width', dw);
            r.setAttribute('height', dh);
            r.setAttribute('rx', '2');
            r.setAttribute('fill', color + '25');
            r.setAttribute('stroke', color);
            r.setAttribute('stroke-width', '1.2');
            group.appendChild(r);
        });

        const chairR = Math.min(dw, dh) * 0.18;
        const chairs = [
            [px - chairR * 1.4, py + dh * 0.5],
            [px - chairR * 1.4, py + dh * 1.5 + gap],
            [px + pw + chairR * 1.4, py + dh * 0.5],
            [px + pw + chairR * 1.4, py + dh * 1.5 + gap],
            [px + dw * 0.5, py - chairR * 1.4],
            [px + dw * 1.5 + gap, py - chairR * 1.4],
            [px + dw * 0.5, py + ph + chairR * 1.4],
            [px + dw * 1.5 + gap, py + ph + chairR * 1.4]
        ];
        chairs.forEach(([cx, cy]) => {
            const c = document.createElementNS(this.ns, 'circle');
            c.setAttribute('cx', cx);
            c.setAttribute('cy', cy);
            c.setAttribute('r', chairR);
            c.setAttribute('fill', color + '50');
            c.setAttribute('stroke', color);
            c.setAttribute('stroke-width', '0.8');
            group.appendChild(c);
        });
    }

    drawComputerStation(group, px, py, pw, ph, color) {
        this.drawComputerDesk(group, px, py, pw, ph, color);
        const chairR = Math.min(pw, ph) * 0.2;
        const chair = document.createElementNS(this.ns, 'circle');
        chair.setAttribute('cx', px + pw + chairR * 1.5);
        chair.setAttribute('cy', py + ph / 2);
        chair.setAttribute('r', chairR);
        chair.setAttribute('fill', color + '40');
        chair.setAttribute('stroke', color);
        chair.setAttribute('stroke-width', '0.8');
        group.appendChild(chair);
    }

    drawComputerDesk(group, px, py, pw, ph, color) {
        const r = document.createElementNS(this.ns, 'rect');
        r.setAttribute('x', px);
        r.setAttribute('y', py);
        r.setAttribute('width', pw);
        r.setAttribute('height', ph);
        r.setAttribute('rx', '2');
        r.setAttribute('fill', color + '20');
        r.setAttribute('stroke', color);
        r.setAttribute('stroke-width', '1.2');
        group.appendChild(r);

        const mw = pw * 0.4;
        const mh = ph * 0.35;
        const monitor = document.createElementNS(this.ns, 'rect');
        monitor.setAttribute('x', px + pw * 0.1);
        monitor.setAttribute('y', py + (ph - mh) / 2);
        monitor.setAttribute('width', mw);
        monitor.setAttribute('height', mh);
        monitor.setAttribute('rx', '1');
        monitor.setAttribute('fill', color + '60');
        monitor.setAttribute('stroke', color);
        monitor.setAttribute('stroke-width', '0.8');
        group.appendChild(monitor);
    }

    drawComputerChair(group, px, py, pw, ph, color) {
        const chairR = Math.min(pw, ph) * 0.45;
        const chair = document.createElementNS(this.ns, 'circle');
        chair.setAttribute('cx', px + pw / 2);
        chair.setAttribute('cy', py + ph / 2);
        chair.setAttribute('r', chairR);
        chair.setAttribute('fill', color + '40');
        chair.setAttribute('stroke', color);
        chair.setAttribute('stroke-width', '0.8');
        group.appendChild(chair);
    }

    drawStorageCubbies(group, px, py, pw, ph, color) {
        const numCubbies = 8;
        const cubbyW = pw / numCubbies;
        for (let i = 0; i < numCubbies; i++) {
            const r = document.createElementNS(this.ns, 'rect');
            r.setAttribute('x', px + i * cubbyW + 1);
            r.setAttribute('y', py);
            r.setAttribute('width', cubbyW - 2);
            r.setAttribute('height', ph);
            r.setAttribute('rx', '1');
            r.setAttribute('fill', color + '20');
            r.setAttribute('stroke', color);
            r.setAttribute('stroke-width', '1');
            group.appendChild(r);
        }
    }

    /* ---- Labels ---- */

    drawLabel(el) {
        const g = this.layers.labels;
        const m = this.mapper;
        const cx = m.toPixelX(el.x + el.width / 2);
        const cy = m.toPixelY(el.y + el.height / 2);

        if (el.type === 'door') return;

        if (el.id === 'library-2') return;
        if (el.id === 'sofa-side') return;
        if (el.id === 'beanbag-2') return;

        const labelText = el.label;
        const t = document.createElementNS(this.ns, 'text');
        t.setAttribute('x', cx);
        t.setAttribute('y', cy);
        t.setAttribute('class', 'element-label');
        t.textContent = labelText;
        g.appendChild(t);
    }

    /* ---- Group Overlays ---- */

    drawGroupOverlays(elements) {
        const g = this.layers.groups;
        const m = this.mapper;
        const groupIds = [...new Set(elements.filter(e => e.groupId).map(e => e.groupId))];

        groupIds.forEach(gid => {
            const meta = this.groupMetas.find(gm => gm.groupId === gid);
            const showBorder = meta ? meta.showBorder !== false : true;
            const showLabel = meta ? meta.showLabel !== false : true;
            const label = meta ? (meta.label || '') : '';

            if (!showBorder && !showLabel) return;

            const members = elements.filter(e => e.groupId === gid);
            if (members.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            members.forEach(el => {
                minX = Math.min(minX, el.x);
                minY = Math.min(minY, el.y);
                maxX = Math.max(maxX, el.x + el.width);
                maxY = Math.max(maxY, el.y + el.height);
            });

            const pad = 0.5;
            const px = m.toPixelX(minX - pad);
            const py = m.toPixelY(maxY + pad);
            const pw = m.toPixelW(maxX - minX + pad * 2);
            const ph = m.toPixelH(maxY - minY + pad * 2);

            if (showBorder) {
                const rect = document.createElementNS(this.ns, 'rect');
                rect.setAttribute('x', px);
                rect.setAttribute('y', py);
                rect.setAttribute('width', pw);
                rect.setAttribute('height', ph);
                rect.setAttribute('rx', '5');
                rect.setAttribute('class', 'group-border');
                g.appendChild(rect);
            }

            if (showLabel && label) {
                const t = document.createElementNS(this.ns, 'text');
                t.setAttribute('x', px + 5);
                t.setAttribute('y', py - 5);
                t.setAttribute('class', 'group-label-text');
                t.textContent = label;
                g.appendChild(t);
            }
        });
    }

    /* ---- Rotation Handle ---- */

    clearSelection() {
        this.layers.selection.innerHTML = '';
    }

    drawMarquee(x1, y1, x2, y2) {
        this.layers.selection.innerHTML = '';
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        const r = document.createElementNS(this.ns, 'rect');
        r.setAttribute('x', x);
        r.setAttribute('y', y);
        r.setAttribute('width', w);
        r.setAttribute('height', h);
        r.setAttribute('class', 'selection-marquee');
        this.layers.selection.appendChild(r);
    }

    drawRotationHandle(el) {
        const g = this.layers.selection;
        g.innerHTML = '';

        const m = this.mapper;
        const cx = m.toPixelX(el.x + el.width / 2);
        const cy = m.toPixelY(el.y + el.height / 2);
        const ph = m.toPixelH(el.height);
        const pw = m.toPixelW(el.width);

        const rotation = el.rotation || 0;
        const rad = rotation * Math.PI / 180;
        const handleDist = Math.max(ph, pw) / 2 + 22;

        const hx = cx + handleDist * Math.sin(rad);
        const hy = cy - handleDist * Math.cos(rad);

        const line = document.createElementNS(this.ns, 'line');
        line.setAttribute('x1', cx);
        line.setAttribute('y1', cy);
        line.setAttribute('x2', hx);
        line.setAttribute('y2', hy);
        line.setAttribute('stroke', '#3b82f6');
        line.setAttribute('stroke-width', '1.2');
        line.setAttribute('stroke-dasharray', '3,3');
        line.setAttribute('class', 'rotation-guide');
        g.appendChild(line);

        const circle = document.createElementNS(this.ns, 'circle');
        circle.setAttribute('cx', hx);
        circle.setAttribute('cy', hy);
        circle.setAttribute('r', 9);
        circle.setAttribute('fill', '#3b82f6');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('class', 'rotation-handle');
        g.appendChild(circle);

        const iconR = 3.5;
        const arc = document.createElementNS(this.ns, 'path');
        arc.setAttribute('d',
            `M ${hx + iconR * 0.7} ${hy - iconR * 0.7}` +
            ` A ${iconR} ${iconR} 0 1 0 ${hx + iconR} ${hy + 0.5}`
        );
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', '#fff');
        arc.setAttribute('stroke-width', '1.5');
        arc.setAttribute('stroke-linecap', 'round');
        arc.setAttribute('class', 'rotation-guide');
        g.appendChild(arc);

        const tip = document.createElementNS(this.ns, 'path');
        tip.setAttribute('d',
            `M ${hx + iconR + 2} ${hy - 1.5} L ${hx + iconR} ${hy + 0.5} L ${hx + iconR - 2} ${hy - 1}`
        );
        tip.setAttribute('fill', 'none');
        tip.setAttribute('stroke', '#fff');
        tip.setAttribute('stroke-width', '1.5');
        tip.setAttribute('stroke-linecap', 'round');
        tip.setAttribute('stroke-linejoin', 'round');
        tip.setAttribute('class', 'rotation-guide');
        g.appendChild(tip);

        if (rotation !== 0) {
            const t = document.createElementNS(this.ns, 'text');
            const labelDist = 12;
            const lx = hx + labelDist * Math.sin(rad);
            const ly = hy - labelDist * Math.cos(rad);
            t.setAttribute('x', lx);
            t.setAttribute('y', ly);
            t.setAttribute('class', 'rotation-label');
            t.textContent = `${Math.round(rotation)}\u00b0`;
            g.appendChild(t);
        }
    }

    /* ---- SVG Primitives ---- */

    line(parent, x1, y1, x2, y2, cls, attrs) {
        const l = document.createElementNS(this.ns, 'line');
        l.setAttribute('x1', x1);
        l.setAttribute('y1', y1);
        l.setAttribute('x2', x2);
        l.setAttribute('y2', y2);
        if (cls) l.setAttribute('class', cls);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
        parent.appendChild(l);
        return l;
    }

    rect(parent, x, y, w, h, cls, attrs) {
        const r = document.createElementNS(this.ns, 'rect');
        r.setAttribute('x', x);
        r.setAttribute('y', y);
        r.setAttribute('width', w);
        r.setAttribute('height', h);
        if (cls) r.setAttribute('class', cls);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => r.setAttribute(k, v));
        parent.appendChild(r);
        return r;
    }

    text(parent, x, y, content, cls, anchor, rotation) {
        const t = document.createElementNS(this.ns, 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        if (cls) t.setAttribute('class', cls);
        if (anchor) t.setAttribute('text-anchor', anchor);
        if (rotation) t.setAttribute('transform', `rotate(${rotation}, ${x}, ${y})`);
        t.textContent = content;
        parent.appendChild(t);
        return t;
    }

    drawCircle(parent, cx, cy, r, color) {
        const c = document.createElementNS(this.ns, 'circle');
        c.setAttribute('cx', cx);
        c.setAttribute('cy', cy);
        c.setAttribute('r', r);
        c.setAttribute('fill', color + '30');
        c.setAttribute('stroke', color);
        c.setAttribute('stroke-width', '1.2');
        parent.appendChild(c);
        return c;
    }

    dimArrows(parent, x1, y1, x2, y2) {
        const size = 4;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;

        [
            [x1, y1, ux, uy],
            [x2, y2, -ux, -uy]
        ].forEach(([bx, by, ax, ay]) => {
            const p = document.createElementNS(this.ns, 'polygon');
            p.setAttribute('points', [
                `${bx},${by}`,
                `${bx + ax * size + px * size * 0.5},${by + ay * size + py * size * 0.5}`,
                `${bx + ax * size - px * size * 0.5},${by + ay * size - py * size * 0.5}`
            ].join(' '));
            p.setAttribute('fill', '#6b7280');
            parent.appendChild(p);
        });

        const l = document.createElementNS(this.ns, 'line');
        l.setAttribute('x1', x1);
        l.setAttribute('y1', y1);
        l.setAttribute('x2', x2);
        l.setAttribute('y2', y2);
        l.setAttribute('stroke', '#6b7280');
        l.setAttribute('stroke-width', '1');
        parent.appendChild(l);
    }
}
