package com.paintcanvas

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class PaintCanvasViewManager : SimpleViewManager<PaintCanvasView>() {
    override fun getName() = "PaintCanvasView"

    override fun createViewInstance(reactContext: ThemedReactContext): PaintCanvasView {
        return PaintCanvasView(reactContext)
    }

    @ReactProp(name = "gridSize")
    fun setGridSize(view: PaintCanvasView, gridSize: Int) {
        view.gridSize = gridSize
    }

    @ReactProp(name = "cells")
    fun setCells(view: PaintCanvasView, cells: ReadableArray) {
        val cellList = mutableListOf<CellData>()
        for (i in 0 until cells.size()) {
            val cell = cells.getMap(i)
            cellList.add(
                CellData(
                    row = cell.getInt("row"),
                    col = cell.getInt("col"),
                    targetColorHex = cell.getString("targetColorHex") ?: "#FFFFFF"
                )
            )
        }
        view.cells = cellList
    }

    @ReactProp(name = "selectedColorHex")
    fun setSelectedColorHex(view: PaintCanvasView, color: String) {
        view.selectedColorHex = color
    }

    @ReactProp(name = "imageUri")
    fun setImageUri(view: PaintCanvasView, uri: String?) {
        view.imageUri = uri
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onCellPainted",
            MapBuilder.of("registrationName", "onCellPainted")
        )
    }
}
