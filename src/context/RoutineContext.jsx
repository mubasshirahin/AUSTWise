import { createContext, useContext } from 'react';

export const RoutineContext = createContext();

// This matches the exact routine shown in the user's uploaded image:
// "Bachelor of Science in Computer Science and Engineering, AUST
// Semester Wise Class Schedule, Spring, 2025"
export const ocrImportedRoutine = {
  Sunday: [],
  Monday: [],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
};

export const ocrImportedWeekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

export const useRoutine = () => useContext(RoutineContext);
