// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Editor, Operation } from 'slate'

import { DocumentDB } from './database'
import { PersistingEditor } from './persisting-editor'

const SYNC = new WeakMap<Editor, Promise<void>>()

function synchronised<T extends unknown[]>(key: Editor, f: (...args: T) => Promise<void>) {
    return async (...args: T) => {
        const sync = SYNC.get(key) ?? Promise.resolve()
        const r = (async () => {
            await sync
            await f(...args)
        })()
        SYNC.set(key, r)
        return r
    }
}

export default function withPersistence<T extends Editor>(
    db: DocumentDB,
    editor: T,
): T & PersistingEditor {
    const e = editor as T & PersistingEditor
    const { apply, onChange } = e

    e.documentDB = db
    e.onChangesPersisted = () => {} // eslint-disable-line @typescript-eslint/no-empty-function

    const persist = synchronised(e, async (operations: Operation[]) => {
        for (const op of operations) {
            if (!IGNORED_OPERATIONS.includes(op.type)) {
                await e.documentDB.mark(op)
            }
        }

        e.onChangesPersisted()
    })

    e.onChange = () => {
        void persist(e.operations)
        onChange()
    }

    e.restore = synchronised(e, async () => {
        const [state, ops] = await e.documentDB.restore()

        Editor.withoutNormalizing(e, () => {
            e.children = state

            for (const op of ops) {
                apply(op)
            }
        })

        if ('history' in e) {
            (e as Record<string, unknown>).history = { undos: [], redos: [] }
        }

        e.operations = []

        e.onChange()
        e.onChangesPersisted()
    })

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
