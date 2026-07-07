/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import { EventEmitter } from 'events';
import type { IDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { delimiter, dirname, join } from '../../../../base/common/path.js';
import { buildPiRpcEnvironment, PiJsonlStreamParser, PiRpcClient, type PiRpcMessage, type PiRpcObject } from '../../node/pi/piRpcClient.js';

class FakePiPackageRpcClient {
	readonly process = new EventEmitter() as EventEmitter & { pid?: number; once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): EventEmitter };
	readonly commands: PiRpcObject[] = [];
	readonly listeners: ((event: unknown) => void)[] = [];
	stderr = '';
	started = false;
	stopped = false;
	response: PiRpcMessage = { type: 'response', success: true, data: {} };

	constructor() {
		this.process.pid = 1234;
	}

	async start(): Promise<void> {
		this.started = true;
	}

	async stop(): Promise<void> {
		this.stopped = true;
	}

	onEvent(listener: (event: unknown) => void): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			}
		};
	}

	getStderr(): string {
		return this.stderr;
	}

	async send(command: PiRpcObject): Promise<PiRpcMessage> {
		this.commands.push(command);
		return this.response;
	}

	fire(event: unknown): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}
}

suite('PiJsonlStreamParser', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses LF-delimited JSON records across chunks', () => {
		const parser = new PiJsonlStreamParser();

		assert.deepStrictEqual(parser.accept('{"type":"agent_start"'), []);
		assert.deepStrictEqual(parser.accept('}\n{"type":"agent_end"}\n'), [
			{ type: 'agent_start' },
			{ type: 'agent_end' },
		]);
	});

	test('strips CR from CRLF records', () => {
		const parser = new PiJsonlStreamParser();

		assert.deepStrictEqual(parser.accept('{"type":"agent_start"}\r\n'), [
			{ type: 'agent_start' },
		]);
	});

	test('does not split on unicode line separators inside JSON strings', () => {
		const parser = new PiJsonlStreamParser();
		const messages = parser.accept('{"type":"message_update","text":"before after"}\n');

		assert.strictEqual(messages.length, 1);
		assert.strictEqual(messages[0].text, 'before after');
	});

	test('rejects non-object records', () => {
		const parser = new PiJsonlStreamParser();

		assert.throws(() => parser.accept('[]\n'), /object with a string type field/);
	});
});

suite('PiRpcClient', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('adds an explicitly configured Node.js directory to the Pi RPC PATH', () => {
		const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'typio-pi-node-'));
		try {
			const nodePath = join(tempDir, process.platform === 'win32' ? 'node.exe' : 'node');
			fs.writeFileSync(nodePath, '');
			const env = buildPiRpcEnvironment({ PATH: '/usr/bin', VSCODE_AGENT_HOST_PI_NODE_PATH: nodePath });
			const pathEntries = env.PATH.split(delimiter);

			assert.ok(pathEntries.includes(dirname(nodePath)));
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('preserves caller-provided Pi RPC environment variables', () => {
		const env = buildPiRpcEnvironment({ PATH: '/usr/bin', PI_OFFLINE: '1' });

		assert.strictEqual(env.PI_OFFLINE, '1');
	});

	test('starts bundled client lazily and forwards command responses', async () => {
		const packageClient = new FakePiPackageRpcClient();
		packageClient.response = { type: 'response', command: 'get_state', success: true, data: { sessionId: 'abc' } };
		const client = new PiRpcClient(packageClient);
		try {
			const response = await client.request('get_state');

			assert.strictEqual(packageClient.started, true);
			assert.deepStrictEqual(packageClient.commands, [{ type: 'get_state' }]);
			assert.strictEqual(response.type, 'response');
			assert.deepStrictEqual(response.data, { sessionId: 'abc' });
		} finally {
			client.dispose();
		}
	});

	test('emits package rpc events', async () => {
		const packageClient = new FakePiPackageRpcClient();
		const client = new PiRpcClient(packageClient);
		let disposable: IDisposable | undefined;
		try {
			await client.request('get_state');
			const eventPromise = new Promise(resolve => disposable = client.onDidEvent(resolve));

			packageClient.fire({ type: 'agent_start' });
			const event = await eventPromise;
			disposable?.dispose();

			assert.deepStrictEqual(event, { type: 'agent_start' });
		} finally {
			disposable?.dispose();
			client.dispose();
		}
	});

	test('rejects failed command responses', async () => {
		const packageClient = new FakePiPackageRpcClient();
		packageClient.response = { type: 'response', command: 'prompt', success: false, error: 'not logged in' };
		const client = new PiRpcClient(packageClient);
		try {
			await assert.rejects(client.request('prompt', { message: 'hello' }), /not logged in/);
		} finally {
			client.dispose();
		}
	});

	test('exposes stderr diagnostics from package rpc client', () => {
		const packageClient = new FakePiPackageRpcClient();
		packageClient.stderr = 'Pi failed to start';
		const client = new PiRpcClient(packageClient);
		try {
			assert.strictEqual(client.stderr, 'Pi failed to start');
		} finally {
			client.dispose();
		}
	});
});
