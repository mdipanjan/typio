/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { IDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PiJsonlStreamParser, PiRpcClient, type IPiRpcProcess } from '../../node/pi/piRpcClient.js';

class FakePiRpcProcess extends EventEmitter implements IPiRpcProcess {
	readonly stdin = new PassThrough();
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly pid = 1234;
	killed = false;
	stdinText = '';

	constructor() {
		super();
		this.stdin.on('data', chunk => this.stdinText += chunk.toString());
	}

	override on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	override on(event: 'error', listener: (error: Error) => void): this;
	override on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	kill(_signal?: NodeJS.Signals | number): boolean {
		this.killed = true;
		return true;
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

	test('correlates command responses by id', async () => {
		const process = new FakePiRpcProcess();
		const client = new PiRpcClient(process);
		try {
			const responsePromise = client.request('get_state');
			const command = JSON.parse(process.stdinText.trim());

			assert.strictEqual(command.type, 'get_state');
			assert.strictEqual(command.id, 'typio-1');

			process.stdout.write('{"type":"response","id":"typio-1","command":"get_state","success":true,"data":{"sessionId":"abc"}}\n');
			const response = await responsePromise;

			assert.strictEqual(response.type, 'response');
			assert.strictEqual(response.id, 'typio-1');
		} finally {
			client.dispose();
		}
	});

	test('emits non-response events', async () => {
		const process = new FakePiRpcProcess();
		const client = new PiRpcClient(process);
		let disposable: IDisposable | undefined;
		try {
			const eventPromise = new Promise(resolve => disposable = client.onDidEvent(resolve));

			process.stdout.write('{"type":"agent_start"}\n');
			const event = await eventPromise;
			disposable?.dispose();

			assert.deepStrictEqual(event, { type: 'agent_start' });
		} finally {
			disposable?.dispose();
			client.dispose();
		}
	});

	test('rejects failed command responses', async () => {
		const process = new FakePiRpcProcess();
		const client = new PiRpcClient(process);
		try {
			const responsePromise = client.request('prompt', { message: 'hello' });

			process.stdout.write('{"type":"response","id":"typio-1","command":"prompt","success":false,"error":"not logged in"}\n');

			await assert.rejects(responsePromise, /not logged in/);
		} finally {
			client.dispose();
		}
	});

	test('keeps recent stderr for diagnostics', () => {
		const process = new FakePiRpcProcess();
		const client = new PiRpcClient(process);
		try {
			process.stderr.write('Pi failed to start');

			assert.strictEqual(client.stderr, 'Pi failed to start');
		} finally {
			client.dispose();
		}
	});
});
