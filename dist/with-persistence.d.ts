import { BaseEditor } from 'slate';
import { DocumentDB } from './database';
import { PersistingEditor } from './persisting-editor';
export default function withPersistence<T extends BaseEditor>(db: DocumentDB, editor: T): T & PersistingEditor;
