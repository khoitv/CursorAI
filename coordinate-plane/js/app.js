/**
 * Main application: wires up rendering, interactivity, and InstantDB persistence.
 * Handles CRUD for elements, legends, and floor plot configuration.
 * Supports multi-selection via Ctrl+click and marquee sweep.
 */

import {
    FLOOR, ELEMENT_TYPES, DEFAULT_ELEMENTS, DEFAULT_LEGENDS, CoordinateMapper,
    LEGEND_SHAPE_KEYS, LEGEND_SHAPE_LABELS, LEGEND_BORDER_KEYS, LEGEND_BORDER_LABELS,
    normalizeLegendShape, normalizeLegendBorderStyle, normalizeLegendBorderColor, normalizeLegendBorderSize,
    mergeElementDrawStyle,
} from './coordinates.js';
import { appendStyledShape, SVG_NS } from './legendDrawHelpers.js';
import { FloorPlanRenderer } from './renderer.js';
import {
    subscribeElements, updateElementPosition, resetElements, seedDefaults,
    createElement, updateElement, deleteElement,
    subscribeLegends, createLegend, updateLegend, deleteLegend, seedLegends,
    subscribeFloorPlotConfig, createFloorPlotConfig, updateFloorPlotConfig,
    subscribeGroups, createGroup, updateGroupMeta, deleteGroupMeta
} from './db.js';

const SVG_WIDTH = 740;
const SVG_HEIGHT = 600;

/* ---- State ---- */
let elements = [];
let legends = [];
let groupMetas = [];
let floorPlotConfigDbId = null;
let selectedIds = new Set();
let editMode = false;
let dragging = null;
let rotating = null;
let marquee = null;
let panning = null;
let panMode = false;
let spaceHeld = false;
let viewBox = { x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT };
let seededElements = false;
let seededLegends = false;
let seededFloorPlot = false;
let editingLegendId = null;
let editingElementDbId = null;
let activeLegendKey = null;
let floorResizing = null;

const FLOOR_RESIZE_MIN = 4;
const FLOOR_RESIZE_MAX = 200;

/* ---- DOM Refs ---- */
const svgEl = document.getElementById('floor-plan-svg');
const container = document.getElementById('canvas-container');
const tooltip = document.getElementById('tooltip');

const selPanel = document.getElementById('selection-panel');
const multiSelPanel = document.getElementById('multi-selection-panel');
const noSelPanel = document.getElementById('no-selection-panel');
const selName = document.getElementById('sel-name');
const selType = document.getElementById('sel-type');
const selPos = document.getElementById('sel-pos');
const selSize = document.getElementById('sel-size');
const selRotation = document.getElementById('sel-rotation');
const selAppearance = document.getElementById('sel-appearance');
const selCount = document.getElementById('sel-count');
const mouseCoords = document.getElementById('mouse-coords');

const floorWDisplay = document.getElementById('floor-w-display');
const floorHDisplay = document.getElementById('floor-h-display');
const floorAreaDisplay = document.getElementById('floor-area-display');

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
    return new CoordinateMapper(FLOOR.width, FLOOR.height, SVG_WIDTH, SVG_HEIGHT, {
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
    const gm = renderer.groupMetas;
    mapper = createMapper();
    svgEl.innerHTML = '';
    renderer = createRenderer(mapper);
    Object.assign(renderer.options, opts);
    renderer.groupMetas = gm;
    renderer.init();
    renderer.render(elements);
    restoreSelection();
    resetZoom();
}

/* ---- Zoom / Pan ---- */

function updateViewBox() {
    const minW = SVG_WIDTH / 8;
    const maxW = SVG_WIDTH * 4;
    viewBox.w = Math.max(minW, Math.min(maxW, viewBox.w));
    viewBox.h = viewBox.w * SVG_HEIGHT / SVG_WIDTH;
    svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);

    const pct = Math.round(SVG_WIDTH / viewBox.w * 100);
    document.getElementById('zoom-level').textContent = `${pct}%`;

    if (pct === 100 && panMode) setPanMode(false);
}

function zoomAtPoint(factor, svgX, svgY) {
    const nx = (svgX - viewBox.x) / viewBox.w;
    const ny = (svgY - viewBox.y) / viewBox.h;
    viewBox.w /= factor;
    viewBox.h /= factor;
    viewBox.x = svgX - nx * viewBox.w;
    viewBox.y = svgY - ny * viewBox.h;
    updateViewBox();
}

