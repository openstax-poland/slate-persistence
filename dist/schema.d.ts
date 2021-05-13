import { Node, Operation } from 'slate';
/** State of an opened document */
export declare type State = {
    /** Document's identification */
    id: string;
    /** Document's version when it was last loaded */
    version: string;
};
/** A single change to a document */
export declare type Change = {
    /**
     * ID of a document to which this change was applied
     *
     * This property is indexed.
     */
    document: string;
    /**
     * Opaque value representing order in which operations are applied
     *
     * The exact value of this field is left unspecified, except that it is
     * guaranteed to be larger than the value for any operation previously
     * applied to the document.
     */
    order: number;
    /** The operation applied in this change */
    change: Operation;
};
/**
 * Content of a document before any {@link Change}s were made
 *
 * We keep it separate from {@link State} to allow querying it without copying
 * potentially huge serialized document.
 */
export declare type Content = {
    /** Document's identification */
    id: string;
    /** Document's contents at the time it was last loaded */
    content: Node[];
};
export declare function upgradeDatabase(event: IDBVersionChangeEvent): void;
