/**
 * InstantDB integration for floor plan persistence.
 * Handles CRUD for elements, legends, and room configuration.
 */

import { init, id as instantId } from '@instantdb/core';

const APP_ID = '893fc487-41f4-4370-a6e5-b25bff85fe99';

const db = init({ appId: APP_ID });

/* ---- Elements ---- */

export function subscribeElements(callback) {
    return db.subscribeQuery({ elements: {} }, (resp) => {
        if (resp.error) {
            console.error('InstantDB query error:', resp.error.message);
            callback({ error: resp.error });
            return;
        }
        if (resp.data) {
            const elements = resp.data.elements.map(record => {
                const el = {
                    id: record.elementId,
                    type: record.type,
                    label: record.label,
                    x: record.x,
                    y: record.y,
                    width: record.width,
                    height: record.height,
                    rotation: record.rotation || 0,
                    _dbId: record.id,
                };
                if (record.swing) el.swing = record.swing;
                return el;
            });
            callback({ data: elements });
        }
    });
}

export function createElement(el) {
    const record = {
        elementId: el.id,
        type: el.type,
        label: el.label,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation || 0,
    };
    if (el.swing) record.swing = el.swing;
    db.transact(db.tx.elements[instantId()].update(record));
}

export function updateElement(dbId, updates) {
    db.transact(db.tx.elements[dbId].update(updates));
}

export function updateElementPosition(dbId, x, y) {
    db.transact(db.tx.elements[dbId].update({ x, y }));
}

export function deleteElement(dbId) {
    db.transact(db.tx.elements[dbId].delete());
}

export function resetElements(currentElements, defaults) {
    const deletes = currentElements
        .filter(el => el._dbId)
        .map(el => db.tx.elements[el._dbId].delete());

    const inserts = defaults.map(el => {
        const record = {
            elementId: el.id,
            type: el.type,
            label: el.label,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
        };
        if (el.swing) record.swing = el.swing;
        return db.tx.elements[instantId()].update(record);
    });

    db.transact([...deletes, ...inserts]);
}

export function seedDefaults(defaults) {
    const txs = defaults.map(el => {
        const record = {
            elementId: el.id,
            type: el.type,
            label: el.label,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
        };
        if (el.swing) record.swing = el.swing;
        return db.tx.elements[instantId()].update(record);
    });
    db.transact(txs);
}

/* ---- Legends ---- */

export function subscribeLegends(callback) {
    return db.subscribeQuery({ legends: {} }, (resp) => {
        if (resp.error) {
            console.error('InstantDB legends error:', resp.error.message);
            callback({ error: resp.error });
            return;
        }
        if (resp.data) {
            callback({ data: resp.data.legends });
        }
    });
}

export function createLegend(legend) {
    db.transact(db.tx.legends[instantId()].update({
        key: legend.key,
        label: legend.label,
        color: legend.color,
    }));
}

export function updateLegend(dbId, updates) {
    db.transact(db.tx.legends[dbId].update(updates));
}

export function deleteLegend(dbId) {
    db.transact(db.tx.legends[dbId].delete());
}

export function seedLegends(legends) {
    const txs = legends.map(l =>
        db.tx.legends[instantId()].update({
            key: l.key,
            label: l.label,
            color: l.color,
        })
    );
    db.transact(txs);
}

/* ---- Room Configuration ---- */

export function subscribeRoomConfig(callback) {
    return db.subscribeQuery({ roomConfig: {} }, (resp) => {
        if (resp.error) {
            console.error('InstantDB roomConfig error:', resp.error.message);
            callback({ error: resp.error });
            return;
        }
        if (resp.data) {
            callback({ data: resp.data.roomConfig });
        }
    });
}

export function createRoomConfig(config) {
    db.transact(db.tx.roomConfig[instantId()].update({
        width: config.width,
        height: config.height,
        unit: config.unit,
    }));
}

export function updateRoomConfig(dbId, updates) {
    db.transact(db.tx.roomConfig[dbId].update(updates));
}
