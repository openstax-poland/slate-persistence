// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Editor, Operation } from 'slate'

import { DocumentDB } from './database'
import { PersistingEditor } from './persisting-editor'

export default function withPersistence<T extends Editor>(db: DocumentDB, editor: T): T & PersistingEditor {
    const e = editor as T & PersistingEditor
    const { apply } = e

    e.documentDB = db

    e.apply = (op: Operation) => {
        if (!IGNORED_OPERATIONS.includes(op.type)) {
            e.documentDB.mark(op)
        }

        apply(op)
    }

    e.restore = async () => {
        e.children = await e.documentDB.restore()

        if ('history' in e) {
            (e as any).history = { undos: [], redos: [] }
        }
    }

    return e
}

/**
 * Operations which not result in meaningful changes to the document.
 *
 * Operations which don't modify document content, such as moving cursor around,
 * can safely be ignored when restoring state.
 */
const IGNORED_OPERATIONS = [
    'set_selection',
]
