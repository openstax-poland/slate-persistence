// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
import { Editor } from 'slate';
import { DocumentDB } from './database';
export const PersistingEditor = {
    /**
     * Check if a value is a `PersistingEditor` object.
     */
    isPersistingEditor(value) {
        return Editor.isEditor(value)
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