function resetZoom() {
    viewBox = { x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT };
    if (panMode) setPanMode(false);
    updateViewBox();
}

function setPanMode(on) {
    panMode = on;
    document.getElementById('btn-pan-mode').classList.toggle('active', on);
    svgEl.classList.toggle('pan-ready', on);
}

container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pt = svgPoint(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAtPoint(factor, pt.x, pt.y);
}, { passive: false });

document.getElementById('btn-zoom-in').addEventListener('click', () => {
    zoomAtPoint(1.3, viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
    zoomAtPoint(1 / 1.3, viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2);
});

document.getElementById('btn-zoom-fit').addEventListener('click', resetZoom);

document.getElementById('btn-pan-mode').addEventListener('click', () => {
    setPanMode(!panMode);
});

/* ---- Init ---- */
renderer.init();

subscribeFloorPlotConfig((resp) => {
    if (resp.error) return;
    if (resp.data.length === 0 && !seededFloorPlot) {
        seededFloorPlot = true;
        createFloorPlotConfig({ width: FLOOR.width, height: FLOOR.height, unit: FLOOR.unit });
        return;
    }
    if (resp.data.length > 0) {
        const cfg = resp.data[0];
        floorPlotConfigDbId = cfg.id;
        const changed = FLOOR.width !== cfg.width || FLOOR.height !== cfg.height || FLOOR.unit !== cfg.unit;
        FLOOR.width = cfg.width;
        FLOOR.height = cfg.height;
        FLOOR.unit = cfg.unit;
        updateFloorPlotDisplay();
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

subscribeGroups((resp) => {
    if (resp.error) return;
    groupMetas = resp.data || [];
    renderer.groupMetas = groupMetas;
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
        ELEMENT_TYPES[l.key] = {
            color: l.color,
            label: l.label,
            shape: normalizeLegendShape(l.shape),
            borderStyle: normalizeLegendBorderStyle(l.borderStyle),
            borderColor: normalizeLegendBorderColor(l.borderColor, l.color),
            borderSize: normalizeLegendBorderSize(l.borderSize),
        };
    });
}

/* ---- Floor plot display ---- */
function updateFloorPlotDisplay() {
    floorWDisplay.textContent = `${FLOOR.width} ${FLOOR.unit}`;
    floorHDisplay.textContent = `${FLOOR.height} ${FLOOR.unit}`;
    const area = FLOOR.width * FLOOR.height;
    floorAreaDisplay.textContent = `${area.toLocaleString()} sq ${FLOOR.unit}`;
}
updateFloorPlotDisplay();

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
        clearSelection();
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
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (!spaceHeld) {
            spaceHeld = true;
            svgEl.classList.add('pan-ready');
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spaceHeld = false;
        if (!panMode) svgEl.classList.remove('pan-ready');
    }
});

/* ======== Floor plot settings modal ======== */

document.getElementById('btn-edit-floor-plot').addEventListener('click', () => {
    document.getElementById('input-floor-plot-width').value = FLOOR.width;
    document.getElementById('input-floor-plot-height').value = FLOOR.height;
    document.getElementById('input-floor-plot-unit').value = FLOOR.unit;
    openModal('modal-floor-plot');
});

document.getElementById('btn-save-floor-plot').addEventListener('click', () => {
    const w = parseFloat(document.getElementById('input-floor-plot-width').value);
    const h = parseFloat(document.getElementById('input-floor-plot-height').value);
    const u = document.getElementById('input-floor-plot-unit').value;
    if (!w || !h || w <= 0 || h <= 0) return;
    if (floorPlotConfigDbId) {
        updateFloorPlotConfig(floorPlotConfigDbId, { width: w, height: h, unit: u });
    }
    closeAllModals();
});

/* ======== Legend Modal ======== */

const legendColorInput = document.getElementById('input-legend-color');
const legendColorHex = document.getElementById('legend-color-hex');
const legendBorderColorInput = document.getElementById('input-legend-border-color');
const legendBorderColorHex = document.getElementById('legend-border-color-hex');

/** #rrggbb or null if not a complete 3- or 6-digit hex (optional leading #). */
function parseHexForColorInput(str) {
    const t = String(str || '').trim();
    if (!t) return null;
    const s = t.startsWith('#') ? t : `#${t}`;
    const hex = s.slice(1).toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) {
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) {
        return `#${hex}`;
    }
    return null;
}

function legendResolvedHex(textInput, colorInput) {
    const parsed = parseHexForColorInput(textInput?.value);
    if (parsed) return parsed;
    return colorInput?.value || '#000000';
}

