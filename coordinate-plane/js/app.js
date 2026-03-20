/**
 * Main application: wires up rendering, interactivity, and persistence.
 */

(function () {
    'use strict';

    const SVG_WIDTH = 740;
    const SVG_HEIGHT = 600;
    const STORAGE_KEY = 'floorplan-elements';

    /* ---- State ---- */
    let elements = loadElements();
    let selectedId = null;
    let editMode = false;
    let dragging = null; // { id, offsetX, offsetY }

    /* ---- DOM refs ---- */
    const svgEl = document.getElementById('floor-plan-svg');
    const container = document.getElementById('canvas-container');
    const tooltip = document.getElementById('tooltip');
    const sidebar = document.getElementById('sidebar');

    const selPanel = document.getElementById('selection-panel');
    const noSelPanel = document.getElementById('no-selection-panel');
    const selName = document.getElementById('sel-name');
    const selType = document.getElementById('sel-type');
    const selPos = document.getElementById('sel-pos');
    const selSize = document.getElementById('sel-size');
    const mouseCoords = document.getElementById('mouse-coords');

    const btnGrid = document.getElementById('btn-toggle-grid');
    const btnLabels = document.getElementById('btn-toggle-labels');
    const btnDims = document.getElementById('btn-toggle-dims');
    const btnEdit = document.getElementById('btn-toggle-edit');
    const btnReset = document.getElementById('btn-reset');
    const btnExport = document.getElementById('btn-export');

    /* ---- Mapper & Renderer ---- */
    const mapper = new CoordinateMapper(ROOM.width, ROOM.height, SVG_WIDTH, SVG_HEIGHT, {
        top: 30, right: 30, bottom: 30, left: 35
    });

    const renderer = new FloorPlanRenderer(svgEl, mapper, {
        showGrid: true,
        showLabels: true,
        showDimensions: true
    });

    /* ---- Init ---- */
    renderer.init();
    renderer.render(elements);
    buildLegend();

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
    });

    btnReset.addEventListener('click', () => {
        if (confirm('Reset all elements to their default positions?')) {
            elements = JSON.parse(JSON.stringify(DEFAULT_ELEMENTS));
            saveElements();
            selectedId = null;
            updateSelectionPanel();
            renderer.render(elements);
        }
    });

    btnExport.addEventListener('click', () => {
        const json = JSON.stringify(elements, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'floorplan-elements.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    /* ---- SVG Events ---- */

    svgEl.addEventListener('mousemove', (e) => {
        const pt = svgPoint(e);
        const lx = mapper.toLogicalX(pt.x);
        const ly = mapper.toLogicalY(pt.y);

        if (lx >= 0 && lx <= ROOM.width && ly >= 0 && ly <= ROOM.height) {
            mouseCoords.textContent = `(${lx.toFixed(1)}, ${ly.toFixed(1)}) ${ROOM.unit}`;
        } else {
            mouseCoords.textContent = '—';
        }

        // Tooltip for hovered element
        const target = e.target.closest('.floor-element');
        if (target && !dragging) {
            const el = elements.find(el => el.id === target.dataset.id);
            if (el) {
                tooltip.textContent = `${el.label} (${el.x}, ${el.y})`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX - container.getBoundingClientRect().left + 12) + 'px';
                tooltip.style.top = (e.clientY - container.getBoundingClientRect().top - 10) + 'px';
            }
        } else {
            tooltip.style.display = 'none';
        }

        // Drag in edit mode
        if (dragging) {
            const el = elements.find(el => el.id === dragging.id);
            if (el) {
                el.x = Math.round((mapper.toLogicalX(pt.x) - dragging.offsetX) * 2) / 2;
                el.y = Math.round((mapper.toLogicalY(pt.y) - dragging.offsetY) * 2) / 2;
                el.x = Math.max(0, Math.min(el.x, ROOM.width - el.width));
                el.y = Math.max(0, Math.min(el.y, ROOM.height - el.height));
                renderer.render(elements);
                restoreSelection();
                updateSelectionPanel();
            }
        }
    });

    svgEl.addEventListener('mousedown', (e) => {
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
        if (dragging) {
            dragging = null;
            saveElements();
        }
    });

    svgEl.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        if (dragging) {
            dragging = null;
            saveElements();
        }
    });

    /* ---- Selection ---- */

    function selectElement(id) {
        selectedId = id;
        document.querySelectorAll('.floor-element').forEach(g => g.classList.remove('selected'));
        const el = svgEl.querySelector(`.floor-element[data-id="${id}"]`);
        if (el) el.classList.add('selected');
        updateSelectionPanel();
    }

    function deselectAll() {
        selectedId = null;
        document.querySelectorAll('.floor-element').forEach(g => g.classList.remove('selected'));
        updateSelectionPanel();
    }

    function restoreSelection() {
        if (selectedId) {
            const el = svgEl.querySelector(`.floor-element[data-id="${selectedId}"]`);
            if (el) el.classList.add('selected');
        }
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
                selSize.textContent = `${el.width} × ${el.height} ${ROOM.unit}`;
                return;
            }
        }
        selPanel.style.display = 'none';
        noSelPanel.style.display = '';
    }

    /* ---- Legend ---- */

    function buildLegend() {
        const list = document.getElementById('legend-list');
        const shown = new Set();
        elements.forEach(el => {
            if (shown.has(el.type)) return;
            shown.add(el.type);
            const info = ELEMENT_TYPES[el.type];
            if (!info) return;
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-swatch" style="background:${info.color}40;border:2px solid ${info.color}"></span><span>${info.label}</span>`;
            list.appendChild(item);
        });
    }

    /* ---- Persistence ---- */

    function saveElements() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
        } catch (_) { /* storage full or unavailable */ }
    }

    function loadElements() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) { /* corrupt data */ }
        return JSON.parse(JSON.stringify(DEFAULT_ELEMENTS));
    }

    /* ---- Utility ---- */

    function svgPoint(mouseEvent) {
        const pt = svgEl.createSVGPoint();
        pt.x = mouseEvent.clientX;
        pt.y = mouseEvent.clientY;
        return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    }
})();
