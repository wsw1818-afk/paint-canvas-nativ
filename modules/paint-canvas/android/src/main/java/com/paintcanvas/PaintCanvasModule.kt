package com.paintcanvas

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaintCanvasModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaintCanvas")

    View(PaintCanvasView::class) {
      Prop("gridSize") { view: PaintCanvasView, gridSize: Int ->
        view.setGridSize(gridSize)
      }

      Prop("cells") { view: PaintCanvasView, cells: List<Map<String, Any>> ->
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
