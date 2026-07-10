# Chat Right Rail Plan

## Status

- Branch: `product/chat-right-rail-plan`
- v0 implemented in this branch:
  - chat scroll metrics API
  - `ChatRightRailContrib`
  - rail CSS
  - pure rail-state regression tests
- Remaining before PR: visual smoke in the running workbench.

## Goal

Add a Seldon-inspired right-hand rail to VS Code chat. The rail should sit on the right side of the chat transcript and give users a compact sense of position, scroll affordance, and eventually semantic landmarks such as requests, responses, tool calls, checkpoints, and annotations.

This is a new Typio/VS Code addition; it is not present in upstream VS Code.

## Reference

Seldon implementation reviewed:

- `/Users/dipanjanmondal/2026/projects/seldon/web/review/src/components/AnnotationRail.tsx`
- `/Users/dipanjanmondal/2026/projects/seldon/web/review/src/hooks/useAnnotationRail.ts`
- `/Users/dipanjanmondal/2026/projects/seldon/web/review/src/styles/annotations.css`

Seldon behavior:

- Fixed right-side rail beside document content.
- Shows scroll thumb based on document scroll fraction.
- Shows annotation ticks clustered by vertical position.
- Optional diff heat marks and previews.
- Uses browser document metrics: `window.scrollY`, `document.documentElement.scrollHeight`, DOM anchors, and `window.scrollTo`.

## VS Code Chat Differences

VS Code chat is not document-scrolled like Seldon.

Relevant files:

- `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatListWidget.ts`
- `src/vs/workbench/contrib/chat/browser/widget/media/chat.css`
- `src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts`
- `src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/media/chatViewPane.css`

Important constraints:

- Chat content is rendered inside `ChatListWidget`, backed by a virtualized tree/list.
- The browser document does not scroll for the transcript; the chat list scrolls.
- `ChatWidget` exposes `scrollTop` and `onDidScroll`.
- `ChatListWidget` has useful internals: `scrollTop`, `scrollHeight`, `renderHeight`, `contentHeight`, `isScrolledToBottom`.
- `IChatWidget` currently exposes `scrollTop` indirectly only on concrete `ChatWidget`, not enough typed metrics for a reusable contribution.
- `.interactive-session` is `position: relative`, `max-width: 950px`, `height: 100%`, and is a suitable rail host.
- `.interactive-list` is the transcript area and is `position: relative`/`overflow: hidden`.

## Product Shape

### v0: Scroll Position Rail

A minimal non-disruptive rail on the right side of full chat widgets:

- Thin vertical track.
- Draggable or clickable thumb showing current scroll position.
- Hidden when content does not overflow.
- Hidden in cramped/narrow layouts.
- Does not overlap message text or input controls.
- No semantic markers yet.

Purpose:

- Validate layout integration with chat view, editor chat, and session view.
- Establish safe scroll metrics API.
- Avoid virtualized row/anchor complexity in first slice.

### v1: Semantic Chat Markers

Add ticks for transcript landmarks:

- User requests.
- Assistant responses.
- Tool invocations / terminal tool sections.
- Checkpoint/file-change summaries.
- Error turns.
- Active/in-progress turn.

Behavior:

- Hover/focus reveals concise label.
- Click scrolls to the corresponding item.
- Cluster nearby markers when transcript is long.
- Use VS Code theme colors and accessibility patterns.

### v2: Review/Annotation Markers

If/when chat has reviewable annotations or plan-review comments:

- Show annotation/comment ticks similar to Seldon.
- Marker click reveals associated chat part or review UI.
- Optional mini preview for changed files/checkpoints.

## Proposed Architecture

### New Chat Widget Contribution

Create a new contribution class:

- `src/vs/workbench/contrib/chat/browser/widget/chatRightRailContrib.ts`

Register it with:

- `ChatWidget.CONTRIBS.push(ChatRightRailContrib)`

Why a contribution:

- Keeps feature isolated from core chat rendering.
- Follows existing chat extension pattern (`IChatWidgetContrib`).
- Can be disabled/hardened without touching request/response renderers.

### Typed Scroll Metrics API

Add a small public method to `ChatWidget` and `IChatWidget`, backed by `ChatListWidget`:

```ts
export interface IChatWidgetScrollMetrics {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly renderHeight: number;
  readonly contentHeight: number;
  readonly hasOverflow: boolean;
}
```

Potential API:

```ts
getScrollMetrics(): IChatWidgetScrollMetrics;
setScrollTop(scrollTop: number): void;
```

Alternative:

- Expose `scrollHeight` and `renderHeight` getters directly on `IChatWidget`.

Preference:

- Use `getScrollMetrics()` to keep the public surface compact and explicit.

### Rail DOM

Contribution creates:

```html
<div class="chat-right-rail" aria-hidden="false">
  <div class="chat-right-rail-track">
    <button class="chat-right-rail-thumb" role="scrollbar" ...></button>
  </div>
</div>
```

Placement:

- Append to `widget.domNode` (`.interactive-session`).
- Absolute positioned inside chat widget, right side.
- Avoid fixed positioning because chat can live in side bar, panel, editor, auxiliary bar, or sessions window.

### Styling

Add CSS to:

- `src/vs/workbench/contrib/chat/browser/widget/media/chat.css`

Initial CSS direction:

