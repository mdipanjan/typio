/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../log/common/log.js';
import { ISessionDataService } from '../../common/sessionDataService.js';
import { AgentSession } from '../../common/agentService.js';

export interface IPiStoredSession {
	readonly session: URI;
	readonly startTime: number;
	readonly modifiedTime: number;
	readonly workingDirectory?: URI;
	readonly summary?: string;
	readonly piSessionId?: string;
	readonly piSessionFile?: string;
	readonly piSessionName?: string;
}

export interface IPiStoredSessionUpdate {
	readonly startTime?: number;
	readonly modifiedTime?: number;
	readonly workingDirectory?: URI;
	readonly summary?: string;
	readonly piSessionId?: string;
	readonly piSessionFile?: string;
	readonly piSessionName?: string;
}

interface IPiStoredSessionJson {
	readonly session: string;
	readonly startTime: number;
	readonly modifiedTime: number;
	readonly workingDirectory?: string;
	readonly summary?: string;
	readonly piSessionId?: string;
	readonly piSessionFile?: string;
	readonly piSessionName?: string;
}

export class PiSessionStore {

	private static readonly KEY_SESSION = 'pi.session';
	private static readonly KEY_REGISTRY = 'pi.registry';
	private static readonly REGISTRY_SESSION = AgentSession.uri('pi', '_pi-registry');

	constructor(
		@ISessionDataService private readonly _sessionDataService: ISessionDataService,
		@ILogService private readonly _logService: ILogService,
	) { }

	async write(session: URI, update: IPiStoredSessionUpdate): Promise<void> {
		try {
			const existing = await this.read(session);
			const stored: IPiStoredSession = {
				session,
				startTime: update.startTime ?? existing?.startTime ?? Date.now(),
				modifiedTime: update.modifiedTime ?? existing?.modifiedTime ?? Date.now(),
				workingDirectory: update.workingDirectory ?? existing?.workingDirectory,
				summary: update.summary ?? existing?.summary,
				piSessionId: update.piSessionId ?? existing?.piSessionId,
				piSessionFile: update.piSessionFile ?? existing?.piSessionFile,
				piSessionName: update.piSessionName ?? existing?.piSessionName,
			};
			const ref = this._sessionDataService.openDatabase(session);
			try {
				await ref.object.setMetadata(PiSessionStore.KEY_SESSION, JSON.stringify(toJson(stored)));
			} finally {
				ref.dispose();
			}
			await this._addToRegistry(session);
		} catch (err) {
			this._logService.warn(`[Pi] session metadata write failed for ${session.toString()}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async read(session: URI): Promise<IPiStoredSession | undefined> {
		try {
			const ref = await this._sessionDataService.tryOpenDatabase(session);
			if (!ref) {
				return undefined;
			}
			try {
				const raw = await ref.object.getMetadata(PiSessionStore.KEY_SESSION);
				return raw ? fromJson(JSON.parse(raw)) : undefined;
			} finally {
				ref.dispose();
			}
		} catch (err) {
			this._logService.warn(`[Pi] session metadata read failed for ${session.toString()}: ${err instanceof Error ? err.message : String(err)}`);
			return undefined;
		}
	}

	async list(): Promise<readonly IPiStoredSession[]> {
		const sessions = await this._readRegistry();
		const result: IPiStoredSession[] = [];
		for (const session of sessions) {
			const stored = await this.read(session);
			if (stored) {
				result.push(stored);
			}
		}
		return result;
	}

	private async _addToRegistry(session: URI): Promise<void> {
		const sessions = await this._readRegistry();
		const sessionString = session.toString();
		if (!sessions.some(existing => existing.toString() === sessionString)) {
			sessions.push(session);
			await this._writeRegistry(sessions);
		}
	}

	private async _readRegistry(): Promise<URI[]> {
		try {
			const ref = await this._sessionDataService.tryOpenDatabase(PiSessionStore.REGISTRY_SESSION);
			if (!ref) {
				return [];
			}
			try {
				const raw = await ref.object.getMetadata(PiSessionStore.KEY_REGISTRY);
				const values = raw ? JSON.parse(raw) : [];
				return Array.isArray(values) ? values.filter(value => typeof value === 'string').map(value => URI.parse(value)) : [];
			} finally {
				ref.dispose();
			}
		} catch (err) {
			this._logService.warn(`[Pi] session registry read failed: ${err instanceof Error ? err.message : String(err)}`);
			return [];
		}
	}

	private async _writeRegistry(sessions: readonly URI[]): Promise<void> {
		const ref = this._sessionDataService.openDatabase(PiSessionStore.REGISTRY_SESSION);
		try {
			await ref.object.setMetadata(PiSessionStore.KEY_REGISTRY, JSON.stringify(sessions.map(session => session.toString())));
		} finally {
			ref.dispose();
		}
	}
}

function toJson(session: IPiStoredSession): IPiStoredSessionJson {
	return {
		session: session.session.toString(),
		startTime: session.startTime,
		modifiedTime: session.modifiedTime,
		workingDirectory: session.workingDirectory?.toString(),
		summary: session.summary,
		piSessionId: session.piSessionId,
		piSessionFile: session.piSessionFile,
		piSessionName: session.piSessionName,
	};
}

function fromJson(value: IPiStoredSessionJson): IPiStoredSession {
	return {
		session: URI.parse(value.session),
		startTime: value.startTime,
		modifiedTime: value.modifiedTime,
		workingDirectory: value.workingDirectory ? URI.parse(value.workingDirectory) : undefined,
		summary: value.summary,
		piSessionId: value.piSessionId,
		piSessionFile: value.piSessionFile,
		piSessionName: value.piSessionName,
	};
}
