/**
 * InstantDB integration for floor plan persistence.
 * Replaces localStorage with real-time cloud-synced data.
 */

import { init, id as instantId } from '@instantdb/core';

const APP_ID = '893fc487-41f4-4370-a6e5-b25bff85fe99';

const db = init({ appId: APP_ID });

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
                    _dbId: record.id,
                };
                if (record.swing) el.swing = record.swing;
                return el;
            });
            callback({ data: elements });
        }
    });
}

export function updateElementPosition(dbId, x, y) {
    db.transact(db.tx.elements[dbId].update({ x, y }));
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
