package app.austwise.bubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * Messenger-style chat head: a 56dp circle added through WindowManager with
 * TYPE_APPLICATION_OVERLAY, so it floats above every other app while this
 * service runs. Tap opens AUSTWise, drag moves it, notification stops it.
 */
class BubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubble: View? = null

    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var moved = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundCompatible()
        showBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        bubble?.let { view ->
            runCatching { windowManager?.removeView(view) }
        }
        bubble = null
        windowManager = null
    }

    // ── Notification (required for a foreground service) ──────────────────

    private fun startForegroundCompatible() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            channel.setShowBadge(false)
            manager?.createNotificationChannel(channel)
        }

        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, BubbleService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // minSdk is 23, so the channel-aware constructor is only used on 26+.
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        val notification = builder
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setContentIntent(openApp)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    Icon.createWithResource(this, android.R.drawable.ic_menu_compass),
                    "Stop",
                    stop
                ).build()
            )
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    // ── Overlay bubble ───────────────────────────────────────────────────

    private fun showBubble() {
        windowManager = getSystemService(WindowManager::class.java) ?: return

        val view = buildBubbleView()
        val screen = resources.displayMetrics
        val size = dp(56)

        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screen.widthPixels - size - dp(12)
            y = (screen.heightPixels * 0.62f).toInt()
        }

        view.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = layoutParams.x
                    startY = layoutParams.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - touchX
                    val dy = event.rawY - touchY
                    if (abs(dx) > dp(6) || abs(dy) > dp(6)) moved = true

                    val maxX = screen.widthPixels - size
                    val maxY = screen.heightPixels - size - dp(8)
                    layoutParams.x = (startX + dx).toInt().coerceIn(0, maxOf(0, maxX))
                    layoutParams.y = (startY + dy).toInt().coerceIn(0, maxOf(0, maxY))

                    runCatching { windowManager?.updateViewLayout(view, layoutParams) }
                    true
                }

                MotionEvent.ACTION_UP -> {
                    if (!moved) openSite()
                    true
                }

                else -> false
            }
        }

        runCatching {
            windowManager?.addView(view, layoutParams)
            bubble = view
        }
    }

    /** Dark disc + white A/W + amber rule — the app's navbar mark, no assets. */
    private fun buildBubbleView(): View {
        val size = dp(56)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#111111"))
                setStroke(dp(2), Color.WHITE)
            }
        }

        val letters = TextView(this).apply {
            text = "AW"
            setTextColor(Color.WHITE)
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.DEFAULT_BOLD
            includeFontPadding = false
            gravity = Gravity.CENTER
        }

        val rule = View(this).apply {
            setBackgroundColor(Color.parseColor("#F2A900"))
            layoutParams = LinearLayout.LayoutParams(dp(16), dp(2)).apply { topMargin = dp(3) }
        }

        container.addView(letters)
        container.addView(rule)
        container.layoutParams = LinearLayout.LayoutParams(size, size)
        return container
    }

    private fun openSite() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SITE))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(intent) }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val CHANNEL_ID = "austwise_bubble"
        private const val NOTIF_ID = 42
        private const val SITE = "https://austwise.vercel.app/?app=1"
        const val ACTION_STOP = "app.austwise.bubble.STOP"
    }
}
