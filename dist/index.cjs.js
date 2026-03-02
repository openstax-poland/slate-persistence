'use strict';

var slate = require('slate');

// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
/* eslint-disable func-names */
const MIGRATIONS = [
    // A dummy migration to fill index 0. It will never be executed, since
    // database versions start at 1 (0 is the “version” before first migration,
    // when database is created).
    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
    function () { },
    // 0 → 1
    function (db) {
        db.createObjectStore('states', { keyPath: 'id' });
        db.createObjectStore('contents', { keyPath: 'id' });
        const changes = db.createObjectStore('changes', {
            keyPath: 'order',
            autoIncrement: true,
        });
        changes.createIndex('document', 'document', {
            unique: false,
            multiEntry: true,
        });
    },
];
/* eslint-enable func-names */
function upgradeDatabase(event) {
    const { newVersion, oldVersion } = event;
    const { result: db, transaction: tx } = event.target;
    if (newVersion === null || tx === null) {
        // We're being deleted.
        return;
    }
    for (let ver = oldVersion + 1; ver <= newVersion; ++ver) {
        MIGRATIONS[ver](db, tx);
    }
}

// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
/** Convert an IndexedDB request into a promise */
async function promisify(req) {
    return new Promise((resolve, reject) => {
        /* eslint-disable-next-line
            @typescript-eslint/prefer-promise-reject-errors */
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
async function iterate(store, ...args // eslint-disable-line @typescript-eslint/no-explicit-any
) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const f = args.pop();
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const req = store.openCursor(...args);
        /* eslint-disable-next-line
            @typescript-eslint/prefer-promise-reject-errors */
        req.onerror = err => reject(err);
        req.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                try {
                    f(cursor, cursor.value, reject);
                }
                catch (ex) {
                    /* eslint-disable-next-line
                        @typescript-eslint/prefer-promise-reject-errors */
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
async function exportDatabase(db) {
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
async function importDatabase(db, data) {
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

// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
const DB_NAME = 'manuscript:persist';
const DB_VERSION = 1;
let DATABASE = null;
/** Management of and access to the persistence database */
class PersistDB {
    /** Open the database */
    static async open() {
        if (DATABASE !== null)
            return DATABASE;
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = upgradeDatabase;
        const db = await promisify(req);
        DATABASE = new PersistDB(db);
        return DATABASE;
    }
    /**
     * Load a document
     *
     * This is a convenience wrapper around {@link #open}
     * and {@link #openDocument}.
     */
    static async load(id) {
        return PersistDB.open().then(async (db) => db.openDocument(id));
    }
    constructor(db) {
        this.database = db;
    }
    /**
     * Export contents of this database as a JS object
     *
     * Returned object can later be used to import data into a database using
     * {@link #import}. It contains only plain JS values and can safely be
     * converted to/from JSON.
     */
    async export() {
        return exportDatabase(this.database);
    }
    /** Import data into a database */
    async import(data) {
        return importDatabase(this.database, data);
    }
    /** Open a document */
    async openDocument(id) {
        const tx = this.database.transaction(['states', 'changes']);
        const store = tx.objectStore('states');
        const document = new DocumentDB(this.database, id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const data = await promisify(store.get(id));
        if (!data) {
            return document;
        }
        const index = tx.objectStore('changes').index('document');
        const count = await promisify(index.count(id));
        document.dirty = count > 0;
        document.version = data.version;
        return document;
    }
    /** Get a list of all modules with local unsaved changes */
    async dirty() {
        const tx = this.database.transaction(['states', 'changes', 'contents'], 'readwrite');
        const states = tx.objectStore('states');
        const changes = tx.objectStore('changes').index('document');
        const contents = tx.objectStore('contents');
        const dirty = [];
        await iterate(states, async (cursor, value) => {
            const count = await promisify(changes.count(value.id));
            if (count === 0) {
                cursor.delete();
                contents.delete(value.id);
            }
            else {
                dirty.push(value);
            }
            cursor.continue();
        });
        return dirty;
    }
    /**
     * Discard any saved changes to a document
     *
     * This has the same effect as calling {@link DocumentDB#discard} on
     * a loaded document.
     */
    async discard(id) {
        return new DocumentDB(this.database, id).discard();
    }
}
/** Local state of a document */
class DocumentDB {
    /** @internal */
    constructor(db, id) {
        this.database = db;
        this.id = id;
        this.dirty = false;
        this.version = null;
    }
    /** Save a new version of a document */
    async save(value, version) {
        const tx = this.database.transaction(['states', 'changes', 'contents'], 'readwrite');
        const states = tx.objectStore('states');
        const changes = tx.objectStore('changes').index('document');
        const contents = tx.objectStore('contents');
        await iterate(changes, this.id, cursor => {
            cursor.delete();
            cursor.continue();
        });
        await Promise.all([
            states.put({
                id: this.id,
                version,
            }),
            contents.put({
                id: this.id,
                content: value,
            }),
        ].map(promisify));
        this.version = version;
        this.dirty = false;
    }
    /** Mark a change to the document */
    async mark(op) {
        const tx = this.database.transaction('changes', 'readwrite');
        const store = tx.objectStore('changes');
        await promisify(store.add({
            document: this.id,
            change: op,
        }));
        this.dirty = true;
    }
    /**
     * Restore document from its saved state
     */
    async restore() {
        const tx = this.database.transaction(['contents', 'changes']);
        const contents = tx.objectStore('contents');
        const changes = tx.objectStore('changes').index('document');
        /* eslint-disable @typescript-eslint/no-unsafe-argument */
        const [value, ops] = await Promise.all([
            promisify(contents.get(this.id)),
            promisify(changes.getAll(this.id)),
        ]);
        /* eslint-enable @typescript-eslint/no-unsafe-argument */
        return [value.content, ops.map(o => o.change)];
    }
    /** Discard any saved changes to a document */
    async discard() {
        const tx = this.database.transaction(['states', 'changes', 'contents'], 'readwrite');
        const states = tx.objectStore('states');
        const changes = tx.objectStore('changes').index('document');
        const contents = tx.objectStore('contents');
        await Promise.all([
            iterate(changes, this.id, cursor => {
                cursor.delete();
                cursor.continue();
            }),
            promisify(states.delete(this.id)),
            promisify(contents.delete(this.id)),
        ]);
        this.dirty = false;
    }
}

// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
const PersistingEditor = {
    /**
     * Check if a value is a `PersistingEditor` object.
     */
    isPersistingEditor(value) {
        return slate.Editor.isEditor(value)
            && typeof value.restore === 'function'
            && value.documentDB instanceof DocumentDB;
    },
    /**
     * Check if changes have been made to the editor since the last time it was
     * saved.
     */
    hasChanges(editor) {
        return editor.documentDB.dirty;
    },
    /**
     * Restore editor to last state saved in {@link DocumentDB}
     *
     * If this editor also uses `withHistory` the history will be cleared.
     */
    async restore(editor) {
        return editor.restore();
    },
};

// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
const SYNC = new WeakMap();
function synchronised(key, f) {
    return async (...args) => {
        var _a;
        const sync = (_a = SYNC.get(key)) !== null && _a !== void 0 ? _a : Promise.resolve();
        const r = (async () => {
            await sync;
            await f(...args);
        })();
        SYNC.set(key, r);
        return r;
    };
}
function withPersistence(db, editor) {
    const e = editor;
    const { apply, onChange } = e;
    e.documentDB = db;
    e.onChangesPersisted = () => { }; // eslint-disable-line @typescript-eslint/no-empty-function
    const persist = synchronised(e, async (operations) => {
        for (const op of operations) {
            if (!IGNORED_OPERATIONS.includes(op.type)) {
                await e.documentDB.mark(op);
            }
        }
        e.onChangesPersisted();
    });
    e.onChange = () => {
        void persist(e.operations);
        onChange();
    };
    e.restore = synchronised(e, async () => {
        const [state, ops] = await e.documentDB.restore();
        slate.Editor.withoutNormalizing(e, () => {
            e.children = state;
            for (const op of ops) {
                apply(op);
            }
        });
        if ('history' in e) {
            e.history = { undos: [], redos: [] };
        }
        e.operations = [];
        e.onChange();
        e.onChangesPersisted();
    });
    return e;
}
/**
 * Operations which not result in meaningful changes to the document.
 *
 * Operations which don't modify document content, such as moving cursor around,
 * can safely be ignored when restoring state.
 */
const IGNORED_OPERATIONS = [
    'set_selection',
];

exports.DocumentDB = DocumentDB;
exports.PersistDB = PersistDB;
exports.PersistingEditor = PersistingEditor;
exports.withPersistence = withPersistence;
//# sourceMappingURL=index.cjs.js.map
