/**
 * Coordinate system and element definitions for the floor plan.
 * Origin (0,0) is at the bottom-left corner. X runs left-to-right, Y runs bottom-to-top.
 * FLOOR (plot bounds) and ELEMENT_TYPES are mutable — updated at runtime from DB subscriptions.
 */

export const FLOOR = {
    width: 42,
    height: 32,
    unit: 'ft'
};

export const ELEMENT_TYPES = {
    wall:      { color: '#374151', label: 'Wall' },
    door:      { color: '#92400e', label: 'Door' },
    whiteboard:{ color: '#6366f1', label: 'Whiteboard' },
    desk:      { color: '#f59e0b', label: 'Teacher Desk' },
    cluster:   { color: '#10b981', label: 'Student Desks' },
    table:     { color: '#10b981', label: 'Student Table' },
    computer:  { color: '#8b5cf6', label: 'Computer Station' },
    computerDesk: { color: '#8b5cf6', label: 'Computer Desk' },
    computerChair: { color: '#7c3aed', label: 'Computer Chair' },
    storage:   { color: '#6b7280', label: 'Student Storage' },
    library:   { color: '#ec4899', label: 'Class Library' },
    zone:      { color: '#06b6d4', label: 'Reading Area' },
    furniture: { color: '#78716c', label: 'Furniture' }
};

