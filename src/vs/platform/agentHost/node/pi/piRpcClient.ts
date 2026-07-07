/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export type PiRpcJsonValue = null | boolean | number | string | readonly PiRpcJsonValue[] | { readonly [key: string]: PiRpcJsonValue };
export type PiRpcObject = { readonly [key: string]: PiRpcJsonValue | undefined };
export type PiRpcMessage = PiRpcObject & { readonly type: string };

export interface IPiRpcProcess {
	readonly stdin: NodeJS.WritableStream;
	readonly stdout: NodeJS.ReadableStream;
	readonly stderr: NodeJS.ReadableStream;
	readonly pid?: number;
	on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	on(event: 'error', listener: (error: Error) => void): this;
	kill(signal?: NodeJS.Signals | number): boolean;
}

export interface IPiRpcSpawnOptions {
	readonly executable?: string;
	readonly cwd?: string;
	readonly extraArgs?: readonly string[];
	readonly env?: NodeJS.ProcessEnv;
}

interface IPendingRequest {
	readonly resolve: (value: PiRpcMessage) => void;
	readonly reject: (error: Error) => void;
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

export class PiRpcClient extends Disposable {
	private readonly _parser = new PiJsonlStreamParser();
	private readonly _pending = new Map<string, IPendingRequest>();
	private readonly _process: IPiRpcProcess;
	private _nextRequestId = 1;
	private _stderr = '';
	private _disposed = false;

	private readonly _onDidEvent = this._register(new Emitter<PiRpcMessage>());
	readonly onDidEvent: Event<PiRpcMessage> = this._onDidEvent.event;

	private readonly _onDidExit = this._register(new Emitter<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>());
	readonly onDidExit: Event<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> = this._onDidExit.event;

	static spawn(options: IPiRpcSpawnOptions = {}): PiRpcClient {
		const executable = options.executable || 'pi';
		const child = spawn(executable, ['--mode', 'rpc', ...(options.extraArgs ?? [])], {
			cwd: options.cwd,
			env: options.env ?? process.env,
			stdio: 'pipe',
		});
		return new PiRpcClient(child);
	}

	constructor(process: IPiRpcProcess) {
		super();
		this._process = process;
		this._process.stdout.on('data', chunk => this._acceptStdout(chunk));
		this._process.stderr.on('data', chunk => this._acceptStderr(chunk));
		this._process.on('exit', (code, signal) => this._handleExit(code, signal));
		this._process.on('error', error => this._rejectAll(error));
	}

	get pid(): number | undefined {
		return this._process.pid;
	}

	get stderr(): string {
		return this._stderr;
	}

	request(type: string, payload: PiRpcObject = {}): Promise<PiRpcMessage> {
		if (this._disposed) {
			return Promise.reject(new Error('Pi RPC client has been disposed.'));
		}
		const id = `typio-${this._nextRequestId++}`;
		const message = { ...payload, id, type };
		return new Promise<PiRpcMessage>((resolve, reject) => {
			this._pending.set(id, { resolve, reject });
			this._write(message, error => {
				if (!error) {
					return;
				}
				this._pending.delete(id);
				reject(error);
			});
		});
	}

	send(type: string, payload: PiRpcObject = {}): void {
		this._write({ ...payload, type }, error => {
			if (error) {
				this._rejectAll(error);
			}
		});
	}

	override dispose(): void {
		this._disposed = true;
		this._rejectAll(new Error('Pi RPC client disposed.'));
		this._process.kill();
		super.dispose();
	}

	private _write(message: PiRpcObject, callback: (error?: Error | null) => void): void {
		this._process.stdin.write(`${JSON.stringify(message)}\n`, callback);
	}

	private _acceptStdout(chunk: Buffer | string): void {
		let messages: PiRpcMessage[];
		try {
			messages = this._parser.accept(chunk);
		} catch (error) {
			this._rejectAll(error instanceof Error ? error : new Error(String(error)));
			return;
		}
		for (const message of messages) {
			this._handleMessage(message);
		}
	}

	private _acceptStderr(chunk: Buffer | string): void {
		this._stderr += chunk.toString();
		if (this._stderr.length > 20_000) {
			this._stderr = this._stderr.slice(-20_000);
		}
	}

	private _handleMessage(message: PiRpcMessage): void {
		if (message.type === 'response' && typeof message.id === 'string') {
			const pending = this._pending.get(message.id);
			if (!pending) {
				return;
			}
			this._pending.delete(message.id);
			if (message.success === false) {
				pending.reject(new Error(getFailureMessage(message)));
				return;
			}
			pending.resolve(message);
			return;
		}
		this._onDidEvent.fire(message);
	}

	private _handleExit(code: number | null, signal: NodeJS.Signals | null): void {
		this._onDidExit.fire({ code, signal });
		this._rejectAll(new Error(`Pi RPC process exited${code === null ? '' : ` with code ${code}`}${signal ? ` and signal ${signal}` : ''}.`));
	}

	private _rejectAll(error: Error): void {
		for (const pending of this._pending.values()) {
			pending.reject(error);
		}
		this._pending.clear();
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
