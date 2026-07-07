/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../base/common/uuid.js';
import { ActionType, type ChatAction } from '../../common/state/sessionActions.js';
import { MessageKind, ResponsePartKind } from '../../common/state/sessionState.js';
import type { PiRpcMessage } from './piRpcClient.js';

export interface IPiTurnMapState {
	readonly turnId: string;
	readonly prompt: string;
	partId?: string;
	completed?: boolean;
}

export function startPiTurn(turnId: string, prompt: string): ChatAction {
	return {
		type: ActionType.ChatTurnStarted,
		turnId,
		message: { text: prompt, origin: { kind: MessageKind.User } },
	};
}

export function mapPiRpcEventToActions(state: IPiTurnMapState, event: PiRpcMessage): ChatAction[] {
	if (state.completed) {
		return [];
	}

	if (event.type === 'message_update') {
		const assistantEvent = getObject(event.assistantMessageEvent);
		if (!assistantEvent) {
			return [];
		}
		if (assistantEvent.type === 'text_start') {
			return [ensureTextPart(state)];
		}
		if (assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string' && assistantEvent.delta.length > 0) {
			const actions: ChatAction[] = [];
			if (!state.partId) {
				actions.push(ensureTextPart(state));
			}
			actions.push({
				type: ActionType.ChatDelta,
				turnId: state.turnId,
				partId: state.partId!,
				content: assistantEvent.delta,
			});
			return actions;
		}
		return [];
	}

	if (event.type === 'turn_end' || event.type === 'agent_end') {
		state.completed = true;
		return [{ type: ActionType.ChatTurnComplete, turnId: state.turnId }];
	}

	return [];
}

function ensureTextPart(state: IPiTurnMapState): ChatAction {
	state.partId ??= generateUuid();
	return {
		type: ActionType.ChatResponsePart,
		turnId: state.turnId,
		part: {
			kind: ResponsePartKind.Markdown,
			id: state.partId,
			content: '',
		},
	};
}

function getObject(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
