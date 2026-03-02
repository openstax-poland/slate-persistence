import { Node, Operation } from 'slate';
import { State } from './schema';
import { Export } from './util';
export { State };
/** Management of and access to the persistence database */
export declare class PersistDB {
    /** Open the database */
    static open(): Promise<PersistDB>;
    /**
     * Load a document
     *
     * This is a convenience wrapper around {@link #open}
     * and {@link #openDocument}.
     */
    static load(id: string): Promise<DocumentDB>;
    private readonly database;
    private constructor();
    /**
     * Export contents of this database as a JS object
     *
     * Returned object can later be used to import data into a database using
     * {@link #import}. It contains only plain JS values and can safely be
     * converted to/from JSON.
     */
    export(): Promise<Export>;
    /** Import data into a database */
    import(data: Export): Promise<void>;
    /** Open a document */
    openDocument(id: string): Promise<DocumentDB>;
    /** Get a list of all modules with local unsaved changes */
    dirty(): Promise<State[]>;
    /**
     * Discard any saved changes to a document
     *
     * This has the same effect as calling {@link DocumentDB#discard} on
     * a loaded document.
     */
    discard(id: string): Promise<void>;
}
/** Local state of a document */
export declare class DocumentDB {
    private readonly database;
    readonly id: string;
    dirty: boolean;
    version: string | null;
    /** @internal */
    constructor(db: IDBDatabase, id: string);
    /** Save a new version of a document */
    save(value: Node[], version: string): Promise<void>;
    /** Mark a change to the document */
    mark(op: Operation): Promise<void>;
    /**
     * Restore document from its saved state
     */
    restore(): Promise<[Node[], Operation[]]>;
    /** Discard any saved changes to a document */
    discard(): Promise<void>;
}
