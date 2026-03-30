/**
 * InstantDB integration for floor plan persistence.
 * Handles CRUD for elements, legends, and floor plot configuration.
 */

import { init, id as instantId, lookup } from '@instantdb/core';

/** OfficeManagement app in Instant; override per env with VITE_INSTANT_APP_ID if needed */
export const INSTANT_APP_ID =
    import.meta.env.VITE_INSTANT_APP_ID || '893fc487-41f4-4370-a6e5-b25bff85fe99';

export const db = init({ appId: INSTANT_APP_ID });

/* ---- Account profile (per Instant user; add $users / accountProfiles in Instant if prompted) ---- */

/**
 * @param {Record<string, unknown> | null | undefined} user
 * @returns {{ userId: string, displayName: string, fullName: string, email: string, updatedAt: number } | null}
 */
export function accountProfileFromUser(user) {
    if (!user || user.id == null) return null;
    const userId = String(user.id);
    const email = typeof user.email === 'string' ? user.email : '';
    const given = typeof user.given_name === 'string' ? user.given_name.trim() : '';
    const family = typeof user.family_name === 'string' ? user.family_name.trim() : '';
    const combined = [given, family].filter(Boolean).join(' ').trim();
    const fullName =
        (typeof user.name === 'string' && user.name.trim()) || combined || '';
    let displayName = fullName;
    if (!displayName && email.includes('@')) {
        displayName = email.split('@')[0] || email;
    }
    if (!displayName) {
        displayName = userId.length > 24 ? `${userId.slice(0, 22)}…` : userId;
    }
    return {
        userId,
        displayName,
        fullName: fullName || displayName,
        email,
        updatedAt: Date.now(),
    };
}

/**
 * Upsert the signed-in user's name/email into InstantDB (namespace: accountProfiles).
 * @param {Record<string, unknown> | null | undefined} user
 */
export function upsertAccountProfile(user) {
    const rec = accountProfileFromUser(user);
    if (!rec) return;
    try {
        db.transact(
            db.tx.accountProfiles[lookup('userId', rec.userId)].update(rec)
        );
    } catch (e) {
        console.error('Failed to save account profile:', e);
    }
}

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
                    groupId: record.groupId || '',
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
        groupId: el.groupId || '',
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
        shape: legend.shape || 'rectangle',
        borderStyle: legend.borderStyle || 'solid',
        borderColor: legend.borderColor || legend.color,
        borderSize: legend.borderSize != null ? legend.borderSize : 1.5,
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
            shape: l.shape || 'rectangle',
            borderStyle: l.borderStyle || 'solid',
            borderColor: l.borderColor || l.color,
            borderSize: l.borderSize != null ? l.borderSize : 1.5,
        })
    );
    db.transact(txs);
}

/* ---- Groups ---- */

export function subscribeGroups(callback) {
    return db.subscribeQuery({ groups: {} }, (resp) => {
        if (resp.error) {
            console.error('InstantDB groups error:', resp.error.message);
            callback({ error: resp.error });
            return;
        }
        if (resp.data) {
            callback({ data: resp.data.groups });
        }
    });
}

export function createGroup(group) {
    db.transact(db.tx.groups[instantId()].update({
        groupId: group.groupId,
        label: group.label,
        showBorder: group.showBorder !== false,
        showLabel: group.showLabel !== false,
    }));
}

export function updateGroupMeta(dbId, updates) {
    db.transact(db.tx.groups[dbId].update(updates));
}

export function deleteGroupMeta(dbId) {
    db.transact(db.tx.groups[dbId].delete());
}

/* ---- Floor plot bounds (InstantDB entity: roomConfig) ---- */

export function subscribeFloorPlotConfig(callback) {
    return db.subscribeQuery({ roomConfig: {} }, (resp) => {
        if (resp.error) {
            console.error('InstantDB floor plot config error:', resp.error.message);
            callback({ error: resp.error });
            return;
        }
        if (resp.data) {
            callback({ data: resp.data.roomConfig });
        }
    });
}

export function createFloorPlotConfig(config) {
    db.transact(db.tx.roomConfig[instantId()].update({
        width: config.width,
        height: config.height,
        unit: config.unit,
    }));
}

export function updateFloorPlotConfig(dbId, updates) {
    db.transact(db.tx.roomConfig[dbId].update(updates));
}

/**
 * Replace all plan data with an import snapshot (same shape as JSON/XML export).
 * Deletes existing elements, legends, and group rows, then inserts snapshot rows.
 */
export function replaceFromSnapshot(ctx, snapshot) {
    const txs = [];

    for (const el of ctx.elements) {
        if (el._dbId) txs.push(db.tx.elements[el._dbId].delete());
    }
    for (const el of snapshot.elements) {
        const record = {
            elementId: el.id,
            type: el.type,
            label: el.label,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            rotation: el.rotation != null ? el.rotation : 0,
            groupId: el.groupId != null ? String(el.groupId) : '',
        };
        if (el.swing) record.swing = el.swing;
        txs.push(db.tx.elements[instantId()].update(record));
    }

    for (const l of ctx.legends) {
        txs.push(db.tx.legends[l.id].delete());
    }
    for (const l of snapshot.legends) {
        txs.push(db.tx.legends[instantId()].update({
            key: l.key,
            label: l.label,
            color: l.color,
            shape: l.shape || 'rectangle',
            borderStyle: l.borderStyle || 'solid',
            borderColor: l.borderColor || l.color,
            borderSize: l.borderSize != null ? l.borderSize : 1.5,
        }));
    }

    for (const g of ctx.groupMetas) {
        txs.push(db.tx.groups[g.id].delete());
    }
    for (const g of snapshot.groups) {
        txs.push(db.tx.groups[instantId()].update({
            groupId: g.groupId,
            label: g.label,
            showBorder: g.showBorder !== false,
            showLabel: g.showLabel !== false,
        }));
    }

    const floor = snapshot.floor;
    if (ctx.floorPlotConfigDbId) {
        txs.push(db.tx.roomConfig[ctx.floorPlotConfigDbId].update({
            width: floor.width,
            height: floor.height,
            unit: floor.unit,
        }));
    } else {
        txs.push(db.tx.roomConfig[instantId()].update({
            width: floor.width,
            height: floor.height,
            unit: floor.unit,
        }));
    }

    db.transact(txs);
}
