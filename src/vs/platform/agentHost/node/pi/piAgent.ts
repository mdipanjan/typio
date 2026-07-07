/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, type Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { type IObservable, observableValue } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { AgentSession, type AgentProvider, type AgentSignal, type IActiveClient, type IAgent, type IAgentChats, type IAgentCreateChatForkSource, type IAgentCreateChatOptions, type IAgentCreateChatResult, type IAgentCreateSessionConfig, type IAgentCreateSessionResult, type IAgentDescriptor, type IAgentModelInfo, type IAgentResolveSessionConfigParams, type IAgentSessionConfigCompletionsParams, type IAgentSessionMetadata } from '../../common/agentService.js';
import type { ChatAction } from '../../common/state/sessionActions.js';
import type { ResolveSessionConfigResult, SessionConfigCompletionsResult } from '../../common/state/protocol/commands.js';
import type { AgentSelection, MessageAttachment, ModelSelection, ProtectedResourceMetadata, ToolDefinition } from '../../common/state/protocol/state.js';
import { parseChatUri, type ChatInputAnswer, ChatInputResponseKind, type ClientPluginCustomization, type ToolCallResult, type Turn } from '../../common/state/sessionState.js';
import { PiRpcClient, type PiRpcMessage, type PiRpcObject } from './piRpcClient.js';
import { mapPiRpcEventToActions, startPiTurn, type IPiTurnMapState } from './piEventMapper.js';
import { generateUuid } from '../../../../base/common/uuid.js';

export const PI_AGENT_PROVIDER_ID = 'pi' as const;

interface IPiSessionRecord {
	readonly session: URI;
	readonly startTime: number;
	modifiedTime: number;
	readonly workingDirectory: URI | undefined;
	readonly summary: string;
	readonly client: IPiSessionClient;
	readonly disposables: DisposableStore;
	activeTurn?: { readonly chat: URI; readonly state: IPiTurnMapState };
}

interface IPiSessionClient {
	readonly onDidEvent: Event<PiRpcMessage>;
	readonly onDidExit: Event<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>;
	readonly stderr: string;
	request(type: string, payload?: PiRpcObject): Promise<PiRpcMessage>;
	dispose(): void;
}

interface IPiClientFactoryOptions {
	readonly cwd?: string;
}

type PiClientFactory = (options: IPiClientFactoryOptions) => IPiSessionClient;

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

	constructor(private readonly _createClient: PiClientFactory = options => PiRpcClient.spawn({ cwd: options.cwd })) {
		super();
	}

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
		sendMessage: async (chat: URI, prompt: string, _attachments?: readonly MessageAttachment[], turnId?: string, _senderClientId?: string): Promise<void> => {
			const record = this._getRecordForChat(chat);
			record.modifiedTime = Date.now();
			const state: IPiTurnMapState = { turnId: turnId ?? generateUuid(), prompt };
			record.activeTurn = { chat, state };
			this._fireChatAction(chat, startPiTurn(state.turnId, prompt));
			try {
				await record.client.request('prompt', { message: prompt });
			} catch (error) {
				record.activeTurn = undefined;
				throw error;
			}
		},
		abort: async (chat: URI): Promise<void> => {
			const record = this._getRecordForChat(chat);
			await record.client.request('abort');
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
		const client = this._createClient({ cwd: workingDirectory?.fsPath });
		try {
			await client.request('get_state');
		} catch (error) {
			client.dispose();
			throw new Error(`Pi Agent failed to start. Make sure Pi is installed and configured. ${error instanceof Error ? error.message : String(error)}`);
		}
		const disposables = new DisposableStore();
		const record: IPiSessionRecord = { session, startTime: now, modifiedTime: now, workingDirectory, summary, client, disposables };
		disposables.add(client.onDidEvent(event => this._handlePiEvent(record, event)));
		disposables.add(client.onDidExit(() => record.activeTurn = undefined));
		this._sessions.set(AgentSession.id(session), record);
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
		const record = this._sessions.get(AgentSession.id(session));
		record?.disposables.dispose();
		record?.client.dispose();
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
		for (const record of this._sessions.values()) {
			record.disposables.dispose();
			record.client.dispose();
		}
		this._sessions.clear();
	}

	private _handlePiEvent(record: IPiSessionRecord, event: PiRpcMessage): void {
		const activeTurn = record.activeTurn;
		if (!activeTurn) {
			return;
		}
		for (const action of mapPiRpcEventToActions(activeTurn.state, event)) {
			this._fireChatAction(activeTurn.chat, action);
		}
		if (activeTurn.state.completed) {
			record.activeTurn = undefined;
		}
	}

	private _fireChatAction(chat: URI, action: ChatAction): void {
		this._onDidSessionProgress.fire({ kind: 'action', resource: chat, action });
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
		return this._getSessionForChat(chat);
	}

	private _getRecordForChat(chat: URI): IPiSessionRecord {
		return this._getRecord(this._getSessionForChat(chat));
	}

	private _getSessionForChat(chat: URI): URI {
		const parsed = parseChatUri(chat);
		if (!parsed) {
			throw new Error(`Pi Agent chat operation requires an Agent Host chat URI: ${chat.toString()}`);
		}
		const session = URI.parse(parsed.session);
		this._assertKnownSession(session);
		return session;
	}

	private _assertKnownSession(session: URI): void {
		this._getRecord(session);
	}

	private _getRecord(session: URI): IPiSessionRecord {
		const record = this._sessions.get(AgentSession.id(session));
		if (!record) {
			throw new Error(`Pi Agent session not found: ${session.toString()}`);
		}
		return record;
	}
}
