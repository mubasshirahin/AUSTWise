package com.austwise.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "NativeAlarm",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class NativeAlarmPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("canScheduleExactAlarms", NativeAlarmScheduler.canScheduleExactAlarms(getContext()));
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(NativeAlarmScheduler.PREFS, android.content.Context.MODE_PRIVATE);
        result.put("scheduled", prefs.getBoolean("enabled", false));
        result.put("triggerAtMillis", prefs.getLong("triggerAtMillis", 0L));
        result.put("notificationPermissionGranted", hasNotificationPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        if (hasNotificationPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    public void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasNotificationPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        Double triggerValue = call.getDouble("triggerAtMillis", 0.0);
        long triggerAtMillis = triggerValue == null ? 0L : triggerValue.longValue();
        String title = call.getString("title", "WakeMeUp — first class");
        String body = call.getString("body", "Your first class is starting soon.");

        if (triggerAtMillis <= System.currentTimeMillis()) {
            call.reject("The alarm time must be in the future.");
            return;
        }
        if (!NativeAlarmScheduler.canScheduleExactAlarms(getContext())) {
            call.reject("Exact alarm permission is not granted.", "EXACT_ALARM_PERMISSION_REQUIRED");
            return;
        }

        try {
            NativeAlarmReceiver.createNotificationChannel(getContext());
            NativeAlarmScheduler.schedule(getContext(), triggerAtMillis, title, body);
            JSObject result = new JSObject();
            result.put("scheduled", true);
            result.put("triggerAtMillis", triggerAtMillis);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Exact alarm permission is not granted.", "EXACT_ALARM_PERMISSION_REQUIRED", error);
        } catch (Exception error) {
            call.reject("Unable to schedule the Android alarm.", error);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        NativeAlarmScheduler.cancel(getContext());
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
