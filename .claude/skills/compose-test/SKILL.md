---
name: compose-test
description: Visual smoke test for Compose page — creates test assets, verifies timeline, undo/redo, and canvas rendering
disable-model-invocation: true
---

# Compose Visual Smoke Test

Run a comprehensive visual test of the Compose editor in the browser.

## Prerequisites

- Dev server running (`npm run dev` or use preview_start)
- Browser available (Playwright MCP or Claude Preview)

## Test Steps

### 1. Navigate to Compose Page
- Open the app and navigate to the Compose tab via sidebar
- Verify "Com|pose" branded header renders
- Verify "Add Assets" step header is visible
- Verify DropZone is present

### 2. Create Test Assets
Use `preview_eval` or browser eval to create colored test images:

```javascript
async function createTestFile(color, name) {
  const canvas = document.createElement('canvas')
  canvas.width = 200; canvas.height = 200
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 200, 200)
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  return new File([blob], name, { type: 'image/png' })
}
```

Create Red.png, Blue.png, Green.png and add via store:
```javascript
const store = window.__ZUSTAND_DEVTOOLS__?.composeStore || /* direct store access */
```

### 3. Verify Assets Panel
- [ ] Assets appear as thumbnails in the grid
- [ ] Asset count matches expected (3)

### 4. Add Layers from Assets
- Click each asset to add as a layer
- Verify layers appear in timeline
- Verify canvas shows layers with correct z-order (first layer = top = foreground)

### 5. Test Undo/Redo
- After adding 3 layers, undo once → should have 2 layers
- Undo again → should have 1 layer
- Redo → should have 2 layers
- Redo → should have 3 layers
- Verify undo/redo buttons enable/disable correctly

### 6. Test Frame Navigation
- Click SkipForward 3 times → time should advance by ~0.1s (3 × 1/30s)
- Click SkipBack → time should decrease
- Verify playback time display updates

### 7. Test Layer Settings
- Select a layer → LayerSettings panel should show
- Verify blend mode dropdown works
- Verify opacity slider works
- Verify Duplicate button creates a copy
- Verify Split button works (for images, when playhead is within layer)
- Verify Delete button removes the layer

### 8. Test Timeline Interactions
- Verify layer bars render at correct positions
- Verify playhead indicator is visible
- Verify snap behavior (layer edges snap to other edges)

### 9. Verify Canvas Rendering
- Take screenshot and verify layers are composited
- Change blend mode → canvas should update
- Change opacity → canvas should reflect

### 10. Final Checks
- Clear All → everything resets
- Undo/Redo buttons should be disabled after clear

## Pass Criteria

All checkboxes above should pass. Report any failures with screenshots.
