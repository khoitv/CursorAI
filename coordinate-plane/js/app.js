/**
 * Main application: wires up rendering, interactivity, and InstantDB persistence.
 * Handles CRUD for elements, legends, and room configuration.
 */

import { ROOM, ELEMENT_TYPES, DEFAULT_ELEMENTS, DEFAULT_LEGENDS, CoordinateMapper } from './coordinates.js';
import { FloorPlanRenderer } from './renderer.js';
import {
    subscribeElements, updateElementPosition, resetElements, seedDefaults,
    createElement, updateElement, deleteElement,
    subscribeLegends, createLegend, updateLegend, deleteLegend, seedLegends,
    subscribeRoomConfig, createRoomConfig, updateRoomConfig
} from './db.js';

const SVG_WIDTH = 740;
const SVG_HEIGHT = 600;

/* ---- State ---- */
let elements = [];
let legends = [];
let roomConfigDbId = null;
let selectedId = null;
let editMode = false;
let dragging = null;
let seededElements = false;
let seededLegends = false;
let seededRoom = false;
let editingLegendId = null;
let editingElementDbId = null;
let rotating = null;

/* ---- DOM Refs ---- */
const svgEl = document.getElementById('floor-plan-svg');
const container = document.getElementById('canvas-container');
const tooltip = document.getElementById('tooltip');

const selPanel = document.getElementById('selection-panel');
const noSelPanel = document.getElementById('no-selection-panel');
const selName = document.getElementById('sel-name');
const selType = document.getElementById('sel-type');
const selPos = document.getElementById('sel-pos');
const selSize = document.getElementById('sel-size');
const selRotation = document.getElementById('sel-rotation');
const mouseCoords = document.getElementById('mouse-coords');

const roomWDisplay = document.getElementById('room-w-display');
const roomHDisplay = document.getElementById('room-h-display');
const roomAreaDisplay = document.getElementById('room-area-display');

const btnGrid = document.getElementById('btn-toggle-grid');
const btnLabels = document.getElementById('btn-toggle-labels');
const btnDims = document.getElementById('btn-toggle-dims');
const btnEdit = document.getElementById('btn-toggle-edit');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');

const modalOverlay = document.getElementById('modal-overlay');

/* ---- Mapper & Renderer ---- */
let mapper = createMapper();
let renderer = createRenderer(mapper);

function createMapper() {
    return new CoordinateMapper(ROOM.width, ROOM.height, SVG_WIDTH, SVG_HEIGHT, {
        top: 30, right: 30, bottom: 30, left: 35
    });
}

function createRenderer(m) {
    return new FloorPlanRenderer(svgEl, m, {
        showGrid: true,
        showLabels: true,
        showDimensions: true
    });
}

function rebuildRenderer() {
    const opts = { ...renderer.options };
    mapper = createMapper();
    svgEl.innerHTML = '';
    renderer = createRenderer(mapper);
    Object.assign(renderer.options, opts);
    renderer.init();
    renderer.render(elements);
    restoreSelection();
}

/* ---- Init ---- */
renderer.init();

subscribeRoomConfig((resp) => {
    if (resp.error) return;
    if (resp.data.length === 0 && !seededRoom) {
        seededRoom = true;
        createRoomConfig({ width: ROOM.width, height: ROOM.height, unit: ROOM.unit });
        return;
    }
    if (resp.data.length > 0) {
        const cfg = resp.data[0];
        roomConfigDbId = cfg.id;
        const changed = ROOM.width !== cfg.width || ROOM.height !== cfg.height || ROOM.unit !== cfg.unit;
        ROOM.width = cfg.width;
        ROOM.height = cfg.height;
        ROOM.unit = cfg.unit;
        updateRoomDisplay();
        if (changed) rebuildRenderer();
    }
});

subscribeLegends((resp) => {
    if (resp.error) return;
    if (resp.data.length === 0 && !seededLegends) {
        seededLegends = true;
        seedLegends(DEFAULT_LEGENDS);
        return;
    }
    legends = resp.data;
    syncElementTypes();
    buildLegend();
    populateTypeSelect();
    renderer.render(elements);
    restoreSelection();
});

