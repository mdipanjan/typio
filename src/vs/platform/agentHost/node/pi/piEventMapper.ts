/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../base/common/uuid.js';
import { ActionType, type ChatAction } from '../../common/state/sessionActions.js';
import { MessageKind, ResponsePartKind, ToolCallConfirmationReason, ToolResultContentType } from '../../common/state/sessionState.js';
import type { PiRpcMessage } from './piRpcClient.js';

export interface IPiTurnMapState {
	readonly turnId: string;
	readonly prompt: string;
	partId?: string;
	completed?: boolean;
	readonly toolCalls?: Map<string, { readonly toolName: string; output: string }>;
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
		if (assistantEvent.type === 'error') {
			state.completed = true;
			if (assistantEvent.reason === 'aborted') {
				return [{ type: ActionType.ChatTurnCancelled, turnId: state.turnId }];
			}
			return [{
				type: ActionType.ChatError,
				turnId: state.turnId,
				error: {
					errorType: 'pi.rpc.error',
					message: typeof assistantEvent.message === 'string' ? assistantEvent.message : 'Pi Agent encountered an error.',
				},
			}];
		}
		return [];
	}

	if (event.type === 'tool_execution_start') {
		const toolCallId = typeof event.toolCallId === 'string' ? event.toolCallId : generateUuid();
		const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool';
		state.toolCalls?.set(toolCallId, { toolName, output: '' });
		const input = stringifyToolInput(event.args);
		return [
			{
				type: ActionType.ChatToolCallStart,
				turnId: state.turnId,
				toolCallId,
				toolName,
				displayName: toolName,
			},
			{
				type: ActionType.ChatToolCallReady,
				turnId: state.turnId,
				toolCallId,
				invocationMessage: input || toolName,
				toolInput: input,
				confirmed: ToolCallConfirmationReason.NotNeeded,
			},
		];
	}

	if (event.type === 'tool_execution_update' && typeof event.toolCallId === 'string') {
		const text = extractToolResultText(event.partialResult);
		const tracked = state.toolCalls?.get(event.toolCallId);
		if (tracked) {
			tracked.output = text;
		}
		return [{
			type: ActionType.ChatToolCallContentChanged,
			turnId: state.turnId,
			toolCallId: event.toolCallId,
			content: text ? [{ type: ToolResultContentType.Text, text }] : [],
		}];
	}

	if (event.type === 'tool_execution_end' && typeof event.toolCallId === 'string') {
		const text = extractToolResultText(event.result);
		const tracked = state.toolCalls?.get(event.toolCallId);
		if (tracked) {
			tracked.output = text;
			state.toolCalls?.delete(event.toolCallId);
		}
		const success = event.isError !== true;
		return [{
			type: ActionType.ChatToolCallComplete,
			turnId: state.turnId,
			toolCallId: event.toolCallId,
			result: {
				success,
				pastTenseMessage: success ? 'Tool completed' : 'Tool failed',
				content: text ? [{ type: ToolResultContentType.Text, text }] : [],
				...(success ? {} : { error: { message: text || 'Tool failed' } }),
			},
		}];
	}

	if (event.type === 'agent_end') {
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

function stringifyToolInput(value: unknown): string {
	if (value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	try {
		return JSON.stringify(value, undefined, 2);
	} catch {
		return String(value);
	}
}

function extractToolResultText(value: unknown): string {
	const result = getObject(value);
	const content = Array.isArray(result?.content) ? result.content : [];
	const text = content
		.map(item => getObject(item))
		.filter(item => item?.type === 'text' && typeof item.text === 'string')
		.map(item => item!.text as string)
		.join('\n');
	if (text.length > 0) {
		return text;
	}
	return typeof result?.text === 'string' ? result.text : '';
}
