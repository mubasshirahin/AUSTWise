package com.austwise.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class NativeAlarmScheduler {
    static final String ACTION_ALARM = "com.austwise.app.ACTION_WAKE_ME_UP";
    static final String PREFS = "native_wake_alarm";
    static final int REQUEST_CODE = 9182;

    private NativeAlarmScheduler() {}

    static boolean canScheduleExactAlarms(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return alarmManager != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms());
    }

    static void schedule(Context context, long triggerAtMillis, String title, String body) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) throw new IllegalStateException("AlarmManager is unavailable");
        if (!canScheduleExactAlarms(context)) throw new SecurityException("Exact alarm permission is not granted");

        Intent alarmIntent = new Intent(context, NativeAlarmReceiver.class)
            .setAction(ACTION_ALARM)
            .putExtra("title", title)
            .putExtra("body", body);
        PendingIntent operation = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showOperation = PendingIntent.getActivity(
            context,
            REQUEST_CODE + 1,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showOperation);
        alarmManager.setAlarmClock(clockInfo, operation);

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("enabled", true)
            .putLong("triggerAtMillis", triggerAtMillis)
            .putString("title", title)
            .putString("body", body)
            .apply();
    }

    static void cancel(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            Intent alarmIntent = new Intent(context, NativeAlarmReceiver.class).setAction(ACTION_ALARM);
            PendingIntent operation = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            alarmManager.cancel(operation);
            operation.cancel();
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }

    static void restore(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;

        long triggerAtMillis = prefs.getLong("triggerAtMillis", 0L);
        if (triggerAtMillis <= System.currentTimeMillis() || !canScheduleExactAlarms(context)) {
            if (triggerAtMillis <= System.currentTimeMillis()) {
                prefs.edit().clear().apply();
            }
            return;
        }

        schedule(
            context,
            triggerAtMillis,
            prefs.getString("title", "WakeMeUp — first class") ,
            prefs.getString("body", "Your first class is starting soon.")
        );
    }
}
