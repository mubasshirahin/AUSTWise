package app.austwise.bubble

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Tiny setup screen: asks for the "display over other apps" permission once,
 * then starts [BubbleService] so the chat head survives outside this app.
 */
class MainActivity : Activity() {

    private lateinit var statusView: TextView
    private lateinit var actionButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(56), dp(28), dp(28))
            setBackgroundColor(Color.parseColor("#0B0B0B"))
        }

        // Same mark as the web app's bubble.
        val badge = TextView(this).apply {
            text = "AW"
            setTextColor(Color.WHITE)
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 26f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#111111"))
                setStroke(dp(2), Color.WHITE)
            }
            layoutParams = LinearLayout.LayoutParams(dp(88), dp(88))
        }

        val title = TextView(this).apply {
            text = "AUSTWise floating bubble"
            setTextColor(Color.WHITE)
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 20f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, 0)
        }

        val body = TextView(this).apply {
            text = "A bubble stays on top of every app — Instagram, YouTube, games. " +
                "Drag it anywhere, tap it to open AUSTWise.\n\n" +
                "Android needs the \u201CDisplay over other apps\u201D permission for this."
            setTextColor(Color.parseColor("#B4B4B4"))
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(20))
        }

        statusView = TextView(this).apply {
            setTextColor(Color.parseColor("#F2A900"))
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 13f)
            gravity = Gravity.CENTER
        }

        actionButton = Button(this).apply {
            setOnClickListener { onPrimaryAction() }
        }

        val stopButton = Button(this).apply {
            text = "Stop bubble"
            setOnClickListener {
                stopService(Intent(this@MainActivity, BubbleService::class.java))
                refreshState()
            }
        }

        root.addView(badge, badge.layoutParams)
        root.addView(title)
        root.addView(body)
        root.addView(statusView)
        root.addView(
            actionButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(16) }
        )
        root.addView(
            stopButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(8) }
        )

        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        refreshState()
    }

    private fun canDrawOverlays(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    private fun refreshState() {
        val granted = canDrawOverlays()
        statusView.text = if (granted) {
            "Permission granted — bubble can float over other apps."
        } else {
            "Permission missing — the bubble cannot show over other apps yet."
        }
        actionButton.text = if (granted) "Start floating bubble" else "Allow display over other apps"
    }

    private fun onPrimaryAction() {
        if (!canDrawOverlays()) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFICATIONS)
        }

        val serviceIntent = Intent(this, BubbleService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        refreshState()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val REQ_NOTIFICATIONS = 1001
    }
}