/** Geometric shape shown for elements of this legend type. */
export const LEGEND_SHAPE_KEYS = [
    'circle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon',
    'ellipse', 'parallelogram', 'trapezoid',
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

export const LEGEND_BORDER_KEYS = ['solid', 'dashed', 'dotted'];

export const LEGEND_BORDER_LABELS = {
    solid: 'Solid',
    dashed: 'Dashed',
    dotted: 'Dotted',
};

export function normalizeLegendShape(s) {
    const v = String(s || '').toLowerCase().trim();
    return LEGEND_SHAPE_KEYS.includes(v) ? v : 'rectangle';
}

export function normalizeLegendBorderStyle(s) {
    const v = String(s || '').toLowerCase().trim();
    return LEGEND_BORDER_KEYS.includes(v) ? v : 'solid';
}

export function normalizeLegendBorderColor(c, fallback) {
    const expand = (hex) => {
        if (hex.length === 4) {
            return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
        }
        return hex.toLowerCase();
    };
    const t = String(c || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) {
        return expand(t);
    }
    const f = String(fallback || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(f)) {
        return expand(f);
    }
    return '#374151';
}

export function normalizeLegendBorderSize(n) {
    const x = parseFloat(n);
    if (Number.isFinite(x) && x >= 0.25 && x <= 12) return x;
    return 1.5;
}

/**
 * Draw style for an element from its legend (type) only — shape, border, and colors come from ELEMENT_TYPES.
 */
export function mergeElementDrawStyle(_el, typeInfo) {
    const ti = typeInfo || {};
    const fillColor = ti.color || '#999999';
    return {
        shape: normalizeLegendShape(ti.shape),
        fillColor,
        strokeColor: normalizeLegendBorderColor(ti.borderColor, fillColor),
        strokeWidth: normalizeLegendBorderSize(ti.borderSize),
        borderStyle: normalizeLegendBorderStyle(ti.borderStyle),
    };
}

export const DEFAULT_LEGENDS = Object.entries(ELEMENT_TYPES).map(([key, val]) => ({
    key,
    label: val.label,
    color: val.color,
    shape: 'rectangle',
    borderStyle: 'solid',
    borderColor: val.color,
    borderSize: 1.5,
}));

export const DEFAULT_ELEMENTS = [
    {
        id: 'whiteboard',
        type: 'whiteboard',
        label: 'Whiteboard',
        x: 12, y: 30.5,
        width: 16, height: 1.2
    },
    {
        id: 'teacher-desk',
        type: 'desk',
        label: 'Teacher Desk',
        x: 33, y: 27,
        width: 6, height: 4
    },
    {
        id: 'table-1',
        type: 'table',
        label: 'Table 1',
        x: 12, y: 21,
        width: 3, height: 2.5
    },
    {
        id: 'table-2',
        type: 'table',
        label: 'Table 2',
        x: 21, y: 21,
        width: 3, height: 2.5
    },
    {
        id: 'table-3',
        type: 'table',
        label: 'Table 3',
        x: 12, y: 13,
        width: 3, height: 2.5
    },
    {
        id: 'table-4',
        type: 'table',
        label: 'Table 4',
        x: 21, y: 13,
        width: 3, height: 2.5
    },
    {
        id: 'computer-1-desk',
        type: 'computerDesk',
        label: 'Computer 1 Desk',
        x: 0.4, y: 22,
        width: 3, height: 2.5
    },
    {
        id: 'computer-1-chair',
        type: 'computerChair',
        label: 'Computer 1 Chair',
        x: 3.45, y: 22.1,
        width: 0.85, height: 2.3
    },
    {
        id: 'computer-2-desk',
        type: 'computerDesk',
        label: 'Computer 2 Desk',
        x: 0.4, y: 18,
        width: 3, height: 2.5
    },
    {
        id: 'computer-2-chair',
        type: 'computerChair',
        label: 'Computer 2 Chair',
        x: 3.45, y: 18.1,
        width: 0.85, height: 2.3
    },
    {
        id: 'computer-3-desk',
        type: 'computerDesk',
        label: 'Computer 3 Desk',
        x: 0.4, y: 14,
        width: 3, height: 2.5
    },
    {
        id: 'computer-3-chair',
        type: 'computerChair',
        label: 'Computer 3 Chair',
        x: 3.45, y: 14.1,
        width: 0.85, height: 2.3
    },
    {
        id: 'storage',
        type: 'storage',
        label: 'Student Storage',
        x: 2, y: 0.5,
        width: 22, height: 2.5
    },
    {
        id: 'library-1',
        type: 'library',
        label: 'Class Library',
        x: 39.5, y: 17,
        width: 2, height: 2
    },
    {
        id: 'library-2',
        type: 'library',
        label: 'Class Library',
        x: 39.5, y: 14.5,
        width: 2, height: 2
    },
    {
        id: 'reading-zone',
        type: 'zone',
        label: 'Reading Area',
        x: 28, y: 3,
        width: 13, height: 10
    },
    {
        id: 'sofa',
        type: 'furniture',
        label: 'Sofa',
        x: 30, y: 8,
        width: 8, height: 2
    },
    {
        id: 'sofa-side',
        type: 'furniture',
        label: 'Sofa',
        x: 36, y: 5,
        width: 2, height: 5
    },
    {
        id: 'rug',
        type: 'zone',
        label: 'Rug',
        x: 31, y: 4,
        width: 6, height: 5
    },
    {
        id: 'beanbag-1',
        type: 'furniture',
        label: 'Beanbag Chair',
        x: 30, y: 4.5,
        width: 1.8, height: 1.8
    },
    {
        id: 'beanbag-2',
        type: 'furniture',
        label: 'Beanbag Chair',
        x: 35, y: 4.5,
        width: 1.8, height: 1.8
    },
    {
        id: 'door-top',
        type: 'door',
        label: 'Door',
        x: 3, y: 30,
        width: 3.5, height: 2,
        swing: 'inward'
    },
    {
        id: 'door-bottom',
        type: 'door',
        label: 'Door',
        x: 26, y: 0,
        width: 3.5, height: 2,
        swing: 'outward'
    }
];

/**
 * Coordinate mapper: converts logical floor plan coordinates to SVG pixel coords.
 */
export class CoordinateMapper {
    constructor(floorWidth, floorHeight, svgWidth, svgHeight, padding) {
        this.floorW = floorWidth;
        this.floorH = floorHeight;
        this.padding = padding || { top: 30, right: 20, bottom: 30, left: 35 };
        this.svgW = svgWidth;
        this.svgH = svgHeight;
        this.drawW = svgWidth - this.padding.left - this.padding.right;
        this.drawH = svgHeight - this.padding.top - this.padding.bottom;
        this.scaleX = this.drawW / floorWidth;
        this.scaleY = this.drawH / floorHeight;
    }

    toPixelX(logicalX) {
        return this.padding.left + logicalX * this.scaleX;
    }

    toPixelY(logicalY) {
        return this.padding.top + (this.floorH - logicalY) * this.scaleY;
    }

    toPixelW(logicalW) {
        return logicalW * this.scaleX;
    }

    toPixelH(logicalH) {
        return logicalH * this.scaleY;
    }

    toLogicalX(pixelX) {
        return (pixelX - this.padding.left) / this.scaleX;
    }

    toLogicalY(pixelY) {
        return this.floorH - (pixelY - this.padding.top) / this.scaleY;
    }
}
