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
     * Check if a value is a `PersistingEditor` object.
     */
    isPersistingEditor(value: unknown): value is PersistingEditor {
        return Editor.isEditor(value)
            && typeof value.restore === 'function'
            && value.documentDB instanceof DocumentDB
    },

    /**
     * Check if changes have been made to the editor since the last time it was
     * saved.
     */
    hasChanges(editor: PersistingEditor): boolean {
        return editor.documentDB.dirty
    },

    /**
     * Restore editor to last state saved in {@link DocumentDB}
     *
     * If this editor also uses `withHistory` the history will be cleared.
     */
    async restore(editor: PersistingEditor): Promise<void> {
        return editor.restore()
    },
}
