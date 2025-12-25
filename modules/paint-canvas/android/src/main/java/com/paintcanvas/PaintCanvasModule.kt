package com.paintcanvas

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaintCanvasModule : Module() {
  // 캡처를 위한 View 참조 저장
  private var currentView: PaintCanvasView? = null

  override fun definition() = ModuleDefinition {
    Name("PaintCanvas")

    // 🖼️ 캔버스 캡처 함수 노출
    Function("captureCanvas") { size: Int ->
      currentView?.captureCanvas(size)
    }

    // 📸 썸네일 캡처 함수 (원본 이미지 + 색칠된 부분 오버레이)
    Function("captureThumbnail") { size: Int ->
      currentView?.captureThumbnail(size)
    }

    // 🗺️ 미니맵 이미지 캡처 (음영 + 색칠된 부분)
    Function("getMinimapImage") { size: Int ->
      currentView?.captureThumbnail(size)
    }

    // 🗺️ 미니맵 터치로 뷰포트 이동
    Function("setViewportPosition") { x: Float, y: Float ->
      currentView?.setViewportPosition(x, y)
    }

    // 🗑️ 특정 gameId의 진행 상황 삭제 (갤러리 리셋 시 JS에서 호출)
    Function("clearProgressForGame") { gameId: String ->
      currentView?.clearProgressForGame(gameId)
        ?: android.util.Log.d("PaintCanvas", "🗑️ clearProgressForGame: currentView가 없어서 SharedPreferences 직접 삭제 - $gameId")
      // View가 없어도 SharedPreferences에서 삭제
      val context = appContext.reactContext ?: return@Function
      val prefs = context.getSharedPreferences("PaintCanvasProgress", android.content.Context.MODE_PRIVATE)
      prefs.edit().remove(gameId).commit()
      android.util.Log.d("PaintCanvas", "🗑️ clearProgressForGame 완료: $gameId")
    }

    View(PaintCanvasView::class) {
      // View 생성 시 참조 저장
      OnViewDidUpdateProps { view: PaintCanvasView ->
        currentView = view
      }

      Prop("gridSize") { view: PaintCanvasView, gridSize: Int ->
        currentView = view
        view.setGridSize(gridSize)
      }

      Prop("cells") { view: PaintCanvasView, cells: List<Map<String, Any>> ->
        currentView = view
        view.setCells(cells)
      }

      Prop("selectedColorHex") { view: PaintCanvasView, colorHex: String ->
        view.setSelectedColor(colorHex)
      }

      Prop("selectedLabel") { view: PaintCanvasView, label: String ->
        view.setSelectedLabel(label)
      }

      Prop("imageUri") { view: PaintCanvasView, uri: String ->
        view.setImageUri(uri)
      }

      // 🔄 저장/복원용 고유 ID (puzzleId 기반)
      Prop("gameId") { view: PaintCanvasView, gameId: String ->
        view.setGameId(gameId)
      }

      // 🗑️ 진행 상황 초기화 플래그 (갤러리 리셋 시 사용)
      // gameId 설정 후에 처리되어야 함
      Prop("clearProgress") { view: PaintCanvasView, shouldClear: Boolean ->
        if (shouldClear) {
          view.clearProgress()
        }
      }

      Prop("filledCells") { view: PaintCanvasView, cells: List<String> ->
        view.setFilledCells(cells)
      }

      Prop("wrongCells") { view: PaintCanvasView, cells: List<String> ->
        view.setWrongCells(cells)
      }

      Prop("undoMode") { view: PaintCanvasView, enabled: Boolean ->
        view.setUndoMode(enabled)
      }

      Prop("eraseMode") { view: PaintCanvasView, enabled: Boolean ->
        view.setEraseMode(enabled)
      }

      Prop("viewSize") { view: PaintCanvasView, size: Map<String, Any> ->
        val width = (size["width"] as? Number)?.toFloat() ?: 0f
        val height = (size["height"] as? Number)?.toFloat() ?: 0f
        view.setViewSize(width, height)
      }

      Prop("completionMode") { view: PaintCanvasView, mode: String ->
        view.setCompletionMode(mode)
      }

      // 🎨 사용자 선택 텍스처 URI
      Prop("textureUri") { view: PaintCanvasView, uri: String? ->
        view.setTextureUri(uri)
      }

      Events("onCellPainted", "onCanvasReady", "onViewportChange", "onNativeLog")
    }
  }
}
