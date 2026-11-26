import { createContext } from 'react';

/*
 * Source files, QID -> paper rows, the student's saved crop fixes and the
 * function that opens the fixer — shared by every question card.
 */
export const OriginalContext = createContext({
  qidRows: null,
  sourceFiles: [],
  refreshKey: 0,
  overrides: {},
  openFixer: null,
});

export default OriginalContext;
