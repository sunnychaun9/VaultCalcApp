package com.vaultcalcapp.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.vaultcalcapp.MainActivity
import com.vaultcalcapp.R
import java.text.DecimalFormat

class CalculatorWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "calculator_widget"
        private const val KEY_DISPLAY = "display"
        private const val KEY_OPERAND = "operand"
        private const val KEY_PENDING_OP = "pending_op"
        private const val KEY_RESET_ON_NEXT = "reset_on_next"

        private const val ACTION_DIGIT = "com.vaultcalcapp.widget.ACTION_DIGIT"
        private const val ACTION_OP = "com.vaultcalcapp.widget.ACTION_OP"
        private const val ACTION_EQUALS = "com.vaultcalcapp.widget.ACTION_EQUALS"
        private const val ACTION_CLEAR = "com.vaultcalcapp.widget.ACTION_CLEAR"
        private const val ACTION_BACKSPACE = "com.vaultcalcapp.widget.ACTION_BACKSPACE"
        private const val ACTION_DECIMAL = "com.vaultcalcapp.widget.ACTION_DECIMAL"
        private const val ACTION_PERCENT = "com.vaultcalcapp.widget.ACTION_PERCENT"
        private const val ACTION_OPEN_APP = "com.vaultcalcapp.widget.ACTION_OPEN_APP"

        private const val EXTRA_DIGIT = "extra_digit"
        private const val EXTRA_OP = "extra_op"
        private const val MAX_DISPLAY_LENGTH = 10

        private val thousandsFormat = DecimalFormat("#,###.##########")
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
            ComponentName(context, CalculatorWidgetProvider::class.java)
        )

        if (appWidgetIds.isEmpty()) return
        val appWidgetId = appWidgetIds[0]

        when (intent.action) {
            ACTION_DIGIT -> {
                val digit = intent.getStringExtra(EXTRA_DIGIT) ?: return
                if (digit.length != 1 || digit[0] !in '0'..'9') return
                handleDigit(context, appWidgetId, digit)
            }
            ACTION_OP -> {
                val op = intent.getCharExtra(EXTRA_OP, '+')
                if (op !in charArrayOf('+', '-', '×', '÷')) return
                handleOperator(context, appWidgetId, op)
            }
            ACTION_EQUALS -> handleEquals(context, appWidgetId)
            ACTION_CLEAR -> handleClear(context, appWidgetId)
            ACTION_BACKSPACE -> handleBackspace(context, appWidgetId)
            ACTION_DECIMAL -> handleDecimal(context, appWidgetId)
            ACTION_PERCENT -> handlePercent(context, appWidgetId)
            ACTION_OPEN_APP -> {
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(launchIntent)
                return
            }
            else -> return
        }

        updateWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (id in appWidgetIds) {
            editor.remove("${KEY_DISPLAY}_$id")
            editor.remove("${KEY_OPERAND}_$id")
            editor.remove("${KEY_PENDING_OP}_$id")
            editor.remove("${KEY_RESET_ON_NEXT}_$id")
        }
        editor.apply()
    }

    private fun handleDigit(context: Context, widgetId: Int, digit: String) {
        val state = loadState(context, widgetId)
        var display = state.display

        if (state.resetOnNext || display == "0" || display == "Error") {
            display = digit
        } else {
            val rawDisplay = display.replace(",", "")
            if (rawDisplay.length >= MAX_DISPLAY_LENGTH) return
            display = rawDisplay + digit
        }

        saveState(context, widgetId, state.copy(display = formatDisplay(display), resetOnNext = false))
    }

    private fun handleOperator(context: Context, widgetId: Int, op: Char) {
        val state = loadState(context, widgetId)
        val currentValue = parseDisplay(state.display)

        if (state.pendingOp != null && !state.resetOnNext) {
            val result = evaluate(state.operand ?: 0.0, currentValue, state.pendingOp)
            if (result == null) {
                saveState(context, widgetId, CalcState("Error", null, null, true))
                return
            }
            val formatted = formatResult(result)
            saveState(context, widgetId, CalcState(formatted, result, op, true))
        } else {
            saveState(context, widgetId, state.copy(operand = currentValue, pendingOp = op, resetOnNext = true))
        }
    }

    private fun handleEquals(context: Context, widgetId: Int) {
        val state = loadState(context, widgetId)
        if (state.pendingOp == null || state.operand == null) return

        val currentValue = parseDisplay(state.display)
        val result = evaluate(state.operand, currentValue, state.pendingOp)
        if (result == null) {
            saveState(context, widgetId, CalcState("Error", null, null, true))
            return
        }
        val formatted = formatResult(result)
        saveState(context, widgetId, CalcState(formatted, null, null, true))
    }

    private fun handleClear(context: Context, widgetId: Int) {
        saveState(context, widgetId, CalcState("0", null, null, false))
    }

    private fun handleBackspace(context: Context, widgetId: Int) {
        val state = loadState(context, widgetId)
        if (state.display == "Error" || state.resetOnNext) {
            saveState(context, widgetId, state.copy(display = "0", resetOnNext = false))
            return
        }
        val raw = state.display.replace(",", "")
        val newRaw = if (raw.length <= 1) "0" else raw.dropLast(1)
        saveState(context, widgetId, state.copy(display = formatDisplay(newRaw)))
    }

    private fun handleDecimal(context: Context, widgetId: Int) {
        val state = loadState(context, widgetId)
        var display = state.display

        if (state.resetOnNext || display == "Error") {
            display = "0."
            saveState(context, widgetId, state.copy(display = display, resetOnNext = false))
            return
        }

        val raw = display.replace(",", "")
        if (raw.contains(".")) return
        if (raw.length >= MAX_DISPLAY_LENGTH) return

        saveState(context, widgetId, state.copy(display = formatDisplay(raw) + "."))
    }

    private fun handlePercent(context: Context, widgetId: Int) {
        val state = loadState(context, widgetId)
        val value = parseDisplay(state.display)
        val result = value / 100.0
        val formatted = formatResult(result)
        saveState(context, widgetId, state.copy(display = formatted, resetOnNext = true))
    }

    private fun evaluate(left: Double, right: Double, op: Char?): Double? {
        return when (op) {
            '+' -> left + right
            '-' -> left - right
            '*' -> left * right
            '/' -> if (right == 0.0) null else left / right
            else -> null
        }
    }

    private fun parseDisplay(display: String): Double {
        return display.replace(",", "").toDoubleOrNull() ?: 0.0
    }

    private fun formatResult(value: Double): String {
        if (value.isNaN() || value.isInfinite()) return "Error"
        if (value == value.toLong().toDouble() && value in -9_999_999_999.0..9_999_999_999.0) {
            return thousandsFormat.format(value.toLong())
        }
        val formatted = thousandsFormat.format(value)
        val raw = formatted.replace(",", "")
        return if (raw.length > MAX_DISPLAY_LENGTH) {
            val scientific = String.format("%.4E", value)
            if (scientific.length > MAX_DISPLAY_LENGTH) "Error" else scientific
        } else {
            formatted
        }
    }

    private fun formatDisplay(raw: String): String {
        val cleanRaw = raw.replace(",", "")
        if (cleanRaw.contains(".")) {
            val parts = cleanRaw.split(".")
            val intPart = parts[0].toLongOrNull() ?: return cleanRaw
            return thousandsFormat.format(intPart) + "." + parts.getOrElse(1) { "" }
        }
        val longVal = cleanRaw.toLongOrNull() ?: return cleanRaw
        return thousandsFormat.format(longVal)
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val state = loadState(context, appWidgetId)
        val views = RemoteViews(context.packageName, R.layout.widget_calculator)

        views.setTextViewText(R.id.widget_display, state.display)

        // Display tap → open app
        views.setOnClickPendingIntent(R.id.widget_display, getPendingIntent(context, ACTION_OPEN_APP))

        // Digit buttons
        val digitButtons = mapOf(
            R.id.btn_0 to "0", R.id.btn_1 to "1", R.id.btn_2 to "2",
            R.id.btn_3 to "3", R.id.btn_4 to "4", R.id.btn_5 to "5",
            R.id.btn_6 to "6", R.id.btn_7 to "7", R.id.btn_8 to "8",
            R.id.btn_9 to "9"
        )
        for ((viewId, digit) in digitButtons) {
            val intent = Intent(context, CalculatorWidgetProvider::class.java).apply {
                action = ACTION_DIGIT
                putExtra(EXTRA_DIGIT, digit)
            }
            val pi = PendingIntent.getBroadcast(
                context,
                viewId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(viewId, pi)
        }

        // Operator buttons
        val opButtons = mapOf(
            R.id.btn_add to '+',
            R.id.btn_subtract to '-',
            R.id.btn_multiply to '*',
            R.id.btn_divide to '/'
        )
        for ((viewId, op) in opButtons) {
            val intent = Intent(context, CalculatorWidgetProvider::class.java).apply {
                action = ACTION_OP
                putExtra(EXTRA_OP, op)
            }
            val pi = PendingIntent.getBroadcast(
                context,
                viewId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(viewId, pi)
        }

        // Function buttons
        views.setOnClickPendingIntent(R.id.btn_equals, getPendingIntent(context, ACTION_EQUALS))
        views.setOnClickPendingIntent(R.id.btn_clear, getPendingIntent(context, ACTION_CLEAR))
        views.setOnClickPendingIntent(R.id.btn_backspace, getPendingIntent(context, ACTION_BACKSPACE))
        views.setOnClickPendingIntent(R.id.btn_decimal, getPendingIntent(context, ACTION_DECIMAL))
        views.setOnClickPendingIntent(R.id.btn_percent, getPendingIntent(context, ACTION_PERCENT))

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun getPendingIntent(context: Context, action: String): PendingIntent {
        val intent = Intent(context, CalculatorWidgetProvider::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            context,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // --- State management ---

    private data class CalcState(
        val display: String = "0",
        val operand: Double? = null,
        val pendingOp: Char? = null,
        val resetOnNext: Boolean = false
    )

    private fun loadState(context: Context, widgetId: Int): CalcState {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val display = prefs.getString("${KEY_DISPLAY}_$widgetId", "0") ?: "0"
        val operandStr = prefs.getString("${KEY_OPERAND}_$widgetId", null)
        val operand = operandStr?.toDoubleOrNull()
        val opStr = prefs.getString("${KEY_PENDING_OP}_$widgetId", null)
        val pendingOp = opStr?.firstOrNull()
        val resetOnNext = prefs.getBoolean("${KEY_RESET_ON_NEXT}_$widgetId", false)
        return CalcState(display, operand, pendingOp, resetOnNext)
    }

    private fun saveState(context: Context, widgetId: Int, state: CalcState) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("${KEY_DISPLAY}_$widgetId", state.display)
            .putString("${KEY_OPERAND}_$widgetId", state.operand?.toString())
            .putString("${KEY_PENDING_OP}_$widgetId", state.pendingOp?.toString())
            .putBoolean("${KEY_RESET_ON_NEXT}_$widgetId", state.resetOnNext)
            .apply()
    }
}
