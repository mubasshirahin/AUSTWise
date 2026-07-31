package com.austwise.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NativeAlarmBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || "android.intent.action.QUICKBOOT_POWERON".equals(action)
            || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            NativeAlarmScheduler.restore(context);
        }
    }
}
