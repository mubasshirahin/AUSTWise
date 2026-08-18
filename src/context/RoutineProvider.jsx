import { useState, useEffect, useCallback } from 'react';
import { RoutineContext, ocrImportedRoutine, ocrImportedWeekDays } from './RoutineContext';
import { routineData as defaultRoutine, weekDays as defaultWeekDays } from '../data/mockData';
import { getUserStorageItem, setUserStorageItem, getUserStorageKey } from '../utils/authStorage';
import { userStore } from '../utils/storageService';
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';

const storageKeyTypes = {
  routine: 'userRoutine',
  weekDays: 'userWeekDays'
};

const ROUTINE_KEY = 'aust-user-routine';
const WEEKDAYS_KEY = 'aust-user-weekdays';

export function RoutineProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  const [routine, setRoutine] = useState(() => {
    const saved = getUserStorageItem(storageKeyTypes.routine);
    // getUserStorageItem already parses JSON, so use directly
    return saved || defaultRoutine;
  });

  const [weekDays, setWeekDays] = useState(() => {
    const saved = getUserStorageItem(storageKeyTypes.weekDays);
    // getUserStorageItem already parses JSON, so use directly
    return saved || ocrImportedWeekDays;
  });

  const loadFromServer = useCallback(() => {
    if (!isAuthenticated) return;
    userStore.get(ROUTINE_KEY).then((serverRoutine) => {
      if (serverRoutine === null) return; // nothing saved on server — keep local
      setRoutine(serverRoutine);
      setUserStorageItem(storageKeyTypes.routine, serverRoutine);
    });
    userStore.get(WEEKDAYS_KEY).then((serverWeekDays) => {
      if (serverWeekDays === null) return;
      setWeekDays(serverWeekDays);
      setUserStorageItem(storageKeyTypes.weekDays, serverWeekDays);
    });
  }, [isAuthenticated]);

  // Pull the server copy once on mount/login. The websocket (see below)
  // keeps it fresh afterwards.
  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  // Real-time: when ANOTHER device (same user, e.g. phone) edits the routine,
  // the server broadcasts store-change → re-fetch just the changed key.
  useWebSocket(isAuthenticated ? user?.id : null, {
    onStoreChange: useCallback(({ scope, key: changedKey }) => {
      if (scope !== 'user') return;
      if (changedKey === ROUTINE_KEY) {
        userStore.get(ROUTINE_KEY).then((serverRoutine) => {
          if (serverRoutine === null) return;
          setRoutine(serverRoutine);
          setUserStorageItem(storageKeyTypes.routine, serverRoutine);
        });
      } else if (changedKey === WEEKDAYS_KEY) {
        userStore.get(WEEKDAYS_KEY).then((serverWeekDays) => {
          if (serverWeekDays === null) return;
          setWeekDays(serverWeekDays);
          setUserStorageItem(storageKeyTypes.weekDays, serverWeekDays);
        });
      }
    }, []),
  });

  const importOcrRoutine = () => {
    setRoutine(ocrImportedRoutine);
    setWeekDays(ocrImportedWeekDays);
    setUserStorageItem(storageKeyTypes.routine, ocrImportedRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, ocrImportedWeekDays);
    userStore.set(ROUTINE_KEY, ocrImportedRoutine);
    userStore.set(WEEKDAYS_KEY, ocrImportedWeekDays);
  };

  const saveRoutine = (nextRoutine) => {
    setRoutine(nextRoutine);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
    userStore.set(ROUTINE_KEY, nextRoutine);
  };

  const replaceRoutine = (nextRoutine, nextWeekDays) => {
    setRoutine(nextRoutine);
    setWeekDays(nextWeekDays);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, nextWeekDays);
    userStore.set(ROUTINE_KEY, nextRoutine);
    userStore.set(WEEKDAYS_KEY, nextWeekDays);
  };

  const updateRoutineClass = (originalDay, updatedClass) => {
    const nextRoutine = { ...routine };

    nextRoutine[originalDay] = (nextRoutine[originalDay] || []).filter(
      (cls) => cls.id !== updatedClass.id
    );

    const targetDay = updatedClass.day || originalDay;
    const { day: _day, ...classData } = updatedClass;
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
    setRoutine(defaultRoutine);
    setWeekDays(defaultWeekDays);
    const routineKey = getUserStorageKey(storageKeyTypes.routine);
    const weekDaysKey = getUserStorageKey(storageKeyTypes.weekDays);
    if (routineKey) localStorage.removeItem(routineKey);
    if (weekDaysKey) localStorage.removeItem(weekDaysKey);
    userStore.del(ROUTINE_KEY);
    userStore.del(WEEKDAYS_KEY);
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