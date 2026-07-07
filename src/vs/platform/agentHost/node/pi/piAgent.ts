/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { type IObservable, observableValue } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { AgentSession, type AgentProvider, type AgentSignal, type IActiveClient, type IAgent, type IAgentChats, type IAgentCreateChatForkSource, type IAgentCreateChatOptions, type IAgentCreateChatResult, type IAgentCreateSessionConfig, type IAgentCreateSessionResult, type IAgentDescriptor, type IAgentModelInfo, type IAgentResolveSessionConfigParams, type IAgentSessionConfigCompletionsParams, type IAgentSessionMetadata } from '../../common/agentService.js';
import type { ResolveSessionConfigResult, SessionConfigCompletionsResult } from '../../common/state/protocol/commands.js';
import type { AgentSelection, MessageAttachment, ModelSelection, ProtectedResourceMetadata, ToolDefinition } from '../../common/state/protocol/state.js';
import { parseChatUri, type ChatInputAnswer, ChatInputResponseKind, type ClientPluginCustomization, type ToolCallResult, type Turn } from '../../common/state/sessionState.js';

export const PI_AGENT_PROVIDER_ID = 'pi' as const;

const PI_AGENT_NOT_CONNECTED_MESSAGE = 'Pi Agent runtime is not connected yet. The provider skeleton is registered; RPC subprocess support will be added in the next implementation slice.';

interface IPiSessionRecord {
	readonly session: URI;
	readonly startTime: number;
	modifiedTime: number;
	readonly workingDirectory: URI | undefined;
	readonly summary: string;
}

/**
 * First Typio-owned Agent Host provider.
 *
 * This initial implementation intentionally stops at the Agent Host provider
 * boundary: it advertises Pi as a selectable agent and owns in-memory session
 * metadata, but it does not yet spawn `pi --mode rpc`. Keeping this skeleton
 * small lets us validate registration, picker wiring, and the broad IAgent
 * contract before adding subprocess lifecycle and event mapping.
 */
export class PiAgent extends Disposable implements IAgent {
	readonly id: AgentProvider = PI_AGENT_PROVIDER_ID;

	private readonly _onDidSessionProgress = this._register(new Emitter<AgentSignal>());
	readonly onDidSessionProgress = this._onDidSessionProgress.event;

	private readonly _models = observableValue<readonly IAgentModelInfo[]>(this, []);
	readonly models: IObservable<readonly IAgentModelInfo[]> = this._models;

	private readonly _sessions = new Map<string, IPiSessionRecord>();
	private _nextSessionId = 1;

	readonly chats: IAgentChats = {
		createChat: async (_chat: URI, _options?: IAgentCreateChatOptions): Promise<IAgentCreateChatResult | void> => {
			throw new Error('Pi Agent does not support multiple chats yet.');
		},
		fork: async (_chat: URI, _source: IAgentCreateChatForkSource, _options?: IAgentCreateChatOptions): Promise<IAgentCreateChatResult | void> => {
			throw new Error('Pi Agent does not support chat forks yet.');
		},
		disposeChat: async (_chat: URI): Promise<void> => {
			// Pi's first slice is single-chat; there are no peer chats to dispose.
		},
		sendMessage: async (chat: URI, _prompt: string, _attachments?: readonly MessageAttachment[], _turnId?: string, _senderClientId?: string): Promise<void> => {
			this._assertKnownChat(chat);
			throw new Error(PI_AGENT_NOT_CONNECTED_MESSAGE);
		},
		abort: async (chat: URI): Promise<void> => {
			this._assertKnownChat(chat);
		},
		changeModel: async (chat: URI, _model: ModelSelection): Promise<void> => {
			this._assertKnownChat(chat);
		},
		changeAgent: async (chat: URI, _agent: AgentSelection | undefined): Promise<void> => {
			this._assertKnownChat(chat);
		},
		getMessages: async (chat: URI): Promise<readonly Turn[]> => {
			this._assertKnownChat(chat);
			return [];
		},
	};

	getDescriptor(): IAgentDescriptor {
		return {
			provider: this.id,
			displayName: 'Pi Agent',
			description: 'Use Pi as a local coding agent with your existing Pi login and provider configuration.',
		};
	}

