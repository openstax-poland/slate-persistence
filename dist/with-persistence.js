// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
import { Editor } from 'slate';
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
export default function withPersistence(db, editor) {
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
        Editor.withoutNormalizing(e, () => {
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
