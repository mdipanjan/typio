/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ActionType } from '../../common/state/sessionActions.js';
import { MessageKind, ResponsePartKind } from '../../common/state/sessionState.js';
import { mapPiRpcEventToActions, startPiTurn, type IPiTurnMapState } from '../../node/pi/piEventMapper.js';

suite('piEventMapper', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('creates a turn-start action from prompt text', () => {
		assert.deepStrictEqual(startPiTurn('turn-1', 'hello'), {
			type: ActionType.ChatTurnStarted,
			turnId: 'turn-1',
			message: { text: 'hello', origin: { kind: MessageKind.User } },
		});
	});

	test('maps text deltas to response part then delta', () => {
		const state: IPiTurnMapState = { turnId: 'turn-1', prompt: 'hello' };
		const actions = mapPiRpcEventToActions(state, {
			type: 'message_update',
			assistantMessageEvent: { type: 'text_delta', delta: 'Hi' },
		});

		assert.strictEqual(actions.length, 2);
		assert.strictEqual(actions[0].type, ActionType.ChatResponsePart);
		assert.strictEqual(actions[0].turnId, 'turn-1');
		assert.strictEqual(actions[0].part.kind, ResponsePartKind.Markdown);
		assert.strictEqual(actions[0].part.content, '');
		assert.strictEqual(actions[1].type, ActionType.ChatDelta);
		assert.strictEqual(actions[1].turnId, 'turn-1');
		assert.strictEqual(actions[1].partId, actions[0].part.id);
		assert.strictEqual(actions[1].content, 'Hi');
	});

	test('maps tool execution lifecycle', () => {
		const state: IPiTurnMapState = { turnId: 'turn-1', prompt: 'hello', toolCalls: new Map() };

		const startActions = mapPiRpcEventToActions(state, {
			type: 'tool_execution_start',
			toolCallId: 'tool-1',
			toolName: 'bash',
			args: { command: 'pwd' },
		});
		assert.deepStrictEqual(startActions.map(action => action.type), [
			ActionType.ChatToolCallStart,
			ActionType.ChatToolCallReady,
		]);

		const updateActions = mapPiRpcEventToActions(state, {
			type: 'tool_execution_update',
			toolCallId: 'tool-1',
			partialResult: { content: [{ type: 'text', text: '/repo' }] },
		});
		assert.strictEqual(updateActions[0].type, ActionType.ChatToolCallContentChanged);
		assert.deepStrictEqual(updateActions[0].content, [{ type: 'text', text: '/repo' }]);

		const endActions = mapPiRpcEventToActions(state, {
			type: 'tool_execution_end',
			toolCallId: 'tool-1',
			result: { content: [{ type: 'text', text: '/repo' }] },
			isError: false,
		});
		assert.strictEqual(endActions[0].type, ActionType.ChatToolCallComplete);
		assert.strictEqual(endActions[0].result.success, true);
		assert.deepStrictEqual(endActions[0].result.content, [{ type: 'text', text: '/repo' }]);
	});

	test('maps completion once', () => {
		const state: IPiTurnMapState = { turnId: 'turn-1', prompt: 'hello' };

		assert.deepStrictEqual(mapPiRpcEventToActions(state, { type: 'agent_end' }), [
			{ type: ActionType.ChatTurnComplete, turnId: 'turn-1' },
		]);
		assert.deepStrictEqual(mapPiRpcEventToActions(state, { type: 'agent_end' }), []);
	});
});