subscribeElements((resp) => {
    if (resp.error) {
        console.error('DB error, falling back to defaults');
        elements = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS));
        renderer.render(elements);
        return;
    }
    if (resp.data.length === 0 && !seededElements) {
        seededElements = true;
        seedDefaults(DEFAULT_ELEMENTS);
        return;
    }
    elements = resp.data;
    renderer.render(elements);
    restoreSelection();
    updateSelectionPanel();
});

/* ---- Sync ELEMENT_TYPES from DB legends ---- */
function syncElementTypes() {
    Object.keys(ELEMENT_TYPES).forEach(k => delete ELEMENT_TYPES[k]);
    legends.forEach(l => {
        ELEMENT_TYPES[l.key] = { color: l.color, label: l.label };
    });
}

/* ---- Room Display ---- */
function updateRoomDisplay() {
    roomWDisplay.textContent = `${ROOM.width} ${ROOM.unit}`;
    roomHDisplay.textContent = `${ROOM.height} ${ROOM.unit}`;
    const area = ROOM.width * ROOM.height;
    roomAreaDisplay.textContent = `${area.toLocaleString()} sq ${ROOM.unit}`;
}
updateRoomDisplay();

/* ---- Toolbar Buttons ---- */
btnGrid.addEventListener('click', () => {
    renderer.options.showGrid = !renderer.options.showGrid;
    btnGrid.classList.toggle('active');
    renderer.render(elements);
    restoreSelection();
});

btnLabels.addEventListener('click', () => {
    renderer.options.showLabels = !renderer.options.showLabels;
    btnLabels.classList.toggle('active');
    renderer.render(elements);
    restoreSelection();
});

btnDims.addEventListener('click', () => {
    renderer.options.showDimensions = !renderer.options.showDimensions;
    btnDims.classList.toggle('active');
    renderer.render(elements);
    restoreSelection();
});

btnEdit.addEventListener('click', () => {
    editMode = !editMode;
    btnEdit.classList.toggle('active');
    svgEl.classList.toggle('edit-mode', editMode);
    showRotationHandle();
});

btnReset.addEventListener('click', () => {
    if (confirm('Reset all elements to their default positions?')) {
        selectedId = null;
        updateSelectionPanel();
        resetElements(elements, DEFAULT_ELEMENTS);
    }
});

btnExport.addEventListener('click', () => {
    const exportData = elements.map(({ _dbId, ...rest }) => rest);
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floorplan-elements.json';
    a.click();
    URL.revokeObjectURL(url);
});

/* ======== Modal System ======== */

function openModal(modalId) {
    modalOverlay.classList.add('active');
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    const firstInput = modal.querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function closeAllModals() {
    modalOverlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    editingLegendId = null;
    editingElementDbId = null;
}

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeAllModals();
});

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
});

/* ======== Room Settings Modal ======== */

document.getElementById('btn-edit-room').addEventListener('click', () => {
    document.getElementById('input-room-width').value = ROOM.width;
    document.getElementById('input-room-height').value = ROOM.height;
    document.getElementById('input-room-unit').value = ROOM.unit;
    openModal('modal-room');
});

document.getElementById('btn-save-room').addEventListener('click', () => {
    const w = parseFloat(document.getElementById('input-room-width').value);
    const h = parseFloat(document.getElementById('input-room-height').value);
    const u = document.getElementById('input-room-unit').value;
    if (!w || !h || w <= 0 || h <= 0) return;
    if (roomConfigDbId) {
        updateRoomConfig(roomConfigDbId, { width: w, height: h, unit: u });
    }
    closeAllModals();
});

/* ======== Legend Modal ======== */

const legendColorInput = document.getElementById('input-legend-color');
const legendColorHex = document.getElementById('legend-color-hex');

legendColorInput.addEventListener('input', () => {
    legendColorHex.textContent = legendColorInput.value;
    syncPresetHighlight();
});

document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        legendColorInput.value = btn.dataset.color;
        legendColorHex.textContent = btn.dataset.color;
        syncPresetHighlight();
    });
});

function syncPresetHighlight() {
    const val = legendColorInput.value.toLowerCase();
    document.querySelectorAll('.color-preset').forEach(p => {
        p.classList.toggle('active', p.dataset.color.toLowerCase() === val);
    });
}

