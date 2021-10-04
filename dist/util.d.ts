/** Convert an IndexedDB request into a promise */
export declare function promisify<T>(req: IDBRequest<T>): Promise<T>;
export declare type IterateCallback<T> = (cursor: IDBCursor, value: T, reject: <T extends Error>(err: T) => void) => void;
export declare function iterate<T>(store: IDBObjectStore | IDBIndex, f: IterateCallback<T>): Promise<void>;
export declare function iterate<T>(store: IDBObjectStore | IDBIndex, query: IDBValidKey | IDBKeyRange | null, f: IterateCallback<T>): Promise<void>;
export declare function iterate<T>(store: IDBObjectStore | IDBIndex, query: IDBValidKey | IDBKeyRange | null, direction: IDBCursorDirection, f: IterateCallback<T>): Promise<void>;
export interface Export {
    database: {
        name: string;
        version: number;
        objectStores: ObjectStoreMap;
    };
    remove: RemoveMap;
    insert: InsertMap;
}
export interface ObjectStore {
    keyPath: string | string[];
    autoIncrement: boolean;
    indexes: IndexMap;
}
export declare type ObjectStoreMap = {
    [name: string]: ObjectStore;
};
export interface Index {
    name: string;
    keyPath: string | string[];
    multiEntry: boolean;
    unique: boolean;
}
export declare type IndexMap = {
    [name: string]: Index;
};
export interface RemoveSpec {
    key?: string | string[];
    index?: string;
}
export declare type RemoveMap = {
    [storeName: string]: RemoveSpec;
};
export declare type InsertMap = {
    [storeName: string]: unknown[];
};
/**
 * Export contents of a database as a JS object
 *
 * Returned object can later be used to import data into a database using
 * {@link #importDatabase}. It contains only plain JS values and can safely be
 * converted to/from JSON.
 */
export declare function exportDatabase(db: IDBDatabase): Promise<Export>;
/** Import data into a database */
export declare function importDatabase(db: IDBDatabase, data: Export): Promise<void>;
