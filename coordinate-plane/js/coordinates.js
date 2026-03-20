/**
 * Coordinate system and element definitions for the 42×32 ft classroom floor plan.
 * Origin (0,0) is at the bottom-left corner. X runs left-to-right, Y runs bottom-to-top.
 */

export const ROOM = {
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

export const DEFAULT_ELEMENTS = [
    // Whiteboard — centered along top wall
    {
        id: 'whiteboard',
        type: 'whiteboard',
        label: 'Whiteboard',
        x: 12, y: 30.5,
        width: 16, height: 1.2
    },

    // Teacher desk — top-right corner
    {
        id: 'teacher-desk',
        type: 'desk',
        label: 'Teacher Desk',
        x: 33, y: 27,
        width: 6, height: 4
    },

    // Student tables — 4 individual tables
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

    // Computer stations — desk + chair as separate elements (3 pairs along left wall)
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

    // Student storage — cubbies along bottom wall
    {
        id: 'storage',
        type: 'storage',
        label: 'Student Storage',
        x: 2, y: 0.5,
        width: 22, height: 2.5
    },

    // Class library — shelves on right wall
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

    // Reading area zone
    {
        id: 'reading-zone',
        type: 'zone',
        label: 'Reading Area',
        x: 28, y: 3,
        width: 13, height: 10
    },

    // Sofa (L-shaped) inside reading area
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

    // Rug
    {
        id: 'rug',
        type: 'zone',
        label: 'Rug',
        x: 31, y: 4,
        width: 6, height: 5
    },

    // Beanbag chairs
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

    // Doors
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
    constructor(roomWidth, roomHeight, svgWidth, svgHeight, padding) {
        this.roomW = roomWidth;
        this.roomH = roomHeight;
        this.padding = padding || { top: 30, right: 20, bottom: 30, left: 35 };
        this.svgW = svgWidth;
        this.svgH = svgHeight;
        this.drawW = svgWidth - this.padding.left - this.padding.right;
        this.drawH = svgHeight - this.padding.top - this.padding.bottom;
        this.scaleX = this.drawW / roomWidth;
        this.scaleY = this.drawH / roomHeight;
    }

    toPixelX(logicalX) {
        return this.padding.left + logicalX * this.scaleX;
    }

    toPixelY(logicalY) {
        return this.padding.top + (this.roomH - logicalY) * this.scaleY;
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
        return this.roomH - (pixelY - this.padding.top) / this.scaleY;
    }
}
