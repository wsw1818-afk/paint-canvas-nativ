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
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true  // 비트맵 스케일링 품질 향상
    }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f
        color = Color.parseColor("#E0E0E0")
    }

    private var gridSize: Int = 60
    private var cells: List<CellData> = emptyList()
    private var selectedColorHex: String = "#FF0000"
    private var selectedLabel: String = "A"
    private var imageUri: String? = null
    private var isEraseMode: Boolean = false  // X ?�거 모드

    fun setGridSize(value: Int) {
        android.util.Log.d("PaintCanvas", "📐 setGridSize called: $value, current canvasWidth=$canvasWidth")
        gridSize = value

        // Only recalculate cellSize, don't touch canvasWidth
        // canvasWidth should be set by setViewSize() from JavaScript
        cellSize = canvasWidth / gridSize

        // 줌 레벨 재계산: 최대 확대 시 셀 하나가 약 40-50px 정도로 보이도록
        // gridSize=60일 때 최대 약 6-16배 확대하면 셀 하나가 충분히 커짐
        maxZoom = max(16f, gridSize / 10f)
        ZOOM_LEVELS = floatArrayOf(1f, maxZoom / 2f, maxZoom)
        android.util.Log.d("PaintCanvas", "📐 Zoom levels updated: ${ZOOM_LEVELS.toList()}")

        invalidate()
    }

    fun setCells(cellList: List<Map<String, Any>>) {
        // ⚡ 최적화: 배열 사전 할당 + 단일 루프로 처리
        val size = cellList.size
        val newCells = ArrayList<CellData>(size)

        // Map 용량 미리 할당
        targetColorMap.clear()
        labelMap.clear()

        for (cellMap in cellList) {
            val row = (cellMap["row"] as? Number)?.toInt() ?: 0
            val col = (cellMap["col"] as? Number)?.toInt() ?: 0
            val targetColorHex = cellMap["targetColorHex"] as? String ?: "#000000"
            val label = cellMap["label"] as? String ?: "A"

            newCells.add(CellData(row, col, targetColorHex, label))

            val key = "$row-$col"
            targetColorMap[key] = targetColorHex
            labelMap[key] = label
        }

        cells = newCells
        invalidate()
    }

    fun setSelectedColor(colorHex: String) {
        selectedColorHex = colorHex
    }

    fun setSelectedLabel(label: String) {
        if (selectedLabel == label) return  // ⚡ 변경 없으면 스킵
        selectedLabel = label
        invalidate()
    }

    fun setEraseMode(enabled: Boolean) {
        if (isEraseMode == enabled) return  // ⚡ 변경 없으면 스킵
        isEraseMode = enabled
        invalidate()
    }

    fun setViewSize(width: Float, height: Float) {
        // This is called from JavaScript with dp values, but we use onSizeChanged() instead
        // which provides actual physical pixel values that Canvas needs
        android.util.Log.d("PaintCanvas", "📏 setViewSize called (from JS): width=$width, height=$height - IGNORED, using onSizeChanged() values")

        // Don't do anything here - onSizeChanged() handles initialization with pixel values
    }

    init {
        android.util.Log.d("PaintCanvas", "🔥🔥🔥 PaintCanvasView initialized - NEW INSTANCE CREATED! isEraseMode=$isEraseMode")
        // 이미지 리소스 로드
        loadDrawableResources()
    }

    private fun loadDrawableResources() {
        try {
            // 위빙 패턴 이미지 로드
            val weaveResId = context.resources.getIdentifier("weave_pattern", "drawable", context.packageName)
            if (weaveResId != 0) {
                weavePatternBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, weaveResId)
                android.util.Log.d("PaintCanvas", "✅ Weave pattern loaded: ${weavePatternBitmap?.width}x${weavePatternBitmap?.height}")
            } else {
                android.util.Log.e("PaintCanvas", "❌ weave_pattern not found in drawable")
            }

            // 잘못 칠한 셀 표시 이미지 로드
            val wrongResId = context.resources.getIdentifier("wrong_mark", "drawable", context.packageName)
            if (wrongResId != 0) {
                wrongMarkBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, wrongResId)
                android.util.Log.d("PaintCanvas", "✅ Wrong mark loaded: ${wrongMarkBitmap?.width}x${wrongMarkBitmap?.height}")
            } else {
                android.util.Log.e("PaintCanvas", "❌ wrong_mark not found in drawable")
            }
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ Failed to load drawable resources: ${e.message}")
        }
    }

    fun setImageUri(uri: String) {
        imageUri = uri
        backgroundBitmap = loadBitmap(uri)
        invalidate()
    }

    fun setFilledCells(cells: List<String>) {
        // JS에서 전달받은 filledCells로 Native filledCells 동기화
        filledCells.clear()
        filledCells.addAll(cells)
        invalidate()
    }

    fun setWrongCells(cells: List<String>) {
        // JS에서 전달받은 wrongCells로 Native wrongPaintedCells 동기화
        // 단, 최근에 Native에서 제거한 셀은 다시 추가하지 않음 (타이밍 문제 방지)
        wrongPaintedCells.clear()
        for (cell in cells) {
            if (!recentlyRemovedWrongCells.contains(cell)) {
                wrongPaintedCells.add(cell)
            }
        }
        // JS와 동기화 완료되면 보호 목록 클리어
        recentlyRemovedWrongCells.clear()
        invalidate()
    }

    fun setUndoMode(enabled: Boolean) {
        setEraseMode(enabled)  // ⚡ 중복 로그 제거
    }

    fun setCompletionMode(mode: String) {
        if (completionMode == mode) return  // ⚡ 변경 없으면 스킵
        completionMode = mode
        invalidate()
    }

    private var canvasWidth: Float = 0f  // Will be set by setViewSize() - DO NOT hardcode!
    private var cellSize: Float = 0f
    private var canvasViewWidth: Float = 0f  // Canvas View size from JavaScript - DO NOT hardcode!
    private var canvasViewHeight: Float = 0f  // DO NOT hardcode!
    private var screenWidthDp: Float = 0f  // Actual screen size (calculated from resources)
    private var screenHeightDp: Float = 0f
    private val filledCells = mutableSetOf<String>() // "row-col"
    private val wrongPaintedCells = mutableSetOf<String>() // "row-col" for wrong paints (show X)
    private val recentlyRemovedWrongCells = mutableSetOf<String>() // X 제거 후 JS 동기화 전까지 보호
    private val targetColorMap = mutableMapOf<String, String>() // "row-col" -> hex (정답 색상)
    private val paintedColorMap = mutableMapOf<String, String>() // "row-col" -> hex (실제 칠한 색상)
    private val labelMap = mutableMapOf<String, String>() // "row-col" -> label
    private var backgroundBitmap: Bitmap? = null

    companion object {
        private const val EDGE_PADDING = 60f  // Padding on all edges for easier painting
    }

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        textAlign = Paint.Align.CENTER
        style = Paint.Style.FILL
    }

    private val coverPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#B3FFFFFF") // 70% 불투명 흰색 (원본 이미지 더 잘 보임)
        style = Paint.Style.FILL
    }

    private val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        // Semi-transparent yellow overlay for selected label cells
        color = Color.parseColor("#80FFEB3B") // 50% opacity yellow
    }

    private val backgroundClearPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }

    private val wrongMarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        color = Color.RED
        strokeCap = Paint.Cap.ROUND
    }

    // 위빙(뜨개질) 텍스처용 Paint
    private val weavePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val weaveHighlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val weaveShadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    // 위빙 텍스처 캐시 (색상별로 캐싱)
    private val weaveTextureCache = mutableMapOf<String, Bitmap>()
    private var lastTextureCellSize = 0f  // 캐시 무효화용

    // 잘못 칠한 셀 경고 이미지 캐시 (색상별로 캐싱)
    private val wrongMarkCache = mutableMapOf<Int, Bitmap>()

    // 원본 패턴 이미지 (drawable에서 로드)
    private var weavePatternBitmap: Bitmap? = null
    // 잘못 칠한 셀 표시 이미지
    private var wrongMarkBitmap: Bitmap? = null

    // ⚡ 최적화: 재사용 가능한 객체들 (onDraw에서 매번 생성하지 않음)
    private val reusableInverseMatrix = Matrix()
    private val reusableScreenCorners = FloatArray(4)
    private val reusableSrcRect = Rect()
    private val reusableDstRect = RectF()
    private val reusableOverlayPaint = Paint()
    private val reusableFallbackPaint = Paint()
    private val reusableBgPaint = Paint().apply {
        style = Paint.Style.FILL
    }
    private val reusablePatternPaint = Paint().apply {
        alpha = 100  // 180 → 100: 패턴 효과를 줄여서 원래 색상과 더 가깝게
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
    private var preventPaintOnce = false  // Prevent painting after multi-touch ends
    private var allowPainting = false  // Only allow painting after first MOVE event (prevents paint during two-finger setup)

    // 완성 모드: "ORIGINAL" = 원본 이미지 표시, "WEAVE" = 위빙 텍스처 유지
    private var completionMode = "ORIGINAL"

    // 3-step zoom levels: 1x (full view) -> maxZoom/2 -> maxZoom -> back to 1x
    // maxZoom will be calculated based on gridSize to show original image at max zoom
    private var ZOOM_LEVELS = floatArrayOf(1f, 8f, 16f)  // Default, will be recalculated
    private var maxZoom = 16f  // Will be calculated based on gridSize
    private var currentZoomIndex = 0
    private var twoFingerTapStartTime = 0L
    private var touchDownTime = 0L  // Time of initial ACTION_DOWN
    private val MULTI_TOUCH_GRACE_PERIOD = 50L  // Wait 50ms for second finger before allowing paint (shorter for better responsiveness)
    private var twoFingerStartX = 0f
    private var twoFingerStartY = 0f
    private var twoFingerLastX = 0f  // Track last position separately from lastTouchX
    private var twoFingerLastY = 0f
    private val TAP_TIMEOUT = 500L  // Max time for a tap (ms) - increased for easier detection
    private val TAP_SLOP = 100f  // Max movement for a tap (pixels) - increased tolerance

    private val scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val scale = detector.scaleFactor

            // Ignore very small scale changes (noise/jitter)
            if (Math.abs(scale - 1f) < 0.01f) {
                return true
            }

            val prevScale = scaleFactor
            val newScale = scaleFactor * scale

            // Clamp between 1x and maxZoom
            scaleFactor = max(1f, min(maxZoom, newScale))

            // Only apply translation if scale actually changed
            if (scaleFactor != prevScale) {
                // Zoom towards focus point
                val focusX = detector.focusX
                val focusY = detector.focusY
                val actualScale = scaleFactor / prevScale
                translateX = focusX - (focusX - translateX) * actualScale
                translateY = focusY - (focusY - translateY) * actualScale

                applyBoundaries()
                invalidate()
            }
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

    // Step zoom: cycle through 1x -> 10x -> 13x -> 1x
    private fun stepZoom(focusX: Float, focusY: Float) {
        val prevScale = scaleFactor

        // Move to next zoom level
        currentZoomIndex = (currentZoomIndex + 1) % ZOOM_LEVELS.size
        scaleFactor = ZOOM_LEVELS[currentZoomIndex]

        android.util.Log.d("PaintCanvas", "🔍 Step zoom: index=$currentZoomIndex, scale=$scaleFactor")

        if (scaleFactor == 1f) {
            // Reset to center when zooming out to 1x
            translateX = (canvasViewWidth - canvasWidth) / 2f
            translateY = (canvasViewHeight - canvasWidth) / 2f
        } else {
            // Zoom towards focus point
            val scaleDelta = scaleFactor / prevScale
            translateX = focusX - (focusX - translateX) * scaleDelta
            translateY = focusY - (focusY - translateY) * scaleDelta
        }

        applyBoundaries()
        invalidate()
    }

    init {
        setWillNotDraw(false)
        cellSize = canvasWidth / gridSize
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)

        android.util.Log.d("PaintCanvas", "📐 onSizeChanged: w=$w h=$h, old=($oldw,$oldh)")

        // Use physical pixel values directly - Canvas operates in pixels!
        if (w <= 0 || h <= 0) {
            android.util.Log.d("PaintCanvas", "📐 Ignoring invalid dimensions")
            return
        }

        // 크기가 실제로 변경된 경우에만 리셋
        val sizeActuallyChanged = (canvasViewWidth != w.toFloat() || canvasViewHeight != h.toFloat())

        // Save View size in pixels
        canvasViewWidth = w.toFloat()
        canvasViewHeight = h.toFloat()

        // Canvas is square, use the smaller dimension
        canvasWidth = min(canvasViewWidth, canvasViewHeight)

        // Recalculate cellSize
        if (gridSize > 0) {
            cellSize = canvasWidth / gridSize
        }

        // 첫 초기화이거나 크기가 실제로 변경된 경우에만 줌 리셋
        if (oldw == 0 && oldh == 0) {
            // 첫 초기화 - 줌 리셋
            scaleFactor = 1f
            currentZoomIndex = 0
            translateX = (canvasViewWidth - canvasWidth) / 2f
            translateY = (canvasViewHeight - canvasWidth) / 2f
            android.util.Log.d("PaintCanvas", "📐 First init: reset zoom to 1x")
        } else if (sizeActuallyChanged) {
            // 크기 변경됨 - 줌 유지하되 경계만 재조정
            applyBoundaries()
            android.util.Log.d("PaintCanvas", "📐 Size changed: keeping zoom=$scaleFactor, adjusting boundaries")
        }

        android.util.Log.d("PaintCanvas", "📐 Result: canvasWidth=$canvasWidth, cellSize=$cellSize, scale=$scaleFactor")

        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // 안전 체크: 캔버스 크기가 유효하지 않으면 그리지 않음
        if (canvasWidth <= 0 || cellSize <= 0 || gridSize <= 0) {
            android.util.Log.w("PaintCanvas", "⚠️ onDraw skipped: invalid dimensions canvasWidth=$canvasWidth cellSize=$cellSize gridSize=$gridSize")
            return
        }

        // Apply transformation matrix
        canvas.save()
        matrix.reset()
        matrix.postScale(scaleFactor, scaleFactor)
        matrix.postTranslate(translateX, translateY)
        canvas.setMatrix(matrix)

        // ⚡ 성능 최적화: 화면에 보이는 셀만 그리기 (Viewport Culling)
        // 화면 좌표를 캔버스 좌표로 변환하여 보이는 영역 계산
        // 재사용 객체 사용 (매 프레임 객체 생성 방지)
        matrix.invert(reusableInverseMatrix)

        // 화면의 네 모서리를 캔버스 좌표로 변환
        reusableScreenCorners[0] = 0f
        reusableScreenCorners[1] = 0f
        reusableScreenCorners[2] = canvasViewWidth
        reusableScreenCorners[3] = canvasViewHeight
        reusableInverseMatrix.mapPoints(reusableScreenCorners)

        // 보이는 캔버스 영역 (약간의 여유 추가)
        val visibleLeft = reusableScreenCorners[0] - cellSize
        val visibleTop = reusableScreenCorners[1] - cellSize
        val visibleRight = reusableScreenCorners[2] + cellSize
        val visibleBottom = reusableScreenCorners[3] + cellSize

        // 보이는 셀 범위 계산
        val startCol = max(0, (visibleLeft / cellSize).toInt())
        val endCol = min(gridSize - 1, (visibleRight / cellSize).toInt())
        val startRow = max(0, (visibleTop / cellSize).toInt())
        val endRow = min(gridSize - 1, (visibleBottom / cellSize).toInt())

        // 1. 보이는 셀만 그리기 (최적화됨!)
        // 텍스트 크기 미리 계산 (루프 밖에서 한 번만)
        textPaint.textSize = cellSize * 0.5f
        val textYOffset = -(textPaint.descent() + textPaint.ascent()) / 2f

        for (row in startRow..endRow) {
            val rowKey = row * gridSize  // 빠른 키 계산용
            val top = row * cellSize

            for (col in startCol..endCol) {
                val cellKey = "$row-$col"
                val left = col * cellSize

                if (filledCells.contains(cellKey)) {
                    // 색칠된 셀: 실제로 칠한 색상 사용 (paintedColorMap에 저장된 색상)
                    // targetColorMap은 정답 확인용으로만 사용
                    val colorHex = paintedColorMap[cellKey] ?: selectedColorHex
                    val cellColor = Color.parseColor(colorHex)

                    // completionMode == "ORIGINAL": 올바르게 칠한 셀은 원본 이미지 표시
                    // completionMode == "WEAVE": 항상 위빙 텍스처 유지
                    if (completionMode == "ORIGINAL" && !wrongPaintedCells.contains(cellKey) && backgroundBitmap != null) {
                        // 원본 이미지 조각 표시 (100% 불투명)
                        drawOriginalImageOverlay(canvas, left, top, cellSize, row, col, 1.0f)
                    } else {
                        // 위빙 텍스처 모드이거나, 잘못 칠한 셀이거나, 원본 이미지 없음 → 위빙 텍스처
                        drawWeaveTexture(canvas, left, top, cellSize, cellColor)
                    }
                } else {
                    // 미색칠 셀 - 흰색 배경에 알파벳만 표시 (모눈종이처럼)
                    val right = left + cellSize
                    val bottom = top + cellSize

                    // 흰색 배경
                    canvas.drawRect(left, top, right, bottom, backgroundClearPaint)

                    // 선택된 라벨 하이라이트 (노란색 반투명)
                    val label = labelMap[cellKey]
                    if (label == selectedLabel) {
                        canvas.drawRect(left, top, right, bottom, highlightPaint)
                    }

                    // 알파벳 (label이 null이면 "A" 사용)
                    canvas.drawText(label ?: "A", left + cellSize / 2f, top + cellSize / 2f + textYOffset, textPaint)
                }
            }
        }

        // 3. Draw grid - 격자선 제거 (셀 사이 공백 없음)
        // for (i in 0..gridSize) {
        //     val pos = i * cellSize
        //     canvas.drawLine(pos, 0f, pos, canvasWidth, gridPaint)
        //     canvas.drawLine(0f, pos, canvasWidth, pos, gridPaint)
        // }

        // 4. Draw warning marks on wrong painted cells (보이는 영역만)
        for (cellKey in wrongPaintedCells) {
            val parts = cellKey.split("-")
            if (parts.size == 2) {
                val row = parts[0].toIntOrNull() ?: continue
                val col = parts[1].toIntOrNull() ?: continue

                // ⚡ 보이는 영역 밖이면 스킵
                if (row < startRow || row > endRow || col < startCol || col > endCol) continue

                val left = col * cellSize
                val top = row * cellSize

                // 잘못 칠한 셀의 실제 칠한 색상 가져오기 (사용자가 칠한 색상)
                val colorHex = paintedColorMap[cellKey] ?: selectedColorHex
                val baseColor = Color.parseColor(colorHex)

                // 경고 이미지를 색상과 함께 표시
                val wrongBitmap = wrongMarkBitmap
                if (wrongBitmap != null) {
                    // 캐시된 경고 이미지 가져오기 또는 생성
                    val warningBitmap = getWrongMarkWithColor(wrongBitmap, baseColor)
                    // ⚡ 최적화: 재사용 Rect/RectF 객체 사용
                    reusableSrcRect.set(0, 0, warningBitmap.width, warningBitmap.height)
                    // 0.5px 오버랩 적용 (틈 방지)
                    reusableDstRect.set(left, top, left + cellSize + 0.5f, top + cellSize + 0.5f)
                    canvas.drawBitmap(warningBitmap, reusableSrcRect, reusableDstRect, paint)
                } else {
                    // 폴백: 이미지 없으면 X 표시
                    val right = left + cellSize
                    val bottom = top + cellSize
                    val padding = cellSize * 0.15f
                    wrongMarkPaint.strokeWidth = max(2f, cellSize * 0.3f)
                    canvas.drawLine(left + padding, top + padding, right - padding, bottom - padding, wrongMarkPaint)
                    canvas.drawLine(right - padding, top + padding, left + padding, bottom - padding, wrongMarkPaint)
                }
            }
        }

        canvas.restore()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // 로그 제거 - 성능 최적화

        // Only let ScaleGestureDetector process events when there are 2+ fingers
        // This prevents accidental zoom during single-finger painting
        if (event.pointerCount >= 2) {
            scaleGestureDetector.onTouchEvent(event)
        }

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x
                lastTouchY = event.y
                activePointerId = event.getPointerId(0)
                preventPaintOnce = false  // Reset on new touch
                allowPainting = false  // Don't allow painting yet (wait for MOVE)
                touchDownTime = System.currentTimeMillis()  // Record time for grace period
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                // Second finger down - block painting
                preventPaintOnce = true
                allowPainting = false

                if (event.pointerCount == 2) {
                    val centroidX = (event.getX(0) + event.getX(1)) / 2f
                    val centroidY = (event.getY(0) + event.getY(1)) / 2f
                    lastTouchX = centroidX
                    lastTouchY = centroidY
                    twoFingerTapStartTime = System.currentTimeMillis()
                    twoFingerStartX = centroidX
                    twoFingerStartY = centroidY
                    twoFingerLastX = centroidX
                    twoFingerLastY = centroidY
                }
            }

            MotionEvent.ACTION_MOVE -> {
                when (event.pointerCount) {
                    1 -> {
                        // Single finger = painting (but block after two-finger gesture)
                        if (preventPaintOnce) {
                            // Skip moves until finger is lifted and new touch starts
                        } else {
                            val timeSinceDown = System.currentTimeMillis() - touchDownTime
                            if (timeSinceDown < MULTI_TOUCH_GRACE_PERIOD) {
                                // Wait for possible second finger
                            } else {
                                handlePainting(event.x, event.y)
                            }
                        }
                    }
                    2 -> {
                        // Two fingers = pan + zoom
                        preventPaintOnce = true
                        allowPainting = false

                        val centroidX = (event.getX(0) + event.getX(1)) / 2f
                        val centroidY = (event.getY(0) + event.getY(1)) / 2f

                        // Always apply pan (ScaleGestureDetector handles zoom separately)
                        val dx = centroidX - lastTouchX
                        val dy = centroidY - lastTouchY
                        translateX += dx
                        translateY += dy

                        lastTouchX = centroidX
                        lastTouchY = centroidY
                        twoFingerLastX = centroidX
                        twoFingerLastY = centroidY

                        applyBoundaries()
                        invalidate()
                    }
                    else -> {
                        preventPaintOnce = true
                        allowPainting = false
                    }
                }
            }

            MotionEvent.ACTION_UP -> {
                // 빠른 탭으로 색칠: grace period 이내에 손가락을 뗐으면 해당 위치 색칠
                val timeSinceDown = System.currentTimeMillis() - touchDownTime
                if (!preventPaintOnce && timeSinceDown < 300L) {
                    handlePainting(event.x, event.y)
                }

                touchMode = TouchMode.NONE
                activePointerId = -1
                preventPaintOnce = false
                allowPainting = false
            }

            MotionEvent.ACTION_POINTER_UP -> {
                if (event.pointerCount == 2) {
                    touchMode = TouchMode.NONE
                    preventPaintOnce = true
                    allowPainting = false
                }
            }

            MotionEvent.ACTION_CANCEL -> {
                touchMode = TouchMode.NONE
                activePointerId = -1
            }
        }

        return true
    }

    private fun handlePainting(screenX: Float, screenY: Float) {
        // Safety check - don't paint if not initialized
        if (cellSize <= 0f || canvasWidth <= 0f) return

        // Convert screen coordinates to canvas coordinates
        val currentMatrix = Matrix()
        currentMatrix.postScale(scaleFactor, scaleFactor)
        currentMatrix.postTranslate(translateX, translateY)

        val inverseMatrix = Matrix()
        currentMatrix.invert(inverseMatrix)
        val points = floatArrayOf(screenX, screenY)
        inverseMatrix.mapPoints(points)

        val canvasX = points[0]
        val canvasY = points[1]

        val col = (canvasX / cellSize).toInt()
        val row = (canvasY / cellSize).toInt()

        // Validate bounds
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return

        val cellKey = "$row-$col"

        // X 고치기 모드: X만 지우고 빈 셀로 복원 (다시 칠할 수 있게)
        if (isEraseMode) {
            if (wrongPaintedCells.contains(cellKey)) {
                wrongPaintedCells.remove(cellKey)
                // filledCells에서도 제거 (빈 셀로 복원)
                filledCells.remove(cellKey)
                // ⭐ paintedColorMap에서도 제거 (칠한 색상 기록 삭제)
                paintedColorMap.remove(cellKey)
                // JS 동기화 전까지 이 셀이 다시 추가되지 않도록 보호
                recentlyRemovedWrongCells.add(cellKey)
                invalidate()
                // correct=true로 보내서 JS에서 wrongCells에서 제거하도록
                sendCellPaintedEvent(row, col, true)
                android.util.Log.d("PaintCanvas", "🔧 [EraseMode] X removed, cell restored: $cellKey")
            }
            return
        }

        // Check if label matches selected label
        val cellLabel = labelMap[cellKey]
        val isCorrect = cellLabel == selectedLabel

        if (isCorrect) {
            // Skip if already correctly filled (and not a wrong cell being fixed)
            if (filledCells.contains(cellKey) && !wrongPaintedCells.contains(cellKey)) {
                return
            }

            // Fill cell immediately - UI update FIRST
            filledCells.add(cellKey)
            paintedColorMap[cellKey] = selectedColorHex
            wrongPaintedCells.remove(cellKey)

            // Instant redraw
            invalidate()

            // Send event to JS
            sendCellPaintedEvent(row, col, true)
        } else {
            // Mark as wrong paint - show X (don't add to filledCells!)
            wrongPaintedCells.add(cellKey)
            // ⭐ 잘못 칠한 색상도 기록 (X 마크의 배경색으로 사용)
            paintedColorMap[cellKey] = selectedColorHex
            invalidate()

            // Send event directly (no post delay)
            sendCellPaintedEvent(row, col, false)
        }
    }

    private fun applyBoundaries() {
        val scaledWidth = canvasWidth * scaleFactor
        val scaledHeight = canvasWidth * scaleFactor  // Square canvas

        val viewWidth = canvasViewWidth
        val viewHeight = canvasViewHeight

        // For X axis
        if (scaledWidth <= viewWidth) {
            // Scaled canvas fits in view width - center horizontally
            translateX = (viewWidth - scaledWidth) / 2f
        } else {
            // Scaled canvas larger than view - allow panning with edge limits
            val minX = viewWidth - scaledWidth - EDGE_PADDING  // Left edge of canvas at right of screen
            val maxX = EDGE_PADDING  // Right edge of canvas at left of screen
            translateX = max(minX, min(maxX, translateX))
        }

        // For Y axis
        if (scaledHeight <= viewHeight) {
            // Scaled canvas fits in view height - center vertically
            translateY = (viewHeight - scaledHeight) / 2f
        } else {
            // Scaled canvas larger than view - allow panning with edge limits
            val minY = viewHeight - scaledHeight - EDGE_PADDING
            val maxY = EDGE_PADDING
            translateY = max(minY, min(maxY, translateY))
        }
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
                // Keep original bitmap - will be scaled in onDraw() using canvasWidth
                // DO NOT hardcode 600x600!
                bitmap
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * 뜨개질(니트) 텍스처를 셀에 그리기 (캐싱 적용)
     */
    private fun drawWeaveTexture(canvas: Canvas, left: Float, top: Float, size: Float, baseColor: Int) {
        val cacheKey = "$baseColor"  // 색상별로 캐싱

        // 캐시에서 가져오거나 새로 생성 (recycled된 경우도 재생성)
        var cachedBitmap = weaveTextureCache[cacheKey]
        if (cachedBitmap == null || cachedBitmap.isRecycled) {
            // 캐시에 없거나 recycled되면 새로 생성
            cachedBitmap = createWeaveTextureBitmap(64, baseColor)
            // 캐시 크기 제한 (메모리 관리)
            if (weaveTextureCache.size > 100) {
                weaveTextureCache.clear()
            }
            weaveTextureCache[cacheKey] = cachedBitmap
        }

        // 비트맵을 셀 크기에 맞게 스케일하여 그리기
        // 셀 사이 틈/잔여 이미지 방지를 위해 0.5px 오버랩 적용
        try {
            // ⚡ 최적화: 재사용 객체 대신 로컬 변수로 직접 설정 (스레드 안전)
            reusableSrcRect.set(0, 0, cachedBitmap.width, cachedBitmap.height)
            // 우측/하단에만 0.5px 오버랩 (좌상단은 정확히)
            reusableDstRect.set(left, top, left + size + 0.5f, top + size + 0.5f)
            canvas.drawBitmap(cachedBitmap, reusableSrcRect, reusableDstRect, paint)
        } catch (e: Exception) {
            // 비트맵 그리기 실패 시 단색으로 폴백
            reusableFallbackPaint.color = baseColor
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableFallbackPaint)
        }
    }

    /**
     * 바스켓 위브 텍스처 비트맵 생성
     * 원본 패턴 이미지를 로드하고 색상을 입혀서 사용
     */
    private fun createWeaveTextureBitmap(size: Int, baseColor: Int): Bitmap {
        val pattern = weavePatternBitmap

        if (pattern != null) {
            val s = pattern.width
            val bitmap = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            // ⚡ 최적화: 재사용 Paint 객체 사용
            // 1. 베이스 색상으로 배경 채우기
            reusableBgPaint.color = baseColor
            canvas.drawRect(0f, 0f, s.toFloat(), s.toFloat(), reusableBgPaint)

            // 2. 패턴의 밝기 정보를 추출하여 명암 효과 적용
            canvas.drawBitmap(pattern, 0f, 0f, reusablePatternPaint)

            return bitmap
        }

        // 패턴 이미지가 없으면 단색으로 폴백
        val s = 64
        val bitmap = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        weavePaint.color = baseColor
        weavePaint.style = Paint.Style.FILL
        canvas.drawRect(0f, 0f, s.toFloat(), s.toFloat(), weavePaint)
        return bitmap
    }

    /**
     * 잘못 칠한 셀 경고 이미지 생성 (배경색 + 경고 아이콘)
     */
    private fun getWrongMarkWithColor(wrongBitmap: Bitmap, baseColor: Int): Bitmap {
        // 캐시 확인 (recycled된 경우도 재생성)
        val cached = wrongMarkCache[baseColor]
        if (cached != null && !cached.isRecycled) {
            return cached
        }

        // 캐시에 없거나 recycled되면 새로 생성
        val s = wrongBitmap.width
        val bitmap = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // ⚡ 최적화: 재사용 Paint 객체 사용
        // 1. 베이스 색상으로 배경 채우기 (위빙 텍스처와 동일)
        reusableBgPaint.color = baseColor
        canvas.drawRect(0f, 0f, s.toFloat(), s.toFloat(), reusableBgPaint)

        // 2. 위빙 패턴 적용 (있으면, recycled 아닌 경우만)
        weavePatternBitmap?.let { pattern ->
            if (!pattern.isRecycled) {
                canvas.drawBitmap(pattern, 0f, 0f, reusablePatternPaint)
            }
        }

        // 3. 경고 이미지 오버레이 (원본 그대로)
        if (!wrongBitmap.isRecycled) {
            canvas.drawBitmap(wrongBitmap, 0f, 0f, null)
        }

        // 캐시에 저장 (제한: 50개)
        if (wrongMarkCache.size > 50) {
            wrongMarkCache.clear()
        }
        wrongMarkCache[baseColor] = bitmap

        return bitmap
    }

    /**
     * 원본 이미지의 미세한 음영을 오버레이로 그리기
     * @param alpha 투명도 (0.0 ~ 1.0, 낮을수록 미세함)
     */
    private fun drawOriginalImageOverlay(canvas: Canvas, left: Float, top: Float, size: Float, row: Int, col: Int, alpha: Float) {
        val bitmap = backgroundBitmap ?: return

        // 안전 체크: Bitmap이 recycled되었거나 유효하지 않은 경우
        if (bitmap.isRecycled || bitmap.width <= 0 || bitmap.height <= 0) {
            return
        }

        try {
            // 원본 이미지에서 해당 셀의 위치 계산
            val srcCellWidth = bitmap.width.toFloat() / gridSize
            val srcCellHeight = bitmap.height.toFloat() / gridSize

            val srcLeft = (col * srcCellWidth).toInt()
            val srcTop = (row * srcCellHeight).toInt()
            val srcRight = min(bitmap.width, ((col + 1) * srcCellWidth).toInt())
            val srcBottom = min(bitmap.height, ((row + 1) * srcCellHeight).toInt())

            // ⚡ 최적화: 재사용 Paint 객체 사용
            reusableOverlayPaint.alpha = (alpha * 255).toInt()

            // ⚡ 최적화: 재사용 Rect/RectF 객체 사용
            reusableSrcRect.set(srcLeft, srcTop, srcRight, srcBottom)
            reusableDstRect.set(left, top, left + size, top + size)

            canvas.drawBitmap(bitmap, reusableSrcRect, reusableDstRect, reusableOverlayPaint)
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ drawOriginalImageOverlay failed: ${e.message}")
        }
    }

    /**
     * 원본 이미지에서 해당 셀의 평균 색상 추출
     * @param row 셀 행
     * @param col 셀 열
     * @return 해당 셀의 평균 색상 (Int)
     */
    private fun getOriginalPixelColor(row: Int, col: Int): Int {
        val bitmap = backgroundBitmap ?: return Color.GRAY

        // 원본 이미지에서 해당 셀의 중심점 계산
        val srcCellWidth = bitmap.width.toFloat() / gridSize
        val srcCellHeight = bitmap.height.toFloat() / gridSize

        val centerX = (col * srcCellWidth + srcCellWidth / 2f).toInt().coerceIn(0, bitmap.width - 1)
        val centerY = (row * srcCellHeight + srcCellHeight / 2f).toInt().coerceIn(0, bitmap.height - 1)

        // 중심점의 픽셀 색상 반환
        return bitmap.getPixel(centerX, centerY)
    }
}
