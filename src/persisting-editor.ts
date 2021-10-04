// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Editor } from 'slate'

import { DocumentDB } from './database'

export interface PersistingEditor extends Editor {
    documentDB: DocumentDB

    /**
     * Function called when all changes have been persisted to IndexedDB
     *
     * This function will be called once for each call to
     * {@link Editor#onChange}. There may be a delay between a call to
     * {@link Editor#onChange} and a corresponding call to this function, and
     * that delay may be long enough for another change to occur.
     */
    onChangesPersisted: () => void
    restore: () => Promise<void>
}

export const PersistingEditor = {
    /**
     * Check if a value is a `PersistingEditor` object.
     */
    isPersistingEditor(value: unknown): value is PersistingEditor {
        return Editor.isEditor(value)
            && typeof (value as PersistingEditor).restore === 'function'
            && (value as PersistingEditor).documentDB instanceof DocumentDB
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