function populateLegendShapeSelect(value) {
    const sel = document.getElementById('input-legend-shape');
    if (!sel) return;
    sel.innerHTML = '';
    LEGEND_SHAPE_KEYS.forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = LEGEND_SHAPE_LABELS[key] || key;
        sel.appendChild(opt);
    });
    const v = normalizeLegendShape(value);
    sel.value = LEGEND_SHAPE_KEYS.includes(v) ? v : 'rectangle';
}

function populateLegendBorderSelect(value) {
    const sel = document.getElementById('input-legend-border-style');
    if (!sel) return;
    sel.innerHTML = '';
    LEGEND_BORDER_KEYS.forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = LEGEND_BORDER_LABELS[key] || key;
        sel.appendChild(opt);
    });
    const v = normalizeLegendBorderStyle(value);
    sel.value = LEGEND_BORDER_KEYS.includes(v) ? v : 'solid';
}

legendColorInput.addEventListener('input', () => {
    if (legendColorHex) legendColorHex.value = legendColorInput.value.toLowerCase();
    syncPresetHighlight();
});

if (legendColorHex) {
    legendColorHex.addEventListener('input', () => {
        const p = parseHexForColorInput(legendColorHex.value);
        if (p) {
            legendColorInput.value = p;
            syncPresetHighlight();
        }
    });
    legendColorHex.addEventListener('blur', () => {
        const p = parseHexForColorInput(legendColorHex.value);
        if (p) legendColorHex.value = p;
    });
}

legendBorderColorInput.addEventListener('input', () => {
    if (legendBorderColorHex) legendBorderColorHex.value = legendBorderColorInput.value.toLowerCase();
});

if (legendBorderColorHex) {
    legendBorderColorHex.addEventListener('input', () => {
        const p = parseHexForColorInput(legendBorderColorHex.value);
        if (p) legendBorderColorInput.value = p;
    });
    legendBorderColorHex.addEventListener('blur', () => {
        const p = parseHexForColorInput(legendBorderColorHex.value);
        if (p) legendBorderColorHex.value = p;
    });
}

document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        legendColorInput.value = btn.dataset.color;
        if (legendColorHex) legendColorHex.value = btn.dataset.color;
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
    if (legendColorHex) legendColorHex.value = '#3b82f6';
    populateLegendShapeSelect('rectangle');
    populateLegendBorderSelect('solid');
    legendBorderColorInput.value = '#3b82f6';
    if (legendBorderColorHex) legendBorderColorHex.value = '#3b82f6';
    document.getElementById('input-legend-border-size').value = '1.5';
    syncPresetHighlight();
    openModal('modal-legend');
});

document.getElementById('btn-save-legend').addEventListener('click', () => {
    const label = document.getElementById('input-legend-label').value.trim();
    let key = document.getElementById('input-legend-key').value.trim();
    const color = normalizeLegendBorderColor(legendResolvedHex(legendColorHex, legendColorInput), '#3b82f6');
    const shape = normalizeLegendShape(document.getElementById('input-legend-shape').value);
    const borderStyle = normalizeLegendBorderStyle(document.getElementById('input-legend-border-style').value);
    const borderColor = normalizeLegendBorderColor(legendResolvedHex(legendBorderColorHex, legendBorderColorInput), color);
    const borderSize = normalizeLegendBorderSize(document.getElementById('input-legend-border-size').value);

    if (!label) return;
    if (!key) {
        key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    if (editingLegendId) {
        updateLegend(editingLegendId, { label, key, color, shape, borderStyle, borderColor, borderSize });
    } else {
        const existing = legends.find(l => l.key === key);
        if (existing) {
            if (!confirm(`A legend with key "${key}" already exists. Use a different key.`)) return;
            return;
        }
        createLegend({ key, label, color, shape, borderStyle, borderColor, borderSize });
    }
    closeAllModals();
});

function openEditLegend(legend) {
    editingLegendId = legend.id;
    document.getElementById('legend-modal-title').textContent = 'Edit Legend';
    document.getElementById('input-legend-label').value = legend.label;
    document.getElementById('input-legend-key').value = legend.key;
    const fillHex = normalizeLegendBorderColor(legend.color, '#3b82f6');
    legendColorInput.value = fillHex;
    if (legendColorHex) legendColorHex.value = fillHex;
    populateLegendShapeSelect(legend.shape);
    populateLegendBorderSelect(legend.borderStyle);
    const bc = normalizeLegendBorderColor(legend.borderColor, legend.color);
    legendBorderColorInput.value = bc;
    if (legendBorderColorHex) legendBorderColorHex.value = bc;
    document.getElementById('input-legend-border-size').value = String(normalizeLegendBorderSize(legend.borderSize));
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
    if (selectedIds.size !== 1) return;
    const el = elements.find(e => e.id === [...selectedIds][0]);
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

    const clampedX = Math.max(0, Math.min(x, FLOOR.width - w));
    const clampedY = Math.max(0, Math.min(y, FLOOR.height - h));
    const normRot = ((rot % 360) + 360) % 360;

    if (editingElementDbId) {
        updateElement(editingElementDbId, {
            label, type,
            x: clampedX, y: clampedY,
            width: w, height: h,
            rotation: normRot,
        });
    } else {
        createElement({
            id: `el-${Date.now()}`,
            type, label,
            x: clampedX, y: clampedY,
            width: w, height: h,
            rotation: normRot,
        });
    }
    closeAllModals();
});

