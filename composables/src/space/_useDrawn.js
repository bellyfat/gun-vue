import { computed, markRaw, nextTick, reactive, ref, watch, onMounted } from 'vue'
import { createDrauu } from 'drauu'
import { toReactive, useStorage, useCycleList } from '@vueuse/core'


export const brushColors = [
  '#000000',
  ...new Array(12).fill(true).map((el, i) => `hsl(${i * 30}, 100%,50%)`),
  '#ffffff',
]

export const drawingModes = ['line', 'arrow', 'stylus', 'rectangle', 'ellipse']

export const brushSizes = useCycleList([4, 8, 16, 24])

export const drawingState = ref()
const pages = toReactive(useStorage('drawings', {}))

const currentPage = ref('/')

export const drawingEnabled = ref(false)
export const drawingPinned = useStorage('drawing-pinned', false)
export const canUndo = ref(false)
export const canRedo = ref(false)
export const canClear = ref(false)
export const isDrawing = ref(false)
export const drawingInitiated = ref(false)

export const brush = toReactive(useStorage('drawing-brush', {
  color: brushColors[0],
  size: 10,
  mode: 'stylus',
}))

const _mode = ref('stylus')
let disableDump = false

export const drawingMode = computed({
  get() {
    return _mode.value
  },
  set(v) {
    _mode.value = v
    if (v === 'arrow') {
      brush.mode = 'line'
      brush.arrowEnd = true
    }
    else {
      brush.mode = v
      brush.arrowEnd = false
    }
  },
})

export const drauuOptions = reactive({
  brush,
  acceptsInputTypes: computed(() => drawingEnabled.value ? undefined : ['pen']),
  coordinateTransform: true,
})
export const drauu = markRaw(createDrauu(drauuOptions))

export function clearDrauu() {
  drauu.clear()
}

export function updateState() {
  canRedo.value = drauu.canRedo()
  canUndo.value = drauu.canUndo()
  canClear.value = !!drauu.el?.children.length
}

export function loadCanvas(page) {
  disableDump = true
  const data = pages[page || currentPage.value]
  if (data != null)
    drauu.load(data)
  else
    drauu.clear()
  disableDump = false
}

export function useDraw() {
  if (!drawingInitiated.value) {
    drauu.on('changed', () => {
      updateState()
      if (!disableDump) {
        const dump = drauu.dump()
        const key = currentPage.value
        if ((pages[key] || '') !== dump)
          pages[key] = dump
      }
    })

    onMounted(() => {
      nextTick(() => {
        if (pages?.[currentPage.value] != null)
          drauu.load(pages?.[currentPage.value] || '')
      })

    })

    watch(currentPage, (page) => {
      disableDump = true
      if (pages[page] != null)
        drauu.load(pages[page] || '')
      disableDump = false
      updateState()
    })

    nextTick(() => {
      watch(currentPage, () => {

        loadCanvas()
      }, { immediate: true })
    })

    drauu.on('start', () => isDrawing.value = true)
    drauu.on('end', () => isDrawing.value = false)

    window.addEventListener('keydown', (e) => {
      if (!drawingEnabled.value)
        return

      const noModifier = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
      let handled = true
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey)
          drauu.redo()
        else
          drauu.undo()
      }
      else if (e.code === 'Escape') {
        drawingEnabled.value = false
      }
      else if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
        clearDrauu()
      }
      else if (e.code.startsWith('Digit') && noModifier && +e.code[5] <= brushColors.length) {
        brush.color = brushColors[+e.code[5] - 1]
      }
      else {
        handled = false
      }

      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }, false)
  }

  drawingInitiated.value = true

  return {
    brush, brushColors, brushSizes, canClear,
    canRedo, canUndo, clearDrauu, currentPage,
    drauu, drawingEnabled, drawingMode, drawingPinned, loadCanvas
  }
}




