// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Node, Operation } from 'slate'

/** State of an opened document */
export type State = {
    /** Document's identification */
    id: string,
    /** Document's version when it was last loaded */
    version: string,
}

/** A single change to a document */
export type Change = {
    /**
     * ID of a document to which this change was applied
     *
     * This property is indexed.
     */
    document: string,
    /**
     * Opaque value representing order in which operations are applied
     *
     * The exact value of this field is left unspecified, except that it is
     * guaranteed to be larger than the value for any operation previously
     * applied to the document.
     */
    order: number,
    /** The operation applied in this change */
    change: Operation,
}

/**
 * Content of a document before any {@link Change}s were made
 *
 * We keep it separate from {@link State} to allow querying it without copying
 * potentially huge serialized document.
 */
export type Content = {
    /** Document's identification */
    id: string,
    /** Document's contents at the time it was last loaded */
    content: Node[],
}

/* eslint-disable func-names */
const MIGRATIONS: ((db: IDBDatabase, tx: IDBTransaction) => void)[] = [
    // A dummy migration to fill index 0. It will never be executed, since
    // database versions start at 1 (0 is the “version” before first migration,
    // when database is created).
    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
    function() {},
    // 0 → 1
    function(db) {
        db.createObjectStore('states', { keyPath: 'id' })
        db.createObjectStore('contents', { keyPath: 'id' })

        const changes = db.createObjectStore('changes', {
            keyPath: 'order',
            autoIncrement: true,
        })
        changes.createIndex('document', 'document', {
            unique: false,
            multiEntry: true,
        })
    },
]
/* eslint-enable func-names */

export function upgradeDatabase(event: IDBVersionChangeEvent): void {
    const { newVersion, oldVersion } = event
    const { result: db, transaction: tx } = event.target as IDBOpenDBRequest

    if (newVersion === null || tx === null) {
        // We're being deleted.
        return
    }

    for (let ver = oldVersion + 1; ver <= newVersion; ++ver) {
        MIGRATIONS[ver](db, tx)
    }
}
