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
    private val onCanvasReady by EventDispatcher()
    private val onViewportChange by EventDispatcher()
    private val onNativeLog by EventDispatcher()

    // 🔧 Native 로그를 JS로 전달하는 헬퍼 함수
    private fun sendLog(tag: String, message: String) {
        android.util.Log.d(tag, message)
        onNativeLog(mapOf("tag" to tag, "message" to message))
    }

    // 🚀 초기화 완료 상태 추적
    private var isImageLoaded = false
    private var isProgressLoaded = false
    private var hasNotifiedReady = false

    /**
     * 🚀 첫 번째 성공적인 렌더링 완료 시 JS에 알림
     * onDraw에서 실제 캔버스가 그려진 후 호출됨
     * ⚡ 성능 개선: 이미지 로딩 완료 시 바로 알림 (진행 상황 복원은 백그라운드에서 계속)
     * → 로딩 오버레이가 빨리 사라져서 터치 응답이 빠름
     */
    private fun notifyCanvasReady() {
        // ⚡ 이미지 로딩 완료되면 바로 알림 (진행 상황 복원 대기 안 함)
        // 진행 상황 복원은 백그라운드에서 계속되고, 화면에 자연스럽게 반영됨
        if (!isImageLoaded) return

        if (!hasNotifiedReady) {
            hasNotifiedReady = true
            sendLog("PaintCanvas", "╔════════════════════════════════════════╗")
            sendLog("PaintCanvas", "║ 🚀 Canvas Ready! 이미지 로딩 완료       ║")
            sendLog("PaintCanvas", "║ filled=${filledCells.size}, wrong=${wrongPaintedCells.size}")
            sendLog("PaintCanvas", "║ maxZoom=$maxZoom, gridSize=$gridSize")
            sendLog("PaintCanvas", "╚════════════════════════════════════════╝")
            onCanvasReady(mapOf(
                "ready" to true,
                "filledCells" to filledCells.size,
                "wrongCells" to wrongPaintedCells.size,
                "wrongCellKeys" to wrongPaintedCells.toList()
            ))
        }
    }

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

    private var gridSize: Int = 60
    private var cells: List<CellData> = emptyList()
    private var selectedColorHex: String = "#FF0000"
    private var selectedLabel: String = "A"
    private var imageUri: String? = null
    private var textureUri: String? = null  // 🎨 텍스처 이미지 URI
    private var textureBitmap: Bitmap? = null  // 🎨 텍스처 비트맵
    private var currentTextureId: String? = null  // 🎨 현재 적용된 텍스처 ID (shader 재생성 판단용)
    private var isEraseMode: Boolean = false  // X 제거 모드

    // ⚡ 대형 그리드 최적화 모드 (GPU 부하 방지)
    // 100+ 그리드에서 텍스처/음영 효과를 간소화하여 RenderThread 크래시 방지
    private var isLargeGridMode: Boolean = false
    private val LARGE_GRID_THRESHOLD = 100  // 100x100 이상은 대형 그리드

    // ⚡ invalidate() 스로틀링 (빠른 색칠 시 RenderThread 크래시 방지)
    private var lastInvalidateTime = 0L
    private var pendingInvalidate = false
    private val invalidateHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val MIN_INVALIDATE_INTERVAL = 16L  // 최소 16ms 간격 (~60fps)

    /**
     * 스로틀링된 invalidate() - 빠른 연속 호출 방지
     * 대형 그리드에서 빠른 색칠 시 RenderThread 크래시를 방지
     */
    private fun throttledInvalidate() {
        val now = System.currentTimeMillis()
        val elapsed = now - lastInvalidateTime

        if (elapsed >= MIN_INVALIDATE_INTERVAL) {
            // 충분한 시간이 지났으면 즉시 invalidate
            lastInvalidateTime = now
            pendingInvalidate = false
            invalidate()
        } else if (!pendingInvalidate) {
            // 아직 시간이 안 됐으면 다음 프레임에 예약
            pendingInvalidate = true
            invalidateHandler.postDelayed({
                pendingInvalidate = false
                lastInvalidateTime = System.currentTimeMillis()
                invalidate()
            }, MIN_INVALIDATE_INTERVAL - elapsed)
        }
        // pendingInvalidate가 이미 true면 무시 (이미 예약됨)
    }

    fun setGridSize(value: Int) {
        android.util.Log.d("PaintCanvas", "📐 setGridSize called: $value, current canvasWidth=$canvasWidth")
        gridSize = value

        // ⚡ 대형 그리드 모드 설정 (GPU 부하 방지)
        isLargeGridMode = gridSize >= LARGE_GRID_THRESHOLD
        if (isLargeGridMode) {
            android.util.Log.d("PaintCanvas", "⚡ 대형 그리드 모드 활성화: ${gridSize}x${gridSize} (텍스처/음영 간소화)")
        }

        // Only recalculate cellSize, don't touch canvasWidth
        // canvasWidth should be set by setViewSize() from JavaScript
        cellSize = canvasWidth / gridSize

        // maxZoom은 JS의 maxZoomLevel prop으로 제어 (하드코딩 제거)
        // 기본값은 클래스 초기값(15f) 또는 JS에서 설정한 값 유지
        val zoomAt80Percent = maxZoom * 0.8f
        ZOOM_LEVELS = floatArrayOf(1f, zoomAt80Percent)
        android.util.Log.d("PaintCanvas", "📐 gridSize=$gridSize, maxZoom=$maxZoom")

        invalidate()
    }

    // 📱 JS에서 전달된 maxZoom 설정
    fun setMaxZoomLevel(level: Float) {
        if (level > 0f) {
            val roundedLevel = kotlin.math.round(level)
            android.util.Log.w("PaintCanvas", "📱 setMaxZoomLevel: raw=$level, rounded=$roundedLevel, scaleFactor=$scaleFactor")
            maxZoom = roundedLevel
            val zoomAt80Percent = maxZoom * 0.8f
            ZOOM_LEVELS = floatArrayOf(1f, zoomAt80Percent)
            applyCurrentZoom()
        }
    }

    // 📱 현재 maxZoom으로 즉시 줌 적용 (zoomTrigger prop에서 호출)
    fun applyCurrentZoom() {
        if (canvasWidth > 0 && canvasViewWidth > 0) {
            val targetScale = maxZoom.coerceIn(1f, maxZoom)
            val centerX = canvasViewWidth / 2f
            val centerY = canvasViewHeight / 2f
            translateX = centerX - (centerX - translateX) * (targetScale / scaleFactor)
            translateY = centerY - (centerY - translateY) * (targetScale / scaleFactor)
            scaleFactor = targetScale
            pendingViewportRestore = null
            applyBoundaries()
            syncZoomIndex()
            invalidate()
            android.util.Log.w("PaintCanvas", "📱 applyCurrentZoom: scaleFactor=$scaleFactor, maxZoom=$maxZoom")
        }
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
        // 🐛 추가 조건: 색칠된 셀이 있으면 더더욱 초기화 방지
        if (size == lastCellsSize && cells.isNotEmpty()) {
            android.util.Log.d("PaintCanvas", "⚡ setCells 스킵: 동일한 퍼즐 재진입 (size=$size, filled=${filledCells.size}, painted=${paintedColorMapInt.size})")
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
        // 🚀 초기화 상태 플래그 리셋 (새 퍼즐이므로 다시 로딩 필요)
        isImageLoaded = false
        isProgressLoaded = false
        hasNotifiedReady = false
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

            // 🎨 팔레트 색상을 parsedColorMap에 저장 (이미지 픽셀 대신 팔레트 사용)
            try {
                parsedColorMap[cellIndex] = android.graphics.Color.parseColor(targetColorHex)
            } catch (e: Exception) {
                parsedColorMap[cellIndex] = android.graphics.Color.WHITE
            }
        }

        cells = newCells
        pendingCellList = null

        // ⚡ 최적화: 셀 데이터 로드 후 선택된 라벨 캐시 재구축
        rebuildSelectedLabelCache()

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

        // 🔄 SharedPreferences에서 저장된 진행 상황 복원
        // gameId가 이미 설정되어 있고 아직 복원되지 않은 경우
        if (currentGameId != null && filledCells.isEmpty()) {
            android.util.Log.d("PaintCanvas", "🔄 setCells 완료 후 SharedPreferences 복원 시도: $currentGameId")
            loadProgressFromPrefs()
        }

        invalidate()
    }

    // ⚡ 파싱된 색상 캐시 (매번 Color.parseColor 호출 방지)
    private var cachedSelectedColorInt: Int = Color.RED

    // ⚡ 최적화: 선택된 라벨의 셀 인덱스 캐시 (onDraw에서 매 프레임 HashMap 조회 제거)
    private var selectedLabelIndicesCache: Set<Int>? = null

    fun setSelectedColor(colorHex: String) {
        if (selectedColorHex == colorHex) return  // ⚡ 변경 없으면 스킵
        selectedColorHex = colorHex
        // ⚡ 색상 변경 시 한 번만 파싱
        cachedSelectedColorInt = try { Color.parseColor(colorHex) } catch (e: Exception) { Color.RED }
    }

    fun setSelectedLabel(label: String) {
        if (selectedLabel == label) return  // ⚡ 변경 없으면 스킵
        selectedLabel = label
        // ⚡ 최적화: 선택된 라벨의 셀 인덱스 미리 계산 (onDraw 성능 향상)
        rebuildSelectedLabelCache()
        // postInvalidate()는 다음 프레임에 그리기를 예약 (UI 스레드 블록 방지)
        postInvalidate()
    }

    /**
     * ⚡ 선택된 라벨의 셀 인덱스 캐시 재구축
     * onDraw에서 매 프레임 labelMapByIndex 조회 → 캐시된 Set.contains() 조회로 변경
     */
    private fun rebuildSelectedLabelCache() {
        val label = selectedLabel
        selectedLabelIndicesCache = labelMapByIndex.filterValues { it == label }.keys.toHashSet()
    }

    fun setEraseMode(enabled: Boolean) {
        if (isEraseMode == enabled) return  // ⚡ 변경 없으면 스킵
        isEraseMode = enabled
        invalidate()
    }

    /**
     * 🔄 JS에서 전달받은 gameId 설정 (저장/복원용)
     * puzzleId 기반의 고유 ID를 사용하여 일관된 저장/복원 보장
     */
    fun setGameId(id: String) {
        if (currentGameId == id && !shouldClearProgress) return  // ⚡ 변경 없으면 스킵 (단, clearProgress 시 재처리)

        val oldId = currentGameId
        currentGameId = id
        android.util.Log.d("PaintCanvas", "🔄 gameId 설정 (from JS): $id (이전: $oldId, shouldClear: $shouldClearProgress)")

        // 🗑️ clearProgress 플래그가 설정되어 있으면 SharedPreferences 삭제
        if (shouldClearProgress) {
            prefs.edit().remove(id).commit()
            android.util.Log.d("PaintCanvas", "🗑️ setGameId에서 SharedPreferences 삭제: $id")
            // 플래그는 유지 (loadProgressFromPrefs에서도 체크)
        }

        // gameId가 설정되면 저장된 진행 상황 복원 시도
        // 단, 아직 사용자가 칠하지 않은 상태에서만 복원
        if (!hasUserPainted) {
            loadProgressFromPrefs()
        }
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
    private var imageLoadScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isImageLoading = false

    fun setImageUri(uri: String) {
        if (imageUri == uri && originalBitmap != null) {
            // 이미 같은 이미지가 로드되어 있으면 스킵
            android.util.Log.d("PaintCanvas", "⚡ 이미지 이미 로드됨, 스킵")
            return
        }

        // 🧹 새 이미지 로드 전 기존 Bitmap 해제 (OOM 방지)
        releaseImageBitmaps()

        imageUri = uri
        isImageLoading = true

        // 🔄 gameId는 JS에서 setGameId로 전달됨 (puzzleId 기반)
        // 하위 호환성: JS에서 gameId가 전달되지 않으면 파일명 기반으로 폴백
        if (currentGameId == null) {
            val fileName = uri.substringAfterLast("/").substringBeforeLast(".")
            currentGameId = "native_${fileName}_${gridSize}"
            android.util.Log.d("PaintCanvas", "🔄 gameId 폴백 생성: $currentGameId")
            loadProgressFromPrefs()
        }

        // 로딩 인디케이터 표시를 위해 먼저 그리기
        invalidate()

        // ⚡ 스코프가 취소된 상태면 재생성
        if (!imageLoadScope.isActive) {
            imageLoadScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        }

        // ⚡ 백그라운드에서 이미지 로드 (UI 블로킹 방지)
        imageLoadScope.launch {
            try {
                val startTime = System.currentTimeMillis()

                // 1. 이미지 로드 (IO 스레드)
                val loadedBitmap = loadBitmap(uri)

                val loadTime = System.currentTimeMillis() - startTime
                android.util.Log.d("PaintCanvas", "⚡ 이미지 로드: ${loadTime}ms")

                // 🎨 parsedColorMap은 setCells에서 팔레트 색상으로 이미 채워짐
                // 이미지 픽셀 색상 대신 팔레트 색상을 사용하여 일관성 유지

                // 메인 스레드에서 UI 업데이트 (텍스처는 나중에 적용)
                withContext(Dispatchers.Main) {
                    try {
                        originalBitmap = loadedBitmap
                        backgroundBitmap = loadedBitmap  // ⚡ 먼저 원본으로 표시

                        isImageLoading = false
                        isImageLoaded = true  // 🚀 이미지 로딩 완료 플래그
                        val totalTime = System.currentTimeMillis() - startTime
                        android.util.Log.d("PaintCanvas", "✨ 로딩 완료: ${totalTime}ms (${originalBitmap?.width}x${originalBitmap?.height})")
                        invalidate()  // onDraw에서 notifyCanvasReady 호출

                        // ⚡ 텍스처는 화면 표시 후 백그라운드에서 지연 적용
                        applyTextureInBackground(loadedBitmap)
                    } catch (e: Exception) {
                        android.util.Log.e("PaintCanvas", "❌ UI 업데이트 오류: ${e.message}")
                        isImageLoading = false
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PaintCanvas", "❌ 이미지 로드 오류: ${e.message}")
                withContext(Dispatchers.Main) {
                    isImageLoading = false
                    invalidate()
                }
            }
        }
    }

    // 🎨 사용자 선택 텍스처 URI 설정
    fun setTextureUri(uri: String?) {
        if (uri == null || uri.isEmpty() || uri == "null") {
            // 텍스처 비활성화 (기본 텍스처로 복원)
            if (textureUri != null) {
                textureUri = null
                textureBitmap?.recycle()
                textureBitmap = null
                baseTextureShader = null  // 🎨 shader 초기화
                currentTextureId = null
                squarePatternBitmap?.recycle()
                squarePatternBitmap = null
                android.util.Log.d("PaintCanvas", "🎨 텍스처 해제 → 기본 텍스처로 복원")

                // 이미지가 로드된 상태라면 텍스처 다시 적용
                originalBitmap?.let { applyTextureInBackground(it) }
                invalidate()  // 즉시 화면 갱신
            }
            return
        }

        if (textureUri == uri && textureBitmap != null && !textureBitmap!!.isRecycled) {
            android.util.Log.d("PaintCanvas", "🎨 동일한 텍스처, 스킵")
            return
        }

        textureUri = uri
        android.util.Log.d("PaintCanvas", "🎨 텍스처 URI 설정: $uri")

        // 백그라운드에서 텍스처 비트맵 로드
        imageLoadScope.launch {
            try {
                val loaded = loadBitmap(uri)
                withContext(Dispatchers.Main) {
                    textureBitmap?.recycle()
                    textureBitmap = loaded
                    baseTextureShader = null  // 🎨 shader 초기화 (새 텍스처로 재생성)
                    squarePatternBitmap?.recycle()
                    squarePatternBitmap = null
                    android.util.Log.d("PaintCanvas", "🎨 텍스처 비트맵 로드 완료: ${loaded?.width}x${loaded?.height}")

                    // 이미지가 로드된 상태라면 새 텍스처로 다시 적용
                    originalBitmap?.let { applyTextureInBackground(it) }
                    invalidate()  // 즉시 화면 갱신 (색칠된 셀에 새 텍스처 적용)
                }
            } catch (e: Exception) {
                android.util.Log.e("PaintCanvas", "❌ 텍스처 로드 실패: ${e.message}")
            }
        }
    }

    // ⚡ 텍스처 지연 적용 (로딩 완료 후 백그라운드에서)
    private fun applyTextureInBackground(bitmap: Bitmap?) {
        if (bitmap == null || bitmap.isRecycled) return

        // 🎨 사용자 선택 텍스처가 있으면 우선 사용, 없으면 기본 텍스처
        val pattern = textureBitmap ?: filledCellPatternBitmap
        if (pattern == null || pattern.isRecycled) {
            android.util.Log.d("PaintCanvas", "⚡ 텍스처 없음, 원본 이미지 유지")
            return
        }

        imageLoadScope.launch {
            try {
                val textured = applyTextureToOriginalImage(bitmap, pattern)
                withContext(Dispatchers.Main) {
                    if (!textured.isRecycled) {
                        backgroundBitmap = textured
                        invalidate()
                        android.util.Log.d("PaintCanvas", "🎨 텍스처 적용 완료 (사용자 선택: ${textureBitmap != null})")
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PaintCanvas", "❌ 텍스처 적용 오류: ${e.message}")
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
        android.util.Log.d("PaintCanvas", "🎨 setCompletionMode: '$mode' (현재: '$completionMode')")
        if (completionMode == mode) return  // ⚡ 변경 없으면 스킵
        completionMode = mode
        android.util.Log.d("PaintCanvas", "🎨 completionMode 변경됨: '$completionMode'")
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

    // 🚨 1x 배율에서 틀린 셀 깜빡임 애니메이션
    private var wrongCellFlashVisible = true
    private val wrongCellFlashHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val wrongCellFlashRunnable = object : Runnable {
        override fun run() {
            if (wrongCellIndices.isNotEmpty() && scaleFactor <= 1.5f) {
                wrongCellFlashVisible = !wrongCellFlashVisible
                invalidate()
                wrongCellFlashHandler.postDelayed(this, 400L)  // 400ms 간격
            }
        }
    }
    private var isFlashAnimationRunning = false

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

        // ⚡ 줌 기반 텍스처 활성화 임계값
        // 음영: 항상 표시 (줌 레벨 무관)
        // 텍스처: 사용자 선택 텍스처가 있으면 항상 표시, 기본 텍스처는 20% 줌 이상에서 표시
        private const val TEXTURE_VISIBLE_ZOOM_THRESHOLD = 0.2f  // 텍스처는 20%부터 (낮춤)
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
        color = Color.parseColor("#80505050") // 50% opacity darker gray
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

    // 🚨 1x 배율 틀린 셀 깜빡임용 Paint (재사용)
    private val wrongCellFlashFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.RED
        style = Paint.Style.FILL
        alpha = 200
    }
    private val wrongCellFlashStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }

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
    // 🐛 캡처 전용 Paint (안티앨리어싱/필터 비활성화 → 격자선 방지)
    private val captureBitmapPaint = Paint().apply {
        isFilterBitmap = false
        isAntiAlias = false
        isDither = false
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
    private var lastMultiTouchEndTime = 0L  // 🐛 두 손가락 제스처 종료 시간 (색칠 차단용)
    private var wasMultiTouchInSession = false  // 🐛 이번 터치 세션에서 두 손가락 사용 여부
    private var pendingViewportRestore: Triple<Float, Float, Float>? = null  // 🔍 복원할 뷰포트 (scale, tx, ty)

    // 완성 모드: "ORIGINAL" = 원본 이미지 표시, "WEAVE" = 위빙 텍스처 유지
    private var completionMode = "ORIGINAL"

    // 3-step zoom levels: 1x ↔ 80% ↔ 100%
    private var ZOOM_LEVELS = floatArrayOf(1f, 12f, 15f)  // 1x, 80% (12x), 100% (15x)
    private var maxZoom = 9f  // 기본값, JS maxZoomLevel prop으로 변경됨
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

    // 🎯 핀치 줌
    private var isPinching = false
    private var pinchStartScale = 1f
    private var pinchStartSpan = 0f
    private var isPanningOnly = false
    private var initialSpanForPanCheck = 0f
    private var isSingleFingerPanning = false
    private var scaleGestureStartTime = 0L
    private var lastStepZoomTime = 0L
    private val STEP_ZOOM_COOLDOWN = 150L

    // 🎬 줌 애니메이션
    private var zoomAnimator: ValueAnimator? = null
    private val ZOOM_ANIMATION_DURATION = 80L

    // 📱 더블탭 감지
    private var lastSingleTapTime = 0L
    private var lastSingleTapX = 0f
    private var lastSingleTapY = 0f
    private val DOUBLE_TAP_TIMEOUT = 300L  // 더블탭 간격 (ms)
    private val DOUBLE_TAP_SLOP = 80f      // 더블탭 허용 이동 거리 (px)

    // 📱 더블탭+홀드 연속 줌
    private var isDoubleTapHoldZoom = false  // 더블탭+홀드 줌 모드
    private var doubleTapHoldStartY = 0f    // 홀드 시작 Y 위치
    private var doubleTapHoldStartScale = 0f // 홀드 시작 스케일
    private var doubleTapFocusX = 0f         // 더블탭 포커스 X
    private var doubleTapFocusY = 0f         // 더블탭 포커스 Y

    // ⚡ 프레임 레이트 제한 - throttledInvalidate()에서 사용
    // (변수 선언은 클래스 상단으로 이동됨: lastInvalidateTime, MIN_INVALIDATE_INTERVAL)

    private var onScaleCallCount = 0  // onScale 호출 횟수 추적

    private val scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            onScaleCallCount++
            if (pinchStartSpan <= 0f || initialSpanForPanCheck <= 0f) return true
            // 스텝 줌 전용: onScale에서는 줌 안 함 (onScaleEnd에서 처리)
            return true
        }

        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            onScaleCallCount = 0
            touchMode = TouchMode.ZOOM
            isPinching = true
            pinchStartScale = scaleFactor
            pinchStartSpan = detector.currentSpan
            scaleGestureStartTime = System.currentTimeMillis()
            zoomAnimator?.cancel()
            // ⚡ 최적화: 로그 제거
            return true
        }

        override fun onScaleEnd(detector: ScaleGestureDetector) {
            // 🎯 핀치 → 스텝 줌 (확실한 핀치만 감지: 30% 이상 변화)
            val spanRatio = if (pinchStartSpan > 0f) detector.currentSpan / pinchStartSpan else 1f
            when {
                spanRatio > 1.30f -> stepZoom(detector.focusX, detector.focusY, zoomIn = true)
                spanRatio < 0.70f -> stepZoom(detector.focusX, detector.focusY, zoomIn = false)
            }
            touchMode = TouchMode.NONE
            isPinching = false
            isPanningOnly = false
            initialSpanForPanCheck = 0f
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

    // Step zoom: 1x → 중간 → maxZoom (동적 3단계)
    private fun stepZoom(focusX: Float, focusY: Float, zoomIn: Boolean = true) {
        val now = System.currentTimeMillis()
        val timeSinceLastZoom = now - lastStepZoomTime

        // 🐛 쿨다운 체크: 300ms 내 중복 호출 방지
        if (timeSinceLastZoom < STEP_ZOOM_COOLDOWN) return
        lastStepZoomTime = now

        // maxZoom 기준 동적 레벨: 1x → 중간(50%) → maxZoom
        val mid = maxZoom * 0.5f
        val levels = floatArrayOf(1f, mid, maxZoom)

        // 현재 스케일에 가장 가까운 레벨 인덱스 찾기
        var closestIdx = 0
        var minDiff = Float.MAX_VALUE
        for (i in levels.indices) {
            val diff = kotlin.math.abs(scaleFactor - levels[i])
            if (diff < minDiff) {
                minDiff = diff
                closestIdx = i
            }
        }

        val targetIdx = if (zoomIn) {
            (closestIdx + 1).coerceAtMost(levels.size - 1)
        } else {
            (closestIdx - 1).coerceAtLeast(0)
        }

        val targetScale = levels[targetIdx]
        if (kotlin.math.abs(targetScale - scaleFactor) < 0.1f) return
        currentZoomIndex = targetIdx
        animateZoomTo(targetScale, focusX, focusY)
    }

    // 🚨 틀린 셀 깜빡임 애니메이션 시작
    private fun startWrongCellFlashAnimation() {
        if (!isFlashAnimationRunning && wrongCellIndices.isNotEmpty()) {
            isFlashAnimationRunning = true
            wrongCellFlashHandler.postDelayed(wrongCellFlashRunnable, 400L)
        }
    }

    // 🚨 틀린 셀 깜빡임 애니메이션 중지
    private fun stopWrongCellFlashAnimation() {
        if (isFlashAnimationRunning) {
            isFlashAnimationRunning = false
            wrongCellFlashHandler.removeCallbacks(wrongCellFlashRunnable)
            wrongCellFlashVisible = true
        }
    }

    /**
     * 🎬 부드러운 줌 애니메이션
     * @param targetScale 목표 스케일
     * @param focusX 줌 포커스 X 좌표
     * @param focusY 줌 포커스 Y 좌표
     */
    private fun animateZoomTo(targetScale: Float, focusX: Float, focusY: Float) {
        if (kotlin.math.abs(targetScale - scaleFactor) < 0.01f) return

        val startScale = scaleFactor
        val startTranslateX = translateX
        val startTranslateY = translateY
        zoomAnimator?.cancel()

        // 목표 위치 계산
        val targetTranslateX: Float
        val targetTranslateY: Float

        if (targetScale == 1f) {
            targetTranslateX = (canvasViewWidth - canvasWidth) / 2f
            targetTranslateY = (canvasViewHeight - canvasWidth) / 2f
        } else {
            val scaleDelta = targetScale / startScale
            targetTranslateX = focusX - (focusX - translateX) * scaleDelta
            targetTranslateY = focusY - (focusY - translateY) * scaleDelta
        }

        // ⚡ 즉시 적용 (단계가 보이지 않도록)
        scaleFactor = targetScale
        translateX = targetTranslateX
        translateY = targetTranslateY
        applyBoundaries()
        invalidate()
    }

    init {
        setWillNotDraw(false)
        cellSize = canvasWidth / gridSize
        // ⚡ 하드웨어 가속 활성화 (GPU 렌더링)
        setLayerType(LAYER_TYPE_HARDWARE, null)
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
            // 🔍 저장된 뷰포트 위치가 있으면 복원, 없으면 기본값
            val viewport = pendingViewportRestore
            if (viewport != null) {
                scaleFactor = viewport.first
                translateX = viewport.second
                translateY = viewport.third
                syncZoomIndex()  // zoomIndex 동기화
                applyBoundaries()  // 경계 보정
                pendingViewportRestore = null
                android.util.Log.d("PaintCanvas", "🔍 뷰포트 복원 완료: scale=$scaleFactor, tx=$translateX, ty=$translateY")
            } else {
                // 첫 초기화 - 1x (전체 보기)에서 시작
                scaleFactor = 1f
                currentZoomIndex = 0
                translateX = (canvasViewWidth - canvasWidth) / 2f
                translateY = (canvasViewHeight - canvasWidth) / 2f
                android.util.Log.d("PaintCanvas", "📐 First init: zoom=1x (전체 보기)")
            }
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
        try {

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

            // 다음 프레임 요청 (애니메이션) - 30fps로 배터리 절약
            postInvalidateDelayed(33)  // ~30fps
            return
        }

        // 안전 체크: 캔버스 뷰 크기가 유효하지 않으면 그리지 않음
        // ⚡ 최적화: cells가 아직 로드되지 않아도 뷰 크기만 있으면 줌/팬 허용
        if (canvasViewWidth <= 0 || canvasViewHeight <= 0) {
            android.util.Log.w("PaintCanvas", "⚠️ onDraw skipped: view not sized yet")
            return
        }

        // cellSize가 0이면 아직 cells가 로드되지 않은 상태 - 배경만 그리기
        if (canvasWidth <= 0 || cellSize <= 0 || gridSize <= 0) {
            // 로딩 중 메시지 (JS 로딩 오버레이와 별개로 Native에서도 표시)
            val centerX = width / 2f
            val centerY = height / 2f
            canvas.drawColor(Color.parseColor("#1A3A4A"))  // 앱 배경색
            canvas.drawText("준비 중...", centerX, centerY, loadingTextPaint)
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
        val shouldDrawText = screenCellSize > 12f  // 12dp 이상일 때만

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
                var cellColor = paintedColorMapInt[cellIndex]

                // 🐛 버그 수정: filledCellIndices에 있는데 paintedColorMapInt에 없으면 정답 색상 사용
                // (복원 시 색상 정보가 없어도 정답 셀로 표시)
                if (cellColor == null && filledCellIndices.contains(cellIndex)) {
                    cellColor = parsedColorMap[cellIndex] ?: Color.WHITE
                }

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
                        // ⚡ 최적화: 캐시된 인덱스 Set으로 하이라이트 체크 (HashMap 조회 제거)
                        val isHighlighted = selectedLabelIndicesCache?.contains(cellIndex) == true
                        if (isHighlighted) {
                            canvas.drawRect(left, top, left + cellSizePlusHalf, top + cellSizePlusHalf, highlightPaint)
                        }

                        // 알파벳 - labelMapByIndex는 여전히 조회 필요 (라벨 텍스트 표시용)
                        val label = labelMapByIndex[cellIndex]
                        canvas.drawText(label ?: "A", left + halfCellSize, top + halfCellSize + textYOffset, textPaint)
                    }
                }
            }
        }

        // 3. Draw grid - 격자선 제거 (셀 사이 공백 없음)

        // 🚨 1x 배율에서 틀린 셀 빨간 원으로 깜빡임 표시
        if (wrongCellIndices.isNotEmpty() && scaleFactor <= 1.5f && wrongCellFlashVisible) {
            for (cellIndex in wrongCellIndices) {
                val row = cellIndex / gridSize
                val col = cellIndex % gridSize
                val centerX = col * cellSize + cellSize / 2
                val centerY = row * cellSize + cellSize / 2
                val radius = cellSize * 1.5f  // 셀보다 큰 원

                canvas.drawCircle(centerX, centerY, radius, wrongCellFlashFillPaint)
                canvas.drawCircle(centerX, centerY, radius, wrongCellFlashStrokePaint)
            }
            startWrongCellFlashAnimation()
        } else if (wrongCellIndices.isEmpty()) {
            stopWrongCellFlashAnimation()
        }

        canvas.restore()

        // 🚀 첫 번째 성공적인 렌더링 완료 시 JS에 알림
        notifyCanvasReady()

        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ onDraw 오류: ${e.message}")
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        try {
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
                touchStartX = event.x
                touchStartY = event.y
                activePointerId = event.getPointerId(0)
                preventPaintOnce = isPinching || touchMode == TouchMode.ZOOM
                allowPainting = false
                touchDownTime = System.currentTimeMillis()
                hasMoved = false
                wasMultiTouchInSession = false
                isSingleFingerPanning = false

                // 더블탭 확대 제거됨 - 줌은 핀치 + UI 버튼으로만 조작
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                preventPaintOnce = true
                allowPainting = false
                wasMultiTouchInSession = true

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

                    val dx = event.getX(0) - event.getX(1)
                    val dy = event.getY(0) - event.getY(1)
                    initialSpanForPanCheck = kotlin.math.sqrt(dx * dx + dy * dy)
                    isPanningOnly = false

                    // 두 손가락은 핀치 줌 + 팬만 처리
                }
            }

            MotionEvent.ACTION_MOVE -> {
                when (event.pointerCount) {
                    1 -> {
                        // 🐛 두 손가락이 한 번이라도 사용되었으면 이 세션 동안 색칠 완전 차단
                        if (wasMultiTouchInSession) {
                            val dx = event.x - lastTouchX
                            val dy = event.y - lastTouchY
                            lastTouchX = event.x
                            lastTouchY = event.y
                            return true
                        }

                        val timeSinceMultiTouch = System.currentTimeMillis() - lastMultiTouchEndTime
                        val isMultiTouchCooldown = timeSinceMultiTouch < 600L

                        if (!preventPaintOnce && !isPinching && touchMode != TouchMode.ZOOM && !isMultiTouchCooldown) {
                            val timeSinceDown = System.currentTimeMillis() - touchDownTime
                            val dx = event.x - touchStartX
                            val dy = event.y - touchStartY
                            val distance = kotlin.math.sqrt(dx * dx + dy * dy)

                            // 색칠 시작: 30ms 대기 또는 8px 이동
                            if (timeSinceDown >= 30L || distance > 8f) {
                                allowPainting = true
                                handlePainting(event.x, event.y)
                                // hasMoved는 실제 이동이 있을 때만 (탭 감지용 - 15px 이상)
                                if (distance > 15f) hasMoved = true
                            } else if (allowPainting) {
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

                        // 🎯 팬 이동 거리 추적 (stepZoom 차단용, 핀치 줌은 항상 허용)
                        val panDistanceFromStart = kotlin.math.sqrt(
                            (centroidX - twoFingerStartX) * (centroidX - twoFingerStartX) +
                            (centroidY - twoFingerStartY) * (centroidY - twoFingerStartY)
                        )
                        if (panDistanceFromStart > 150f && !isPanningOnly) {
                            isPanningOnly = true  // stepZoom 차단 (핀치 줌은 계속 작동)
                        }

                        // ⚡ 확대 시 팬 속도 1.8배 (확대할수록 빠르게 이동)
                        val panMultiplier = if (scaleFactor > 3f) 1.8f else 1f
                        translateX += dx * panMultiplier
                        translateY += dy * panMultiplier

                        lastTouchX = centroidX
                        lastTouchY = centroidY
                        twoFingerLastX = centroidX
                        twoFingerLastY = centroidY

                        applyBoundaries()
                        // ⚡ 최적화: 팬 중 스로틀링된 invalidate (60fps 제한)
                        throttledInvalidate()
                    }
                    else -> {
                        preventPaintOnce = true
                        allowPainting = false
                    }
                }
            }

            MotionEvent.ACTION_UP -> {
                val now = System.currentTimeMillis()
                val timeSinceDown = now - touchDownTime
                val timeSinceMultiTouch = now - lastMultiTouchEndTime
                val isMultiTouchCooldown = timeSinceMultiTouch < 600L

                if (!preventPaintOnce && !isPinching && touchMode != TouchMode.ZOOM && !isMultiTouchCooldown && !wasMultiTouchInSession && timeSinceDown < 300L && !hasMoved) {
                    handlePainting(event.x, event.y)
                }

                touchMode = TouchMode.NONE
                activePointerId = -1
                preventPaintOnce = false
                allowPainting = false
                hasMoved = false
                isPanningOnly = false
                isSingleFingerPanning = false
                initialSpanForPanCheck = 0f

                lastPaintedCellIndex = -1
                lastPaintedRow = -1
                lastPaintedCol = -1
                flushEraseEvents()
                flushPendingEventsWithColor()
            }

            MotionEvent.ACTION_POINTER_UP -> {
                if (event.pointerCount == 2) {
                    val now = System.currentTimeMillis()
                    val twoFingerDuration = now - twoFingerTapStartTime
                    val panDist = kotlin.math.sqrt(
                        (twoFingerLastX - twoFingerStartX) * (twoFingerLastX - twoFingerStartX) +
                        (twoFingerLastY - twoFingerStartY) * (twoFingerLastY - twoFingerStartY)
                    )
                    val spanRatio = if (pinchStartSpan > 0f) {
                        val dx = event.getX(0) - event.getX(1)
                        val dy = event.getY(0) - event.getY(1)
                        val endSpan = kotlin.math.sqrt(dx * dx + dy * dy)
                        endSpan / pinchStartSpan
                    } else 1f
                    val isQuickTap = twoFingerDuration < 400L && panDist < 80f && spanRatio > 0.85f && spanRatio < 1.15f

                    touchMode = TouchMode.NONE
                    preventPaintOnce = true
                    allowPainting = false
                    lastMultiTouchEndTime = now
                    isPanningOnly = false
                    initialSpanForPanCheck = 0f
                    syncZoomIndex()
                }
            }

            MotionEvent.ACTION_CANCEL -> {
                touchMode = TouchMode.NONE
                activePointerId = -1
                hasMoved = false
                isPanningOnly = false  // 🐛 팬 모드 리셋
                isSingleFingerPanning = false  // 🐛 한 손가락 팬 모드 리셋
                initialSpanForPanCheck = 0f
            }
        }

        return true
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ onTouchEvent 오류: ${e.message}")
            return true
        }
    }

    // ⚡ 연속 색칠 최적화: 마지막으로 칠한 셀 추적 (Int 인덱스로 변경)
    private var lastPaintedCellIndex: Int = -1
    private var lastPaintedRow: Int = -1
    private var lastPaintedCol: Int = -1

    // ⚡ 배치 이벤트 전송을 위한 runnable (색상 포함 이벤트용)
    private var batchEventRunnable: Runnable? = null

    // ⚡ X 제거용 별도 큐와 runnable (일반 색칠 큐와 충돌 방지)
    private val pendingEraseEvents = mutableListOf<Triple<Int, Int, Boolean>>()
    private var eraseEventRunnable: Runnable? = null

    // ⚡ 재사용 가능한 객체들 (handlePainting에서 매번 생성하지 않음)
    private val paintingMatrix = Matrix()
    private val paintingInverseMatrix = Matrix()
    private val paintingPoints = FloatArray(2)

    private fun handlePainting(screenX: Float, screenY: Float) {
        try {
            // Safety check - don't paint if not initialized or still loading
            if (cellSize <= 0f || canvasWidth <= 0f) return
            if (isImageLoading) return  // ⚡ 이미지 로딩 중 색칠 차단

            // 🔒 확대율 60% 미만에서는 색칠 차단
            val zoomPercent = (scaleFactor / maxZoom) * 100f
            if (zoomPercent < 60f) return

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

            // ⚡ 색칠 시 즉시 화면 갱신 (딜레이 제거)
            // 대형 그리드에서만 스로틀링 (RenderThread 크래시 방지)
            if (isLargeGridMode) {
                throttledInvalidate()
            } else {
                invalidate()
            }

            lastPaintedCellIndex = cellIndex
            lastPaintedRow = row
            lastPaintedCol = col
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ handlePainting 오류: ${e.message}")
        }
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
        try {
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
                    // ⚡ X 제거 전용 큐 사용 (일반 색칠 큐와 충돌 방지)
                    // 🔄 저장은 flushEraseEvents에서 배치로 처리 (매 셀마다 호출 제거)
                    queueEraseEvent(row, col, true)
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

        // ⚠️ 라벨 맵에 없는 셀은 색칠 불가 (데이터 로드 전 또는 유효하지 않은 셀)
        if (cellLabel == null) {
            android.util.Log.w("PaintCanvas", "⚠️ 셀($row, $col) 라벨 없음 - 색칠 스킵")
            return
        }

        val isCorrect = cellLabel == selectedLabel

        // ⚡ 캐시된 색상 사용 (Color.parseColor 호출 제거)
        val parsedSelectedColor = cachedSelectedColorInt

        // ✅ 사용자가 색칠 시작함 표시 (이후 JS 업데이트 무시)
        hasUserPainted = true

        // 🔍 마지막 색칠 위치 저장 (앱 재시작 시 자동 이동용)
        lastPaintedCellIndex = cellIndex

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

        // 🔄 저장은 flushPendingEventsWithColor에서 배치로 처리 (매 셀마다 호출 제거)
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ paintSingleCell 오류: ${e.message}")
        }
    }

    // ⚡ 색상 정보 포함 이벤트 큐잉 (String 생성 지연)
    private data class PaintEvent(val row: Int, val col: Int, val isCorrect: Boolean, val color: Int)
    private val pendingPaintEventsWithColor = mutableListOf<PaintEvent>()
    private val MAX_PENDING_EVENTS = 500  // ⚡ OOM 방지: 이벤트 큐 크기 제한

    private fun queuePaintEventWithColor(row: Int, col: Int, isCorrect: Boolean, color: Int) {
        // ⚡ OOM 방지: 큐가 너무 커지면 즉시 플러시
        if (pendingPaintEventsWithColor.size >= MAX_PENDING_EVENTS) {
            flushPendingEventsWithColor()
        }

        pendingPaintEventsWithColor.add(PaintEvent(row, col, isCorrect, color))

        // 이미 예약된 배치 전송이 있으면 이벤트만 추가
        if (batchEventRunnable != null) return

        // ⚡ 200ms 후 JS 이벤트 배치 전송 (JS 리렌더링 빈도 낮춰 Native 렌더링 우선)
        batchEventRunnable = Runnable {
            flushPendingEventsWithColor()
        }
        postDelayed(batchEventRunnable, 200)
    }

    private fun flushPendingEventsWithColor() {
        try {
            batchEventRunnable?.let { removeCallbacks(it) }
            batchEventRunnable = null

            if (pendingPaintEventsWithColor.isEmpty()) return

            // ⚡ 리스트 복사 후 순회 (ConcurrentModificationException 방지)
            val eventsCopy = pendingPaintEventsWithColor.toList()
            pendingPaintEventsWithColor.clear()

            // ⚡ 배치로 String 맵 업데이트 및 JS 이벤트 전송
            for (event in eventsCopy) {
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

            // 🔄 배치 처리 완료 후 한 번만 저장 (디바운스 적용)
            saveProgressToPrefs()
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ flushPendingEventsWithColor 오류: ${e.message}")
        }
    }

    // ⚡ X 제거 이벤트 전용 큐 (일반 색칠 큐와 분리하여 충돌 방지)
    private fun queueEraseEvent(row: Int, col: Int, isCorrect: Boolean) {
        // ⚡ OOM 방지: 큐가 너무 커지면 즉시 플러시
        if (pendingEraseEvents.size >= MAX_PENDING_EVENTS) {
            flushEraseEvents()
        }

        pendingEraseEvents.add(Triple(row, col, isCorrect))

        // 이미 예약된 배치 전송이 있으면 이벤트만 추가
        if (eraseEventRunnable != null) return

        // ⚡ 50ms 후 JS 이벤트 배치 전송 (X 제거는 빠른 피드백 필요)
        eraseEventRunnable = Runnable {
            flushEraseEvents()
        }
        postDelayed(eraseEventRunnable, 50)
    }

    // ⚡ X 제거 이벤트 즉시 처리
    private fun flushEraseEvents() {
        try {
            // 타이머 취소
            eraseEventRunnable?.let { removeCallbacks(it) }
            eraseEventRunnable = null

            if (pendingEraseEvents.isEmpty()) return

            // ⚡ 리스트 복사 후 순회 (ConcurrentModificationException 방지)
            val eventsCopy = pendingEraseEvents.toList()
            pendingEraseEvents.clear()

            // JS 이벤트 배치 전송 (UI는 이미 업데이트됨)
            for ((r, c, correct) in eventsCopy) {
                sendCellPaintedEvent(r, c, correct)
            }

            // 🔄 배치 처리 완료 후 한 번만 저장
            saveProgressToPrefs()
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ flushEraseEvents 오류: ${e.message}")
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

        // 🗺️ 뷰포트 변경 이벤트 전송 (미니맵용)
        sendViewportChangeEvent()
    }

    private fun sendCellPaintedEvent(row: Int, col: Int, correct: Boolean) {
        onCellPainted(mapOf(
            "row" to row,
            "col" to col,
            "correct" to correct
        ))
    }

    /**
     * 🗺️ 뷰포트 변경 이벤트 전송 (미니맵용)
     * 현재 보이는 영역의 위치와 크기를 0~1 비율로 전달
     */
    private fun sendViewportChangeEvent() {
        if (canvasWidth <= 0 || canvasViewWidth <= 0) return

        val scaledCanvasWidth = canvasWidth * scaleFactor
        val scaledCanvasHeight = canvasWidth * scaleFactor  // Square canvas

        // 캔버스 전체 대비 현재 뷰포트의 비율 계산
        // viewportX/Y: 현재 보이는 영역의 시작점 (0~1)
        // viewportWidth/Height: 현재 보이는 영역의 크기 (0~1)

        val viewportX = if (scaledCanvasWidth <= canvasViewWidth) {
            0f  // 캔버스가 뷰보다 작으면 전체 보임
        } else {
            (-translateX / scaledCanvasWidth).coerceIn(0f, 1f)
        }

        val viewportY = if (scaledCanvasHeight <= canvasViewHeight) {
            0f
        } else {
            (-translateY / scaledCanvasHeight).coerceIn(0f, 1f)
        }

        val viewportWidth = if (scaledCanvasWidth <= canvasViewWidth) {
            1f  // 전체 보임
        } else {
            (canvasViewWidth / scaledCanvasWidth).coerceIn(0f, 1f)
        }

        val viewportHeight = if (scaledCanvasHeight <= canvasViewHeight) {
            1f
        } else {
            (canvasViewHeight / scaledCanvasHeight).coerceIn(0f, 1f)
        }

        onViewportChange(mapOf(
            "viewportX" to viewportX,
            "viewportY" to viewportY,
            "viewportWidth" to viewportWidth,
            "viewportHeight" to viewportHeight,
            "scale" to scaleFactor
        ))
    }

    /**
     * 🗺️ 미니맵에서 터치한 위치로 뷰포트 이동
     * @param targetX 목표 X 위치 (0~1 비율, 뷰포트 중심 기준)
     * @param targetY 목표 Y 위치 (0~1 비율, 뷰포트 중심 기준)
     * @param zoom 목표 줌 레벨 (null이면 현재 줌 유지)
     */
    fun setViewportPosition(targetX: Float, targetY: Float, zoom: Float? = null) {
        if (canvasWidth <= 0 || canvasViewWidth <= 0) return

        // 🎯 줌 레벨이 지정되면 먼저 적용
        if (zoom != null && zoom > 0) {
            scaleFactor = zoom.coerceIn(1f, maxZoom)
        }

        val scaledCanvasWidth = canvasWidth * scaleFactor
        val scaledCanvasHeight = canvasWidth * scaleFactor  // Square canvas

        // 현재 뷰포트 크기 계산
        val viewportWidth = if (scaledCanvasWidth <= canvasViewWidth) 1f
            else (canvasViewWidth / scaledCanvasWidth).coerceIn(0f, 1f)
        val viewportHeight = if (scaledCanvasHeight <= canvasViewHeight) 1f
            else (canvasViewHeight / scaledCanvasHeight).coerceIn(0f, 1f)

        // 뷰포트 중심을 터치 위치로 이동 (터치 위치가 뷰포트 중심이 되도록)
        val centerX = (targetX - viewportWidth / 2f).coerceIn(0f, 1f - viewportWidth)
        val centerY = (targetY - viewportHeight / 2f).coerceIn(0f, 1f - viewportHeight)

        // translateX/Y 계산 (비율 → 실제 좌표)
        translateX = -centerX * scaledCanvasWidth
        translateY = -centerY * scaledCanvasHeight

        // 경계 적용 및 이벤트 전송
        applyBoundaries()
        invalidate()
    }

    private fun loadBitmap(uriString: String): Bitmap? {
        return try {
            android.util.Log.d("PaintCanvas", "🖼️ loadBitmap 시작: $uriString")

            // HTTP/HTTPS URL 처리 (Metro bundler에서 제공하는 asset 등)
            if (uriString.startsWith("http://") || uriString.startsWith("https://")) {
                android.util.Log.d("PaintCanvas", "🌐 HTTP URL 감지, URL에서 직접 로드")
                return loadBitmapFromUrl(uriString)
            }

            // 🎨 Release 빌드: drawable:// 또는 asset:// URI 처리
            // React Native Release 빌드에서 Image.resolveAssetSource()는 drawable:// 형식 반환
            if (uriString.startsWith("drawable://")) {
                android.util.Log.d("PaintCanvas", "🎨 drawable:// URI 감지, 리소스에서 로드")
                return loadBitmapFromDrawable(uriString)
            }

            // 🎨 Release 빌드: file:///android_asset/ 형식 처리
            if (uriString.startsWith("file:///android_asset/")) {
                android.util.Log.d("PaintCanvas", "🎨 android_asset URI 감지, assets에서 로드")
                val assetPath = uriString.removePrefix("file:///android_asset/")
                return context.assets.open(assetPath).use { stream ->
                    BitmapFactory.decodeStream(stream)
                }
            }

            // 🎨 Release 빌드: asset:// 형식 처리
            if (uriString.startsWith("asset://")) {
                android.util.Log.d("PaintCanvas", "🎨 asset:// URI 감지, assets에서 로드")
                val assetPath = uriString.removePrefix("asset://")
                return context.assets.open(assetPath).use { stream ->
                    BitmapFactory.decodeStream(stream)
                }
            }

            // 🎨 Release 빌드: assets_textures_* 형식 처리 (React Native bundled assets)
            // 예: assets_textures_animal_02_dog → drawable 리소스로 로드
            if (uriString.startsWith("assets_") || uriString.matches(Regex("^[a-z_0-9]+$"))) {
                android.util.Log.d("PaintCanvas", "🎨 Bundled asset 이름 감지: $uriString")
                return loadBitmapFromDrawable("drawable://$uriString")
            }

            val uri = Uri.parse(uriString)

            // ⚡ 최적화: GenerateScreen에서 이미 최적화된 이미지는 그대로 로드
            // 기존 퍼즐(1024px) 호환성을 위해 런타임 체크는 유지
            // 대형 그리드: 384px로 축소 (메모리 40% 추가 절약)
            val maxSize = if (gridSize >= 100) 384 else 1024

            // 1단계: 이미지 크기 확인
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, options)
            }

            val originalWidth = options.outWidth
            val originalHeight = options.outHeight

            // ⚡ 이미 최적화된 이미지면 그대로 로드 (리사이즈 스킵)
            if (originalWidth <= maxSize && originalHeight <= maxSize) {
                android.util.Log.d("PaintCanvas", "⚡ 이미 최적화된 이미지: ${originalWidth}x${originalHeight} (리사이즈 스킵)")
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    BitmapFactory.decodeStream(stream)
                }
            } else {
                // 기존 퍼즐 호환: 큰 이미지는 런타임에 리사이즈
                android.util.Log.d("PaintCanvas", "📐 레거시 이미지 리사이즈: ${originalWidth}x${originalHeight} → ${maxSize}px")

                val sampleSize = calculateInSampleSize(originalWidth, originalHeight, maxSize)
                val loadOptions = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                }

                context.contentResolver.openInputStream(uri)?.use { stream ->
                    BitmapFactory.decodeStream(stream, null, loadOptions)
                }?.let { bitmap ->
                    if (bitmap.width > maxSize || bitmap.height > maxSize) {
                        val scale = maxSize.toFloat() / maxOf(bitmap.width, bitmap.height)
                        val newWidth = (bitmap.width * scale).toInt()
                        val newHeight = (bitmap.height * scale).toInt()
                        val scaled = Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
                        if (scaled != bitmap) bitmap.recycle()
                        scaled
                    } else {
                        bitmap
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun calculateInSampleSize(width: Int, height: Int, maxSize: Int): Int {
        var inSampleSize = 1
        if (width > maxSize || height > maxSize) {
            val halfWidth = width / 2
            val halfHeight = height / 2
            while ((halfWidth / inSampleSize) >= maxSize && (halfHeight / inSampleSize) >= maxSize) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }

    /**
     * HTTP/HTTPS URL에서 비트맵 로드 (Metro bundler asset 등)
     */
    private fun loadBitmapFromUrl(urlString: String): Bitmap? {
        return try {
            val url = java.net.URL(urlString)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.connect()

            val inputStream = connection.inputStream
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream.close()
            connection.disconnect()

            android.util.Log.d("PaintCanvas", "🌐 HTTP에서 비트맵 로드 성공: ${bitmap?.width}x${bitmap?.height}")
            bitmap
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ HTTP 비트맵 로드 실패: ${e.message}")
            e.printStackTrace()
            null
        }
    }

    /**
     * 🎨 drawable:// URI에서 비트맵 로드 (Release 빌드용)
     * React Native Release 빌드에서 Image.resolveAssetSource()는 drawable://resName 형식 반환
     */
    private fun loadBitmapFromDrawable(drawableUri: String): Bitmap? {
        return try {
            // drawable://animal_01_cat 형식에서 리소스 이름 추출
            val resourceName = drawableUri.removePrefix("drawable://")
                .replace(".png", "")
                .replace(".jpg", "")
                .replace("-", "_")  // 하이픈을 언더스코어로 변환 (Android 리소스 규칙)

            android.util.Log.d("PaintCanvas", "🎨 drawable 리소스 찾기: $resourceName")

            // 리소스 ID 조회
            val resourceId = context.resources.getIdentifier(resourceName, "drawable", context.packageName)

            if (resourceId != 0) {
                val bitmap = BitmapFactory.decodeResource(context.resources, resourceId)
                android.util.Log.d("PaintCanvas", "🎨 drawable 로드 성공: ${bitmap?.width}x${bitmap?.height}")
                bitmap
            } else {
                android.util.Log.e("PaintCanvas", "❌ drawable 리소스 없음: $resourceName")
                null
            }
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ drawable 로드 실패: ${e.message}")
            e.printStackTrace()
            null
        }
    }

    // 색칠된 셀 텍스처 캐시 (색상별로 캐싱)
    // ⚠️ 안전성: LinkedHashMap + recycle 조합은 recycled bitmap 크래시 유발
    // 대신 단순 HashMap 사용 (색상 수는 보통 20개 미만으로 메모리 문제 없음)
    // ⚠️ 캐시 크기 제한: 대형 그리드에서 OOM 방지
    // - 소형 그리드: 최대 12개 캐시 (64x64 × 12 = 약 200KB)
    // - 대형 그리드(>=100): 최대 5개 캐시 (메모리 절약 강화)
    private fun getMaxTextureCacheSize(): Int = if (isLargeGridMode) 5 else 12
    private val filledCellTextureCache = mutableMapOf<Int, Bitmap>()

    private var textureDebugLogged = false

    // 🎨 타일링용 BitmapShader 캐시 (색상별)
    private val tiledShaderCache = mutableMapOf<Int, BitmapShader>()
    private val tiledPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val shaderMatrix = Matrix()

    // ⚡ 캐시된 타일 스케일 (줌 레벨 변경 시만 업데이트)
    private var cachedTileScale = 0f
    private var lastCellSizeForTile = 0f

    // 🎨 PorterDuff 방식: 단일 텍스처 + ColorFilter (캐시 불필요, OOM 방지)
    private var baseTextureShader: BitmapShader? = null
    private val texturePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    private fun drawFilledCellWithTexture(canvas: Canvas, left: Float, top: Float, size: Float, color: Int) {
        try {
            // ✨ 완성 모드에 따라 다른 렌더링 적용
            if (completionMode == "ORIGINAL") {
                // ORIGINAL 모드: 원본 이미지 영역 복사
                drawOriginalImageCell(canvas, left, top, size)
                return
            }

            // ⚡ 줌 기반 텍스처 최적화: 줌 레벨이 임계값 미만이면 단색만 표시
            // scaleFactor / maxZoom = 현재 줌 비율 (0.0 ~ 1.0)
            // 예: maxZoom=10, scaleFactor=8 → 80% 줌
            val zoomRatio = scaleFactor / maxZoom

            // WEAVE 모드: PorterDuff MULTIPLY 방식 (캐시 없음, OOM 방지)
            // 🎨 사용자 선택 텍스처 우선, 없으면 기본 텍스처 사용
            val pattern = textureBitmap ?: filledCellPatternBitmap

            // 🎨 사용자가 텍스처를 선택했으면 줌 레벨과 무관하게 항상 표시
            val hasUserTexture = textureBitmap != null && !textureBitmap!!.isRecycled

            // ⚡ 대형 그리드(>=100) 추가 최적화: 40% 줌 미만에서 텍스처 완전 스킵 (사용자 텍스처 제외)
            // 100+ 그리드는 셀이 매우 작아서 텍스처가 거의 안 보임 → 렌더링 낭비 방지
            val textureThreshold = if (isLargeGridMode) 0.4f else TEXTURE_VISIBLE_ZOOM_THRESHOLD
            val shouldShowTexture = hasUserTexture || zoomRatio >= textureThreshold

            // ⚡ 텍스처 비활성화 조건: 패턴 없음/손상 (줌은 이미 위에서 체크)
            if (!shouldShowTexture || pattern == null || pattern.isRecycled) {
                reusableBgPaint.color = color
                canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)
                return
            }

            // 1단계: 색상 배경 먼저 그리기
            reusableBgPaint.color = color
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)

            // 2단계: 텍스처를 반투명 오버레이로 그리기 (명암만 추가)
            // 🎨 사용자 텍스처가 변경되면 shader 재생성
            val currentPattern = textureBitmap ?: filledCellPatternBitmap
            if (baseTextureShader == null || currentTextureId != textureUri) {
                currentTextureId = textureUri
                val squarePattern = getSquarePattern(currentPattern!!)
                if (!squarePattern.isRecycled) {
                    baseTextureShader = BitmapShader(squarePattern, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
                }
            }

            // 🐛 안전 체크: squarePatternBitmap이 recycled된 경우 shader 무효화
            val squarePattern = squarePatternBitmap
            if (squarePattern == null || squarePattern.isRecycled) {
                baseTextureShader = null
                return  // 텍스처 없이 단색만 그림 (위에서 이미 그려짐)
            }

            baseTextureShader?.let { shader ->
                // 타일 스케일 계산
                if (size != lastCellSizeForTile) {
                    lastCellSizeForTile = size
                    cachedTileScale = size / squarePattern.width.toFloat()
                }

                shaderMatrix.setScale(cachedTileScale, cachedTileScale)
                shaderMatrix.postTranslate(left, top)
                shader.setLocalMatrix(shaderMatrix)

                // 텍스처를 30% 알파로 오버레이 (명암 효과)
                texturePaint.shader = shader
                texturePaint.alpha = 77  // 30% 투명도
                canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, texturePaint)
                texturePaint.alpha = 255  // 리셋
            }
        } catch (e: Exception) {
            reusableBgPaint.color = color
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)
        }
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

        // ⚡ 성능 + OOM 방지: 64x64로 축소 (메모리 4배 절약, 타일링이라 품질 유지)
        val targetSize = 64
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
        try {
            // ⚠️ 안전 체크: recycled 비트맵 접근 방지
            if (pattern.isRecycled) {
                val fallback = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
                fallback.eraseColor(color)
                return fallback
            }

            // 정사각형으로 보정된 패턴 사용 (비율 왜곡 방지)
            val squarePattern = getSquarePattern(pattern)
            if (squarePattern.isRecycled) {
                val fallback = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
                fallback.eraseColor(color)
                return fallback
            }

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
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ createColoredTexture 오류: ${e.message}")
            // 폴백: 단색 비트맵 반환
            val fallback = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
            fallback.eraseColor(color)
            return fallback
        }
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
        // 음영은 항상 표시 (줌 레벨 무관)
        // 사용자가 어느 줌에서든 원본 이미지 힌트를 볼 수 있음

        val bitmap = originalBitmap ?: backgroundBitmap

        // ⚠️ 안전 체크: bitmap이 null이거나 recycled면 흰색 배경
        if (bitmap != null && !bitmap.isRecycled) {
            try {
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
            } catch (e: Exception) {
                // 오류 시 흰색 배경으로 폴백
                canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, backgroundClearPaint)
            }
        } else {
            // 비트맵 없거나 recycled면 흰색 배경
            canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, backgroundClearPaint)
        }
    }

    /**
     * ✨ 원본 이미지의 해당 셀 영역을 그대로 복사 (ORIGINAL 완성 모드)
     */
    private var originalDrawnLogOnce = false
    private fun drawOriginalImageCell(canvas: Canvas, left: Float, top: Float, size: Float) {
        val bitmap = originalBitmap ?: backgroundBitmap

        // ⚠️ 안전 체크: bitmap이 null이거나 recycled면 회색 폴백
        if (bitmap == null || bitmap.isRecycled) {
            reusableBgPaint.color = Color.LTGRAY
            canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
            return
        }

        try {
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
        } catch (e: Exception) {
            // 오류 시 회색으로 폴백
            reusableBgPaint.color = Color.LTGRAY
            canvas.drawRect(left, top, left + size, top + size, reusableBgPaint)
        }
    }

    private fun applyTextureToOriginalImage(original: Bitmap, pattern: Bitmap): Bitmap {
        // ⚠️ 안전 체크: recycled 비트맵 접근 방지
        if (original.isRecycled || pattern.isRecycled) {
            android.util.Log.e("PaintCanvas", "❌ applyTextureToOriginalImage: recycled bitmap")
            return original
        }

        return try {
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
            result
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ applyTextureToOriginalImage 오류: ${e.message}")
            original  // 오류 시 원본 반환
        }
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

        // ⚠️ 안전 체크: recycled 비트맵 접근 방지
        if (bitmap.isRecycled) return Color.GRAY

        return try {
            // 원본 이미지에서 해당 셀의 중심점 계산
            val srcCellWidth = bitmap.width.toFloat() / gridSize
            val srcCellHeight = bitmap.height.toFloat() / gridSize

            val centerX = (col * srcCellWidth + srcCellWidth / 2f).toInt().coerceIn(0, bitmap.width - 1)
            val centerY = (row * srcCellHeight + srcCellHeight / 2f).toInt().coerceIn(0, bitmap.height - 1)

            // 중심점의 픽셀 색상 반환
            bitmap.getPixel(centerX, centerY)
        } catch (e: Exception) {
            Color.GRAY
        }
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
            val totalCells = gridSize * gridSize
            // 🐛 paintedColorMapInt 대신 filledCellIndices 사용 (저장된 진행 상황 복원 시 paintedColorMapInt는 빈 상태)
            val paintedCells = filledCellIndices.size
            val isComplete = paintedCells >= totalCells

            android.util.Log.w("PaintCanvas", "📸📸📸 captureCanvas 호출됨! painted=$paintedCells, total=$totalCells, complete=$isComplete, mode='$completionMode'")

            // 🐛 100% 완료 + ORIGINAL 모드: 원본 이미지 직접 리사이즈 (격자선 완전 방지)
            if (isComplete && completionMode == "ORIGINAL") {
                android.util.Log.w("PaintCanvas", "🟢 ORIGINAL 100% 분기 진입!")
                val sourceBitmap = originalBitmap ?: backgroundBitmap
                if (sourceBitmap != null && !sourceBitmap.isRecycled) {
                    android.util.Log.d("PaintCanvas", "✅ ORIGINAL 100% 완료: 원본 이미지 직접 리사이즈")
                    val outputBitmap = Bitmap.createScaledBitmap(sourceBitmap, size, size, true)
                    val outputStream = ByteArrayOutputStream()
                    outputBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
                    val base64String = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                    if (outputBitmap != sourceBitmap) outputBitmap.recycle()
                    return base64String
                }
            }

            // 🐛 100% 완료 + WEAVE 모드: gridSize 배수 크기로 정수 좌표 렌더링 (격자선 방지)
            if (isComplete && completionMode == "WEAVE") {
                android.util.Log.w("PaintCanvas", "🟢 WEAVE 100% 분기 진입!")
                val pattern = textureBitmap ?: filledCellPatternBitmap
                if (pattern != null && !pattern.isRecycled) {
                    android.util.Log.d("PaintCanvas", "✅ WEAVE 100% 완료: 정수 좌표 렌더링")

                    // 셀 크기를 정수로 만들기 위해 gridSize 배수 크기 사용
                    val cellSizeInt = (size / gridSize).coerceAtLeast(1)
                    val captureSize = cellSizeInt * gridSize

                    val captureBitmap = Bitmap.createBitmap(captureSize, captureSize, Bitmap.Config.ARGB_8888)
                    val captureCanvas = Canvas(captureBitmap)
                    captureCanvas.drawColor(Color.WHITE)

                    for (row in 0 until gridSize) {
                        val top = row * cellSizeInt
                        for (col in 0 until gridSize) {
                            val left = col * cellSizeInt
                            val cellIndex = row * gridSize + col

                            // 🐛 paintedColorMapInt에 없으면 cells의 targetColorHex 사용 (저장된 진행 상황 복원 시)
                            val cellColor = paintedColorMapInt[cellIndex]
                                ?: cells.getOrNull(cellIndex)?.targetColorHex?.let { Color.parseColor(it) }
                                ?: continue

                            // 텍스처 캐시에서 가져오거나 생성
                            val texturedBitmap = filledCellTextureCache[cellColor] ?: run {
                                val newBitmap = createColoredTexture(pattern, cellColor)
                                filledCellTextureCache[cellColor] = newBitmap
                                newBitmap
                            }

                            val srcRect = Rect(0, 0, texturedBitmap.width, texturedBitmap.height)
                            val dstRect = Rect(left, top, left + cellSizeInt, top + cellSizeInt)
                            // 🐛 captureBitmapPaint 사용 (안티앨리어싱 비활성화 → 격자선 방지)
                            captureCanvas.drawBitmap(texturedBitmap, srcRect, dstRect, captureBitmapPaint)
                        }
                    }

                    // 요청 크기로 리사이즈
                    val outputBitmap = if (captureSize != size) {
                        val scaled = Bitmap.createScaledBitmap(captureBitmap, size, size, true)
                        captureBitmap.recycle()
                        scaled
                    } else {
                        captureBitmap
                    }

                    val outputStream = ByteArrayOutputStream()
                    outputBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
                    val base64String = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                    outputBitmap.recycle()
                    android.util.Log.d("PaintCanvas", "✅ WEAVE 캡처 완료: ${captureSize}→${size}")
                    return base64String
                }
            }

            // 미완료 또는 fallback: 기존 방식
            val captureSize = size.toFloat()
            val captureCellSize = captureSize / gridSize

            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)

            val captureTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.BLACK
                textAlign = Paint.Align.CENTER
                style = Paint.Style.FILL
                textSize = captureCellSize * 0.5f
            }
            val textYOffset = -(captureTextPaint.descent() + captureTextPaint.ascent()) / 2f

            for (row in 0 until gridSize) {
                val top = row * captureCellSize
                val rowOffset = row * gridSize

                for (col in 0 until gridSize) {
                    val left = col * captureCellSize
                    val cellIndex = rowOffset + col
                    val cellColor = paintedColorMapInt[cellIndex]

                    if (cellColor != null) {
                        drawCapturedCell(canvas, left, top, captureCellSize, cellColor, row, col)
                    } else {
                        canvas.drawRect(left, top, left + captureCellSize, top + captureCellSize, backgroundClearPaint)
                        val label = labelMapByIndex[cellIndex] ?: "A"
                        canvas.drawText(label, left + captureCellSize / 2f, top + captureCellSize / 2f + textYOffset, captureTextPaint)
                    }
                }
            }

            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val base64String = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
            bitmap.recycle()
            android.util.Log.d("PaintCanvas", "✅ 캔버스 캡처 완료: ${size}x${size}")

            return base64String
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ captureCanvas 예외: ${e.message}")
            return null
        }
    }

    /**
     * 📸 갤러리 썸네일 캡처 - 미색칠 부분 음영, 색칠된 부분 밝게 표시
     * 미색칠 영역: 원본 이미지 + 어두운 오버레이 (음영)
     * 색칠된 영역: 색칠한 색상 그대로 표시 (밝게)
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

            // 2단계: 전체에 어두운 오버레이 (음영 효과)
            val shadowPaint = Paint().apply {
                style = Paint.Style.FILL
                color = Color.argb(230, 0, 0, 0)  // 90% 투명도의 검은색
            }
            canvas.drawRect(0f, 0f, captureSize, captureSize, shadowPaint)

            // 3단계: 색칠된 셀만 밝게 표시 (음영 제거 + 색상 표시)
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
                        // 색칠된 셀 - 밝은 색상으로 표시
                        val left = col * captureCellSize
                        cellPaint.color = cellColor
                        canvas.drawRect(left, top, left + captureCellSize + 0.5f, top + captureCellSize + 0.5f, cellPaint)
                    }
                    // 미색칠 셀은 어두운 음영 그대로 유지
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
            // 🎨 사용자 선택 텍스처 우선, 없으면 기본 텍스처 사용
            val pattern = textureBitmap ?: filledCellPatternBitmap
            if (pattern != null && !pattern.isRecycled) {
                // ⚡ OOM 방지: 캐시 크기 제한 (대형 그리드에서 더 작은 캐시)
                val maxCacheSize = getMaxTextureCacheSize()
                val texturedBitmap = if (filledCellTextureCache.containsKey(color)) {
                    filledCellTextureCache[color]!!
                } else {
                    // 캐시가 가득 찼으면 가장 오래된 항목 제거
                    if (filledCellTextureCache.size >= maxCacheSize) {
                        val oldestKey = filledCellTextureCache.keys.firstOrNull()
                        if (oldestKey != null) {
                            filledCellTextureCache.remove(oldestKey)?.recycle()
                        }
                    }
                    val newBitmap = createColoredTexture(pattern, color)
                    filledCellTextureCache[color] = newBitmap
                    newBitmap
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

    // ⚡ 뷰 연결 시 코루틴 스코프 재생성 (백그라운드 → 포그라운드 복귀 시)
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        try {
            // 취소된 스코프가 있으면 재생성
            if (!imageLoadScope.isActive) {
                imageLoadScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
            }
            android.util.Log.d("PaintCanvas", "✅ View attached, coroutine scopes ready")
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ onAttachedToWindow 오류: ${e.message}")
        }
    }

    // ⚡ 뷰 분리 시 코루틴 정리, Bitmap 해제, 진행 상황 저장
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        try {
            // 마지막 진행 상황 저장 (동기)
            saveProgressToPrefsSync()
            // 스코프 취소 (재연결 시 onAttachedToWindow에서 재생성)
            imageLoadScope.cancel()

            // 🧹 메모리 정리: 모든 Bitmap 해제 (OOM 방지)
            releaseBitmaps()

            android.util.Log.d("PaintCanvas", "🧹 View detached, progress saved, bitmaps released")
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ onDetachedFromWindow 오류: ${e.message}")
        }
    }

    // 🐛 잠재적 문제 해결: 앱 백그라운드 전환 시 진행 상황 동기 저장
    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        try {
            if (visibility == GONE || visibility == INVISIBLE) {
                // 화면이 안 보이게 되면 (홈 버튼, 다른 앱 전환 등) 동기 저장
                if (filledCells.isNotEmpty() || wrongPaintedCells.isNotEmpty()) {
                    saveProgressToPrefsSync()
                    android.util.Log.d("PaintCanvas", "💾 백그라운드 전환, 진행 상황 동기 저장 완료")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ onWindowVisibilityChanged 오류: ${e.message}")
        }
    }

    /**
     * 🧹 이미지 Bitmap만 해제 (새 이미지 로드 전 호출)
     * - backgroundBitmap, originalBitmap, 텍스처 캐시만 해제
     * - 패턴 Bitmap은 재사용하므로 유지
     */
    private fun releaseImageBitmaps() {
        try {
            // 이미지 Bitmap 해제
            backgroundBitmap?.let { if (!it.isRecycled) it.recycle() }
            backgroundBitmap = null

            originalBitmap?.let { if (!it.isRecycled) it.recycle() }
            originalBitmap = null

            // 텍스처 캐시 해제 (색상별 생성된 텍스처)
            for (bitmap in filledCellTextureCache.values) {
                if (!bitmap.isRecycled) bitmap.recycle()
            }
            filledCellTextureCache.clear()
            tiledShaderCache.clear()

            // squarePattern 해제 (이미지마다 다름)
            squarePatternBitmap?.let { if (!it.isRecycled) it.recycle() }
            squarePatternBitmap = null

            // 텍스처 밝기 캐시 초기화
            texLumCalculated = false

            android.util.Log.d("PaintCanvas", "🗑️ 이미지 Bitmap 해제 완료 (새 이미지 로드 준비)")
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ releaseImageBitmaps 오류: ${e.message}")
        }
    }

    /**
     * 🧹 모든 Bitmap 메모리 해제 (OOM 방지)
     * - 뷰 분리 시, 이미지 전환 시 호출
     */
    private fun releaseBitmaps() {
        try {
            // 1. 메인 이미지 Bitmap 해제
            backgroundBitmap?.let { if (!it.isRecycled) it.recycle() }
            backgroundBitmap = null

            originalBitmap?.let { if (!it.isRecycled) it.recycle() }
            originalBitmap = null

            // 2. 패턴 Bitmap 해제
            weavePatternBitmap?.let { if (!it.isRecycled) it.recycle() }
            weavePatternBitmap = null

            filledCellPatternBitmap?.let { if (!it.isRecycled) it.recycle() }
            filledCellPatternBitmap = null

            wrongMarkBitmap?.let { if (!it.isRecycled) it.recycle() }
            wrongMarkBitmap = null

            squarePatternBitmap?.let { if (!it.isRecycled) it.recycle() }
            squarePatternBitmap = null

            // 3. 텍스처 캐시 Bitmap 해제
            for (bitmap in filledCellTextureCache.values) {
                if (!bitmap.isRecycled) bitmap.recycle()
            }
            filledCellTextureCache.clear()
            tiledShaderCache.clear()

            // 4. 픽셀 버퍼 해제
            texPixelBuffer = null
            outPixelBuffer = null

            // 5. 텍스처 밝기 캐시 초기화 (다음 이미지에서 재계산)
            texLumCalculated = false

            android.util.Log.d("PaintCanvas", "🗑️ 모든 Bitmap 메모리 해제 완료")
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ releaseBitmaps 오류: ${e.message}")
        }
    }

    // ====== 🔄 자동 저장/복원 기능 ======

    /**
     * SharedPreferences에서 저장된 진행 상황 복원
     */
    private fun loadProgressFromPrefs() {
        // 🗑️ clearProgress가 호출된 경우 복원 건너뛰기
        if (shouldClearProgress) {
            android.util.Log.d("PaintCanvas", "🗑️ shouldClearProgress=true, 복원 건너뛰기")
            isProgressLoaded = true
            return
        }

        val gameId = currentGameId ?: run {
            // gameId가 없으면 완료 처리 (onDraw에서 notifyCanvasReady 호출)
            isProgressLoaded = true
            return
        }

        // ⚡ 비동기 로딩으로 메인 스레드 블로킹 방지
        imageLoadScope.launch {
            try {
                // 🗑️ 비동기 작업 중에도 플래그 재확인
                if (shouldClearProgress) {
                    withContext(Dispatchers.Main) {
                        isProgressLoaded = true
                    }
                    return@launch
                }

                val json = prefs.getString(gameId, null)
                if (json == null) {
                    // 저장된 데이터가 없으면 (새 퍼즐) 완료 처리
                    withContext(Dispatchers.Main) {
                        isProgressLoaded = true
                        android.util.Log.d("PaintCanvas", "🆕 새 퍼즐, 진행 상황 없음")
                        invalidate()  // onDraw 트리거
                    }
                    return@launch
                }
                val data = JSONObject(json)

                val filledArray = data.optJSONArray("filledCells")
                if (filledArray == null) {
                    // 저장 형식이 잘못됐거나 빈 경우 완료 처리
                    withContext(Dispatchers.Main) {
                        isProgressLoaded = true
                        invalidate()  // onDraw 트리거
                    }
                    return@launch
                }
                val wrongArray = data.optJSONArray("wrongCells")
                val colorMapObj = data.optJSONObject("paintedColors")

                // 🔍 뷰포트 위치 복원 데이터
                val savedScaleFactor = data.optDouble("scaleFactor", 1.0).toFloat()
                val savedTranslateX = data.optDouble("translateX", 0.0).toFloat()
                val savedTranslateY = data.optDouble("translateY", 0.0).toFloat()
                val savedLastPaintedCell = if (data.has("lastPaintedCell")) data.optInt("lastPaintedCell", -1) else -1

                // 백그라운드에서 데이터 파싱
                val localGridSize = gridSize
                val tempFilledCells = HashSet<String>()
                val tempFilledIndices = HashSet<Int>()
                val tempWrongCells = HashSet<String>()
                val tempWrongIndices = HashSet<Int>()
                val tempColorMapInt = HashMap<Int, Int>()
                val tempColorMap = HashMap<String, String>()

                // 현재 parsedColorMap 스냅샷 (백그라운드에서 읽기)
                val currentParsedColors = HashMap(parsedColorMap)

                // filledCells 파싱
                for (i in 0 until filledArray.length()) {
                    val cellKey = filledArray.getString(i)
                    tempFilledCells.add(cellKey)
                    val parts = cellKey.split("-")
                    if (parts.size == 2) {
                        val row = parts[0].toIntOrNull() ?: continue
                        val col = parts[1].toIntOrNull() ?: continue
                        val idx = row * localGridSize + col
                        tempFilledIndices.add(idx)

                        val savedColor = colorMapObj?.optInt(cellKey, 0) ?: 0
                        if (savedColor != 0) {
                            tempColorMapInt[idx] = savedColor
                            tempColorMap[cellKey] = String.format("#%06X", 0xFFFFFF and savedColor)
                        }
                        // 🐛 버그 수정: savedColor가 0이면 색상 정보 없음 (정답 색상으로 대체하지 않음)
                        // 정답 색상은 onDraw에서 parsedColorMap에서 직접 가져옴
                    }
                }

                // wrongCells 파싱
                if (wrongArray != null) {
                    for (i in 0 until wrongArray.length()) {
                        val cellKey = wrongArray.getString(i)
                        tempWrongCells.add(cellKey)
                        val parts = cellKey.split("-")
                        if (parts.size == 2) {
                            val row = parts[0].toIntOrNull() ?: continue
                            val col = parts[1].toIntOrNull() ?: continue
                            val idx = row * localGridSize + col
                            tempWrongIndices.add(idx)

                            val savedColor = colorMapObj?.optInt(cellKey, 0) ?: 0
                            if (savedColor != 0) {
                                tempColorMapInt[idx] = savedColor
                                tempColorMap[cellKey] = String.format("#%06X", 0xFFFFFF and savedColor)
                            }
                        }
                    }
                }

                android.util.Log.d("PaintCanvas", "✅ 진행 상황 파싱 완료 (백그라운드): filled=${tempFilledCells.size}, wrong=${tempWrongCells.size}")

                // 메인 스레드에서 UI 업데이트 (빠른 대입만)
                withContext(Dispatchers.Main) {
                    filledCells.clear()
                    filledCells.addAll(tempFilledCells)
                    filledCellIndices.clear()
                    filledCellIndices.addAll(tempFilledIndices)
                    wrongPaintedCells.clear()
                    wrongPaintedCells.addAll(tempWrongCells)
                    wrongCellIndices.clear()
                    wrongCellIndices.addAll(tempWrongIndices)
                    paintedColorMapInt.clear()
                    paintedColorMapInt.putAll(tempColorMapInt)
                    paintedColorMap.clear()
                    paintedColorMap.putAll(tempColorMap)

                    if (filledCells.isNotEmpty()) {
                        hasUserPainted = true
                    }

                    // 🔍 마지막 색칠 위치 복원
                    if (savedLastPaintedCell >= 0) {
                        lastPaintedCellIndex = savedLastPaintedCell
                    }

                    // 🔍 뷰포트 위치 복원 (캔버스 크기가 설정된 후 적용)
                    if (savedScaleFactor > 1f || savedTranslateX != 0f || savedTranslateY != 0f) {
                        pendingViewportRestore = Triple(savedScaleFactor, savedTranslateX, savedTranslateY)
                        android.util.Log.d("PaintCanvas", "🔍 뷰포트 복원 예약: scale=$savedScaleFactor, tx=$savedTranslateX, ty=$savedTranslateY")
                    }

                    // 🔧 wrongCells 재검증: 칠해진 색상이 정답 색상과 일치하면 wrongCells에서 제거
                    // (disperseColorDistribution 버그로 인해 잘못 판정된 셀 정리)
                    if (wrongCellIndices.isNotEmpty() && parsedColorMap.isNotEmpty()) {
                        val falsePosIndices = mutableListOf<Int>()
                        val falsePosKeys = mutableListOf<String>()
                        for (cellIndex in wrongCellIndices) {
                            val paintedColor = paintedColorMapInt[cellIndex] ?: continue
                            val targetColor = parsedColorMap[cellIndex] ?: continue
                            // RGB만 비교 (알파 무시)
                            if ((paintedColor and 0x00FFFFFF) == (targetColor and 0x00FFFFFF)) {
                                falsePosIndices.add(cellIndex)
                                val row = cellIndex / gridSize
                                val col = cellIndex % gridSize
                                falsePosKeys.add("$row-$col")
                            }
                        }
                        if (falsePosIndices.isNotEmpty()) {
                            for (idx in falsePosIndices) wrongCellIndices.remove(idx)
                            for (key in falsePosKeys) wrongPaintedCells.remove(key)
                            android.util.Log.d("PaintCanvas", "🔧 wrongCells 재검증: ${falsePosIndices.size}개 오판 셀 정리됨 (남은 wrong: ${wrongCellIndices.size})")
                        }
                    }

                    isProgressLoaded = true  // 🚀 진행 상황 로딩 완료 플래그
                    android.util.Log.d("PaintCanvas", "✅ 진행 상황 복원 완료: filled=${filledCells.size}, wrong=${wrongPaintedCells.size}")
                    invalidate()  // onDraw에서 notifyCanvasReady 호출
                }

            } catch (e: Exception) {
                android.util.Log.e("PaintCanvas", "❌ 진행 상황 복원 실패: ${e.message}")
                // 실패해도 로딩 완료 처리 (빈 상태로 시작)
                withContext(Dispatchers.Main) {
                    isProgressLoaded = true
                    invalidate()  // onDraw 트리거
                }
            }
        }
    }

    // ⚡ 저장 디바운스용 핸들러
    private var saveProgressRunnable: Runnable? = null
    private val saveHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val SAVE_DEBOUNCE_MS = 500L  // 500ms 디바운스

    /**
     * ⚡ 진행 상황을 SharedPreferences에 비동기 저장 (UI 블로킹 방지)
     * 일반 색칠 중에는 apply()로 비동기 저장 + 500ms 디바운스
     */
    private fun saveProgressToPrefs() {
        // ⚡ 기존 예약된 저장 취소 (디바운스)
        saveProgressRunnable?.let { saveHandler.removeCallbacks(it) }

        saveProgressRunnable = Runnable {
            val gameId = currentGameId ?: return@Runnable
            if (filledCells.isEmpty() && wrongPaintedCells.isEmpty()) return@Runnable

            try {
                val data = buildSaveData()
                // ⚡ apply() 사용: 비동기 저장으로 UI 스레드 블로킹 방지
                prefs.edit().putString(gameId, data.toString()).apply()
            } catch (e: Exception) {
                android.util.Log.e("PaintCanvas", "❌ saveProgressToPrefs 오류: ${e.message}")
            }
        }
        saveHandler.postDelayed(saveProgressRunnable!!, SAVE_DEBOUNCE_MS)
    }

    /**
     * 저장용 JSON 데이터 생성 (공통 로직)
     */
    private fun buildSaveData(): JSONObject {
        val filledArray = JSONArray(filledCells.toList())
        val wrongArray = JSONArray(wrongPaintedCells.toList())

        // 🎨 색상 정보 저장 (cellKey -> colorInt)
        val colorMapObj = JSONObject()
        for (cellKey in filledCells) {
            val idx = parseIndex(cellKey)
            if (idx >= 0) {
                paintedColorMapInt[idx]?.let { color ->
                    colorMapObj.put(cellKey, color)
                }
            }
        }
        for (cellKey in wrongPaintedCells) {
            val idx = parseIndex(cellKey)
            if (idx >= 0) {
                paintedColorMapInt[idx]?.let { color ->
                    colorMapObj.put(cellKey, color)
                }
            }
        }

        return JSONObject().apply {
            put("filledCells", filledArray)
            put("wrongCells", wrongArray)
            put("paintedColors", colorMapObj)
            put("timestamp", System.currentTimeMillis())
            // 🔍 뷰포트 위치 저장 (마지막 색칠 위치로 자동 이동용)
            put("scaleFactor", scaleFactor.toDouble())
            put("translateX", translateX.toDouble())
            put("translateY", translateY.toDouble())
            // 마지막 색칠한 셀 위치 저장
            if (lastPaintedCellIndex >= 0) put("lastPaintedCell", lastPaintedCellIndex)
        }
    }

    /**
     * 진행 상황을 동기적으로 저장 (뷰 분리 시 사용)
     * ⚠️ commit() 사용: 앱 종료 시에도 확실히 저장
     * 🎨 색상 정보도 함께 저장하여 복원 시 정확한 색상 표시
     */
    private fun saveProgressToPrefsSync() {
        val gameId = currentGameId ?: return
        if (filledCells.isEmpty() && wrongPaintedCells.isEmpty()) return

        try {
            val data = buildSaveData()

            // ⚠️ commit() 사용: 동기 저장으로 앱 종료 시에도 확실히 저장
            val success = prefs.edit().putString(gameId, data.toString()).commit()
            if (success) {
                android.util.Log.d("PaintCanvas", "💾 진행 상황 동기 저장 완료: $gameId (filled=${filledCells.size}, wrong=${wrongPaintedCells.size})")
            } else {
                android.util.Log.e("PaintCanvas", "❌ 진행 상황 저장 실패: commit() returned false")
            }

        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "❌ 진행 상황 저장 실패: ${e.message}")
        }
    }

    /**
     * 🗑️ 진행 상황 초기화 (갤러리 리셋 시 호출)
     * - 메모리 내 상태 초기화
     * - SharedPreferences에서 데이터 삭제
     * - shouldClearProgress 플래그 설정 (loadProgressFromPrefs 무시용)
     */
    private var shouldClearProgress = false

    fun clearProgress() {
        val gameId = currentGameId
        android.util.Log.d("PaintCanvas", "🗑️ clearProgress 호출: gameId=$gameId")

        // 플래그 설정 (이후 loadProgressFromPrefs 호출 시 무시)
        shouldClearProgress = true

        // 1. 메모리 내 상태 초기화
        filledCells.clear()
        wrongPaintedCells.clear()
        filledCellIndices.clear()
        wrongCellIndices.clear()
        paintedColorMapInt.clear()
        hasUserPainted = false  // 새로 시작이므로 리셋

        // 2. SharedPreferences에서 삭제
        if (gameId != null) {
            prefs.edit().remove(gameId).commit()  // commit()으로 즉시 삭제
            android.util.Log.d("PaintCanvas", "🗑️ SharedPreferences에서 $gameId 삭제 완료")
        }

        // 3. 진행 상황 로딩 완료 처리 (빈 상태로)
        isProgressLoaded = true

        // 4. 화면 갱신
        invalidate()
    }

    /**
     * 🗑️ 특정 gameId의 진행 상황 삭제 (Module에서 호출)
     * View가 생성되기 전에도 호출 가능
     */
    fun clearProgressForGame(gameId: String) {
        android.util.Log.d("PaintCanvas", "🗑️ clearProgressForGame 호출: $gameId (currentGameId=$currentGameId)")

        // 현재 View의 gameId와 일치하면 메모리도 초기화
        if (currentGameId == gameId) {
            shouldClearProgress = true
            filledCells.clear()
            wrongPaintedCells.clear()
            filledCellIndices.clear()
            wrongCellIndices.clear()
            paintedColorMapInt.clear()
            hasUserPainted = false
            isProgressLoaded = true
        }

        // SharedPreferences에서 삭제
        prefs.edit().remove(gameId).commit()
        android.util.Log.d("PaintCanvas", "🗑️ clearProgressForGame: SharedPreferences에서 $gameId 삭제 완료")
    }
}
