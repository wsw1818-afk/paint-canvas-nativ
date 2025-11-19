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

      Events("onCellPainted")
    }
  }
}
