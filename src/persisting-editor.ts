// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Editor } from 'slate'

import { DocumentDB } from './database'

export interface PersistingEditor extends Editor {
    documentDB: DocumentDB
    restore: () => Promise<void>
}

export const PersistingEditor = {
    /**
     * Restore editor to last state saved in {@link DocumentDB}
     *
     * If this editor also uses `withHistory` the history will be cleared.
     */
    restore(editor: PersistingEditor): Promise<void> {
        return editor.restore()
    },
}