/* ======== Delete Elements ======== */

document.getElementById('btn-delete-element').addEventListener('click', () => {
    if (selectedIds.size !== 1) return;
    const el = elements.find(e => e.id === [...selectedIds][0]);
    if (!el) return;
    if (confirm(`Delete "${el.label}"?`)) {
        deleteElement(el._dbId);
        clearSelection();
        updateSelectionPanel();
    }
});

document.getElementById('btn-delete-selected').addEventListener('click', () => {
    if (selectedIds.size < 2) return;
    if (confirm(`Delete ${selectedIds.size} selected elements?`)) {
        for (const id of selectedIds) {
            const el = elements.find(e => e.id === id);
            if (el && el._dbId) deleteElement(el._dbId);
        }
        clearSelection();
        updateSelectionPanel();
    }
});

/* ======== Group / Ungroup ======== */

document.getElementById('btn-group-elements').addEventListener('click', () => {
    if (selectedIds.size < 2) return;
    document.getElementById('input-group-label').value = '';
    document.getElementById('input-group-border').checked = true;
    document.getElementById('input-group-label-visible').checked = true;
    openModal('modal-group');
});

document.getElementById('btn-save-group').addEventListener('click', () => {
    if (selectedIds.size < 2) return;
    const label = document.getElementById('input-group-label').value.trim();
    const showBorder = document.getElementById('input-group-border').checked;
    const showLabel = document.getElementById('input-group-label-visible').checked;

    const gid = `group-${Date.now()}`;
    for (const id of selectedIds) {
        const el = elements.find(e => e.id === id);
        if (el && el._dbId) {
            updateElement(el._dbId, { groupId: gid });
        }
    }
    createGroup({ groupId: gid, label, showBorder, showLabel });
    closeAllModals();
});

document.getElementById('btn-ungroup-elements').addEventListener('click', () => {
    const groupIdsToRemove = new Set();
    for (const id of selectedIds) {
        const el = elements.find(e => e.id === id);
        if (el && el._dbId && el.groupId) {
            groupIdsToRemove.add(el.groupId);
            updateElement(el._dbId, { groupId: '' });
        }
    }
    for (const gid of groupIdsToRemove) {
        const meta = groupMetas.find(g => g.groupId === gid);
        if (meta) deleteGroupMeta(meta.id);
    }
});

/* ======== Inline Group Config ======== */

function getCurrentGroupMeta() {
    const selEls = [...selectedIds].map(id => elements.find(e => e.id === id)).filter(Boolean);
    const gids = [...new Set(selEls.filter(e => e.groupId).map(e => e.groupId))];
    if (gids.length !== 1) return null;
    return groupMetas.find(g => g.groupId === gids[0]) || null;
}

document.getElementById('group-label-input').addEventListener('change', (e) => {
    const meta = getCurrentGroupMeta();
    if (meta) updateGroupMeta(meta.id, { label: e.target.value.trim() });
});

document.getElementById('group-show-border').addEventListener('change', (e) => {
    const meta = getCurrentGroupMeta();
    if (meta) updateGroupMeta(meta.id, { showBorder: e.target.checked });
});

