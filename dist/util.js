// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
/** Convert an IndexedDB request into a promise */
export async function promisify(req) {
    return new Promise((resolve, reject) => {
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
}
/**
 * Call closure once for each item in a cursor
 *
 * The closure is responsible for advancing cursor to the next value.
 *
 * Returned promise will be resolved once iteration has successfully completed
 * (there are no more items remaining in the cursor), or rejected on a database
 * error, or if closure throws.
 */
export async function iterate(store, ...args // eslint-disable-line @typescript-eslint/no-explicit-any
) {
    const f = args.pop();
    return new Promise((resolve, reject) => {
        const req = store.openCursor(...args);
        req.onerror = err => reject(err);
        req.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                try {
                    f(cursor, cursor.value, reject);
                }
                catch (ex) {
                    reject(ex);
                }
            }
            else {
                resolve();
            }
        };
    });
}
/**
 * Export contents of a database as a JS object
 *
 * Returned object can later be used to import data into a database using
 * {@link #importDatabase}. It contains only plain JS values and can safely be
 * converted to/from JSON.
 */
export async function exportDatabase(db) {
    // db.objectStoresNames has type DOMStringList, which contrary to TS's
    // typpings is allowed as an argument to IDBDatabase#transaction.
    const tx = db.transaction(db.objectStoreNames, 'readonly');
    const insert = {};
    const objectStores = {};
    for (const name of db.objectStoreNames) {
        const store = tx.objectStore(name);
        const indexes = Object.fromEntries(Array.from(store.indexNames, name => {
            const index = store.index(name);
            return [name, {
                    name: index.name,
                    keyPath: index.keyPath,
                    multiEntry: index.multiEntry,
                    unique: index.unique,
                }];
        }));
        insert[name] = await promisify(store.getAll());
        objectStores[name] = {
            indexes,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
        };
    }
    return {
        database: {
            name: db.name,
            version: db.version,
            objectStores,
        },
        remove: Object.fromEntries(Array.from(db.objectStoreNames, st => [st, {}])),
        insert,
    };
}
/** Import data into a database */
export async function importDatabase(db, data) {
    const { database: { name, version }, remove = {}, insert = {} } = data;
    if (name !== db.name) {
        throw new Error(`Cannot import data for database ${name} into potentially \
            incompatible database ${db.name}`);
    }
    if (version !== db.version) {
        throw new Error(`Imported data is in an incompatible format ${version} \
            (this database uses ${db.version}`);
    }
    const tx = db.transaction(db.objectStoreNames, 'readwrite');
    for (const [name, { key, index }] of Object.entries(remove)) {
        const store = tx.objectStore(name);
        const keys = key && (key instanceof Array ? key : [key]);
        if (index && keys) {
            const inx = store.index(index);
            for (const key of keys) {
                await iterate(inx, key, cursor => {
                    cursor.delete();
                    cursor.continue();
                });
            }
        }
        else if (keys) {
            for (const key of keys) {
                await promisify(store.delete(key));
            }
        }
        else {
            await promisify(store.clear());
        }
    }
    for (const [name, values] of Object.entries(insert)) {
        const store = tx.objectStore(name);
        for (const val of values) {
            await promisify(store.add(val));
        }
    }
}
