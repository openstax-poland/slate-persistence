import { Editor } from 'slate';
import { DocumentDB } from './database';
import { PersistingEditor } from './persisting-editor';
export default function withPersistence<T extends Editor>(db: DocumentDB, editor: T): T & PersistingEditor;
