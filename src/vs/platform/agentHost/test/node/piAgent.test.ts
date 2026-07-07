/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AgentSession } from '../../common/agentService.js';
import { ActionType } from '../../common/state/sessionActions.js';
import { buildDefaultChatUri } from '../../common/state/sessionState.js';
import { PiAgent, PI_AGENT_PROVIDER_ID } from '../../node/pi/piAgent.js';
import type { PiRpcMessage, PiRpcObject } from '../../node/pi/piRpcClient.js';

class FakePiSessionClient {
	private readonly _onDidEvent = new Emitter<PiRpcMessage>();
	readonly onDidEvent = this._onDidEvent.event;
	private readonly _onDidExit = new Emitter<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>();
	readonly onDidExit = this._onDidExit.event;
	readonly stderr = '';
	readonly requests: { readonly type: string; readonly payload?: PiRpcObject }[] = [];
	disposed = false;
	requestError: Error | undefined;

	async request(type: string, payload?: PiRpcObject): Promise<PiRpcMessage> {
		this.requests.push({ type, payload });
		if (this.requestError) {
			throw this.requestError;
		}
		return { type: 'response', success: true };
	}

	fireEvent(event: PiRpcMessage): void {
		this._onDidEvent.fire(event);
	}

	fireExit(code: number | null, signal: NodeJS.Signals | null = null): void {
		this._onDidExit.fire({ code, signal });
	}

	dispose(): void {
		this.disposed = true;
		this._onDidEvent.dispose();
		this._onDidExit.dispose();
	}
}

suite('PiAgent', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('advertises Pi descriptor', () => {
		const agent = new PiAgent();
		try {
			assert.strictEqual(agent.id, PI_AGENT_PROVIDER_ID);
			assert.deepStrictEqual(agent.getDescriptor(), {
				provider: PI_AGENT_PROVIDER_ID,
				displayName: 'Pi Agent',
				description: 'Use Pi as a local coding agent with your existing Pi login and provider configuration.',
			});
		} finally {
			agent.dispose();
		}
	});

	test('creates and lists in-memory session metadata', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const workingDirectory = URI.file('/tmp/typio-pi-project');
			const result = await agent.createSession({ workingDirectory });

			assert.deepStrictEqual(client.requests, [{ type: 'get_state', payload: undefined }]);
			assert.strictEqual(result.session.scheme, PI_AGENT_PROVIDER_ID);
			assert.strictEqual(AgentSession.provider(result.session), PI_AGENT_PROVIDER_ID);
			assert.deepStrictEqual(result.workingDirectory, workingDirectory);

			const sessions = await agent.listSessions();
			assert.strictEqual(sessions.length, 1);
			assert.deepStrictEqual(sessions[0].session, result.session);
			assert.deepStrictEqual(sessions[0].workingDirectory, workingDirectory);
			assert.strictEqual(sessions[0].summary, 'Pi Agent · typio-pi-project');
		} finally {
			agent.dispose();
		}
	});

	test('sends prompts through the Pi RPC client', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));

			await agent.chats.sendMessage(chat, 'hello');

			assert.deepStrictEqual(client.requests, [
				{ type: 'get_state', payload: undefined },
				{ type: 'prompt', payload: { message: 'hello' } },
			]);
		} finally {
			agent.dispose();
		}
	});

	test('maps Pi text stream events to agent progress actions', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const signals: unknown[] = [];
			const disposable = agent.onDidSessionProgress(signal => signals.push(signal));
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));

			await agent.chats.sendMessage(chat, 'hello', undefined, 'turn-1');
			client.fireEvent({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Hi' } });
			client.fireEvent({ type: 'agent_end' });

			disposable.dispose();
			assert.strictEqual(signals.length, 5);
			assert.deepStrictEqual(signals.map(signal => (signal as { action: { type: string } }).action.type), [
				'chat/turnStarted',
				'chat/responsePart',
				'chat/delta',
				'chat/activityChanged',
				'chat/turnComplete',
			]);
		} finally {
			agent.dispose();
		}
	});

	test('surfaces prompt failures as chat errors', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const signals: unknown[] = [];
			const disposable = agent.onDidSessionProgress(signal => signals.push(signal));
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));
			client.requestError = new Error('not logged in');

			await assert.rejects(agent.chats.sendMessage(chat, 'hello', undefined, 'turn-1'), /not logged in/);

			disposable.dispose();
			const errorSignal = signals.find(signal => (signal as { action: { type: string } }).action.type === ActionType.ChatError);
			assert.ok(errorSignal);
			assert.match((errorSignal as { action: { error: { message: string } } }).action.error.message, /Sign in to Pi|not logged in/);
		} finally {
			agent.dispose();
		}
	});

	test('queues prompts while Pi is still processing', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const signals: unknown[] = [];
			const disposable = agent.onDidSessionProgress(signal => signals.push(signal));
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));

			await agent.chats.sendMessage(chat, 'first', undefined, 'turn-1');
			client.fireEvent({ type: 'turn_end' });
			await agent.chats.sendMessage(chat, 'second', undefined, 'turn-2');

			assert.deepStrictEqual(client.requests, [
				{ type: 'get_state', payload: undefined },
				{ type: 'prompt', payload: { message: 'first' } },
				{ type: 'prompt', payload: { message: 'second', streamingBehavior: 'followUp' } },
			]);

			client.fireEvent({ type: 'agent_end' });
			client.fireEvent({ type: 'agent_start' });

			disposable.dispose();
			assert.deepStrictEqual(signals.map(signal => (signal as { action: { type: string } }).action.type), [
				'chat/turnStarted',
				'chat/pendingMessageSet',
				'chat/activityChanged',
				'chat/turnComplete',
				'chat/pendingMessageRemoved',
				'chat/turnStarted',
			]);
		} finally {
			agent.dispose();
		}
	});

	test('turns active prompts into chat errors when the Pi process exits', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const signals: unknown[] = [];
			const disposable = agent.onDidSessionProgress(signal => signals.push(signal));
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));

			await agent.chats.sendMessage(chat, 'hello', undefined, 'turn-1');
			client.fireExit(1);

			disposable.dispose();
			const errorSignal = signals.find(signal => (signal as { action: { type: string } }).action.type === ActionType.ChatError);
			assert.ok(errorSignal);
			assert.match((errorSignal as { action: { error: { message: string } } }).action.error.message, /Pi RPC process exited with code 1/);
		} finally {
			agent.dispose();
		}
	});

	test('reports a helpful startup error when Pi is missing', async () => {
		const client = new FakePiSessionClient();
		client.requestError = Object.assign(new Error('spawn pi ENOENT'), { code: 'ENOENT' });
		const agent = new PiAgent(() => client);
		try {
			await assert.rejects(agent.createSession({ workingDirectory: URI.file('/tmp/project') }), /Pi CLI was not found/);
			assert.strictEqual(client.disposed, true);
		} finally {
			agent.dispose();
		}
	});

	test('disposes Pi RPC client with the session', async () => {
		const client = new FakePiSessionClient();
		const agent = new PiAgent(() => client);
		try {
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });

			await agent.disposeSession(session);

			assert.strictEqual(client.disposed, true);
		} finally {
			agent.dispose();
		}
	});
});