```css
.interactive-session .chat-right-rail {
  position: absolute;
  top: 48px;
  right: 8px;
  bottom: 112px;
  width: 24px;
  z-index: 5;
  pointer-events: none;
}

.interactive-session .chat-right-rail-track {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--vscode-scrollbarSlider-background);
}

.interactive-session .chat-right-rail-thumb {
  position: absolute;
  left: 50%;
  width: 8px;
  min-height: 24px;
  transform: translateX(-50%);
  border: 0;
  border-radius: 999px;
  background: var(--vscode-scrollbarSlider-hoverBackground);
  pointer-events: auto;
  cursor: ns-resize;
}
```

Need final polish after seeing it in the workbench.

### Visibility Rules

Hide rail when:

- No overflow (`scrollHeight <= renderHeight + 1`).
- Widget is quick chat or inline chat.
- Widget width below threshold, e.g. `< 520px`.
- Chat input/list is not laid out yet.

Possibly hide when:

- Accessibility setting demands reduced clutter.
- Screen reader optimized mode is enabled.

### Interactions

v0 interactions:

- Thumb reflects `scrollTop / (scrollHeight - renderHeight)`.
- Dragging thumb changes chat `scrollTop`.
- Clicking track jumps to corresponding scroll fraction.
- Keyboard support on thumb:
  - ArrowUp/ArrowDown small delta.
  - PageUp/PageDown viewport delta.
  - Home/End top/bottom.
- Mouse wheel over rail delegates to chat list scroll.

Important:

- Do not steal focus unexpectedly.
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation="vertical"` on thumb if focusable.

## Implementation Steps

### Step 1: Branch and Plan

- Create branch `product/chat-right-rail-plan`.
- Add this plan doc.

### Step 2: Scroll Metrics API

Files:

- `src/vs/workbench/contrib/chat/browser/chat.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`

Tasks:

- Add `IChatWidgetScrollMetrics` interface.
- Add `getScrollMetrics()` to `IChatWidget`.
- Implement in `ChatWidget` using `this.listWidget`.

Risks:

- Some tests/mocks implementing `IChatWidget` may need updates.

### Step 3: Rail Contribution Skeleton

Files:

- `src/vs/workbench/contrib/chat/browser/widget/chatRightRailContrib.ts`
- `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` or another registration module

Tasks:

- Implement `IChatWidgetContrib`.
- Append rail DOM to `widget.domNode`.
- Subscribe to:
  - `widget.onDidScroll`
  - `widget.onDidChangeViewModel`
  - `widget.onDidChangeContentHeight` if accessible, or use existing layout/scroll events plus resize observer
- Use `requestAnimationFrame` to coalesce updates.
- Dispose listeners and DOM.

Potential blocker:

- `IChatWidget` exposes `onDidScroll` but not `onDidChangeContentHeight`. If needed, expose it or observe DOM size with `ResizeObserver`.

### Step 4: v0 Render/Interaction

Tasks:

- Calculate thumb top/height from metrics.
- Implement track click and thumb drag.
- Implement keyboard behavior.
- Guard against zero/invalid dimensions.
- Hide while not overflowed.

### Step 5: CSS Polish

Tasks:

- Theme-compatible colors.
- Works in light/dark/high contrast.
- Does not overlap native scrollbar or input.
- Hide at narrow widths.
- Different offsets for chat view vs chat editor if needed.

### Step 6: Tests

Likely tests:

- Unit/browser test for `ChatRightRailContrib` math.
- Contribution creates rail only for eligible widgets.
- Updates hidden state when no overflow.
- Thumb drag/click calls `setScrollTop` or sets `scrollTop` correctly.
- Disposal removes DOM/listeners.

Potential test location:

- `src/vs/workbench/contrib/chat/test/browser/widget/chatRightRailContrib.test.ts`

Need to inspect existing chat widget test patterns before implementation.

### Step 7: Manual Smoke

Use VS Code launch skill to inspect visually:

- Chat view in side bar.
- Chat editor in editor area.
- Chat in panel/auxiliary bar if supported.
- Narrow width hides rail.
- Long chat transcript shows thumb.
- Drag/click scroll works.
- No layout shift in input or messages.
- No leaked disposables.

## Open Questions

1. Should v0 rail be always-on for all chat widgets, or only Typio/agent-host sessions?
   - Recommendation: all full chat widgets, but hide in quick/inline chat.

2. Should rail appear inside the chat content width or in the right margin outside message cards?
   - Recommendation: right margin inside `.interactive-session`, because chat has max-width and margins already.

3. Should native scrollbar remain visible?
   - Recommendation: yes for v0. Rail is an additional navigational affordance, not a replacement.

4. Should semantic markers use virtualized list item metadata or DOM measurements?
   - Recommendation: list item metadata/index for v1 where possible; DOM measurement only for rendered items.

5. Should this be behind a setting?
   - Recommendation: yes if it ships beyond prototype, e.g. `chat.rightRail.enabled` default true/false to be decided after smoke.

## Risks

- Chat list virtualization makes exact marker positioning tricky.
- Rail may collide with native scrollbar or action hover affordances.
- Chat appears in many containers; absolute positioning must be container-relative.
- Touch/mouse/keyboard accessibility needs careful handling.
- Mocks/tests implementing `IChatWidget` may need updates when adding API.

## Acceptance Criteria for v0

- Long chat transcript shows a right rail thumb beside chat content.
- Thumb position and height match current scroll state.
- Dragging/clicking rail scrolls chat transcript.
- Rail hides when transcript does not overflow.
- Rail hides in narrow layouts and quick/inline chat.
- No visible overlap with input, native scrollbar, or message text.
- No disposable leaks.
- Typecheck passes.
- Targeted browser tests pass.

## Non-goals for v0

- Full Seldon annotation functionality.
- Diff heat maps.
- File preview cards.
- Replacing the native scrollbar.
- Persisting rail state.