document.getElementById('btn-add-legend').addEventListener('click', () => {
    editingLegendId = null;
    document.getElementById('legend-modal-title').textContent = 'Add Legend';
    document.getElementById('input-legend-label').value = '';
    document.getElementById('input-legend-key').value = '';
    legendColorInput.value = '#3b82f6';
    legendColorHex.textContent = '#3b82f6';
    syncPresetHighlight();
    openModal('modal-legend');
});

document.getElementById('btn-save-legend').addEventListener('click', () => {
    const label = document.getElementById('input-legend-label').value.trim();
    let key = document.getElementById('input-legend-key').value.trim();
    const color = legendColorInput.value;

    if (!label) return;
    if (!key) {
        key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    if (editingLegendId) {
        updateLegend(editingLegendId, { label, key, color });
    } else {
        const existing = legends.find(l => l.key === key);
        if (existing) {
            if (!confirm(`A legend with key "${key}" already exists. Use a different key.`)) return;
            return;
        }
        createLegend({ key, label, color });
    }
    closeAllModals();
});

function openEditLegend(legend) {
    editingLegendId = legend.id;
    document.getElementById('legend-modal-title').textContent = 'Edit Legend';
    document.getElementById('input-legend-label').value = legend.label;
    document.getElementById('input-legend-key').value = legend.key;
    legendColorInput.value = legend.color;
    legendColorHex.textContent = legend.color;
    syncPresetHighlight();
    openModal('modal-legend');
}

function handleDeleteLegend(legend) {
    const usedBy = elements.filter(el => el.type === legend.key);
    let msg = `Delete legend "${legend.label}"?`;
    if (usedBy.length > 0) {
        msg += `\n\n${usedBy.length} element(s) currently use this type.`;
    }
    if (confirm(msg)) {
        deleteLegend(legend.id);
    }
}

/* ======== Element Modal ======== */

const elTypeSelect = document.getElementById('input-el-type');
const elTypeDot = document.getElementById('el-type-dot');

function populateTypeSelect() {
    const prevValue = elTypeSelect.value;
    elTypeSelect.innerHTML = '';
    legends.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.key;
        opt.textContent = l.label;
        opt.dataset.color = l.color;
        elTypeSelect.appendChild(opt);
    });
    if (prevValue && [...elTypeSelect.options].some(o => o.value === prevValue)) {
        elTypeSelect.value = prevValue;
    }
    updateTypeDot();
}

function updateTypeDot() {
    const selected = elTypeSelect.selectedOptions[0];
    elTypeDot.style.background = (selected && selected.dataset.color) ? selected.dataset.color : '#ccc';
}

elTypeSelect.addEventListener('change', updateTypeDot);

const elRotationSlider = document.getElementById('input-el-rotation-slider');
const elRotationInput = document.getElementById('input-el-rotation');

elRotationSlider.addEventListener('input', () => {
    elRotationInput.value = elRotationSlider.value;
});
elRotationInput.addEventListener('input', () => {
    elRotationSlider.value = elRotationInput.value;
});

document.getElementById('btn-add-element').addEventListener('click', () => {
    editingElementDbId = null;
    document.getElementById('element-modal-title').textContent = 'Add Element';
    document.getElementById('input-el-label').value = '';
    document.getElementById('input-el-x').value = '0';
    document.getElementById('input-el-y').value = '0';
    document.getElementById('input-el-width').value = '3';
    document.getElementById('input-el-height').value = '2';
    elRotationSlider.value = '0';
    elRotationInput.value = '0';
    populateTypeSelect();
    openModal('modal-element');
});

document.getElementById('btn-edit-element').addEventListener('click', () => {
    if (!selectedId) return;
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    editingElementDbId = el._dbId;
    document.getElementById('element-modal-title').textContent = 'Edit Element';
    document.getElementById('input-el-label').value = el.label;
    document.getElementById('input-el-x').value = el.x;
    document.getElementById('input-el-y').value = el.y;
    document.getElementById('input-el-width').value = el.width;
    document.getElementById('input-el-height').value = el.height;
    elRotationSlider.value = el.rotation || 0;
    elRotationInput.value = el.rotation || 0;
    populateTypeSelect();
    elTypeSelect.value = el.type;
    updateTypeDot();
    openModal('modal-element');
});

