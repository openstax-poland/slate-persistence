// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
import { upgradeDatabase } from './schema';
import { exportDatabase, importDatabase, iterate, promisify } from './util';
const DB_NAME = 'manuscript:persist';
const DB_VERSION = 1;
let DATABASE = null;
/** Management of and access to the persistence database */
export class PersistDB {
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
export class DocumentDB {
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
