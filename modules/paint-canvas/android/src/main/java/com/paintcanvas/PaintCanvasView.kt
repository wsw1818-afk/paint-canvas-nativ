package com.paintcanvas

import android.content.Context
import android.graphics.*
import android.net.Uri
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.max
import kotlin.math.min

data class CellData(
    val row: Int,
    val col: Int,
    val targetColorHex: String,
    val label: String
)

class PaintCanvasView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val onCellPainted by EventDispatcher()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f
        color = Color.parseColor("#E0E0E0")
    }

    private var gridSize: Int = 100
    private var cells: List<CellData> = emptyList()
    private var selectedColorHex: String = "#FF0000"
    private var selectedLabel: String = "A"
    private var imageUri: String? = null

    fun setGridSize(value: Int) {
        gridSize = value
        cellSize = canvasWidth / gridSize
        invalidate()
    }

    fun setCells(cellList: List<Map<String, Any>>) {
        cells = cellList.map { cellMap ->
            CellData(
                row = (cellMap["row"] as? Number)?.toInt() ?: 0,
                col = (cellMap["col"] as? Number)?.toInt() ?: 0,
                targetColorHex = cellMap["targetColorHex"] as? String ?: "#000000",
                label = cellMap["label"] as? String ?: "A"
            )
        }
        // targetColorMap 및 labelMap 생성
        targetColorMap.clear()
        labelMap.clear()
        cells.forEach { cell ->
            val key = "${cell.row}-${cell.col}"
            targetColorMap[key] = cell.targetColorHex
            labelMap[key] = cell.label
        }
        invalidate()
    }

    fun setSelectedColor(colorHex: String) {
        selectedColorHex = colorHex
    }

    fun setSelectedLabel(label: String) {
        selectedLabel = label
    }

    fun setImageUri(uri: String) {
        imageUri = uri
        backgroundBitmap = loadBitmap(uri)
        invalidate()
    }

    private var canvasWidth: Float = 600f
    private var cellSize: Float = 0f
    private val filledCells = mutableSetOf<String>() // "row-col"
    private val targetColorMap = mutableMapOf<String, String>() // "row-col" -> hex
    private val labelMap = mutableMapOf<String, String>() // "row-col" -> label
    private var backgroundBitmap: Bitmap? = null

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        textAlign = Paint.Align.CENTER
        style = Paint.Style.FILL
    }

    private val coverPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }

    // Zoom and Pan variables
    private val matrix = Matrix()
    private var scaleFactor = 1f
    private var translateX = 0f
    private var translateY = 0f
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var activePointerId = -1
    private enum class TouchMode { NONE, DRAG, ZOOM }
    private var touchMode = TouchMode.NONE

    private val scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val prevScale = scaleFactor
            scaleFactor *= detector.scaleFactor
            scaleFactor = max(1f, min(scaleFactor, 5f))

            // Adjust translation to zoom towards focus point
            val focusX = detector.focusX
            val focusY = detector.focusY
            val scaleDelta = scaleFactor / prevScale

            translateX = focusX - (focusX - translateX) * scaleDelta
            translateY = focusY - (focusY - translateY) * scaleDelta

            applyBoundaries()
            invalidate()
            return true
        }

        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            touchMode = TouchMode.ZOOM
            return true
        }

        override fun onScaleEnd(detector: ScaleGestureDetector) {
            touchMode = TouchMode.NONE
        }
    })

    init {
        setWillNotDraw(false)
        cellSize = canvasWidth / gridSize
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        canvasWidth = w.toFloat()
        cellSize = canvasWidth / gridSize
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Apply transformation matrix
        canvas.save()
        matrix.reset()
        matrix.postScale(scaleFactor, scaleFactor)
        matrix.postTranslate(translateX, translateY)
        canvas.setMatrix(matrix)

        // 1. Draw background image
        backgroundBitmap?.let {
            val dest = RectF(0f, 0f, canvasWidth, canvasWidth)
            canvas.drawBitmap(it, null, dest, null)
        }

        // 2. Draw white cover + alphabet labels on unfilled cells
        for (row in 0 until gridSize) {
            for (col in 0 until gridSize) {
                val cellKey = "$row-$col"

                if (!filledCells.contains(cellKey)) {
                    val left = col * cellSize
                    val top = row * cellSize
                    val right = left + cellSize
                    val bottom = top + cellSize

                    // White cover
                    canvas.drawRect(left, top, right, bottom, coverPaint)

                    // Alphabet label
                    val label = labelMap[cellKey] ?: "A"
                    textPaint.textSize = cellSize * 0.5f
                    val xPos = left + cellSize / 2f
                    val yPos = top + cellSize / 2f - (textPaint.descent() + textPaint.ascent()) / 2f
                    canvas.drawText(label, xPos, yPos, textPaint)
                }
            }
        }

        // 3. Draw grid
        for (i in 0..gridSize) {
            val pos = i * cellSize
            canvas.drawLine(pos, 0f, pos, canvasWidth, gridPaint)
            canvas.drawLine(0f, pos, canvasWidth, pos, gridPaint)
        }

        canvas.restore()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // Only pass to scale detector if multi-touch
        if (event.pointerCount >= 2) {
            scaleGestureDetector.onTouchEvent(event)
        }

        // Skip single-touch handling if currently zooming
        if (touchMode == TouchMode.ZOOM) {
            return true
        }

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (event.pointerCount == 1) {
                    touchMode = TouchMode.DRAG
                    lastTouchX = event.x
                    lastTouchY = event.y
                    activePointerId = event.getPointerId(0)

                    // Always try painting on single touch
                    handlePainting(event.x, event.y)
                }
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                // Second finger down - switch to zoom/pan mode
                scaleGestureDetector.onTouchEvent(event)
            }

            MotionEvent.ACTION_MOVE -> {
                if (touchMode == TouchMode.DRAG && event.pointerCount == 1) {
                    if (scaleFactor > 1.01f) {
                        // Pan mode when zoomed
                        val dx = event.x - lastTouchX
                        val dy = event.y - lastTouchY

                        translateX += dx
                        translateY += dy

                        lastTouchX = event.x
                        lastTouchY = event.y

                        applyBoundaries()
                        invalidate()
                    } else {
                        // Painting mode when not zoomed
                        handlePainting(event.x, event.y)
                    }
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                touchMode = TouchMode.NONE
                activePointerId = -1
            }

            MotionEvent.ACTION_POINTER_UP -> {
                // If we had 2+ fingers and one lifted, check remaining count
                if (event.pointerCount <= 2) {
                    touchMode = TouchMode.NONE
                }
            }
        }

        return true
    }

    private fun handlePainting(screenX: Float, screenY: Float) {
        // Convert screen coordinates to canvas coordinates
        val inverseMatrix = Matrix()
        matrix.invert(inverseMatrix)
        val points = floatArrayOf(screenX, screenY)
        inverseMatrix.mapPoints(points)

        val canvasX = points[0]
        val canvasY = points[1]

        val col = (canvasX / cellSize).toInt()
        val row = (canvasY / cellSize).toInt()

        // Validate bounds
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
            return
        }

        val cellKey = "$row-$col"

        // Skip already filled cells
        if (filledCells.contains(cellKey)) {
            return
        }

        // Check if label matches selected label
        val cellLabel = labelMap[cellKey]
        val isCorrect = cellLabel == selectedLabel

        if (isCorrect) {
            // Fill cell immediately
            filledCells.add(cellKey)
            invalidate() // Instant redraw - no delay!

            // Send event to JS
            sendCellPaintedEvent(row, col, true)
        } else {
            // Wrong label - send negative feedback
            sendCellPaintedEvent(row, col, false)
        }
    }

    private fun applyBoundaries() {
        val scaledWidth = canvasWidth * scaleFactor
        val scaledHeight = canvasWidth * scaleFactor

        // Limit translation to keep content visible
        val maxTranslateX = 0f
        val minTranslateX = width.toFloat() - scaledWidth
        val maxTranslateY = 0f
        val minTranslateY = height.toFloat() - scaledHeight

        translateX = max(minTranslateX, min(maxTranslateX, translateX))
        translateY = max(minTranslateY, min(maxTranslateY, translateY))
    }

    private fun sendCellPaintedEvent(row: Int, col: Int, correct: Boolean) {
        onCellPainted(mapOf(
            "row" to row,
            "col" to col,
            "correct" to correct
        ))
    }

    private fun loadBitmap(uriString: String): Bitmap? {
        return try {
            val uri = Uri.parse(uriString)
            val inputStream = context.contentResolver.openInputStream(uri)
            BitmapFactory.decodeStream(inputStream)?.let { bitmap ->
                // Scale to 600x600
                Bitmap.createScaledBitmap(bitmap, 600, 600, true)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