document.getElementById('btn-save-element').addEventListener('click', () => {
    const label = document.getElementById('input-el-label').value.trim();
    const type = elTypeSelect.value;
    const x = parseFloat(document.getElementById('input-el-x').value);
    const y = parseFloat(document.getElementById('input-el-y').value);
    const w = parseFloat(document.getElementById('input-el-width').value);
    const h = parseFloat(document.getElementById('input-el-height').value);
    const rot = parseInt(elRotationInput.value) || 0;

    if (!label || !type) return;
    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) return;
    if (w <= 0 || h <= 0) return;

    const clampedX = Math.max(0, Math.min(x, ROOM.width - w));
    const clampedY = Math.max(0, Math.min(y, ROOM.height - h));
    const normRot = ((rot % 360) + 360) % 360;

    if (editingElementDbId) {
        updateElement(editingElementDbId, {
            label,
            type,
            x: clampedX,
            y: clampedY,
            width: w,
            height: h,
            rotation: normRot,
        });
    } else {
        createElement({
            id: `el-${Date.now()}`,
            type,
            label,
            x: clampedX,
            y: clampedY,
            width: w,
            height: h,
            rotation: normRot,
        });
    }
    closeAllModals();
});

/* ======== Delete Element ======== */

document.getElementById('btn-delete-element').addEventListener('click', () => {
    if (!selectedId) return;
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    if (confirm(`Delete "${el.label}"?`)) {
        deleteElement(el._dbId);
        selectedId = null;
        updateSelectionPanel();
    }
});

/* ======== Legend List (Sidebar) ======== */

