package com.paintcanvas

import android.content.Context
import android.graphics.*
import android.net.Uri
import android.view.MotionEvent
import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File

data class CellData(
    val row: Int,
    val col: Int,
    val targetColorHex: String
)

class PaintCanvasView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f
        color = Color.parseColor("#E0E0E0")
    }

    var gridSize: Int = 60
        set(value) {
            field = value
            cellSize = width.toFloat() / gridSize
            invalidate()
        }

    var cells: List<CellData> = emptyList()
        set(value) {
            field = value
            // targetColorMap 생성
            targetColorMap.clear()
            value.forEach { cell ->
                targetColorMap["${cell.row}-${cell.col}"] = cell.targetColorHex
            }
            invalidate()
        }

    var selectedColorHex: String = "#FF0000"
    var imageUri: String? = null
        set(value) {
            field = value
            backgroundBitmap = value?.let { loadBitmap(it) }
            invalidate()
        }

    private var cellSize: Float = 0f
    private val filledCells = mutableSetOf<String>() // "row-col"
    private val targetColorMap = mutableMapOf<String, String>() // "row-col" -> hex
    private var backgroundBitmap: Bitmap? = null

    private var lastTouchedRow = -1
    private var lastTouchedCol = -1

    init {
        setWillNotDraw(false)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        cellSize = w.toFloat() / gridSize
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // 배경 이미지 그리기
        backgroundBitmap?.let {
            val dest = RectF(0f, 0f, width.toFloat(), height.toFloat())
            canvas.drawBitmap(it, null, dest, null)
        }

        // 격자 그리기
        for (i in 0..gridSize) {
            val pos = i * cellSize
            canvas.drawLine(pos, 0f, pos, height.toFloat(), gridPaint)
            canvas.drawLine(0f, pos, width.toFloat(), pos, gridPaint)
        }

        // 채워진 셀 그리기
        filledCells.forEach { cellKey ->
            val parts = cellKey.split("-")
            val row = parts[0].toInt()
            val col = parts[1].toInt()

            val left = col * cellSize
            val top = row * cellSize

            // 배경 이미지가 있으면 해당 부분 크롭하여 그리기
            backgroundBitmap?.let { bitmap ->
                val src = Rect(
                    left.toInt(),
                    top.toInt(),
                    (left + cellSize).toInt(),
                    (top + cellSize).toInt()
                )
                val dest = RectF(left, top, left + cellSize, top + cellSize)
                canvas.drawBitmap(bitmap, src, dest, null)
            }
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                val col = (event.x / cellSize).toInt()
                val row = (event.y / cellSize).toInt()

                // 유효 범위 체크
                if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
                    return true
                }

                // 중복 터치 방지
                if (row == lastTouchedRow && col == lastTouchedCol) {
                    return true
                }

                lastTouchedRow = row
                lastTouchedCol = col

                val cellKey = "$row-$col"

                // 이미 채워진 셀은 스킵
                if (filledCells.contains(cellKey)) {
                    return true
                }

                // 색상 검증
                val targetColor = targetColorMap[cellKey]
                val isCorrect = targetColor == selectedColorHex

                if (isCorrect) {
                    // 셀 채우기 (즉시 반영)
                    filledCells.add(cellKey)
                    invalidate() // 즉시 재그리기 - 펜처럼 반응!

                    // JS로 이벤트 전송 (점수 업데이트용)
                    sendCellPaintedEvent(row, col, true)
                } else {
                    // 틀린 색상 - 점수 감점만
                    sendCellPaintedEvent(row, col, false)
                }

                return true
            }
            MotionEvent.ACTION_UP -> {
                lastTouchedRow = -1
                lastTouchedCol = -1
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun sendCellPaintedEvent(row: Int, col: Int, correct: Boolean) {
        val event: WritableMap = Arguments.createMap().apply {
            putInt("row", row)
            putInt("col", col)
            putBoolean("correct", correct)
        }

        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
            ?.receiveEvent(id, "onCellPainted", event)
    }

    private fun loadBitmap(uriString: String): Bitmap? {
        return try {
            val uri = Uri.parse(uriString)
            val inputStream = context.contentResolver.openInputStream(uri)
            BitmapFactory.decodeStream(inputStream)?.let { bitmap ->
                // 600x600으로 스케일
                Bitmap.createScaledBitmap(bitmap, 600, 600, true)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
