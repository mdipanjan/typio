/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { IMouseWheelEvent } from '../../../../../base/browser/mouseEvent.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { isRequestVM } from '../../common/model/chatViewModel.js';
import { IChatWidget, IChatWidgetScrollMetrics, isIChatResourceViewContext } from '../chat.js';
import { IChatWidgetContrib } from './chatWidget.js';

const MIN_RAIL_WIDGET_WIDTH = 520;
const MIN_RAIL_HEIGHT = 80;
const PAGE_SCROLL_FACTOR = 0.85;

export interface IChatRightRailState {
	readonly visible: boolean;
	readonly thumbTop: number;
	readonly thumbHeight: number;
	readonly scrollPercent: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function computeChatRightRailState(metrics: IChatWidgetScrollMetrics): IChatRightRailState {
	if (!metrics.hasOverflow || metrics.scrollHeight <= 0 || metrics.renderHeight <= 0) {
		return { visible: false, thumbTop: 0, thumbHeight: 100, scrollPercent: 0 };
	}

	const maxScrollTop = Math.max(1, metrics.scrollHeight - metrics.renderHeight);
	const fraction = clamp(metrics.scrollTop / maxScrollTop, 0, 1);
	const thumbHeight = clamp((metrics.renderHeight / metrics.scrollHeight) * 100, 6, 100);
	const thumbTop = fraction * (100 - thumbHeight);

	return {
		visible: true,
		thumbTop,
		thumbHeight,
		scrollPercent: Math.round(fraction * 100),
	};
}

export class ChatRightRailContrib extends Disposable implements IChatWidgetContrib {
	static readonly ID = 'chat.rightRail';
	readonly id = ChatRightRailContrib.ID;

	private readonly rail: HTMLElement;
	private readonly track: HTMLElement;
	private readonly thumb: HTMLButtonElement;
	private readonly dragListeners = this._register(new DisposableStore());
	private readonly markerListeners = this._register(new DisposableStore());
	private readonly viewModelListeners = this._register(new DisposableStore());
	private readonly markers: HTMLButtonElement[] = [];
	private markerRenderSignature = '';
	private animationFrame = 0;

	constructor(private readonly widget: IChatWidget) {
		super();

		this.rail = dom.append(widget.domNode, dom.$('.chat-right-rail'));
		this.track = dom.append(this.rail, dom.$('.chat-right-rail-track'));
		this.thumb = dom.append(this.track, dom.$('button.chat-right-rail-thumb'));
		this.thumb.type = 'button';
		this.thumb.setAttribute('role', 'scrollbar');
		this.thumb.setAttribute('aria-label', 'Scroll chat');
		this.thumb.setAttribute('aria-orientation', 'vertical');
		this.thumb.setAttribute('aria-valuemin', '0');
		this.thumb.setAttribute('aria-valuemax', '100');

		this._register(toDisposable(() => {
			if (this.animationFrame) {
				dom.getWindow(this.widget.domNode).cancelAnimationFrame(this.animationFrame);
				this.animationFrame = 0;
			}
			this.rail.remove();
		}));

		this._register(widget.onDidScroll(() => this.scheduleUpdate()));
		this._register(widget.onDidChangeContentHeight(() => this.scheduleUpdate()));
		this._register(widget.onDidChangeViewModel(() => {
			this.markerRenderSignature = '';
			this.registerViewModelListeners();
			this.scheduleUpdate();
		}));
		this.registerViewModelListeners();

		const resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
		resizeObserver.observe(widget.domNode);
		this._register(toDisposable(() => resizeObserver.disconnect()));

		this._register(dom.addDisposableListener(this.track, dom.EventType.CLICK, e => this.onTrackClick(e)));
		this._register(dom.addDisposableListener(this.thumb, dom.EventType.POINTER_DOWN, e => this.onThumbPointerDown(e)));
		this._register(dom.addDisposableListener(this.thumb, dom.EventType.KEY_DOWN, e => this.onThumbKeyDown(e)));
		this._register(dom.addDisposableListener(this.rail, dom.EventType.MOUSE_WHEEL, (e: IMouseWheelEvent) => this.widget.delegateScrollFromMouseWheelEvent(e)));

		this.scheduleUpdate();
	}

