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

      Events("onCellPainted")
    }
  }
}