function buildLegend() {
    const list = document.getElementById('legend-list');
    list.innerHTML = '';
    const seen = new Set();

    legends.forEach(l => {
        if (seen.has(l.key)) return;
        seen.add(l.key);

        const item = document.createElement('div');
        item.className = 'legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = l.color + '40';
        swatch.style.border = `2px solid ${l.color}`;

        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = l.label;

        const actions = document.createElement('div');
        actions.className = 'legend-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn icon-btn-sm';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M10.5 1.5l2 2L4.5 11.5H2.5v-2l8-8z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditLegend(l); });

        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn icon-btn-sm icon-btn-danger';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M4 4v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteLegend(l); });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

/* ======== SVG Events ======== */

svgEl.addEventListener('mousemove', (e) => {
    const pt = svgPoint(e);
    const lx = mapper.toLogicalX(pt.x);
    const ly = mapper.toLogicalY(pt.y);

    if (lx >= 0 && lx <= ROOM.width && ly >= 0 && ly <= ROOM.height) {
        mouseCoords.textContent = `(${lx.toFixed(1)}, ${ly.toFixed(1)}) ${ROOM.unit}`;
    } else {
        mouseCoords.textContent = '\u2014';
    }

    const target = e.target.closest('.floor-element');
    if (target && !dragging && !rotating) {
        const el = elements.find(el => el.id === target.dataset.id);
        if (el) {
            tooltip.textContent = `${el.label} (${el.x}, ${el.y})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX - container.getBoundingClientRect().left + 12) + 'px';
            tooltip.style.top = (e.clientY - container.getBoundingClientRect().top - 10) + 'px';
        }
    } else if (!rotating) {
        tooltip.style.display = 'none';
    }

    if (rotating) {
        tooltip.style.display = 'none';
        const el = elements.find(el => el.id === rotating.id);
        if (el) {
            let angle = Math.atan2(pt.x - rotating.centerX, rotating.centerY - pt.y) * (180 / Math.PI);
            if (e.shiftKey) {
                angle = Math.round(angle / 15) * 15;
            } else {
                angle = Math.round(angle);
            }
            el.rotation = ((angle % 360) + 360) % 360;
            renderer.render(elements);
            restoreSelection();
            showRotationHandle();
            updateSelectionPanel();
        }
        return;
    }

    if (dragging) {
        const el = elements.find(el => el.id === dragging.id);
        if (el) {
            el.x = Math.round((mapper.toLogicalX(pt.x) - dragging.offsetX) * 2) / 2;
            el.y = Math.round((mapper.toLogicalY(pt.y) - dragging.offsetY) * 2) / 2;
            el.x = Math.max(0, Math.min(el.x, ROOM.width - el.width));
            el.y = Math.max(0, Math.min(el.y, ROOM.height - el.height));
            renderer.render(elements);
            restoreSelection();
            showRotationHandle();
            updateSelectionPanel();
        }
    }
});

svgEl.addEventListener('mousedown', (e) => {
    if (editMode && e.target.closest('.rotation-handle')) {
        const el = elements.find(e => e.id === selectedId);
        if (el) {
            rotating = {
                id: el.id,
                centerX: mapper.toPixelX(el.x + el.width / 2),
                centerY: mapper.toPixelY(el.y + el.height / 2),
            };
            e.preventDefault();
            return;
        }
    }

    const target = e.target.closest('.floor-element');
    if (target) {
        const id = target.dataset.id;
        selectElement(id);

        if (editMode) {
            const pt = svgPoint(e);
            const el = elements.find(el => el.id === id);
            if (el) {
                dragging = {
                    id: id,
                    offsetX: mapper.toLogicalX(pt.x) - el.x,
                    offsetY: mapper.toLogicalY(pt.y) - el.y
                };
                e.preventDefault();
            }
        }
    } else {
        deselectAll();
    }
});

svgEl.addEventListener('mouseup', () => {
    if (rotating) {
        const el = elements.find(el => el.id === rotating.id);
        if (el && el._dbId) {
            updateElement(el._dbId, { rotation: el.rotation || 0 });
        }
        rotating = null;
        return;
    }
    if (dragging) {
        const el = elements.find(el => el.id === dragging.id);
        if (el && el._dbId) {
            updateElementPosition(el._dbId, el.x, el.y);
        }
        dragging = null;
    }
});

svgEl.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    if (rotating) {
        const el = elements.find(el => el.id === rotating.id);
        if (el && el._dbId) {
            updateElement(el._dbId, { rotation: el.rotation || 0 });
        }
        rotating = null;
    }
    if (dragging) {
        const el = elements.find(el => el.id === dragging.id);
        if (el && el._dbId) {
            updateElementPosition(el._dbId, el.x, el.y);
        }
        dragging = null;
    }
});

/* ======== Selection ======== */

function selectElement(id) {
    selectedId = id;
    document.querySelectorAll('.floor-element').forEach(g => g.classList.remove('selected'));
    const el = svgEl.querySelector(`.floor-element[data-id="${id}"]`);
    if (el) el.classList.add('selected');
    showRotationHandle();
    updateSelectionPanel();
}

function deselectAll() {
    selectedId = null;
    document.querySelectorAll('.floor-element').forEach(g => g.classList.remove('selected'));
    renderer.clearSelection();
    updateSelectionPanel();
}

function restoreSelection() {
    if (selectedId) {
        const el = svgEl.querySelector(`.floor-element[data-id="${selectedId}"]`);
        if (el) el.classList.add('selected');
    }
}

function showRotationHandle() {
    renderer.clearSelection();
    if (!editMode || !selectedId) return;
    const el = elements.find(e => e.id === selectedId);
    if (el) renderer.drawRotationHandle(el);
}

function updateSelectionPanel() {
    if (selectedId) {
        const el = elements.find(e => e.id === selectedId);
        if (el) {
            selPanel.style.display = '';
            noSelPanel.style.display = 'none';
            selName.textContent = el.label;
            selType.textContent = ELEMENT_TYPES[el.type]?.label || el.type;
            selPos.textContent = `(${el.x}, ${el.y}) ${ROOM.unit}`;
            selSize.textContent = `${el.width} \u00d7 ${el.height} ${ROOM.unit}`;
            selRotation.textContent = `${el.rotation || 0}\u00b0`;
            return;
        }
    }
    selPanel.style.display = 'none';
    noSelPanel.style.display = '';
}

/* ======== Utility ======== */

function svgPoint(mouseEvent) {
    const pt = svgEl.createSVGPoint();
    pt.x = mouseEvent.clientX;
    pt.y = mouseEvent.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}