	private isEligible(): boolean {
		if (isIChatResourceViewContext(this.widget.viewContext) && (this.widget.viewContext.isQuickChat || this.widget.viewContext.isInlineChat)) {
			return false;
		}

		return this.widget.domNode.clientWidth >= MIN_RAIL_WIDGET_WIDTH && this.widget.domNode.clientHeight >= MIN_RAIL_HEIGHT;
	}

	private registerViewModelListeners(): void {
		this.viewModelListeners.clear();
		const viewModel = this.widget.viewModel;
		if (!viewModel) {
			return;
		}

		this.viewModelListeners.add(viewModel.onDidChange(() => this.scheduleUpdate()));
	}

	private scheduleUpdate(): void {
		if (this.animationFrame) {
			return;
		}

		const targetWindow = dom.getWindow(this.widget.domNode);
		this.animationFrame = targetWindow.requestAnimationFrame(() => {
			this.animationFrame = 0;
			this.update();
		});
	}

	private update(): void {
		const metrics = this.widget.getScrollMetrics();
		const state = computeChatRightRailState(metrics);
		// Don't show a full-height provisional thumb while a session is still loading
		// or before any transcript turns have materialized.
		const hasTranscriptItems = (this.widget.viewModel?.getItems().length ?? 0) > 0;
		const visible = this.isEligible() && hasTranscriptItems && state.visible;
		this.rail.classList.toggle('chat-right-rail-hidden', !visible);
		if (!visible) {
			this.thumb.setAttribute('aria-hidden', 'true');
			return;
		}

		this.thumb.style.top = `${state.thumbTop}%`;
		this.thumb.style.height = `${state.thumbHeight}%`;
		this.thumb.setAttribute('aria-hidden', 'false');
		this.thumb.setAttribute('aria-valuenow', String(state.scrollPercent));
		this.renderMarkers(metrics);
		this.updateActiveMarker(metrics);
	}

	private clearMarkers(): void {
		this.markerListeners.clear();
		for (const marker of this.markers) {
			marker.remove();
		}
		this.markers.length = 0;
	}

	private renderMarkers(metrics: IChatWidgetScrollMetrics): void {
		const viewModel = this.widget.viewModel;
		if (!viewModel || metrics.scrollHeight <= 0) {
			this.markerRenderSignature = '';
			this.clearMarkers();
			return;
		}

		const items = viewModel.getItems();
		const requestIds = items.filter(isRequestVM).map(item => item.id).join('|');
		const signature = `${viewModel.sessionResource.toString()}@${Math.round(metrics.scrollHeight)}@${Math.round(metrics.contentHeight)}@${items.length}@${requestIds}`;
		if (signature === this.markerRenderSignature) {
			return;
		}
		this.markerRenderSignature = signature;
		this.clearMarkers();

		const fallbackItemHeight = metrics.contentHeight > 0 && items.length > 0 ? metrics.contentHeight / items.length : 0;
		let offset = 0;
		for (const item of items) {
			const itemHeight = item.currentRenderedHeight ?? fallbackItemHeight;
			if (isRequestVM(item)) {
				const markerScrollTop = offset;
				const marker = dom.append(this.track, dom.$('button.chat-right-rail-marker')) as HTMLButtonElement;
				const label = item.messageText.trim().replace(/\s+/g, ' ');
				const shortLabel = label.length > 96 ? `${label.slice(0, 95)}…` : label;
				marker.type = 'button';
				marker.style.top = `${clamp((markerScrollTop / metrics.scrollHeight) * 100, 0, 100)}%`;
				marker.dataset.scrollTop = String(markerScrollTop);
				marker.title = shortLabel;
				marker.setAttribute('aria-label', `Scroll to message: ${shortLabel}`);
				marker.setAttribute('data-label', shortLabel);
				this.markers.push(marker);
				this.markerListeners.add(dom.addDisposableListener(marker, dom.EventType.CLICK, event => {
					event.preventDefault();
					event.stopPropagation();
					this.setScrollTop(markerScrollTop);
				}));
			}
			offset += itemHeight;
		}
	}

