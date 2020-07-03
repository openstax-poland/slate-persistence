// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { createEditor, Editor, Node, Operation } from 'slate'

import { Change, Content, State, upgradeDatabase } from './schema'
import { Export, exportDatabase, importDatabase, iterate, promisify } from './util'

export { State }

const DB_NAME = 'manuscript:persist'
const DB_VERSION = 1

let DATABASE: PersistDB | null = null

/** Management of and access to the persistence database */
export class PersistDB {
    /** Open the database */
    public static async open(): Promise<PersistDB> {
        if (DATABASE !== null) return DATABASE

        const req = window.indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = upgradeDatabase

        const db = await promisify(req)

        DATABASE = new PersistDB(db)

        return DATABASE
    }

    /**
     * Load a document
     *
     * This is a convenience wrapper around {@link #open}
     * and {@link #openDocument}.
     */
    public static async load(id: string): Promise<DocumentDB> {
        return PersistDB.open().then(async db => db.openDocument(id))
    }

    private readonly database: IDBDatabase

    private constructor(db: IDBDatabase) {
        this.database = db
    }

    /**
     * Export contents of this database as a JS object
     *
     * Returned object can later be used to import data into a database using
     * {@link #import}. It contains only plain JS values and can safely be
     * converted to/from JSON.
     */
    public async export(): Promise<Export> {
        return exportDatabase(this.database)
    }

    /** Import data into a database */
    public async import(data: Export): Promise<void> {
        return importDatabase(this.database, data)
    }

    /** Open a document */
    public async openDocument(id: string): Promise<DocumentDB> {
        const tx = this.database.transaction(['states', 'changes'])
        const store = tx.objectStore('states')
        const document = new DocumentDB(this.database, id)
        const data = await promisify(store.get(id))

        if (!data) {
            return document
        }

        const index = tx.objectStore('changes').index('document')
        const count = await promisify(index.count(id))
        document.dirty = count > 0
        document.version = data.version

        return document
    }

    /** Get a list of all modules with local unsaved changes */
    public async dirty(): Promise<State[]> {
        const tx = this.database.transaction(
            ['states', 'changes', 'contents'], 'readwrite')
        const states = tx.objectStore('states')
        const changes = tx.objectStore('changes').index('document')
        const contents = tx.objectStore('contents')

        const dirty: State[] = []

        await iterate<State>(states, async (cursor, value) => {
            const count = await promisify(changes.count(value.id))

            if (count === 0) {
                cursor.delete()
                contents.delete(value.id)
            } else {
                dirty.push(value)
            }

            cursor.continue()
        })

        return dirty
    }

    /**
     * Discard any saved changes to a document
     *
     * This has the same effect as calling {@link DocumentDB#discard} on
     * a loaded document.
     */
    public async discard(id: string): Promise<void> {
        return new DocumentDB(this.database, id).discard()
    }
}

/** Local state of a document */
export class DocumentDB {
    private readonly database: IDBDatabase

    public readonly id: string

    public dirty: boolean

    public version: string | null

    /** @internal */
    public constructor(db: IDBDatabase, id: string) {
        this.database = db
        this.id = id
        this.dirty = false
        this.version = null
    }

    /** Save a new version of a document */
    public async save(value: Node[], version: string): Promise<void> {
        const tx = this.database.transaction(
            ['states', 'changes', 'contents'], 'readwrite')
        const states = tx.objectStore('states')
        const changes = tx.objectStore('changes').index('document')
        const contents = tx.objectStore('contents')

        await iterate(changes, this.id, cursor => {
            cursor.delete()
            cursor.continue()
        })

        await Promise.all([
            states.put({
                id: this.id,
                version,
            }),
            contents.put({
                id: this.id,
                content: value,
            }),
        ].map(promisify))

        this.version = version
    }

    /** Mark a change to the document */
    public async mark(op: Operation): Promise<void> {
        const tx = this.database.transaction('changes', 'readwrite')
        const store = tx.objectStore('changes')

        await promisify(store.add({
            document: this.id,
            change: op,
        }))
    }

    /**
     * Restore document from its saved state
     *
     * The returned value will not be normalized.
     */
    public async restore(): Promise<Node[]> {
        const tx = this.database.transaction(['contents', 'changes'])
        const contents = tx.objectStore('contents')
        const changes = tx.objectStore('changes').index('document')

        const [value, ops] = await Promise.all([
            promisify<Content>(contents.get(this.id)),
            promisify<Change[]>(changes.getAll(this.id)),
        ])

        const editor = createEditor()
        editor.children = value.content

        let result!: Node[]

        Editor.withoutNormalizing(editor, () => {
            for (const op of ops) {
                editor.apply(op.change)
            }

            result = editor.children
        })

        return result
    }

    /** Discard any saved changes to a document */
    public async discard(): Promise<void> {
        const tx = this.database.transaction(
            ['states', 'changes', 'contents'], 'readwrite')
        const states = tx.objectStore('states')
        const changes = tx.objectStore('changes').index('document')
        const contents = tx.objectStore('contents')

        await Promise.all([
            iterate(changes, this.id, cursor => {
                cursor.delete()
                cursor.continue()
            }),
            promisify(states.delete(this.id)),
            promisify(contents.delete(this.id)),
        ])

        this.dirty = false
    }
}
