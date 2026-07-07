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
	textContent?: string;
	reasoningPartId?: string;
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
		if (assistantEvent.type === 'thinking_start') {
			return [ensureReasoningPart(state)];
		}
		if (assistantEvent.type === 'thinking_delta' && typeof assistantEvent.delta === 'string' && assistantEvent.delta.length > 0) {
			const actions: ChatAction[] = [];
			if (!state.reasoningPartId) {
				actions.push(ensureReasoningPart(state));
			}
			actions.push({
				type: ActionType.ChatReasoning,
				turnId: state.turnId,
				partId: state.reasoningPartId!,
				content: assistantEvent.delta,
			});
			return actions;
		}
		if (assistantEvent.type === 'text_start') {
			return [ensureTextPart(state)];
		}
		if (assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string' && assistantEvent.delta.length > 0) {
			const actions: ChatAction[] = [];
			if (!state.partId) {
				actions.push(ensureTextPart(state));
			}
			state.textContent = `${state.textContent ?? ''}${assistantEvent.delta}`;
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

	if (event.type === 'queue_update') {
		return [{
			type: ActionType.ChatActivityChanged,
			activity: formatQueueActivity(event),
		}];
	}

	if (event.type === 'compaction_start') {
		return [{ type: ActionType.ChatActivityChanged, activity: 'Compacting context...' }];
	}

	if (event.type === 'compaction_end') {
		return compactedActions(state, event);
	}

	if (event.type === 'auto_retry_start') {
		return [{ type: ActionType.ChatActivityChanged, activity: formatRetryActivity(event) }];
	}

	if (event.type === 'auto_retry_end') {
		return [{ type: ActionType.ChatActivityChanged, activity: undefined }];
	}

	if (event.type === 'agent_end') {
		state.completed = true;
		return completeTurnActions(state, event);
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

function ensureReasoningPart(state: IPiTurnMapState): ChatAction {
	state.reasoningPartId ??= generateUuid();
	return {
		type: ActionType.ChatResponsePart,
		turnId: state.turnId,
		part: {
			kind: ResponsePartKind.Reasoning,
			id: state.reasoningPartId,
			content: '',
		},
	};
}

function completeTurnActions(state: IPiTurnMapState, event: PiRpcMessage): ChatAction[] {
	const actions: ChatAction[] = [];
	const finalText = extractLastAssistantText(event.messages);
	if (finalText && !state.textContent?.trim()) {
		if (!state.partId) {
			actions.push(ensureTextPart(state));
		}
		state.textContent = finalText;
		actions.push({ type: ActionType.ChatDelta, turnId: state.turnId, partId: state.partId!, content: finalText });
	}
	const usage = extractLastAssistantUsage(event.messages);
	if (usage) {
		actions.push({ type: ActionType.ChatUsage, turnId: state.turnId, usage });
	}
	actions.push({ type: ActionType.ChatActivityChanged, activity: undefined });
	actions.push({ type: ActionType.ChatTurnComplete, turnId: state.turnId });
	return actions;
}

function compactedActions(state: IPiTurnMapState, event: PiRpcMessage): ChatAction[] {
	const actions: ChatAction[] = [{ type: ActionType.ChatActivityChanged, activity: undefined }];
	const result = getObject(event.result);
	if (event.aborted === true) {
		actions.push(systemNotificationPart(state, 'Context compaction was cancelled.'));
		return actions;
	}
	if (!result) {
		const message = typeof event.errorMessage === 'string' ? event.errorMessage : 'Context compaction failed.';
		actions.push(systemNotificationPart(state, message));
		return actions;
	}
	const before = typeof result.tokensBefore === 'number' ? result.tokensBefore : undefined;
	const after = typeof result.estimatedTokensAfter === 'number' ? result.estimatedTokensAfter : undefined;
	const summary = before !== undefined && after !== undefined
		? `Compacted context from ${before.toLocaleString()} to about ${after.toLocaleString()} tokens.`
		: 'Compacted context.';
	actions.push(systemNotificationPart(state, summary));
	return actions;
}

function systemNotificationPart(state: IPiTurnMapState, content: string): ChatAction {
	return {
		type: ActionType.ChatResponsePart,
		turnId: state.turnId,
		part: {
			kind: ResponsePartKind.SystemNotification,
			content,
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

function extractLastAssistantText(messages: unknown): string {
	if (!Array.isArray(messages)) {
		return '';
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = getObject(messages[i]);
		if (message?.role !== 'assistant') {
			continue;
		}
		return extractMessageText(message.content);
	}
	return '';
}

function extractMessageText(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}
	if (!Array.isArray(content)) {
		return '';
	}
	return content
		.map(item => getObject(item))
		.filter(item => item?.type === 'text' && typeof item.text === 'string')
		.map(item => item!.text as string)
		.join('');
}

function extractLastAssistantUsage(messages: unknown): { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; model?: string; _meta?: Record<string, unknown> } | undefined {
	if (!Array.isArray(messages)) {
		return undefined;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = getObject(messages[i]);
		if (message?.role !== 'assistant') {
			continue;
		}
		const usage = getObject(message.usage);
		if (!usage) {
			return undefined;
		}
		const result: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; model?: string; _meta?: Record<string, unknown> } = {};
		if (typeof usage.input === 'number') {
			result.inputTokens = usage.input;
		}
		if (typeof usage.output === 'number') {
			result.outputTokens = usage.output;
		}
		if (typeof usage.cacheRead === 'number') {
			result.cacheReadTokens = usage.cacheRead;
		}
		if (typeof message.model === 'string') {
			result.model = message.model;
		}
		result._meta = { provider: message.provider, cost: usage.cost };
		return result;
	}
	return undefined;
}

function formatQueueActivity(event: PiRpcMessage): string | undefined {
	const steering = Array.isArray(event.steering) ? event.steering.length : 0;
	const followUp = Array.isArray(event.followUp) ? event.followUp.length : 0;
	const total = steering + followUp;
	return total > 0 ? `${total} queued message${total === 1 ? '' : 's'}` : undefined;
}

function formatRetryActivity(event: PiRpcMessage): string {
	const attempt = typeof event.attempt === 'number' ? event.attempt : undefined;
	const maxAttempts = typeof event.maxAttempts === 'number' ? event.maxAttempts : undefined;
	const delayMs = typeof event.delayMs === 'number' ? event.delayMs : undefined;
	const attemptText = attempt !== undefined && maxAttempts !== undefined ? ` ${attempt}/${maxAttempts}` : '';
	const delayText = delayMs !== undefined ? ` in ${Math.round(delayMs / 1000)}s` : '';
	return `Retrying${attemptText}${delayText}...`;
}