	private updateActiveMarker(metrics: IChatWidgetScrollMetrics): void {
		if (this.markers.length === 0) {
			return;
		}

		const viewportAnchor = metrics.scrollTop + metrics.renderHeight * 0.35;
		let activeMarker: HTMLElement | undefined;
		let activeDistance = Number.POSITIVE_INFINITY;
		for (const marker of this.markers) {
			const markerScrollTop = Number(marker.dataset.scrollTop);
			if (!Number.isFinite(markerScrollTop)) {
				continue;
			}

			const distance = Math.abs(markerScrollTop - viewportAnchor);
			if (distance < activeDistance) {
				activeDistance = distance;
				activeMarker = marker;
			}
		}

		for (const marker of this.markers) {
			marker.classList.toggle('chat-right-rail-marker-active', marker === activeMarker);
		}
	}

	private onTrackClick(event: MouseEvent): void {
		if (event.target === this.thumb) {
			return;
		}

		event.preventDefault();
		this.scrollToTrackPoint(event.clientY);
	}

	private onThumbPointerDown(event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.thumb.focus();
		this.scrollToTrackPoint(event.clientY);

		this.dragListeners.clear();
		const targetWindow = dom.getWindow(this.widget.domNode);
		const onMove = (moveEvent: PointerEvent) => {
			moveEvent.preventDefault();
			this.scrollToTrackPoint(moveEvent.clientY);
		};
		const onUp = () => this.dragListeners.clear();

		targetWindow.addEventListener('pointermove', onMove, { passive: false });
		targetWindow.addEventListener('pointerup', onUp);
		targetWindow.addEventListener('pointercancel', onUp);
		this.dragListeners.add(toDisposable(() => {
			targetWindow.removeEventListener('pointermove', onMove);
			targetWindow.removeEventListener('pointerup', onUp);
			targetWindow.removeEventListener('pointercancel', onUp);
		}));
	}

	private onThumbKeyDown(event: KeyboardEvent): void {
		const metrics = this.widget.getScrollMetrics();
		const pageDelta = metrics.renderHeight * PAGE_SCROLL_FACTOR;
		let nextScrollTop: number | undefined;

		switch (event.key) {
			case 'ArrowUp':
				nextScrollTop = metrics.scrollTop - 40;
				break;
			case 'ArrowDown':
				nextScrollTop = metrics.scrollTop + 40;
				break;
			case 'PageUp':
				nextScrollTop = metrics.scrollTop - pageDelta;
				break;
			case 'PageDown':
				nextScrollTop = metrics.scrollTop + pageDelta;
				break;
			case 'Home':
				nextScrollTop = 0;
				break;
			case 'End':
				nextScrollTop = metrics.scrollHeight;
				break;
		}

		if (nextScrollTop === undefined) {
			return;
		}

		event.preventDefault();
		this.setScrollTop(nextScrollTop);
	}

	private scrollToTrackPoint(clientY: number): void {
		const rect = this.track.getBoundingClientRect();
		if (rect.height <= 0) {
			return;
		}

		const metrics = this.widget.getScrollMetrics();
		const thumbHeightPx = (computeChatRightRailState(metrics).thumbHeight / 100) * rect.height;
		const travel = Math.max(1, rect.height - thumbHeightPx);
		const fraction = clamp((clientY - rect.top - thumbHeightPx / 2) / travel, 0, 1);
		this.setScrollTop(fraction * Math.max(0, metrics.scrollHeight - metrics.renderHeight));
	}

	private setScrollTop(scrollTop: number): void {
		const metrics = this.widget.getScrollMetrics();
		this.widget.setScrollTop(clamp(scrollTop, 0, Math.max(0, metrics.scrollHeight - metrics.renderHeight)));
		this.scheduleUpdate();
	}
}