document.getElementById('group-show-label').addEventListener('change', (e) => {
    const meta = getCurrentGroupMeta();
    if (meta) updateGroupMeta(meta.id, { showLabel: e.target.checked });
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
        item.dataset.legendKey = l.key;

        const previewWrap = document.createElement('span');
        previewWrap.className = 'legend-shape-preview';
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 18 18');
        svg.setAttribute('class', 'legend-shape-svg');
        const g = document.createElementNS(SVG_NS, 'g');
        svg.appendChild(g);
        const prevStroke = Math.min(2.25, normalizeLegendBorderSize(l.borderSize));
        appendStyledShape(g, SVG_NS, 1, 1, 16, 16, {
            shape: normalizeLegendShape(l.shape),
            fillColor: l.color,
            strokeColor: normalizeLegendBorderColor(l.borderColor, l.color),
            strokeWidth: prevStroke,
            borderStyle: normalizeLegendBorderStyle(l.borderStyle),
        });
        previewWrap.appendChild(svg);

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

        item.addEventListener('click', () => legendClick(l.key));
        item.addEventListener('mouseenter', () => legendHoverIn(l.key));
        item.addEventListener('mouseleave', legendHoverOut);

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        item.appendChild(previewWrap);
        item.appendChild(label);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

/* ======== Legend Click / Hover ======== */

function legendClick(key) {
    if (activeLegendKey === key) {
        activeLegendKey = null;
        clearSelection();
    } else {
        activeLegendKey = key;
        clearSelection();
        elements.filter(el => el.type === key).forEach(el => addToSelection(el.id));
        expandGroupsInSelection();
    }
    syncActiveLegendItem();
    showRotationHandle();
    updateSelectionPanel();
}

function syncActiveLegendItem() {
    document.querySelectorAll('.legend-item').forEach(item => {
        item.classList.toggle('active', item.dataset.legendKey === activeLegendKey);
    });
}

function legendHoverIn(key) {
    svgEl.classList.add('legend-filter');
    document.querySelectorAll('.floor-element').forEach(g => {
        const el = elements.find(e => e.id === g.dataset.id);
        g.classList.toggle('legend-match', el && el.type === key);
    });
}

function legendHoverOut() {
    svgEl.classList.remove('legend-filter');
    document.querySelectorAll('.floor-element.legend-match').forEach(g => {
        g.classList.remove('legend-match');
    });
}

/* ======== SVG Events ======== */

function endFloorResizeInteraction() {
    if (!floorResizing) return;
    if (floorPlotConfigDbId) {
        updateFloorPlotConfig(floorPlotConfigDbId, { width: FLOOR.width, height: FLOOR.height, unit: FLOOR.unit });
    }
    floorResizing = null;
    document.removeEventListener('mouseup', onFloorResizeDocumentMouseUp);
}

function onFloorResizeDocumentMouseUp() {
    endFloorResizeInteraction();
}

svgEl.addEventListener('mousemove', (e) => {
    /* -- Panning -- */
    if (panning) {
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        const rect = svgEl.getBoundingClientRect();
        viewBox.x = panning.vbX - dx * (viewBox.w / rect.width);
        viewBox.y = panning.vbY - dy * (viewBox.h / rect.height);
        updateViewBox();
        return;
    }

    if (floorResizing) {
        const pt = svgPoint(e);
        if (floorResizing.axis === 'width') {
            const dw = (pt.x - floorResizing.startSvgX) / floorResizing.scaleX;
            let w = Math.round((floorResizing.startW + dw) * 2) / 2;
            w = Math.max(FLOOR_RESIZE_MIN, Math.min(FLOOR_RESIZE_MAX, w));
            if (w !== FLOOR.width) {
                FLOOR.width = w;
                mapper.setFloorSize(FLOOR.width, FLOOR.height);
                renderer.render(elements);
                updateFloorPlotDisplay();
                restoreSelection();
                showRotationHandle();
            }
        } else {
            const dh = -(pt.y - floorResizing.startSvgY) / floorResizing.scaleY;
            let h = Math.round((floorResizing.startH + dh) * 2) / 2;
            h = Math.max(FLOOR_RESIZE_MIN, Math.min(FLOOR_RESIZE_MAX, h));
            if (h !== FLOOR.height) {
                FLOOR.height = h;
                mapper.setFloorSize(FLOOR.width, FLOOR.height);
                renderer.render(elements);
                updateFloorPlotDisplay();
                restoreSelection();
                showRotationHandle();
            }
        }
        return;
    }

    const pt = svgPoint(e);
    const lx = mapper.toLogicalX(pt.x);
    const ly = mapper.toLogicalY(pt.y);

    if (lx >= 0 && lx <= FLOOR.width && ly >= 0 && ly <= FLOOR.height) {
        mouseCoords.textContent = `(${lx.toFixed(1)}, ${ly.toFixed(1)}) ${FLOOR.unit}`;
    } else {
        mouseCoords.textContent = '\u2014';
    }

    /* -- Tooltip -- */
    const hovered = e.target.closest('.floor-element');
    if (hovered && !dragging && !rotating && !marquee) {
        const el = elements.find(el => el.id === hovered.dataset.id);
        if (el) {
            tooltip.textContent = `${el.label} (${el.x}, ${el.y})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX - container.getBoundingClientRect().left + 12) + 'px';
            tooltip.style.top = (e.clientY - container.getBoundingClientRect().top - 10) + 'px';
        }
    } else {
        tooltip.style.display = 'none';
    }

    /* -- Rotating -- */
    if (rotating) {
        const el = elements.find(el => el.id === rotating.id);
        if (el) {
            let angle = Math.atan2(pt.x - rotating.centerX, rotating.centerY - pt.y) * (180 / Math.PI);
            angle = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
            el.rotation = ((angle % 360) + 360) % 360;
            renderer.render(elements);
            restoreSelection();
            showRotationHandle();
            updateSelectionPanel();
        }
        return;
    }

    /* -- Marquee -- */
    if (marquee) {
        renderer.drawMarquee(marquee.startX, marquee.startY, pt.x, pt.y);
        return;
    }

    /* -- Dragging -- */
    if (dragging) {
        dragging.moved = true;
        const initPrimary = dragging.initPositions.get(dragging.primaryId);
        const newX = Math.round((mapper.toLogicalX(pt.x) - dragging.offsetX) * 2) / 2;
        const newY = Math.round((mapper.toLogicalY(pt.y) - dragging.offsetY) * 2) / 2;
        const dx = newX - initPrimary.x;
        const dy = newY - initPrimary.y;

        for (const [id, init] of dragging.initPositions) {
            const el = elements.find(e => e.id === id);
            if (el) {
                el.x = Math.round((init.x + dx) * 2) / 2;
                el.y = Math.round((init.y + dy) * 2) / 2;
                el.x = Math.max(0, Math.min(el.x, FLOOR.width - el.width));
                el.y = Math.max(0, Math.min(el.y, FLOOR.height - el.height));
            }
        }
        renderer.render(elements);
        restoreSelection();
        showRotationHandle();
        updateSelectionPanel();
    }
});

svgEl.addEventListener('mousedown', (e) => {
    /* -- Middle mouse, Space+left, or Pan mode left → pan -- */
    if (e.button === 1 || (e.button === 0 && (spaceHeld || panMode))) {
        panning = { startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
        svgEl.classList.add('panning');
        e.preventDefault();
        return;
    }

    const resizeTarget = e.target.closest('[data-floor-resize-axis]');
    if (e.button === 0 && resizeTarget) {
        const axis = resizeTarget.dataset.floorResizeAxis;
        if (axis === 'width' || axis === 'height') {
            const pt = svgPoint(e);
            floorResizing = {
                axis,
                startSvgX: pt.x,
                startSvgY: pt.y,
                startW: FLOOR.width,
                startH: FLOOR.height,
                scaleX: mapper.scaleX,
                scaleY: mapper.scaleY,
            };
            document.addEventListener('mouseup', onFloorResizeDocumentMouseUp);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    /* -- Rotation handle (single selection, edit mode) -- */
    if (editMode && selectedIds.size === 1 && e.target.closest('.rotation-handle')) {
        const el = elements.find(el => el.id === [...selectedIds][0]);
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

    /* -- Click on element -- */
    const target = e.target.closest('.floor-element');
    if (target) {
        const id = target.dataset.id;
        const clickedEl = elements.find(el => el.id === id);
        const groupMembers = (clickedEl && clickedEl.groupId)
            ? elements.filter(el => el.groupId === clickedEl.groupId)
            : null;

        if (isCtrl) {
            if (groupMembers) {
                const allIn = groupMembers.every(m => selectedIds.has(m.id));
                if (allIn) {
                    groupMembers.forEach(m => removeFromSelection(m.id));
                } else {
                    groupMembers.forEach(m => addToSelection(m.id));
                }
                showRotationHandle();
                updateSelectionPanel();
            } else {
                toggleSelection(id);
            }
        } else {
            if (groupMembers) {
                if (!groupMembers.every(m => selectedIds.has(m.id))) {
                    clearSelection();
                    groupMembers.forEach(m => addToSelection(m.id));
                }
            } else if (!selectedIds.has(id)) {
                clearSelection();
                addToSelection(id);
            }
        }

        showRotationHandle();
        updateSelectionPanel();

        if (editMode && !isCtrl && selectedIds.has(id)) {
            const pt = svgPoint(e);
            const el = elements.find(el => el.id === id);
            if (el) {
                const initPositions = new Map();
                for (const selId of selectedIds) {
                    const selEl = elements.find(e => e.id === selId);
                    if (selEl) initPositions.set(selId, { x: selEl.x, y: selEl.y });
                }
                dragging = {
                    primaryId: id,
                    offsetX: mapper.toLogicalX(pt.x) - el.x,
                    offsetY: mapper.toLogicalY(pt.y) - el.y,
                    initPositions,
                    moved: false,
                };
                e.preventDefault();
            }
        }
        return;
    }

    /* -- Click on empty area → start marquee -- */
    const pt = svgPoint(e);
    marquee = { startX: pt.x, startY: pt.y };
    if (!isCtrl) {
        clearSelection();
        updateSelectionPanel();
    }
    e.preventDefault();
});

svgEl.addEventListener('mouseup', (e) => {
    if (panning) {
        panning = null;
        svgEl.classList.remove('panning');
        return;
    }

    if (floorResizing) {
        endFloorResizeInteraction();
        return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    /* -- Rotation -- */
    if (rotating) {
        const el = elements.find(el => el.id === rotating.id);
        if (el && el._dbId) {
            updateElement(el._dbId, { rotation: el.rotation || 0 });
        }
        rotating = null;
        return;
    }

    /* -- Marquee -- */
    if (marquee) {
        const pt = svgPoint(e);
        const dx = Math.abs(pt.x - marquee.startX);
        const dy = Math.abs(pt.y - marquee.startY);

        if (dx > 3 || dy > 3) {
            const hits = getElementsInRect(marquee.startX, marquee.startY, pt.x, pt.y);
            hits.forEach(el => addToSelection(el.id));
            expandGroupsInSelection();
        }

        marquee = null;
        renderer.clearSelection();
        showRotationHandle();
        updateSelectionPanel();
        return;
    }

    /* -- Dragging -- */
    if (dragging) {
        if (dragging.moved) {
            for (const [id] of dragging.initPositions) {
                const el = elements.find(e => e.id === id);
                if (el && el._dbId) {
                    updateElementPosition(el._dbId, el.x, el.y);
                }
            }
        } else if (!isCtrl && selectedIds.size > 1) {
            clearSelection();
            addToSelection(dragging.primaryId);
            showRotationHandle();
            updateSelectionPanel();
        }
        dragging = null;
    }
});

svgEl.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';

    if (floorResizing) {
        endFloorResizeInteraction();
    }

    if (panning) {
        panning = null;
        svgEl.classList.remove('panning');
    }

    if (rotating) {
        const el = elements.find(el => el.id === rotating.id);
        if (el && el._dbId) updateElement(el._dbId, { rotation: el.rotation || 0 });
        rotating = null;
    }

    if (marquee) {
        marquee = null;
        renderer.clearSelection();
        showRotationHandle();
    }

    if (dragging) {
        if (dragging.moved) {
            for (const [id] of dragging.initPositions) {
                const el = elements.find(e => e.id === id);
                if (el && el._dbId) updateElementPosition(el._dbId, el.x, el.y);
            }
        }
        dragging = null;
    }
});

/* ======== Selection Helpers ======== */

function addToSelection(id) {
    selectedIds.add(id);
    const el = svgEl.querySelector(`.floor-element[data-id="${id}"]`);
    if (el) el.classList.add('selected');
}

function removeFromSelection(id) {
    selectedIds.delete(id);
    const el = svgEl.querySelector(`.floor-element[data-id="${id}"]`);
    if (el) el.classList.remove('selected');
}

function toggleSelection(id) {
    if (selectedIds.has(id)) {
        removeFromSelection(id);
    } else {
        addToSelection(id);
    }
    showRotationHandle();
    updateSelectionPanel();
}

function clearSelection() {
    selectedIds.clear();
    document.querySelectorAll('.floor-element.selected').forEach(g => g.classList.remove('selected'));
    renderer.clearSelection();
    if (activeLegendKey) {
        activeLegendKey = null;
        syncActiveLegendItem();
    }
}

function expandGroupsInSelection() {
    const toAdd = [];
    for (const id of selectedIds) {
        const el = elements.find(e => e.id === id);
        if (el && el.groupId) {
            elements.filter(e => e.groupId === el.groupId && !selectedIds.has(e.id))
                .forEach(e => toAdd.push(e.id));
        }
    }
    toAdd.forEach(id => addToSelection(id));
}

function restoreSelection() {
    for (const id of selectedIds) {
        const el = svgEl.querySelector(`.floor-element[data-id="${id}"]`);
        if (el) el.classList.add('selected');
    }
}

function showRotationHandle() {
    renderer.clearSelection();
    if (!editMode || selectedIds.size !== 1) return;
    const el = elements.find(e => e.id === [...selectedIds][0]);
    if (el) renderer.drawRotationHandle(el);
}

function updateSelectionPanel() {
    const count = selectedIds.size;

    if (count === 1) {
        const el = elements.find(e => e.id === [...selectedIds][0]);
        if (el) {
            selPanel.style.display = '';
            multiSelPanel.style.display = 'none';
            noSelPanel.style.display = 'none';
            selName.textContent = el.label;
            selType.textContent = ELEMENT_TYPES[el.type]?.label || el.type;
            selPos.textContent = `(${el.x}, ${el.y}) ${FLOOR.unit}`;
            selSize.textContent = `${el.width} \u00d7 ${el.height} ${FLOOR.unit}`;
            selRotation.textContent = `${el.rotation || 0}\u00b0`;
            const ti = ELEMENT_TYPES[el.type];
            const st = mergeElementDrawStyle(null, ti || {});
            const shapeLbl = LEGEND_SHAPE_LABELS[st.shape] || st.shape;
            const borderLbl = LEGEND_BORDER_LABELS[st.borderStyle] || st.borderStyle;
            if (selAppearance) {
                selAppearance.textContent = `${shapeLbl}, ${borderLbl}, ${st.strokeColor}, ${st.strokeWidth}px`;
            }
            return;
        }
    }

    if (count > 1) {
        selPanel.style.display = 'none';
        multiSelPanel.style.display = '';
        noSelPanel.style.display = 'none';
        selCount.textContent = `${count} elements`;

        const selEls = [...selectedIds].map(id => elements.find(e => e.id === id)).filter(Boolean);
        const hasGrouped = selEls.some(e => e.groupId);
        const allSameGroup = hasGrouped && selEls.every(e => e.groupId) &&
            new Set(selEls.map(e => e.groupId)).size === 1;

        const groupRow = document.getElementById('sel-group-row');
        const groupStatus = document.getElementById('sel-group-status');
        const btnGroup = document.getElementById('btn-group-elements');
        const btnUngroup = document.getElementById('btn-ungroup-elements');
        const groupConfig = document.getElementById('group-config');

        if (allSameGroup) {
            groupRow.style.display = '';
            groupStatus.textContent = 'Grouped';
            btnGroup.style.display = 'none';
            btnUngroup.style.display = '';

            const meta = groupMetas.find(g => g.groupId === selEls[0].groupId);
            groupConfig.style.display = '';
            document.getElementById('group-label-input').value = meta ? (meta.label || '') : '';
            document.getElementById('group-show-border').checked = meta ? meta.showBorder !== false : true;
            document.getElementById('group-show-label').checked = meta ? meta.showLabel !== false : true;
        } else if (hasGrouped) {
            groupRow.style.display = '';
            groupStatus.textContent = 'Mixed';
            btnGroup.style.display = '';
            btnUngroup.style.display = '';
            groupConfig.style.display = 'none';
        } else {
            groupRow.style.display = 'none';
            btnGroup.style.display = '';
            btnUngroup.style.display = 'none';
            groupConfig.style.display = 'none';
        }
        return;
    }

    selPanel.style.display = 'none';
    multiSelPanel.style.display = 'none';
    noSelPanel.style.display = '';
}

/* ======== Hit Testing ======== */

function getElementsInRect(sx1, sy1, sx2, sy2) {
    const left = Math.min(sx1, sx2);
    const right = Math.max(sx1, sx2);
    const top = Math.min(sy1, sy2);
    const bottom = Math.max(sy1, sy2);

    return elements.filter(el => {
        const ex0 = mapper.toPixelX(el.x);
        const ey0 = mapper.toPixelY(el.y + el.height);
        const ex1 = mapper.toPixelX(el.x + el.width);
        const ey1 = mapper.toPixelY(el.y);
        return !(ex1 < left || ex0 > right || ey1 < top || ey0 > bottom);
    });
}

/* ======== Utility ======== */

function svgPoint(mouseEvent) {
    const pt = svgEl.createSVGPoint();
    pt.x = mouseEvent.clientX;
    pt.y = mouseEvent.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}
