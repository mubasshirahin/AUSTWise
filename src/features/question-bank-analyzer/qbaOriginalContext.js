import { createContext } from 'react';

/* Source files + QID -> paper rows, shared by every question card. */
export const OriginalContext = createContext({ qidRows: null, sourceFiles: [], refreshKey: 0 });

export default OriginalContext;
