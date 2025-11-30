package com.paintcanvas

import android.animation.ValueAnimator
import android.content.Context
import android.content.SharedPreferences
import android.graphics.*
import android.net.Uri
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.animation.DecelerateInterpolator
import android.util.Base64
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

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

    // 🔄 자동 저장용 SharedPreferences
    private val prefs: SharedPreferences = context.getSharedPreferences("PaintCanvasProgress", Context.MODE_PRIVATE)
    private var currentGameId: String? = null
    private var saveJob: Job? = null
    private val saveScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var gridSize: Int = 60
    private var cells: List<CellData> = emptyList()
    private var selectedColorHex: String = "#FF0000"
    private var selectedLabel: String = "A"
    private var imageUri: String? = null
    private var isEraseMode: Boolean = false  // X 제거 모드

    fun setGridSize(value: Int) {
        android.util.Log.d("PaintCanvas", "📐 setGridSize called: $value, current canvasWidth=$canvasWidth")
        gridSize = value

        // Only recalculate cellSize, don't touch canvasWidth
        // canvasWidth should be set by setViewSize() from JavaScript
        cellSize = canvasWidth / gridSize

        // 난이도별 줌 레벨 설정
        // 두 손가락 탭: 1x → 10x → 최대 → 1x 순환
        // gridSize 클수록 maxZoom 높임
        when {
            gridSize <= 120 -> {  // 쉬움: 120×120
                maxZoom = 10f
                ZOOM_LEVELS = floatArrayOf(1f, 10f)  // 1x → 10x → 1x
            }
            gridSize <= 160 -> {  // 보통: 160×160
                maxZoom = 12f
                ZOOM_LEVELS = floatArrayOf(1f, 10f, 12f)  // 1x → 10x → 12x → 1x
            }
            gridSize <= 200 -> {  // 어려움: 200×200
                maxZoom = 15f
                ZOOM_LEVELS = floatArrayOf(1f, 10f, 15f)  // 1x → 10x → 15x → 1x
            }
            else -> {  // 초고화질: 250×250+
                maxZoom = 20f
                ZOOM_LEVELS = floatArrayOf(1f, 10f, 20f)  // 1x → 10x → 20x → 1x
            }
        }
        android.util.Log.d("PaintCanvas", "📐 gridSize=$gridSize, maxZoom=$maxZoom, Zoom levels: ${ZOOM_LEVELS.toList()}")

        invalidate()
    }

    // ⚡ 셀 데이터 임시 저장 (gridSize 설정 후 인덱스 재계산용)
    private var pendingCellList: List<Map<String, Any>>? = null

    // ⚡ 저장된 진행 상황 임시 저장 (setCells 후 복원용)
    private var pendingFilledCells: List<String>? = null
    private var pendingWrongCells: List<String>? = null

    // 🔄 마지막으로 설정된 cells 크기 추적 (중복 초기화 방지)
    private var lastCellsSize: Int = 0

    fun setCells(cellList: List<Map<String, Any>>) {
        val size = cellList.size
        if (size == 0) return

        val startTime = System.currentTimeMillis()

        // 🐛 버그 수정: gridSize가 아직 설정되지 않았을 수 있음
        val inferredGridSize = kotlin.math.sqrt(size.toDouble()).toInt()
        if (inferredGridSize > 0 && inferredGridSize * inferredGridSize == size && gridSize != inferredGridSize) {
            gridSize = inferredGridSize
            cellSize = if (canvasWidth > 0) canvasWidth / gridSize else 0f
        }

        // ✅ 동일한 퍼즐 재진입 시 상태 초기화 방지
        // 크기가 같고 이미 cells가 설정된 경우 = 같은 퍼즐 재진입
        if (size == lastCellsSize && cells.isNotEmpty()) {
            android.util.Log.d("PaintCanvas", "⚡ setCells 스킵: 동일한 퍼즐 재진입 (size=$size, filled=${filledCells.size})")
            // pending 데이터만 복원 (있으면)
            var restoredInReentry = false
            pendingFilledCells?.let { pending ->
                android.util.Log.d("PaintCanvas", "🔄 pendingFilledCells 복원 (재진입): ${pending.size}개")
                for (cellKey in pending) {
                    filledCells.add(cellKey)
                    val idx = parseIndex(cellKey)
                    if (idx >= 0) filledCellIndices.add(idx)
                }
                pendingFilledCells = null
                restoredInReentry = true
            }
            pendingWrongCells?.let { pending ->
                android.util.Log.d("PaintCanvas", "🔄 pendingWrongCells 복원 (재진입): ${pending.size}개")
                for (cellKey in pending) {
                    wrongPaintedCells.add(cellKey)
                    val idx = parseIndex(cellKey)
                    if (idx >= 0) wrongCellIndices.add(idx)
                }
                pendingWrongCells = null
                restoredInReentry = true
            }
            if (restoredInReentry) {
                invalidate()
            }
            return
        }

        // 🔄 새 퍼즐 로드 시 모든 상태 초기화
        android.util.Log.d("PaintCanvas", "🔄 setCells: 새 퍼즐 로드, 상태 초기화 (old=$lastCellsSize, new=$size)")
        lastCellsSize = size
        hasUserPainted = false  // ✅ 새 퍼즐이면 사용자 색칠 플래그 리셋
        filledCells.clear()
        filledCellIndices.clear()
        wrongPaintedCells.clear()
        wrongCellIndices.clear()
        recentlyRemovedWrongCells.clear()
        lastPaintedCellIndex = -1
        lastPaintedRow = -1
        lastPaintedCol = -1
        targetColorMap.clear()
        labelMap.clear()
        parsedColorMap.clear()
        labelMapByIndex.clear()
        paintedColorMapInt.clear()
        paintedColorMap.clear()
        filledCellTextureCache.clear()

        // ⚡ 최적화: 배열 사전 할당 + 지역 변수로 캐싱
        val newCells = ArrayList<CellData>(size)
        val localGridSize = gridSize
        val hasBitmap = backgroundBitmap != null

        for (cellMap in cellList) {
            val row = (cellMap["row"] as? Number)?.toInt() ?: 0
            val col = (cellMap["col"] as? Number)?.toInt() ?: 0
            val targetColorHex = cellMap["targetColorHex"] as? String ?: "#000000"
            val label = cellMap["label"] as? String ?: "A"

            newCells.add(CellData(row, col, targetColorHex, label))

            // ⚡ String key 생성 제거 - Int 인덱스만 사용
            val cellIndex = row * localGridSize + col
            labelMapByIndex[cellIndex] = label

            // ⚡ 색상 파싱은 필요할 때만 (지연 로딩)
            // parsedColorMap은 onDraw나 터치 시 lazy하게 채움
        }

        cells = newCells
        pendingCellList = null

        android.util.Log.d("PaintCanvas", "📦 setCells: ${size}개, ${System.currentTimeMillis() - startTime}ms")

        // 🔄 저장된 진행 상황 복원 (setFilledCells/setWrongCells가 먼저 호출된 경우)
        pendingFilledCells?.let { pending ->
            android.util.Log.d("PaintCanvas", "🔄 pendingFilledCells 복원: ${pending.size}개")
            for (cellKey in pending) {
                filledCells.add(cellKey)
                val idx = parseIndex(cellKey)
                if (idx >= 0) filledCellIndices.add(idx)
            }
            pendingFilledCells = null
        }

        pendingWrongCells?.let { pending ->
            android.util.Log.d("PaintCanvas", "🔄 pendingWrongCells 복원: ${pending.size}개")
            for (cellKey in pending) {
                wrongPaintedCells.add(cellKey)
                val idx = parseIndex(cellKey)
                if (idx >= 0) wrongCellIndices.add(idx)
            }
            pendingWrongCells = null
        }

        invalidate()
    }

    // ⚡ 파싱된 색상 캐시 (매번 Color.parseColor 호출 방지)
    private var cachedSelectedColorInt: Int = Color.RED

    fun setSelectedColor(colorHex: String) {
        if (selectedColorHex == colorHex) return  // ⚡ 변경 없으면 스킵
        selectedColorHex = colorHex
        // ⚡ 색상 변경 시 한 번만 파싱
        cachedSelectedColorInt = try { Color.parseColor(colorHex) } catch (e: Exception) { Color.RED }
    }

    fun setSelectedLabel(label: String) {
        if (selectedLabel == label) return  // ⚡ 변경 없으면 스킵
        selectedLabel = label
        // ⚡ 최적화: 색상 선택 시 즉시 다시 그리기 (하이라이트 업데이트 필요)
        // postInvalidate()는 다음 프레임에 그리기를 예약 (UI 스레드 블록 방지)
        postInvalidate()
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

    // ⚡ 비동기 이미지 로딩용 코루틴 스코프
    private val imageLoadScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isImageLoading = false

    fun setImageUri(uri: String) {
        if (imageUri == uri && originalBitmap != null) {
            // 이미 같은 이미지가 로드되어 있으면 스킵
            android.util.Log.d("PaintCanvas", "⚡ 이미지 이미 로드됨, 스킵")
            return
        }

        imageUri = uri
        isImageLoading = true

        // 🔄 gameId 생성 및 저장된 진행 상황 복원
        val fileName = uri.substringAfterLast("/").substringBeforeLast(".")
        currentGameId = "native_${fileName}_${gridSize}"
        android.util.Log.d("PaintCanvas", "🔄 gameId 설정: $currentGameId")
        loadProgressFromPrefs()

        // 로딩 인디케이터 표시를 위해 먼저 그리기
        invalidate()

        // ⚡ 백그라운드에서 이미지 로드 (UI 블로킹 방지)
        imageLoadScope.launch {
            val startTime = System.currentTimeMillis()

            // 1. 이미지 로드 (IO 스레드)
            val loadedBitmap = loadBitmap(uri)

            // 2. 텍스처 적용 (CPU 집약적 작업)
            val texturedBitmap = if (loadedBitmap != null && filledCellPatternBitmap != null) {
                applyTextureToOriginalImage(loadedBitmap, filledCellPatternBitmap!!)
            } else {
                loadedBitmap
            }

            val loadTime = System.currentTimeMillis() - startTime
            android.util.Log.d("PaintCanvas", "⚡ 비동기 이미지 로드 완료: ${loadTime}ms")

            // 3. 메인 스레드에서 UI 업데이트
            withContext(Dispatchers.Main) {
                originalBitmap = loadedBitmap
                backgroundBitmap = texturedBitmap

                // ✨ parsedColorMap 업데이트 (이미 cells가 설정된 경우)
                if (backgroundBitmap != null && cells.isNotEmpty()) {
                    for (cell in cells) {
                        val cellIndex = cell.row * gridSize + cell.col
                        parsedColorMap[cellIndex] = getOriginalPixelColor(cell.row, cell.col)
                    }
                    android.util.Log.d("PaintCanvas", "✨ parsedColorMap 업데이트 완료: ${cells.size}개 셀")
                }

                isImageLoading = false
                android.util.Log.d("PaintCanvas", "✨ 이미지 로드 완료: original=${originalBitmap?.width}x${originalBitmap?.height}, textured=${backgroundBitmap?.width}x${backgroundBitmap?.height}")
                invalidate()
            }
        }
    }

    // 🔄 터치로 색칠 시작 여부 (true면 JS 업데이트 무시)
    private var hasUserPainted: Boolean = false

    fun setFilledCells(cellsFromJs: List<String>) {
        // 🔄 진행 상황 복원 로직:
        // - setCells가 아직 호출되지 않았으면 pendingFilledCells에 저장
        // - setCells가 이미 호출됐으면 즉시 복원
        // - 사용자가 터치로 색칠 시작했으면 JS 업데이트 무시 (Native가 관리)

        if (cellsFromJs.isEmpty()) return  // 빈 데이터는 무시

        // ✅ 사용자가 터치로 색칠 시작했으면 JS 업데이트 무시
        if (hasUserPainted) {
            android.util.Log.d("PaintCanvas", "⚡ setFilledCells 무시: 사용자가 색칠 시작함, Native가 관리 중")
            return
        }

        // cells가 아직 설정되지 않았으면 pending에 저장 (setCells에서 복원)
        if (cells.isEmpty()) {
            android.util.Log.d("PaintCanvas", "📥 setFilledCells: cells 미설정, pending에 ${cellsFromJs.size}개 저장")
            pendingFilledCells = cellsFromJs
            return
        }

        // cells가 설정된 상태 → 즉시 복원
        // ✅ 기존 데이터와 비교하여 더 많은 경우에만 복원 (JS → Native 방향만)
        if (cellsFromJs.size > filledCells.size) {
            android.util.Log.d("PaintCanvas", "🔄 setFilledCells: 복원 (JS=${cellsFromJs.size}개 > Native=${filledCells.size}개)")
            filledCells.clear()
            filledCellIndices.clear()
            for (cellKey in cellsFromJs) {
                filledCells.add(cellKey)
                val idx = parseIndex(cellKey)
                if (idx >= 0) filledCellIndices.add(idx)
            }
            invalidate()
        } else {
            android.util.Log.d("PaintCanvas", "⚡ setFilledCells 스킵: Native=${filledCells.size}개 >= JS=${cellsFromJs.size}개")
        }
    }

    // ⚡ 헬퍼: "row-col" 문자열을 인덱스로 변환
    private fun parseIndex(cellKey: String): Int {
        val parts = cellKey.split("-")
        if (parts.size != 2) return -1
        val row = parts[0].toIntOrNull() ?: return -1
        val col = parts[1].toIntOrNull() ?: return -1
        return row * gridSize + col
    }

    fun setWrongCells(cellsFromJs: List<String>) {
        // 🔄 진행 상황 복원 로직 (setFilledCells와 동일한 패턴)
        recentlyRemovedWrongCells.clear()

        if (cellsFromJs.isEmpty()) return  // 빈 데이터는 무시

        // ✅ 사용자가 터치로 색칠 시작했으면 JS 업데이트 무시
        if (hasUserPainted) {
            android.util.Log.d("PaintCanvas", "⚡ setWrongCells 무시: 사용자가 색칠 시작함, Native가 관리 중")
            return
        }

        // cells가 아직 설정되지 않았으면 pending에 저장 (setCells에서 복원)
        if (cells.isEmpty()) {
            android.util.Log.d("PaintCanvas", "📥 setWrongCells: cells 미설정, pending에 ${cellsFromJs.size}개 저장")
            pendingWrongCells = cellsFromJs
            return
        }

        // cells가 설정된 상태 → 즉시 복원
        // ✅ 기존 데이터와 비교하여 더 많은 경우에만 복원 (JS → Native 방향만)
        if (cellsFromJs.size > wrongPaintedCells.size) {
            android.util.Log.d("PaintCanvas", "🔄 setWrongCells: 복원 (JS=${cellsFromJs.size}개 > Native=${wrongPaintedCells.size}개)")
            wrongPaintedCells.clear()
            wrongCellIndices.clear()
            for (cellKey in cellsFromJs) {
                wrongPaintedCells.add(cellKey)
                val idx = parseIndex(cellKey)
                if (idx >= 0) wrongCellIndices.add(idx)
            }
            invalidate()
        } else {
            android.util.Log.d("PaintCanvas", "⚡ setWrongCells 스킵: Native=${wrongPaintedCells.size}개 >= JS=${cellsFromJs.size}개")
        }
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

    // ⚡ 성능 최적화: Int 인덱스 기반 데이터 구조 (String 생성/파싱 제거)
    private val filledCellIndices = mutableSetOf<Int>() // row * gridSize + col
    private val wrongCellIndices = mutableSetOf<Int>() // row * gridSize + col
    private val parsedColorMap = mutableMapOf<Int, Int>() // cellIndex -> parsed color (Int)
    private val labelMapByIndex = mutableMapOf<Int, String>() // cellIndex -> label
    private val paintedColorMapInt = mutableMapOf<Int, Int>() // ⚡ cellIndex -> painted color (Int, 파싱 완료)
    private var backgroundBitmap: Bitmap? = null  // 텍스처 적용된 이미지 (WEAVE 모드용)
    private var originalBitmap: Bitmap? = null    // 원본 이미지 (ORIGINAL 모드용)

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
        // Semi-transparent gray overlay for selected label cells
        color = Color.parseColor("#80BDBDBD") // 50% opacity light gray
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
    private val reusableBgPaint = Paint().apply {
        style = Paint.Style.FILL
    }
    private val reusableBitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true  // 비트맵 스케일링 품질 향상
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

    // 4-step zoom levels: 최대 배율(15x)의 70% → 80% → 90% → 100% → back to 1x
    // 첫 확대 시 바로 작업 가능한 크기(70%)부터 시작
    private var ZOOM_LEVELS = floatArrayOf(1f, 10.5f, 12f, 13.5f, 15f)
    private var maxZoom = 15f
    private var currentZoomIndex = 0
    private var twoFingerTapStartTime = 0L
    private var touchDownTime = 0L  // Time of initial ACTION_DOWN
    private var touchStartX = 0f    // ⚡ 터치 시작 X 위치
    private var touchStartY = 0f    // ⚡ 터치 시작 Y 위치
    private var hasMoved = false    // ⚡ 드래그 시작 여부
    private var twoFingerStartX = 0f
    private var twoFingerStartY = 0f
    private var twoFingerLastX = 0f  // Track last position separately from lastTouchX
    private var twoFingerLastY = 0f
    private val TAP_TIMEOUT = 500L  // Max time for a tap (ms) - increased for easier detection
    private val TAP_SLOP = 100f  // Max movement for a tap (pixels) - increased tolerance

    // 🎯 연속 핀치 줌 (Google Maps 스타일)
    private var isPinching = false
    private var pinchStartScale = 1f  // 핀치 시작 시 스케일
    private var pinchStartSpan = 0f   // 핀치 시작 시 손가락 거리

    // 🎬 부드러운 줌 애니메이션 (두 손가락 탭용)
    private var zoomAnimator: ValueAnimator? = null
    private val ZOOM_ANIMATION_DURATION = 250L  // 애니메이션 지속 시간 (ms)

    // ⚡ 프레임 레이트 제한 (60fps = 16ms, 120fps = 8ms)
    private var lastInvalidateTime = 0L
    private val MIN_INVALIDATE_INTERVAL = 12L  // ~83fps 최대

    private val scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            // ⚠️ 안전 체크
            if (pinchStartSpan <= 0f) return true

            // 🎯 5단계 줌: 확대 1x→80%→100%, 축소 100%→80%→50%→1x
            val spanRatio = detector.currentSpan / pinchStartSpan
            val zoomTarget80 = maxZoom * 0.8f
            val zoomTarget50 = maxZoom * 0.5f

            // ⚡ 가속 줌: 손가락 50% 벌리면/모으면 목표까지 도달
            var newScale = if (spanRatio >= 1f) {
                // 🔼 확대
                val expandTarget = if (pinchStartScale < zoomTarget80) zoomTarget80 else maxZoom
                val progress = ((spanRatio - 1f) / 0.5f).coerceIn(0f, 1f)
                pinchStartScale + (expandTarget - pinchStartScale) * progress
            } else {
                // 🔽 축소
                val shrinkTarget = when {
                    pinchStartScale > zoomTarget80 -> zoomTarget80
                    pinchStartScale > zoomTarget50 -> zoomTarget50
                    else -> 1f
                }
                val progress = ((1f - spanRatio) / 0.5f).coerceIn(0f, 1f)
                pinchStartScale - (pinchStartScale - shrinkTarget) * progress
            }

            newScale = newScale.coerceIn(1f, maxZoom)

            // 포커스 포인트 기준 줌 적용
            val focusX = detector.focusX
            val focusY = detector.focusY
            val scaleDelta = newScale / scaleFactor
            translateX = focusX - (focusX - translateX) * scaleDelta
            translateY = focusY - (focusY - translateY) * scaleDelta

            scaleFactor = newScale
            applyBoundaries()
            invalidate()

            return true
        }

        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            touchMode = TouchMode.ZOOM
            isPinching = true
            pinchStartScale = scaleFactor
            pinchStartSpan = detector.currentSpan
            zoomAnimator?.cancel()
            return true
        }

        override fun onScaleEnd(detector: ScaleGestureDetector) {
            touchMode = TouchMode.NONE
            isPinching = false
            syncZoomIndex()
        }
    })

    /**
     * 현재 scaleFactor에 맞는 zoomIndex 동기화
     * 핀치 줌 후 두 손가락 탭 줌이 올바르게 작동하도록
     */
    private fun syncZoomIndex() {
        // 현재 스케일에 가장 가까운 줌 레벨 찾기
        var closestIndex = 0
        var minDiff = Float.MAX_VALUE

        for (i in ZOOM_LEVELS.indices) {
            val diff = kotlin.math.abs(scaleFactor - ZOOM_LEVELS[i])
            if (diff < minDiff) {
                minDiff = diff
                closestIndex = i
            }
        }

        currentZoomIndex = closestIndex
    }

    // Step zoom: cycle through zoom levels with animation
    private fun stepZoom(focusX: Float, focusY: Float) {
        // Move to next zoom level
        currentZoomIndex = (currentZoomIndex + 1) % ZOOM_LEVELS.size
        val targetScale = ZOOM_LEVELS[currentZoomIndex]

        android.util.Log.d("PaintCanvas", "🔍 Step zoom: index=$currentZoomIndex, target=$targetScale")

        animateZoomTo(targetScale, focusX, focusY)
    }

    /**
     * 🎬 부드러운 줌 애니메이션
     * @param targetScale 목표 스케일
     * @param focusX 줌 포커스 X 좌표
     * @param focusY 줌 포커스 Y 좌표
     */
    private fun animateZoomTo(targetScale: Float, focusX: Float, focusY: Float) {
        // 기존 애니메이션 취소
        zoomAnimator?.cancel()

        val startScale = scaleFactor
        val startTranslateX = translateX
        val startTranslateY = translateY

        // 목표 위치 계산
        val targetTranslateX: Float
        val targetTranslateY: Float

        if (targetScale == 1f) {
            // 1x로 축소시 중앙으로 리셋
            targetTranslateX = (canvasViewWidth - canvasWidth) / 2f
            targetTranslateY = (canvasViewHeight - canvasWidth) / 2f
        } else {
            // 포커스 포인트를 기준으로 확대/축소
            val scaleDelta = targetScale / startScale
            targetTranslateX = focusX - (focusX - startTranslateX) * scaleDelta
            targetTranslateY = focusY - (focusY - startTranslateY) * scaleDelta
        }

        zoomAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = ZOOM_ANIMATION_DURATION
            interpolator = DecelerateInterpolator()

            addUpdateListener { animation ->
                val progress = animation.animatedValue as Float

                // 스케일과 위치를 부드럽게 보간
                scaleFactor = startScale + (targetScale - startScale) * progress
                translateX = startTranslateX + (targetTranslateX - startTranslateX) * progress
                translateY = startTranslateY + (targetTranslateY - startTranslateY) * progress

                applyBoundaries()
                invalidate()
            }

            start()
        }
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

    // 로딩 인디케이터용 Paint
    private val loadingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#40E0D0")  // 앱 테마 색상
        style = Paint.Style.STROKE
        strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
    }
    private val loadingTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#40E0D0")
        textSize = 48f
        textAlign = Paint.Align.CENTER
    }
    private var loadingAngle = 0f

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // ⚡ 이미지 로딩 중일 때 로딩 인디케이터 표시
        if (isImageLoading) {
            val centerX = width / 2f
            val centerY = height / 2f
            val radius = 40f

            // 회전하는 원형 로딩 인디케이터
            loadingAngle = (loadingAngle + 10f) % 360f
            canvas.drawArc(
                centerX - radius, centerY - radius,
                centerX + radius, centerY + radius,
                loadingAngle, 270f, false, loadingPaint
            )

            // 로딩 텍스트
            canvas.drawText("로딩 중...", centerX, centerY + radius + 60f, loadingTextPaint)

            // 다음 프레임 요청 (애니메이션)
            postInvalidateDelayed(16)  // ~60fps
            return
        }

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
        // ⚡ 성능: 루프 내 변수 미리 계산
        val halfCellSize = cellSize / 2f
        val cellSizePlusHalf = cellSize + 0.5f

        // ⚡ 줌 레벨에 따른 텍스트 표시 여부 (확대 시에만 텍스트 표시)
        // 셀이 화면에서 너무 작으면 텍스트가 안 보이므로 그리기 스킵
        val screenCellSize = cellSize * scaleFactor
        val shouldDrawText = screenCellSize > 12f  // 12dp 이상일 때만 텍스트 표시

        // 텍스트 크기 미리 계산 (텍스트 그릴 때만)
        val textYOffset = if (shouldDrawText) {
            textPaint.textSize = cellSize * 0.5f
            -(textPaint.descent() + textPaint.ascent()) / 2f
        } else 0f

        for (row in startRow..endRow) {
            val top = row * cellSize
            val rowOffset = row * gridSize

            for (col in startCol..endCol) {
                val left = col * cellSize
                val cellIndex = rowOffset + col

                // ⚡ 색칠된 셀 색상 직접 조회 (contains 호출 제거)
                val cellColor = paintedColorMapInt[cellIndex]

                if (cellColor != null) {
                    // 색칠된 셀
                    drawFilledCellWithTexture(canvas, left, top, cellSize, cellColor)

                    // ⚡ wrongCellIndices 조회는 색칠된 셀에서만
                    if (wrongCellIndices.contains(cellIndex)) {
                        drawWarningTriangle(canvas, left, top, cellSize)
                    }
                } else {
                    // 미색칠 셀 - 원본 이미지 음영 + 반투명 흰색 오버레이 + 알파벳
                    // 🎨 참조 앱 스타일: 축소 화면에서도 그림의 음영이 보임
                    drawUnfilledCellWithShadow(canvas, left, top, cellSize, row, col)

                    // ⚡ 텍스트와 하이라이트는 확대 시에만 (성능 최적화)
                    if (shouldDrawText) {
                        // 선택된 라벨 하이라이트 (노란색 반투명)
                        val label = labelMapByIndex[cellIndex]
                        if (label == selectedLabel) {
                            canvas.drawRect(left, top, left + cellSizePlusHalf, top + cellSizePlusHalf, highlightPaint)
                        }

                        // 알파벳
                        canvas.drawText(label ?: "A", left + halfCellSize, top + halfCellSize + textYOffset, textPaint)
                    }
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
                touchStartX = event.x  // ⚡ 터치 시작 위치 저장
                touchStartY = event.y
                activePointerId = event.getPointerId(0)
                preventPaintOnce = false
                allowPainting = false
                touchDownTime = System.currentTimeMillis()
                hasMoved = false  // ⚡ 이동 여부 리셋
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
                        if (!preventPaintOnce) {
                            val timeSinceDown = System.currentTimeMillis() - touchDownTime
                            val dx = event.x - touchStartX
                            val dy = event.y - touchStartY
                            val distance = kotlin.math.sqrt(dx * dx + dy * dy)

                            // ⚡ 두 손가락 터치 방지: 45ms 대기 또는 15px 이동 시 색칠 시작
                            // 두 손가락은 보통 40ms 내 두 번째 손가락 도착 (빠른 응답)
                            if (timeSinceDown >= 45L || distance > 15f) {
                                allowPainting = true
                                handlePainting(event.x, event.y)
                                hasMoved = true
                            } else if (hasMoved) {
                                // 이미 드래그 시작했으면 바로 색칠 (distance 체크 제거)
                                handlePainting(event.x, event.y)
                            }
                        }
                    }
                    2 -> {
                        // Two fingers = pan + zoom (ScaleGestureDetector가 줌 처리)
                        preventPaintOnce = true
                        allowPainting = false

                        val centroidX = (event.getX(0) + event.getX(1)) / 2f
                        val centroidY = (event.getY(0) + event.getY(1)) / 2f

                        // 팬 처리 (줌은 ScaleGestureDetector가 처리)
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
                val timeSinceDown = System.currentTimeMillis() - touchDownTime
                // ⚡ 빠른 탭: 300ms 이내, 이동 없음, 두 손가락 아님 → 색칠
                if (!preventPaintOnce && timeSinceDown < 300L && !hasMoved) {
                    handlePainting(event.x, event.y)
                }

                touchMode = TouchMode.NONE
                activePointerId = -1
                preventPaintOnce = false
                allowPainting = false
                hasMoved = false

                lastPaintedCellIndex = -1
                lastPaintedRow = -1
                lastPaintedCol = -1
                flushPendingEvents()
                flushPendingEventsWithColor()
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
                hasMoved = false
            }
        }

        return true
    }

    // ⚡ 연속 색칠 최적화: 마지막으로 칠한 셀 추적 (Int 인덱스로 변경)
    private var lastPaintedCellIndex: Int = -1
    private var lastPaintedRow: Int = -1
    private var lastPaintedCol: Int = -1

    // ⚡ 배치 이벤트 전송을 위한 큐
    private val pendingPaintEvents = mutableListOf<Triple<Int, Int, Boolean>>()
    private var batchEventRunnable: Runnable? = null

    // ⚡ 재사용 가능한 객체들 (handlePainting에서 매번 생성하지 않음)
    private val paintingMatrix = Matrix()
    private val paintingInverseMatrix = Matrix()
    private val paintingPoints = FloatArray(2)

    private fun handlePainting(screenX: Float, screenY: Float) {
        // Safety check - don't paint if not initialized
        if (cellSize <= 0f || canvasWidth <= 0f) return

        // ⚡ 재사용 객체로 좌표 변환 (메모리 할당 제거)
        paintingMatrix.reset()
        paintingMatrix.postScale(scaleFactor, scaleFactor)
        paintingMatrix.postTranslate(translateX, translateY)
        paintingMatrix.invert(paintingInverseMatrix)

        paintingPoints[0] = screenX
        paintingPoints[1] = screenY
        paintingInverseMatrix.mapPoints(paintingPoints)

        val col = (paintingPoints[0] / cellSize).toInt()
        val row = (paintingPoints[1] / cellSize).toInt()

        // Validate bounds
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return

        // ⚡ Int 인덱스로 중복 체크 (String 생성 제거)
        val cellIndex = row * gridSize + col

        // ⚡ 같은 셀 연속 터치 무시 (드래그 중 같은 셀 반복 방지)
        if (cellIndex == lastPaintedCellIndex) return

        // ⚡ 빠른 드래그 시 중간 셀 보간 (Bresenham 라인 알고리즘)
        if (lastPaintedRow >= 0 && lastPaintedCol >= 0) {
            // 이전 셀과 현재 셀 사이의 모든 셀 채우기 (시작점 제외)
            fillLineCells(lastPaintedRow, lastPaintedCol, row, col)
        } else {
            // 첫 번째 터치: 현재 셀만 칠하기
            paintSingleCell(row, col)
        }

        // ⚡ 모든 셀 처리 후 한 번만 invalidate
        invalidate()

        lastPaintedCellIndex = cellIndex
        lastPaintedRow = row
        lastPaintedCol = col
    }

    // ⚡ Bresenham 라인 알고리즘으로 두 점 사이 모든 셀 채우기 (시작점 제외, 끝점 포함)
    private fun fillLineCells(r0: Int, c0: Int, r1: Int, c1: Int) {
        var x0 = c0
        var y0 = r0
        val x1 = c1
        val y1 = r1

        val dx = kotlin.math.abs(x1 - x0)
        val dy = -kotlin.math.abs(y1 - y0)
        val sx = if (x0 < x1) 1 else -1
        val sy = if (y0 < y1) 1 else -1
        var err = dx + dy

        // 시작점은 이미 이전 터치에서 칠해졌으므로 스킵
        val startX = x0
        val startY = y0

        while (true) {
            // 시작점 제외하고 모든 점 칠하기
            if (x0 != startX || y0 != startY) {
                if (y0 in 0 until gridSize && x0 in 0 until gridSize) {
                    paintSingleCell(y0, x0)
                }
            }

            if (x0 == x1 && y0 == y1) break

            val e2 = 2 * err
            if (e2 >= dy) {
                err += dy
                x0 += sx
            }
            if (e2 <= dx) {
                err += dx
                y0 += sy
            }
        }
    }

    // ⚡ 단일 셀 칠하기 (String 생성 최소화)
    private fun paintSingleCell(row: Int, col: Int) {
        val cellIndex = row * gridSize + col

        // X 고치기 모드: X만 지우고 빈 셀로 복원 (다시 칠할 수 있게)
        if (isEraseMode) {
            if (wrongCellIndices.contains(cellIndex)) {
                wrongCellIndices.remove(cellIndex)
                filledCellIndices.remove(cellIndex)
                paintedColorMapInt.remove(cellIndex)
                // ⚡ String 맵은 JS 이벤트 전송 시에만 업데이트
                val cellKey = "$row-$col"
                wrongPaintedCells.remove(cellKey)
                filledCells.remove(cellKey)
                paintedColorMap.remove(cellKey)
                recentlyRemovedWrongCells.add(cellKey)
                queuePaintEvent(row, col, true)
                // 🔄 자동 저장
                saveProgressToPrefs()
            }
            return
        }

        // ⚠️ 이미 잘못 칠한 셀은 고치기 모드(isEraseMode)에서만 수정 가능
        if (wrongCellIndices.contains(cellIndex)) {
            return
        }

        // ✅ 이미 정상적으로 색칠된 셀은 다른 색으로 덧칠 불가
        // (filledCellIndices에 있지만 wrongCellIndices에 없는 셀 = 정상 색칠됨)
        if (filledCellIndices.contains(cellIndex)) {
            return
        }

        // Check if label matches selected label
        val cellLabel = labelMapByIndex[cellIndex]
        val isCorrect = cellLabel == selectedLabel

        // ⚡ 캐시된 색상 사용 (Color.parseColor 호출 제거)
        val parsedSelectedColor = cachedSelectedColorInt

        // ✅ 사용자가 색칠 시작함 표시 (이후 JS 업데이트 무시)
        hasUserPainted = true

        // 🔄 String 키 생성 (저장용)
        val cellKey = "$row-$col"

        if (isCorrect) {
            filledCellIndices.add(cellIndex)
            filledCells.add(cellKey)  // 🔄 저장용
            paintedColorMapInt[cellIndex] = parsedSelectedColor
            // ⚡ String 맵은 JS 이벤트 전송 시에만 업데이트 (지연 생성)
            queuePaintEventWithColor(row, col, true, parsedSelectedColor)
        } else {
            // 새로운 틀린 셀 추가
            wrongCellIndices.add(cellIndex)
            wrongPaintedCells.add(cellKey)  // 🔄 저장용
            filledCellIndices.add(cellIndex)
            filledCells.add(cellKey)  // 🔄 저장용
            paintedColorMapInt[cellIndex] = parsedSelectedColor
            // ⚡ String 맵은 JS 이벤트 전송 시에만 업데이트 (지연 생성)
            queuePaintEventWithColor(row, col, false, parsedSelectedColor)
        }

        // 🔄 자동 저장 (디바운스 적용)
        saveProgressToPrefs()
    }

    // ⚡ 색상 정보 포함 이벤트 큐잉 (String 생성 지연)
    private data class PaintEvent(val row: Int, val col: Int, val isCorrect: Boolean, val color: Int)
    private val pendingPaintEventsWithColor = mutableListOf<PaintEvent>()

    private fun queuePaintEventWithColor(row: Int, col: Int, isCorrect: Boolean, color: Int) {
        pendingPaintEventsWithColor.add(PaintEvent(row, col, isCorrect, color))

        // 이미 예약된 배치 전송이 있으면 이벤트만 추가
        if (batchEventRunnable != null) return

        // ⚡ 100ms 후 JS 이벤트 배치 전송
        batchEventRunnable = Runnable {
            flushPendingEventsWithColor()
        }
        postDelayed(batchEventRunnable, 100)
    }

    private fun flushPendingEventsWithColor() {
        batchEventRunnable?.let { removeCallbacks(it) }
        batchEventRunnable = null

        if (pendingPaintEventsWithColor.isEmpty()) return

        // ⚡ 배치로 String 맵 업데이트 및 JS 이벤트 전송
        for (event in pendingPaintEventsWithColor) {
            val cellKey = "${event.row}-${event.col}"
            if (event.isCorrect) {
                filledCells.add(cellKey)
                paintedColorMap[cellKey] = selectedColorHex
            } else {
                wrongPaintedCells.add(cellKey)
                filledCells.add(cellKey)
                paintedColorMap[cellKey] = selectedColorHex
            }
            sendCellPaintedEvent(event.row, event.col, event.isCorrect)
        }
        pendingPaintEventsWithColor.clear()
    }

    // ⚡ JS 이벤트만 큐에 추가 (invalidate는 handlePainting에서 한 번만)
    private fun queuePaintEvent(row: Int, col: Int, isCorrect: Boolean) {
        pendingPaintEvents.add(Triple(row, col, isCorrect))

        // 이미 예약된 배치 전송이 있으면 이벤트만 추가
        if (batchEventRunnable != null) return

        // ⚡ 100ms 후 JS 이벤트 배치 전송 (연속 색칠 중 리렌더링 방지)
        batchEventRunnable = Runnable {
            flushPendingEvents()
        }
        postDelayed(batchEventRunnable, 100)
    }


    // ⚡ 남은 이벤트 즉시 처리 (터치 종료 시 또는 타이머 만료 시)
    private fun flushPendingEvents() {
        // 타이머 취소
        batchEventRunnable?.let { removeCallbacks(it) }
        batchEventRunnable = null

        if (pendingPaintEvents.isEmpty()) return

        // JS 이벤트 배치 전송 (UI는 이미 업데이트됨)
        for ((r, c, correct) in pendingPaintEvents) {
            sendCellPaintedEvent(r, c, correct)
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

    // 색칠된 셀 텍스처 캐시 (색상별로 캐싱)
    private val filledCellTextureCache = mutableMapOf<Int, Bitmap>()

    private var textureDebugLogged = false

    // 🎨 타일링용 BitmapShader 캐시 (색상별)
    private val tiledShaderCache = mutableMapOf<Int, BitmapShader>()
    private val tiledPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val shaderMatrix = Matrix()

    // ⚡ 캐시된 타일 스케일 (줌 레벨 변경 시만 업데이트)
    private var cachedTileScale = 0f
    private var lastCellSizeForTile = 0f

    private fun drawFilledCellWithTexture(canvas: Canvas, left: Float, top: Float, size: Float, color: Int) {
        // ✨ 완성 모드에 따라 다른 렌더링 적용
        if (completionMode == "ORIGINAL") {
            // ORIGINAL 모드: 원본 이미지 영역 복사
            drawOriginalImageCell(canvas, left, top, size)
            return
        }

        // WEAVE 모드: 타일링 텍스처 합성
        val pattern = filledCellPatternBitmap
        if (pattern == null) {
            // 패턴 없으면 단색 폴백
            if (!textureDebugLogged) {
                android.util.Log.e("PaintCanvas", "❌ filledCellPatternBitmap is NULL - falling back to solid color")
                textureDebugLogged = true
            }
            reusableBgPaint.color = color
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)
            return
        }

        // ⚡ 캐시에서 색상별 타일링 셰이더 가져오기
        val shader = tiledShaderCache.getOrPut(color) {
            val texturedBitmap = filledCellTextureCache.getOrPut(color) {
                createColoredTexture(pattern, color)
            }
            BitmapShader(texturedBitmap, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
        }

        // ⚡ 성능: 타일 스케일이 변경되지 않았으면 재계산 스킵
        if (size != lastCellSizeForTile) {
            lastCellSizeForTile = size
            val squarePattern = squarePatternBitmap ?: pattern
            val patternSize = squarePattern.width.toFloat()
            cachedTileScale = size / patternSize
        }

        // ⚡ 성능: 매번 Matrix 재설정 대신 간단한 translate만 (패턴은 고정 스케일)
        shaderMatrix.setScale(cachedTileScale, cachedTileScale)
        shaderMatrix.postTranslate(left, top)
        shader.setLocalMatrix(shaderMatrix)

        tiledPaint.shader = shader
        canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, tiledPaint)
    }

    // 재사용 가능한 RectF (매 프레임 객체 생성 방지)
    private val reusableTextureRect = android.graphics.RectF()

    // 정사각형으로 보정된 텍스처 패턴 (aspect ratio 유지)
    private var squarePatternBitmap: Bitmap? = null

    /**
     * 텍스처 패턴을 정사각형으로 보정 + 성능 최적화를 위해 축소
     * ⚡ 성능: 큰 텍스처(998x963)를 128x128로 축소하여 처리 속도 50배 향상
     */
    private fun getSquarePattern(pattern: Bitmap): Bitmap {
        squarePatternBitmap?.let { return it }

        val w = pattern.width
        val h = pattern.height
        val cropSize = minOf(w, h)

        // 중앙 기준 크롭
        val offsetX = (w - cropSize) / 2
        val offsetY = (h - cropSize) / 2
        val cropped = Bitmap.createBitmap(pattern, offsetX, offsetY, cropSize, cropSize)

        // ⚡ 성능: 128x128로 축소 (927,369 픽셀 → 16,384 픽셀 = 56배 빠름)
        val targetSize = 128
        val square = if (cropSize > targetSize) {
            Bitmap.createScaledBitmap(cropped, targetSize, targetSize, true).also {
                if (cropped != pattern) cropped.recycle()  // 중간 비트맵 해제
            }
        } else {
            cropped
        }

        squarePatternBitmap = square
        android.util.Log.d("PaintCanvas", "✅ 텍스처 최적화: ${w}x${h} → ${square.width}x${square.height}")
        return square
    }

    // 텍스처 밝기 범위 (최초 1회 계산)
    private var texMinLum = 0f
    private var texMaxLum = 1f
    private var texLumCalculated = false

    // ⚡ 성능 최적화: 텍스처 픽셀 배열 재사용
    private var texPixelBuffer: IntArray? = null
    private var outPixelBuffer: IntArray? = null

    /**
     * 색상+텍스처 비트맵 즉시 생성 (동기적)
     * 🎨 참조 앱 스타일: 텍스처 밝기를 정규화하여 어두운 색에서도 선명한 하이라이트
     * ⚡ 최적화: getPixels/setPixels 배열 처리로 5~10배 속도 향상
     */
    private fun createColoredTexture(pattern: Bitmap, color: Int): Bitmap {
        // 정사각형으로 보정된 패턴 사용 (비율 왜곡 방지)
        val squarePattern = getSquarePattern(pattern)
        val size = squarePattern.width
        val totalPixels = size * size
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)

        // ⚡ 픽셀 버퍼 재사용 (메모리 할당 최소화)
        if (texPixelBuffer == null || texPixelBuffer!!.size != totalPixels) {
            texPixelBuffer = IntArray(totalPixels)
            outPixelBuffer = IntArray(totalPixels)
        }
        val texPixels = texPixelBuffer!!
        val outPixels = outPixelBuffer!!

        // ⚡ 배열로 한 번에 읽기 (getPixel 루프 대비 10배 이상 빠름)
        squarePattern.getPixels(texPixels, 0, size, 0, 0, size, size)

        // 텍스처 밝기 범위 계산 (최초 1회)
        if (!texLumCalculated) {
            var minL = 1f
            var maxL = 0f
            for (i in 0 until totalPixels) {
                val p = texPixels[i]
                val l = ((p shr 16 and 0xFF) + (p shr 8 and 0xFF) + (p and 0xFF)) / 3f / 255f
                if (l < minL) minL = l
                if (l > maxL) maxL = l
            }
            texMinLum = minL
            texMaxLum = maxL
            texLumCalculated = true
            android.util.Log.d("PaintCanvas", "📊 텍스처 밝기 범위: min=$minL, max=$maxL")
        }

        val r = color shr 16 and 0xFF
        val g = color shr 8 and 0xFF
        val b = color and 0xFF

        // 색상 밝기 계산 (0~1)
        val colorLuminance = (r * 0.299f + g * 0.587f + b * 0.114f) / 255f
        val lumRange = texMaxLum - texMinLum

        // 🎨 색상 밝기별 하이라이트/그림자 강도 미리 계산
        val highlightStr: Float
        val shadowStr: Float
        when {
            colorLuminance >= 0.7f -> { highlightStr = 0.4f; shadowStr = 0.15f }
            colorLuminance >= 0.4f -> { highlightStr = 0.45f; shadowStr = 0.2f }
            colorLuminance >= 0.2f -> { highlightStr = 0.5f; shadowStr = 0.2f }
            else -> { highlightStr = 0.55f; shadowStr = 0.15f }
        }

        // ⚡ 단일 루프로 모든 픽셀 처리 (2중 루프보다 빠름)
        for (i in 0 until totalPixels) {
            val texPixel = texPixels[i]
            val texR = texPixel shr 16 and 0xFF
            val texG = texPixel shr 8 and 0xFF
            val texB = texPixel and 0xFF
            val rawLum = (texR + texG + texB) / 3f / 255f

            // 📊 텍스처 밝기를 0~1로 정규화
            val normalizedLum = if (lumRange > 0.01f) {
                ((rawLum - texMinLum) / lumRange).coerceIn(0f, 1f)
            } else {
                0.5f
            }

            // 하이라이트 (Screen): 텍스처 밝은 부분 → 색상 밝게
            val highlightAmount = normalizedLum * highlightStr
            val screenR = r + (255 - r) * highlightAmount
            val screenG = g + (255 - g) * highlightAmount
            val screenB = b + (255 - b) * highlightAmount

            // 그림자 (Multiply): 텍스처 어두운 부분 → 색상 어둡게
            val shadowAmount = (1f - normalizedLum) * shadowStr
            val factor = 1f - shadowAmount

            val newR = (screenR * factor).toInt().coerceIn(0, 255)
            val newG = (screenG * factor).toInt().coerceIn(0, 255)
            val newB = (screenB * factor).toInt().coerceIn(0, 255)

            outPixels[i] = 0xFF000000.toInt() or (newR shl 16) or (newG shl 8) or newB
        }

        // ⚡ 배열로 한 번에 쓰기
        bitmap.setPixels(outPixels, 0, size, 0, 0, size, size)
        return bitmap
    }

    /**
     * 🎨 미색칠 셀에 원본 이미지 음영 표시 (참조 앱 스타일)
     * 원본 이미지를 먼저 그리고 반투명 흰색으로 덮어서 음영만 살짝 보이게
     */
    private val shadowOverlayPaint = Paint().apply {
        color = Color.parseColor("#E8FFFFFF")  // 91% 불투명 흰색 (음영만 살짝 보임)
        style = Paint.Style.FILL
    }
    private var shadowDrawnLogOnce = false

    private fun drawUnfilledCellWithShadow(canvas: Canvas, left: Float, top: Float, size: Float, row: Int, col: Int) {
        val bitmap = originalBitmap ?: backgroundBitmap

        if (bitmap != null) {
            // 1단계: 원본 이미지 영역 그리기
            val srcCellWidth = bitmap.width.toFloat() / gridSize
            val srcCellHeight = bitmap.height.toFloat() / gridSize

            val srcLeft = (col * srcCellWidth).toInt()
            val srcTop = (row * srcCellHeight).toInt()
            val srcRight = ((col + 1) * srcCellWidth).toInt().coerceAtMost(bitmap.width)
            val srcBottom = ((row + 1) * srcCellHeight).toInt().coerceAtMost(bitmap.height)

            reusableSrcRect.set(srcLeft, srcTop, srcRight, srcBottom)
            reusableDstRect.set(left, top, left + size, top + size)

            canvas.drawBitmap(bitmap, reusableSrcRect, reusableDstRect, reusableBitmapPaint)

            // 2단계: 반투명 흰색 오버레이 (음영만 살짝 보이게)
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, shadowOverlayPaint)

            if (!shadowDrawnLogOnce) {
                android.util.Log.d("PaintCanvas", "🎨 미색칠 셀 음영 표시 활성화")
                shadowDrawnLogOnce = true
            }
        } else {
            // 비트맵 없으면 흰색 배경
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, backgroundClearPaint)
        }
    }

    /**
     * ✨ 원본 이미지의 해당 셀 영역을 그대로 복사 (ORIGINAL 완성 모드)
     */
    private var originalDrawnLogOnce = false
    private fun drawOriginalImageCell(canvas: Canvas, left: Float, top: Float, size: Float) {
        val bitmap = originalBitmap ?: backgroundBitmap
        if (bitmap == null) {
            // Fallback: 회색으로 채우기
            reusableBgPaint.color = Color.LTGRAY
            canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
            return
        }

        // 캔버스 좌표에서 row/col 역계산
        val row = (top / cellSize).toInt()
        val col = (left / cellSize).toInt()

        // 원본 이미지에서 해당 셀의 영역 계산
        val srcCellWidth = bitmap.width.toFloat() / gridSize
        val srcCellHeight = bitmap.height.toFloat() / gridSize

        val srcLeft = (col * srcCellWidth).toInt()
        val srcTop = (row * srcCellHeight).toInt()
        val srcRight = ((col + 1) * srcCellWidth).toInt().coerceAtMost(bitmap.width)
        val srcBottom = ((row + 1) * srcCellHeight).toInt().coerceAtMost(bitmap.height)

        // 소스 영역과 대상 영역 설정
        reusableSrcRect.set(srcLeft, srcTop, srcRight, srcBottom)
        reusableDstRect.set(left, top, left + size, top + size)

        // 원본 이미지의 해당 영역을 그대로 복사
        canvas.drawBitmap(bitmap, reusableSrcRect, reusableDstRect, reusableBitmapPaint)

        if (!originalDrawnLogOnce) {
            android.util.Log.d("PaintCanvas", "✨ ORIGINAL 모드: 원본 이미지 영역 복사 (${srcLeft},${srcTop})-(${srcRight},${srcBottom})")
            originalDrawnLogOnce = true
        }
    }

    // ⚡ 재사용 가능한 HSV 배열 (매번 생성하지 않음)
    private val reusableHsv = FloatArray(3)

    private fun applyTextureToOriginalImage(original: Bitmap, pattern: Bitmap): Bitmap {
        val result = Bitmap.createBitmap(original.width, original.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        // 1. 원본 이미지 그리기
        canvas.drawBitmap(original, 0f, 0f, null)

        // 2. 텍스처를 타일링하여 반투명 오버레이 (15% 강도로 은은하게)
        val texturePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = BitmapShader(pattern, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
            alpha = 40  // 15% 투명도 - 원본 색상 유지하면서 텍스처만 살짝
        }
        canvas.drawRect(0f, 0f, original.width.toFloat(), original.height.toFloat(), texturePaint)

        android.util.Log.d("PaintCanvas", "✨ Pre-baked 텍스처 적용 완료: ${original.width}x${original.height}")
        return result
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

    /**
     * 🖼️ 캔버스 캡처 - 현재 색칠된 상태를 이미지로 저장
     * @param size 출력 이미지 크기 (정사각형)
     * @return Base64 인코딩된 PNG 이미지 문자열
     */
    fun captureCanvas(size: Int = 512): String? {
        if (gridSize <= 0 || cells.isEmpty()) {
            android.util.Log.e("PaintCanvas", "❌ captureCanvas 실패: gridSize=$gridSize, cells=${cells.size}")
            return null
        }

        try {
            val captureSize = size.toFloat()
            val captureCellSize = captureSize / gridSize

            // 캡처용 비트맵 생성
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            // 흰색 배경
            canvas.drawColor(Color.WHITE)

            // 텍스트 크기 설정
            val captureTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.BLACK
                textAlign = Paint.Align.CENTER
                style = Paint.Style.FILL
                textSize = captureCellSize * 0.5f
            }
            val textYOffset = -(captureTextPaint.descent() + captureTextPaint.ascent()) / 2f

            // 모든 셀 그리기
            for (row in 0 until gridSize) {
                val top = row * captureCellSize
                val rowOffset = row * gridSize

                for (col in 0 until gridSize) {
                    val left = col * captureCellSize
                    val cellIndex = rowOffset + col

                    val cellColor = paintedColorMapInt[cellIndex]

                    if (cellColor != null) {
                        // 색칠된 셀 - 완성 모드에 따라 렌더링
                        drawCapturedCell(canvas, left, top, captureCellSize, cellColor, row, col)
                    } else {
                        // 미색칠 셀 - 흰색 배경에 라벨
                        canvas.drawRect(left, top, left + captureCellSize, top + captureCellSize, backgroundClearPaint)
                        val label = labelMapByIndex[cellIndex] ?: "A"
                        canvas.drawText(label, left + captureCellSize / 2f, top + captureCellSize / 2f + textYOffset, captureTextPaint)
                    }
                }
            }

            // Base64로 인코딩
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val base64String = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)

            bitmap.recycle()
            android.util.Log.d("PaintCanvas", "✅ 캔버스 캡처 완료: ${size}x${size}, base64 길이=${base64String.length}")

            return base64String
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ captureCanvas 예외: ${e.message}")
            return null
        }
    }

    /**
     * 📸 갤러리 썸네일 캡처 - 원본 이미지 위에 색칠된 부분만 오버레이
     * 참조 앱 스타일: 원본 사진이 배경, 색칠된 셀만 단색으로 표시
     * @param size 출력 이미지 크기 (정사각형)
     * @return Base64 인코딩된 PNG 이미지 문자열
     */
    fun captureThumbnail(size: Int = 256): String? {
        if (gridSize <= 0) {
            android.util.Log.e("PaintCanvas", "❌ captureThumbnail 실패: gridSize=$gridSize")
            return null
        }

        val bitmap = originalBitmap ?: backgroundBitmap
        if (bitmap == null) {
            android.util.Log.e("PaintCanvas", "❌ captureThumbnail 실패: 원본 비트맵 없음")
            return null
        }

        try {
            val captureSize = size.toFloat()
            val captureCellSize = captureSize / gridSize

            // 캡처용 비트맵 생성
            val outputBitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(outputBitmap)

            // 1단계: 원본 이미지를 배경으로 그리기
            val srcRect = Rect(0, 0, bitmap.width, bitmap.height)
            val dstRect = RectF(0f, 0f, captureSize, captureSize)
            canvas.drawBitmap(bitmap, srcRect, dstRect, reusableBitmapPaint)

            // 2단계: 색칠된 셀만 단색으로 오버레이
            val cellPaint = Paint().apply {
                style = Paint.Style.FILL
            }

            for (row in 0 until gridSize) {
                val top = row * captureCellSize
                val rowOffset = row * gridSize

                for (col in 0 until gridSize) {
                    val cellIndex = rowOffset + col
                    val cellColor = paintedColorMapInt[cellIndex]

                    if (cellColor != null) {
                        // 색칠된 셀 - 단색으로 표시
                        val left = col * captureCellSize
                        cellPaint.color = cellColor
                        canvas.drawRect(left, top, left + captureCellSize + 0.5f, top + captureCellSize + 0.5f, cellPaint)
                    }
                    // 미색칠 셀은 원본 이미지 그대로 (이미 배경에 그려짐)
                }
            }

            // Base64로 인코딩
            val outputStream = ByteArrayOutputStream()
            outputBitmap.compress(Bitmap.CompressFormat.PNG, 90, outputStream)
            val base64String = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)

            outputBitmap.recycle()
            android.util.Log.d("PaintCanvas", "📸 썸네일 캡처 완료: ${size}x${size}, 색칠된 셀=${paintedColorMapInt.size}")

            return base64String
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ captureThumbnail 예외: ${e.message}")
            return null
        }
    }

    /**
     * 캡처용 셀 렌더링 (완성 모드에 따라 다르게 처리)
     */
    private fun drawCapturedCell(canvas: Canvas, left: Float, top: Float, size: Float, color: Int, row: Int, col: Int) {
        if (completionMode == "ORIGINAL") {
            // ORIGINAL 모드: 원본 이미지 영역 복사
            val bitmap = originalBitmap ?: backgroundBitmap
            if (bitmap != null) {
                val srcCellWidth = bitmap.width.toFloat() / gridSize
                val srcCellHeight = bitmap.height.toFloat() / gridSize

                val srcLeft = (col * srcCellWidth).toInt()
                val srcTop = (row * srcCellHeight).toInt()
                val srcRight = ((col + 1) * srcCellWidth).toInt().coerceAtMost(bitmap.width)
                val srcBottom = ((row + 1) * srcCellHeight).toInt().coerceAtMost(bitmap.height)

                val srcRect = Rect(srcLeft, srcTop, srcRight, srcBottom)
                val dstRect = RectF(left, top, left + size, top + size)

                canvas.drawBitmap(bitmap, srcRect, dstRect, reusableBitmapPaint)
            } else {
                // 비트맵 없으면 단색
                reusableBgPaint.color = color
                canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
            }
        } else {
            // WEAVE 모드: 텍스처 합성
            val pattern = filledCellPatternBitmap
            if (pattern != null) {
                val texturedBitmap = filledCellTextureCache.getOrPut(color) {
                    createColoredTexture(pattern, color)
                }
                val srcRect = Rect(0, 0, texturedBitmap.width, texturedBitmap.height)
                val dstRect = RectF(left, top, left + size, top + size)
                canvas.drawBitmap(texturedBitmap, srcRect, dstRect, reusableBitmapPaint)
            } else {
                // 패턴 없으면 단색
                reusableBgPaint.color = color
                canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
            }
        }
    }

    // ⚡ 뷰 분리 시 코루틴 정리 및 진행 상황 저장
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        // 즉시 저장 (비동기 저장 취소하고 동기적으로 저장)
        saveJob?.cancel()
        saveProgressToPrefsSync()
        imageLoadScope.cancel()
        saveScope.cancel()
        android.util.Log.d("PaintCanvas", "🧹 View detached, progress saved, coroutine scopes cancelled")
    }

    // ====== 🔄 자동 저장/복원 기능 ======

    /**
     * SharedPreferences에서 저장된 진행 상황 복원
     */
    private fun loadProgressFromPrefs() {
        val gameId = currentGameId ?: return

        try {
            val json = prefs.getString(gameId, null) ?: return
            val data = JSONObject(json)

            val filledArray = data.optJSONArray("filledCells") ?: return
            val wrongArray = data.optJSONArray("wrongCells")

            // 기존 데이터 클리어
            filledCells.clear()
            filledCellIndices.clear()
            wrongPaintedCells.clear()
            wrongCellIndices.clear()

            // filledCells 복원
            for (i in 0 until filledArray.length()) {
                val cellKey = filledArray.getString(i)
                filledCells.add(cellKey)
                val idx = parseIndex(cellKey)
                if (idx >= 0) filledCellIndices.add(idx)
            }

            // wrongCells 복원
            if (wrongArray != null) {
                for (i in 0 until wrongArray.length()) {
                    val cellKey = wrongArray.getString(i)
                    wrongPaintedCells.add(cellKey)
                    val idx = parseIndex(cellKey)
                    if (idx >= 0) wrongCellIndices.add(idx)
                }
            }

            android.util.Log.d("PaintCanvas", "✅ 진행 상황 복원: filled=${filledCells.size}, wrong=${wrongPaintedCells.size}")
            invalidate()

        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ 진행 상황 복원 실패: ${e.message}")
        }
    }

    /**
     * 진행 상황을 SharedPreferences에 저장 (디바운스 적용)
     */
    private fun saveProgressToPrefs() {
        val gameId = currentGameId ?: return
        if (filledCells.isEmpty() && wrongPaintedCells.isEmpty()) return

        // 기존 저장 작업 취소
        saveJob?.cancel()

        // 1초 디바운스로 저장 (너무 자주 저장 방지)
        saveJob = saveScope.launch {
            delay(1000)
            saveProgressToPrefsSync()
        }
    }

    /**
     * 진행 상황을 동기적으로 저장 (뷰 분리 시 사용)
     */
    private fun saveProgressToPrefsSync() {
        val gameId = currentGameId ?: return
        if (filledCells.isEmpty() && wrongPaintedCells.isEmpty()) return

        try {
            val filledArray = JSONArray(filledCells.toList())
            val wrongArray = JSONArray(wrongPaintedCells.toList())

            val data = JSONObject().apply {
                put("filledCells", filledArray)
                put("wrongCells", wrongArray)
                put("timestamp", System.currentTimeMillis())
            }

            prefs.edit().putString(gameId, data.toString()).apply()
            android.util.Log.d("PaintCanvas", "💾 진행 상황 저장: $gameId (filled=${filledCells.size}, wrong=${wrongPaintedCells.size})")

        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ 진행 상황 저장 실패: ${e.message}")
        }
    }
}