	async createSession(config?: IAgentCreateSessionConfig): Promise<IAgentCreateSessionResult> {
		const session = config?.session ?? AgentSession.uri(this.id, `pi-session-${this._nextSessionId++}`);
		const now = Date.now();
		const workingDirectory = config?.workingDirectory;
		const summary = workingDirectory ? `Pi Agent · ${basename(workingDirectory.fsPath) || workingDirectory.fsPath}` : 'Pi Agent Quick Chat';
		this._sessions.set(AgentSession.id(session), { session, startTime: now, modifiedTime: now, workingDirectory, summary });
		return {
			session,
			workingDirectory,
			project: workingDirectory ? { uri: workingDirectory, displayName: basename(workingDirectory.fsPath) || workingDirectory.fsPath } : undefined,
		};
	}

	async resolveSessionConfig(params: IAgentResolveSessionConfigParams): Promise<ResolveSessionConfigResult> {
		return { schema: { type: 'object', properties: {} }, values: params.config ?? {} };
	}

	async sessionConfigCompletions(_params: IAgentSessionConfigCompletionsParams): Promise<SessionConfigCompletionsResult> {
		return { items: [] };
	}

	async getSessionMessages(session: URI): Promise<readonly Turn[]> {
		this._assertKnownSession(session);
		return [];
	}

	async disposeSession(session: URI): Promise<void> {
		this._sessions.delete(AgentSession.id(session));
	}

	respondToPermissionRequest(_requestId: string, _approved: boolean): void {
		// Pi RPC permission mapping will be introduced with subprocess support.
	}

	respondToUserInputRequest(_requestId: string, _response: ChatInputResponseKind, _answers?: Record<string, ChatInputAnswer>): void {
		// Pi RPC user-input mapping will be introduced with subprocess support.
	}

	async listSessions(): Promise<IAgentSessionMetadata[]> {
		return [...this._sessions.values()].map(record => this._toMetadata(record));
	}

	async getSessionMetadata(session: URI): Promise<IAgentSessionMetadata | undefined> {
		const record = this._sessions.get(AgentSession.id(session));
		return record ? this._toMetadata(record) : undefined;
	}

	getProtectedResources(): ProtectedResourceMetadata[] {
		return [];
	}

	async authenticate(_resource: string, _token: string): Promise<boolean> {
		return false;
	}

	getOrCreateActiveClient(_session: URI, client: { readonly clientId: string; readonly displayName?: string }): IActiveClient {
		let tools: readonly ToolDefinition[] = [];
		let customizations: readonly ClientPluginCustomization[] = [];
		return {
			clientId: client.clientId,
			displayName: client.displayName,
			get tools() { return tools; },
			set tools(value: readonly ToolDefinition[]) { tools = value; },
			get customizations() { return customizations; },
			set customizations(value: readonly ClientPluginCustomization[]) { customizations = value; },
		};
	}

	removeActiveClient(_session: URI, _clientId: string): void {
		// No active-client state until Pi RPC tool bridging exists.
	}

	onClientToolCallComplete(_session: URI, _chat: URI, _toolCallId: string, _result: ToolCallResult): void {
		// No client-provided tool calls until Pi RPC tool bridging exists.
	}

	setCustomizationEnabled(_id: string, _enabled: boolean): void {
		// Pi customizations are owned by Pi configuration for the first slice.
	}

	async shutdown(): Promise<void> {
		this._sessions.clear();
	}

	private _toMetadata(record: IPiSessionRecord): IAgentSessionMetadata {
		return {
			session: record.session,
			startTime: record.startTime,
			modifiedTime: record.modifiedTime,
			workingDirectory: record.workingDirectory,
			project: record.workingDirectory ? { uri: record.workingDirectory, displayName: basename(record.workingDirectory.fsPath) || record.workingDirectory.fsPath } : undefined,
			summary: record.summary,
		};
	}

	private _assertKnownChat(chat: URI): URI {
		const parsed = parseChatUri(chat);
		if (!parsed) {
			throw new Error(`Pi Agent chat operation requires an Agent Host chat URI: ${chat.toString()}`);
		}
		const session = URI.parse(parsed.session);
		this._assertKnownSession(session);
		return session;
	}

	private _assertKnownSession(session: URI): void {
		if (!this._sessions.has(AgentSession.id(session))) {
			throw new Error(`Pi Agent session not found: ${session.toString()}`);
		}
	}
}
