import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeAlarm = registerPlugin('NativeAlarm');

export function isAndroidNative() {
  return Capacitor.getPlatform() === 'android';
}

export async function getNativeAlarmStatus() {
  if (!isAndroidNative()) return { available: false, canScheduleExactAlarms: false };
  try {
    return await NativeAlarm.getStatus();
  } catch {
    return { available: false, canScheduleExactAlarms: false };
  }
}

export async function requestNativeNotificationPermission() {
  if (!isAndroidNative()) return { granted: false, available: false };
  try {
    return await NativeAlarm.requestNotificationPermission();
  } catch {
    return { granted: false, available: true };
  }
}

export async function openNativeExactAlarmSettings() {
  if (!isAndroidNative()) return { opened: false };
  try {
    return await NativeAlarm.openExactAlarmSettings();
  } catch {
    return { opened: false };
  }
}

export async function scheduleNativeAlarm({ triggerAtMillis, title, body }) {
  if (!isAndroidNative()) return { scheduled: false, available: false };
  try {
    return await NativeAlarm.scheduleAlarm({ triggerAtMillis, title, body });
  } catch (error) {
    return {
      scheduled: false,
      available: true,
      error: error?.message || 'Native alarm could not be scheduled.',
      code: error?.code,
    };
  }
}

export async function scheduleNativeWakeUp(schedule, offsetMins = 30) {
  if (!schedule?.date || !schedule?.time) return { scheduled: false, available: false };
  const [year, month, day] = String(schedule.date).split('-').map(Number);
  const [hour, minute] = String(schedule.time).split(':').map(Number);
  const classTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  const triggerAtMillis = classTime.getTime() - Math.max(0, Number(offsetMins) || 0) * 60 * 1000;
  if (triggerAtMillis <= Date.now()) {
    return {
      scheduled: false,
      available: true,
      error: 'The selected alert time for this class has already passed. Choose a smaller lead time or use the next class day.',
    };
  }

  return scheduleNativeAlarm({
    triggerAtMillis,
    title: '⏰ WakeMeUp — first class',
    body: `${schedule.course || 'Your first class'}${schedule.room ? ` • Room ${schedule.room}` : ''} starts at ${schedule.time}.`,
  });
}

export function getNativeAlarmTriggerAtMillis(schedule, offsetMins = 30) {
  if (!schedule?.date || !schedule?.time) return null;
  const [year, month, day] = String(schedule.date).split('-').map(Number);
  const [hour, minute] = String(schedule.time).split(':').map(Number);
  const classTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  return classTime.getTime() - Math.max(0, Number(offsetMins) || 0) * 60 * 1000;
}

export async function cancelNativeAlarm() {
  if (!isAndroidNative()) return { cancelled: false, available: false };
  try {
    return await NativeAlarm.cancelAlarm();
  } catch {
    return { cancelled: false, available: true };
  }
}
