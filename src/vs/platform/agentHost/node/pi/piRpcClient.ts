/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RpcClient as PiPackageRpcClient, getPackageDir } from '@earendil-works/pi-coding-agent';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { join } from '../../../../base/common/path.js';

export type PiRpcJsonValue = null | boolean | number | string | readonly PiRpcJsonValue[] | { readonly [key: string]: PiRpcJsonValue };
export type PiRpcObject = { readonly [key: string]: PiRpcJsonValue | undefined };
export type PiRpcMessage = PiRpcObject & { readonly type: string };

export interface IPiRpcSpawnOptions {
	/** Path to Pi's CLI entry point. Defaults to the bundled @earendil-works/pi-coding-agent CLI. */
	readonly executable?: string;
	readonly cwd?: string;
	readonly extraArgs?: readonly string[];
	readonly env?: NodeJS.ProcessEnv;
}

export class PiRpcProtocolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PiRpcProtocolError';
	}
}

export class PiJsonlStreamParser {
	private _buffer = '';

	accept(chunk: Buffer | string): PiRpcMessage[] {
		this._buffer += chunk.toString();
		const messages: PiRpcMessage[] = [];
		let lineEnd = this._buffer.indexOf('\n');
		while (lineEnd >= 0) {
			const rawLine = this._buffer.slice(0, lineEnd);
			this._buffer = this._buffer.slice(lineEnd + 1);
			const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
			if (line.trim().length > 0) {
				messages.push(parsePiRpcMessage(line));
			}
			lineEnd = this._buffer.indexOf('\n');
		}
		return messages;
	}

	end(): void {
		if (this._buffer.trim().length > 0) {
			throw new PiRpcProtocolError('Pi RPC stream ended with an unterminated JSONL record.');
		}
		this._buffer = '';
	}
}

interface IPiPackageRpcClient {
	start(): Promise<void>;
	stop(): Promise<void>;
	onEvent(listener: (event: unknown) => void): () => void;
	getStderr(): string;
	send(command: PiRpcObject): Promise<PiRpcMessage>;
	process?: { readonly pid?: number; once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void } | null;
}

export class PiRpcClient extends Disposable {
	private readonly _client: IPiPackageRpcClient;
	private _started: Promise<void> | undefined;
	private _disposed = false;
	private _unsubscribeEvents: (() => void) | undefined;
	private _didAttachExit = false;

	private readonly _onDidEvent = this._register(new Emitter<PiRpcMessage>());
	readonly onDidEvent: Event<PiRpcMessage> = this._onDidEvent.event;

	private readonly _onDidExit = this._register(new Emitter<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>());
	readonly onDidExit: Event<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> = this._onDidExit.event;

	static spawn(options: IPiRpcSpawnOptions = {}): PiRpcClient {
		const cliPath = options.executable || join(getPackageDir(), 'dist', 'cli.js');
		const client = new PiPackageRpcClient({
			cliPath,
			cwd: options.cwd,
			env: options.env as Record<string, string> | undefined,
			args: options.extraArgs ? [...options.extraArgs] : undefined,
		});
		return new PiRpcClient(client as unknown as IPiPackageRpcClient);
	}

	constructor(client: IPiPackageRpcClient) {
		super();
		this._client = client;
	}

	get pid(): number | undefined {
		return this._client.process?.pid;
	}

	get stderr(): string {
		return this._client.getStderr();
	}

	async request(type: string, payload: PiRpcObject = {}): Promise<PiRpcMessage> {
		if (this._disposed) {
			throw new Error('Pi RPC client has been disposed.');
		}
		await this._ensureStarted();
		const response = await this._client.send({ ...payload, type });
		if (response.success === false) {
			throw new Error(getFailureMessage(response));
		}
		return response;
	}

	send(type: string, payload: PiRpcObject = {}): void {
		void this.request(type, payload).catch(() => undefined);
	}

	override dispose(): void {
		this._disposed = true;
		this._unsubscribeEvents?.();
		this._unsubscribeEvents = undefined;
		void this._client.stop();
		super.dispose();
	}

	private async _ensureStarted(): Promise<void> {
		this._started ??= this._start();
		return this._started;
	}

	private async _start(): Promise<void> {
		this._unsubscribeEvents = this._client.onEvent(event => {
			if (isPiRpcObject(event) && typeof event.type === 'string') {
				this._onDidEvent.fire(event as PiRpcMessage);
			}
		});
		await this._client.start();
		this._attachExitListener();
	}

	private _attachExitListener(): void {
		if (this._didAttachExit) {
			return;
		}
		const process = this._client.process;
		if (!process) {
			return;
		}
		this._didAttachExit = true;
		process.once('exit', (code, signal) => this._onDidExit.fire({ code, signal }));
	}
}

function parsePiRpcMessage(line: string): PiRpcMessage {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch (error) {
		throw new PiRpcProtocolError(`Invalid Pi RPC JSONL record: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!isPiRpcObject(value) || typeof value.type !== 'string') {
		throw new PiRpcProtocolError('Pi RPC JSONL record must be an object with a string type field.');
	}
	return value as PiRpcMessage;
}

function isPiRpcObject(value: unknown): value is PiRpcObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFailureMessage(message: PiRpcMessage): string {
	if (typeof message.error === 'string') {
		return message.error;
	}
	const data = message.data;
	if (isPiRpcObject(data) && typeof data.error === 'string') {
		return data.error;
	}
	return 'Pi RPC command failed.';
}
