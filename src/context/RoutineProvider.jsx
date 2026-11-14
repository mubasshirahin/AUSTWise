import { useState, useEffect, useCallback, useRef } from 'react';
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

// Per-user marker: set when the user loads a CR's published routine. It is the
// single source of truth for whether Zero Hour follows the CR's shared exam
// schedule or the user's own, manually edited routine.
const loadedSharedRoutineKey = (userId) => `aust-loaded-shared-routine:${userId}`;

export function RoutineProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  const activeUserIdRef = useRef(userId);
  activeUserIdRef.current = userId;

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

  const [isLoading, setIsLoading] = useState(() => isAuthenticated);
  const [loadedSharedCrId, setLoadedSharedCrId] = useState(null);
  const loadGenerationRef = useRef(0);

  // Restore the "loaded from CR" source for this account. Zero Hour uses it to
  // decide whether the CR's shared exam schedule applies (only after a load).
  useEffect(() => {
    if (!userId) {
      setLoadedSharedCrId(null);
      return undefined;
    }
    let cancelled = false;
    userStore.get(loadedSharedRoutineKey(userId)).then((crId) => {
      if (!cancelled && activeUserIdRef.current === userId) {
        setLoadedSharedCrId(crId || null);
      }
    }).catch(() => {
      if (!cancelled && activeUserIdRef.current === userId) setLoadedSharedCrId(null);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const markSharedRoutineLoaded = useCallback(async (crId) => {
    if (!userId || !crId) return false;
    const saved = await userStore.set(loadedSharedRoutineKey(userId), crId);
    if (saved) setLoadedSharedCrId(crId);
    return saved;
  }, [userId]);

  const clearSharedRoutineSource = useCallback(async () => {
    setLoadedSharedCrId(null);
    if (!userId) return true;
    return userStore.del(loadedSharedRoutineKey(userId));
  }, [userId]);

  const loadFromServer = useCallback(() => {
    const generation = ++loadGenerationRef.current;
    if (!isAuthenticated) {
      setRoutine(getUserStorageItem(storageKeyTypes.routine) || defaultRoutine);
      setWeekDays(getUserStorageItem(storageKeyTypes.weekDays) || ocrImportedWeekDays);
      setIsLoading(false);
      return;
    }
    // Swap to this account's own saved timetable before its server copy loads.
    const localRoutine = getUserStorageItem(storageKeyTypes.routine);
    const localWeekDays = getUserStorageItem(storageKeyTypes.weekDays);
    setRoutine(localRoutine || defaultRoutine);
    setWeekDays(localWeekDays || ocrImportedWeekDays);
    setIsLoading(true);
    Promise.all([userStore.get(ROUTINE_KEY), userStore.get(WEEKDAYS_KEY)]).then(([serverRoutine, serverWeekDays]) => {
      if (generation !== loadGenerationRef.current) return;
      if (serverRoutine !== null) {
        setRoutine(serverRoutine);
        setUserStorageItem(storageKeyTypes.routine, serverRoutine);
      } else if (localRoutine !== null) {
        userStore.set(ROUTINE_KEY, localRoutine);
      }
      if (serverWeekDays !== null) {
        setWeekDays(serverWeekDays);
        setUserStorageItem(storageKeyTypes.weekDays, serverWeekDays);
      } else if (localWeekDays !== null) {
        userStore.set(WEEKDAYS_KEY, localWeekDays);
      }
      setIsLoading(false);
    }).catch(() => {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    });
  }, [isAuthenticated, user?.id]);

  // Pull the server copy once on mount/login. The websocket (see below)
  // keeps it fresh afterwards.
  useEffect(() => {
    loadFromServer();
    return () => { loadGenerationRef.current += 1; };
  }, [loadFromServer]);

  // Real-time: when ANOTHER device (same user, e.g. phone) edits the routine,
  // the server broadcasts store-change → re-fetch just the changed key.
  useWebSocket(isAuthenticated ? user?.id : null, {
    onStoreChange: useCallback(({ scope, key: changedKey }) => {
      if (scope !== 'user') return;
      const targetUserId = user?.id || null;
      if (changedKey === ROUTINE_KEY) {
        userStore.get(ROUTINE_KEY).then((serverRoutine) => {
          if (serverRoutine === null || activeUserIdRef.current !== targetUserId) return;
          setRoutine(serverRoutine);
          setUserStorageItem(storageKeyTypes.routine, serverRoutine);
        });
      } else if (changedKey === WEEKDAYS_KEY) {
        userStore.get(WEEKDAYS_KEY).then((serverWeekDays) => {
          if (serverWeekDays === null || activeUserIdRef.current !== targetUserId) return;
          setWeekDays(serverWeekDays);
          setUserStorageItem(storageKeyTypes.weekDays, serverWeekDays);
        });
      } else if (targetUserId && changedKey === loadedSharedRoutineKey(targetUserId)) {
        // A load/unload (or manual edit that detaches the routine) on another
        // device keeps Zero Hour's shared/personal mode in sync here too.
        userStore.get(changedKey).then((crId) => {
          if (activeUserIdRef.current !== targetUserId) return;
          setLoadedSharedCrId(crId || null);
        });
      }
    }, [user?.id]),
  });

  const importOcrRoutine = () => {
    setRoutine(ocrImportedRoutine);
    setWeekDays(ocrImportedWeekDays);
    setUserStorageItem(storageKeyTypes.routine, ocrImportedRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, ocrImportedWeekDays);
    userStore.set(ROUTINE_KEY, ocrImportedRoutine);
    userStore.set(WEEKDAYS_KEY, ocrImportedWeekDays);
    // Manually imported data is no longer the CR's routine.
    clearSharedRoutineSource();
  };

  const saveRoutine = (nextRoutine) => {
    setRoutine(nextRoutine);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
    userStore.set(ROUTINE_KEY, nextRoutine);
  };

  const replaceRoutine = async (nextRoutine, nextWeekDays, { keepSharedSource = false } = {}) => {
    // A routine loaded from a CR must be committed to the account store before
    // presenting it as successfully loaded. This keeps other devices in sync.
    if (isAuthenticated) {
      const [routineSaved, weekDaysSaved] = await Promise.all([
        userStore.set(ROUTINE_KEY, nextRoutine),
        userStore.set(WEEKDAYS_KEY, nextWeekDays),
      ]);
      if (!routineSaved || !weekDaysSaved) {
        throw new Error('Could not save the loaded routine to your account. Check your connection and try again.');
      }
    }
    setRoutine(nextRoutine);
    setWeekDays(nextWeekDays);
    setUserStorageItem(storageKeyTypes.routine, nextRoutine);
    setUserStorageItem(storageKeyTypes.weekDays, nextWeekDays);
    // Loading a template / resetting detaches the routine from any CR. The
    // live CR sync passes keepSharedSource so its own refresh does not unlink.
    if (!keepSharedSource) await clearSharedRoutineSource();
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
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
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
    clearSharedRoutineSource();
  };

  return (
    <RoutineContext.Provider value={{
      routine,
      weekDays,
      isLoading,
      loadedSharedCrId,
      importOcrRoutine,
      resetRoutine,
      replaceRoutine,
      markSharedRoutineLoaded,
      clearSharedRoutineSource,
      updateRoutineClass,
      addRoutineClass,
      deleteRoutineClass,
    }}>
      {children}
    </RoutineContext.Provider>
  );
}
