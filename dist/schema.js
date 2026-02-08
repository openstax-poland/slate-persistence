// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.
/* eslint-disable func-names */
const MIGRATIONS = [
    // A dummy migration to fill index 0. It will never be executed, since
    // database versions start at 1 (0 is the “version” before first migration,
    // when database is created).
    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
    function () { },
    // 0 → 1
    function (db) {
        db.createObjectStore('states', { keyPath: 'id' });
        db.createObjectStore('contents', { keyPath: 'id' });
        const changes = db.createObjectStore('changes', {
            keyPath: 'order',
            autoIncrement: true,
        });
        changes.createIndex('document', 'document', {
            unique: false,
            multiEntry: true,
        });
    },
];
/* eslint-enable func-names */
export function upgradeDatabase(event) {
    const { newVersion, oldVersion } = event;
    const { result: db, transaction: tx } = event.target;
    if (newVersion === null || tx === null) {
        // We're being deleted.
        return;
    }
    for (let ver = oldVersion + 1; ver <= newVersion; ++ver) {
        MIGRATIONS[ver](db, tx);
    }
}
