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

            // 색칠된 셀용 직조 패턴 로드 (weave_pattern2.png - 갈색 직조 텍스처)
            val filledPatternResId = context.resources.getIdentifier("weave_pattern2", "drawable", context.packageName)
            if (filledPatternResId != 0) {
                filledCellPatternBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, filledPatternResId)
                android.util.Log.d("PaintCanvas", "✅ Filled cell pattern (weave_pattern2) loaded: ${filledCellPatternBitmap?.width}x${filledCellPatternBitmap?.height}")
            } else {
                android.util.Log.e("PaintCanvas", "❌ weave_pattern2 not found in drawable")
            }

            // 잘못 칠한 셀 경고 이미지 로드 (warning_mark.png = 경고 삼각형)
            val wrongResId = context.resources.getIdentifier("warning_mark", "drawable", context.packageName)
            if (wrongResId != 0) {
                wrongMarkBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, wrongResId)
                android.util.Log.d("PaintCanvas", "✅ Warning mark loaded: ${wrongMarkBitmap?.width}x${wrongMarkBitmap?.height}")
            } else {
                android.util.Log.e("PaintCanvas", "❌ warning_mark not found in drawable")
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
        // ⚡ 최적화: 변경이 없으면 스킵 (깜빡임 방지)
        val newSet = cells.toSet()
        if (filledCells == newSet) return

        filledCells.clear()
        filledCells.addAll(newSet)
        invalidate()
    }

    fun setWrongCells(cells: List<String>) {
        // JS에서 전달받은 wrongCells로 Native wrongPaintedCells 동기화
        // 단, 최근에 Native에서 제거한 셀은 다시 추가하지 않음 (타이밍 문제 방지)
        val newWrongCells = mutableSetOf<String>()
        for (cell in cells) {
            if (!recentlyRemovedWrongCells.contains(cell)) {
                newWrongCells.add(cell)
            }
        }

        // ⚡ 최적화: 변경이 없으면 스킵 (깜빡임 방지)
        if (wrongPaintedCells == newWrongCells) {
            recentlyRemovedWrongCells.clear()
            return
        }

        wrongPaintedCells.clear()
        wrongPaintedCells.addAll(newWrongCells)
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

    // 노란색 경고 삼각형용 Paint
    private val warningTriangleFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#FFEB3B")  // 노란색
    }
    private val warningTriangleStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
        color = Color.parseColor("#F57F17")  // 진한 노란색/주황색 테두리
    }
    private val warningExclamationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#5D4037")  // 갈색 느낌표
    }
    private val reusableTrianglePath = Path()

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
    // 색칠된 셀용 직조 패턴 (weave_pattern2.png - 갈색 직조 텍스처)
    private var filledCellPatternBitmap: Bitmap? = null
    // 잘못 칠한 셀 표시 이미지
    private var wrongMarkBitmap: Bitmap? = null

    // ⚡ 최적화: 재사용 가능한 객체들 (onDraw에서 매번 생성하지 않음)
    private val reusableInverseMatrix = Matrix()
    private val reusableScreenCorners = FloatArray(4)
    private val reusableSrcRect = Rect()
    private val reusableDstRect = RectF()
    private val reusableOverlayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true  // Bitmap 스케일링 품질 향상
    }
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
    private val MULTI_TOUCH_GRACE_PERIOD = 20L  // ⚡ 20ms로 단축 - 더 빠른 반응
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
                    // 색칠된 셀: weave_pattern2 텍스처 + 해당 셀의 정답 색상 (알파벳에 맞는 색)
                    // ⭐ paintedColorMap이 아닌 targetColorMap 사용 - 항상 정답 색상으로 표시
                    val colorHex = targetColorMap[cellKey] ?: "#CCCCCC"
                    val cellColor = Color.parseColor(colorHex)

                    // weave_pattern2 텍스처에 정답 색상 적용
                    drawFilledCellWithTexture(canvas, left, top, cellSize, cellColor)
                } else if (wrongPaintedCells.contains(cellKey)) {
                    // ⭐ 잘못 칠한 셀: weave_pattern2 텍스처 + 해당 셀의 정답 색상 + 경고 삼각형
                    // targetColorMap = 이 셀에 칠해져야 할 정답 색상 (알파벳에 맞는 색)
                    val correctColorHex = targetColorMap[cellKey] ?: "#CCCCCC"
                    val baseColor = Color.parseColor(correctColorHex)

                    // 1. weave_pattern2 텍스처에 정답 색상 적용
                    drawFilledCellWithTexture(canvas, left, top, cellSize, baseColor)

                    // 2. 노란색 경고 삼각형 그리기 (코드로 직접 그림 - 투명 배경)
                    drawWarningTriangle(canvas, left, top, cellSize)
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

        // ⭐ Wrong cells는 이제 메인 루프에서 처리됨 (별도 루프 제거)
        // 이렇게 해야 흰색 배경이 먼저 그려지지 않음

        canvas.restore()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // ⚡ 성능 최적화: 터치 로그 제거 (매 프레임마다 출력되면 딜레이 발생)

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

                // ⚡ 터치 종료 시 리셋 + 남은 이벤트 즉시 전송
                lastPaintedCellKey = null
                flushPaintEvents()
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

    // ⚡ 연속 색칠 최적화: 마지막으로 칠한 셀 추적
    private var lastPaintedCellKey: String? = null

    // ⚡ 배치 이벤트 전송을 위한 큐
    private val pendingPaintEvents = mutableListOf<Triple<Int, Int, Boolean>>()
    private var batchEventRunnable: Runnable? = null

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

        // ⚡ 같은 셀 연속 터치 무시 (드래그 중 같은 셀 반복 방지)
        if (cellKey == lastPaintedCellKey) return
        lastPaintedCellKey = cellKey

        // X 고치기 모드: X만 지우고 빈 셀로 복원 (다시 칠할 수 있게)
        if (isEraseMode) {
            if (wrongPaintedCells.contains(cellKey)) {
                wrongPaintedCells.remove(cellKey)
                filledCells.remove(cellKey)
                paintedColorMap.remove(cellKey)
                recentlyRemovedWrongCells.add(cellKey)
                invalidate()
                // ⚡ 배치로 이벤트 전송
                queuePaintEvent(row, col, true)
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

            filledCells.add(cellKey)
            paintedColorMap[cellKey] = selectedColorHex
            wrongPaintedCells.remove(cellKey)
            invalidate()

            // ⚡ 배치로 이벤트 전송
            queuePaintEvent(row, col, true)
        } else {
            // ⚡ 이미 틀린 셀로 표시된 경우 스킵
            if (wrongPaintedCells.contains(cellKey)) {
                return
            }

            wrongPaintedCells.add(cellKey)
            paintedColorMap[cellKey] = selectedColorHex
            invalidate()

            // ⚡ 배치로 이벤트 전송
            queuePaintEvent(row, col, false)
        }
    }

    // ⚡ 이벤트를 큐에 추가하고 배치로 전송
    private fun queuePaintEvent(row: Int, col: Int, isCorrect: Boolean) {
        pendingPaintEvents.add(Triple(row, col, isCorrect))

        // 이미 예약된 배치 전송이 있으면 스킵
        if (batchEventRunnable != null) return

        // 16ms 후 배치 전송 (약 1프레임)
        batchEventRunnable = Runnable {
            flushPaintEvents()
            batchEventRunnable = null
        }
        postDelayed(batchEventRunnable, 16)
    }

    // ⚡ 큐에 쌓인 이벤트 일괄 전송
    private fun flushPaintEvents() {
        if (pendingPaintEvents.isEmpty()) return

        // 모든 이벤트 전송
        for ((row, col, isCorrect) in pendingPaintEvents) {
            sendCellPaintedEvent(row, col, isCorrect)
        }
        pendingPaintEvents.clear()
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
     * 색상 틴트 오버레이 그리기
     * 원본 이미지 위에 팔레트 색상을 반투명하게 덮어서 색상 힌트 제공
     * @param alpha 투명도 (0.0 ~ 1.0, 낮을수록 원본 이미지가 더 잘 보임)
     */
    private fun drawColorTint(canvas: Canvas, left: Float, top: Float, size: Float, color: Int, alpha: Float) {
        reusableBgPaint.color = color
        reusableBgPaint.alpha = (alpha * 255).toInt()
        canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
        reusableBgPaint.alpha = 255  // 복원
    }

    // 색칠된 셀 텍스처 캐시 (색상별로 캐싱)
    private val filledCellTextureCache = mutableMapOf<Int, Bitmap>()

    /**
     * 색칠된 셀에 weave_pattern2 텍스처 + 팔레트 색상 그리기
     * 텍스처의 명암 정보는 유지하면서 팔레트 색상으로 틴트 적용
     */
    private fun drawFilledCellWithTexture(canvas: Canvas, left: Float, top: Float, size: Float, color: Int) {
        val pattern = filledCellPatternBitmap

        if (pattern != null && !pattern.isRecycled) {
            // 캐시에서 색상별 텍스처 찾기
            val cachedBitmap = getColoredTextureFromCache(pattern, color)

            // 텍스처를 셀에 그리기
            reusableSrcRect.set(0, 0, cachedBitmap.width, cachedBitmap.height)
            reusableDstRect.set(left, top, left + size + 0.5f, top + size + 0.5f)
            canvas.drawBitmap(cachedBitmap, reusableSrcRect, reusableDstRect, paint)
        } else {
            // 폴백: 텍스처 없으면 단색으로 그리기
            reusableBgPaint.color = color
            canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
        }
    }

    /**
     * 색상별 텍스처 비트맵 캐시에서 가져오기 (없으면 생성)
     * 텍스처의 명암(밝기)은 유지하면서 팔레트 색상을 적용
     */
    private fun getColoredTextureFromCache(pattern: Bitmap, color: Int): Bitmap {
        // 캐시 확인
        val cached = filledCellTextureCache[color]
        if (cached != null && !cached.isRecycled) {
            return cached
        }

        // 새로 생성: 팔레트 색상 + 텍스처 명암
        val s = pattern.width
        val bitmap = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
        val tempCanvas = Canvas(bitmap)

        // 1. 팔레트 색상으로 배경 채우기
        reusableBgPaint.color = color
        tempCanvas.drawRect(0f, 0f, s.toFloat(), s.toFloat(), reusableBgPaint)

        // 2. 텍스처 패턴의 명암 정보 오버레이 (Multiply 블렌드)
        // 텍스처의 어두운 부분은 어둡게, 밝은 부분은 밝게 유지
        reusablePatternPaint.alpha = 180  // 텍스처 효과 강도 조절
        tempCanvas.drawBitmap(pattern, 0f, 0f, reusablePatternPaint)

        // 캐시에 저장 (제한: 100개)
        if (filledCellTextureCache.size > 100) {
            filledCellTextureCache.clear()
        }
        filledCellTextureCache[color] = bitmap

        return bitmap
    }

    /**
     * 색칠된 셀 그리기 (단색 폴백용)
     */
    private fun drawWeaveTexture(canvas: Canvas, left: Float, top: Float, size: Float, baseColor: Int) {
        reusableBgPaint.color = baseColor
        canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
    }

    /**
     * 노란색 경고 삼각형 그리기 (투명 배경)
     * 잘못 칠한 셀 위에 오버레이로 표시
     */
    private fun drawWarningTriangle(canvas: Canvas, left: Float, top: Float, size: Float) {
        val padding = size * 0.15f
        val centerX = left + size / 2f
        val triangleTop = top + padding
        val triangleBottom = top + size - padding
        val triangleLeft = left + padding
        val triangleRight = left + size - padding

        // 삼각형 경로 설정
        reusableTrianglePath.reset()
        reusableTrianglePath.moveTo(centerX, triangleTop)  // 상단 꼭지점
        reusableTrianglePath.lineTo(triangleRight, triangleBottom)  // 우측 하단
        reusableTrianglePath.lineTo(triangleLeft, triangleBottom)  // 좌측 하단
        reusableTrianglePath.close()

        // 노란색 삼각형 채우기
        canvas.drawPath(reusableTrianglePath, warningTriangleFillPaint)

        // 테두리 그리기
        warningTriangleStrokePaint.strokeWidth = max(1f, size * 0.05f)
        canvas.drawPath(reusableTrianglePath, warningTriangleStrokePaint)

        // 느낌표 그리기
        val exclamationWidth = size * 0.08f
        val exclamationTop = triangleTop + size * 0.25f
        val exclamationBottom = triangleBottom - size * 0.2f
        val exclamationMid = exclamationBottom - size * 0.15f

        // 느낌표 세로 막대
        canvas.drawRect(
            centerX - exclamationWidth / 2f,
            exclamationTop,
            centerX + exclamationWidth / 2f,
            exclamationMid,
            warningExclamationPaint
        )

        // 느낌표 점
        val dotRadius = exclamationWidth * 0.6f
        canvas.drawCircle(centerX, exclamationBottom - dotRadius, dotRadius, warningExclamationPaint)
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
     * ⭐ 배경은 정답 색상, 그 위에 경고 삼각형 오버레이
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
        // 1. 정답 색상으로 배경 채우기 (순수 단색, 패턴 없음)
        reusableBgPaint.color = baseColor
        canvas.drawRect(0f, 0f, s.toFloat(), s.toFloat(), reusableBgPaint)

        // 2. 경고 이미지 오버레이 (경고 삼각형 - weave_pattern3.png)
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
        val bitmap = backgroundBitmap ?: run {
            if (row == 7 && col == 4) {
                android.util.Log.d("PaintCanvas", "⚠️ drawOriginalImageOverlay: bitmap is NULL!")
            }
            return
        }

        // 안전 체크: Bitmap이 recycled되었거나 유효하지 않은 경우
        if (bitmap.isRecycled || bitmap.width <= 0 || bitmap.height <= 0) {
            if (row == 7 && col == 4) {
                android.util.Log.d("PaintCanvas", "⚠️ drawOriginalImageOverlay: bitmap invalid (recycled=${bitmap.isRecycled}, size=${bitmap.width}x${bitmap.height})")
            }
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

            if (row == 7 && col == 4) {
                android.util.Log.d("PaintCanvas", "✅ drawOriginalImageOverlay: src=[${srcLeft},${srcTop},${srcRight},${srcBottom}], dst=[${left},${top},${left+size},${top+size}], alpha=${alpha}")
            }

            // ⚡ 최적화: 재사용 Paint 객체 사용
            reusableOverlayPaint.alpha = (alpha * 255).toInt()

            // ⚡ 최적화: 재사용 Rect/RectF 객체 사용
            reusableSrcRect.set(srcLeft, srcTop, srcRight, srcBottom)
            reusableDstRect.set(left, top, left + size, top + size)

            if (row == 7 && col == 4) {
                android.util.Log.d("PaintCanvas", "🎨 drawBitmap called: paint.alpha=${reusableOverlayPaint.alpha}")
            }

            canvas.drawBitmap(bitmap, reusableSrcRect, reusableDstRect, reusableOverlayPaint)

            if (row == 7 && col == 4) {
                android.util.Log.d("PaintCanvas", "✅ drawBitmap completed for original image overlay")
            }
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ drawOriginalImageOverlay failed: ${e.message}")
            e.printStackTrace()
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
