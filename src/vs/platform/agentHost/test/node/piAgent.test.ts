/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AgentSession } from '../../common/agentService.js';
import { buildDefaultChatUri } from '../../common/state/sessionState.js';
import { PiAgent, PI_AGENT_PROVIDER_ID } from '../../node/pi/piAgent.js';

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
		const agent = new PiAgent();
		try {
			const workingDirectory = URI.file('/tmp/typio-pi-project');
			const result = await agent.createSession({ workingDirectory });

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

	test('rejects send before RPC runtime is connected', async () => {
		const agent = new PiAgent();
		try {
			const { session } = await agent.createSession({ workingDirectory: URI.file('/tmp/project') });
			const chat = URI.parse(buildDefaultChatUri(session));

			await assert.rejects(
				agent.chats.sendMessage(chat, 'hello'),
				/Pi Agent runtime is not connected yet/
			);
		} finally {
			agent.dispose();
		}
	});
});
