import React, { createContext, useContext, useState, useEffect } from 'react';

import { getUserStorageItem, setUserStorageItem, getUserStorageKey } from '../utils/authStorage';

const RoutineContext = createContext();
const storageKeyTypes = {
  routine: 'userRoutine',
  weekDays: 'userWeekDays'
};

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

  export function RoutineProvider({ children }) {
  const [routine, setRoutine] = useState(() => {
    const saved = getUserStorageItem(storageKeyTypes.routine);
    return saved || ocrImportedRoutine;
  });

  const [weekDays, setWeekDays] = useState(() => {
    const saved = getUserStorageItem(storageKeyTypes.weekDays);
    return saved || ocrImportedWeekDays;
  });

  const importOcrRoutine = () => {
    setRoutine(ocrImportedRoutine);
    setWeekDays(ocrImportedWeekDays);
    setUserStorageItem(storageKeyTypes.routine, ocrImportedRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, ocrImportedWeekDays);
  };



  const saveRoutine = (nextRoutine) => {
    setRoutine(nextRoutine);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
  };

  const replaceRoutine = (nextRoutine, nextWeekDays) => {
    setRoutine(nextRoutine);
    setWeekDays(nextWeekDays);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, nextWeekDays);
  };

  const updateRoutineClass = (originalDay, updatedClass) => {
    const nextRoutine = { ...routine };

    nextRoutine[originalDay] = (nextRoutine[originalDay] || []).filter(
      (cls) => cls.id !== updatedClass.id
    );

    const targetDay = updatedClass.day || originalDay;
    const { day, ...classData } = updatedClass;
    nextRoutine[targetDay] = [...(nextRoutine[targetDay] || []), classData];

    saveRoutine(nextRoutine);
  };

  const addRoutineClass = (day, classData) => {
    const nextRoutine = {
      ...routine,
      [day]: [
        ...(routine[day] || []),
        {
          ...classData,
          id: Date.now(),
        },
      ],
    };

    saveRoutine(nextRoutine);
  };

  const deleteRoutineClass = (day, classId) => {
    const nextRoutine = {
      ...routine,
      [day]: (routine[day] || []).filter((cls) => cls.id !== classId),
    };

    saveRoutine(nextRoutine);
  };

  const resetRoutine = () => {
    setRoutine(ocrImportedRoutine);
    setWeekDays(ocrImportedWeekDays);
    const routineKey = getUserStorageKey(storageKeyTypes.routine);
    const weekDaysKey = getUserStorageKey(storageKeyTypes.weekDays);
    if (routineKey) localStorage.removeItem(routineKey);
    if (weekDaysKey) localStorage.removeItem(weekDaysKey);
  };

  return (
    <RoutineContext.Provider value={{
      routine,
      weekDays,
      importOcrRoutine,
      resetRoutine,
      replaceRoutine,
      updateRoutineClass,
      addRoutineClass,
      deleteRoutineClass,
    }}>
      {children}
    </RoutineContext.Provider>
  );
}

export const useRoutine = () => useContext(RoutineContext);
