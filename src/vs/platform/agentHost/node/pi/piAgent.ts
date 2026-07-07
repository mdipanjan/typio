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
import { ActionType, type ChatAction } from '../../common/state/sessionActions.js';
import type { ResolveSessionConfigResult, SessionConfigCompletionsResult } from '../../common/state/protocol/commands.js';
import type { AgentSelection, MessageAttachment, ModelSelection, ProtectedResourceMetadata, ToolDefinition } from '../../common/state/protocol/state.js';
import { ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, MessageKind, parseChatUri, PendingMessageKind, ResponsePartKind, TurnState, type ChatInputAnswer, type ChatInputRequest, ChatInputResponseKind, type ClientPluginCustomization, type ResponsePart, type ToolCallResult, type Turn } from '../../common/state/sessionState.js';
import { PiRpcClient, type PiRpcMessage, type PiRpcObject } from './piRpcClient.js';
import { mapPiRpcEventToActions, startPiTurn, type IPiTurnMapState } from './piEventMapper.js';
import { generateUuid } from '../../../../base/common/uuid.js';

export const PI_AGENT_PROVIDER_ID = 'pi' as const;

interface IPiQueuedTurn {
	readonly id: string;
	readonly turnId: string;
	readonly chat: URI;
	readonly prompt: string;
}

interface IPiSessionRecord {
	readonly session: URI;
	readonly startTime: number;
	modifiedTime: number;
	readonly workingDirectory: URI | undefined;
	summary: string;
	piSessionId?: string;
	piSessionFile?: string;
	piSessionName?: string;
	readonly client: IPiSessionClient;
	readonly disposables: DisposableStore;
	readonly queuedTurns: IPiQueuedTurn[];
	activeTurn?: { readonly chat: URI; readonly state: IPiTurnMapState };
	disposing?: boolean;
}

interface IPiSessionClient {
	readonly onDidEvent: Event<PiRpcMessage>;
	readonly onDidExit: Event<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>;
	readonly stderr: string;
	request(type: string, payload?: PiRpcObject): Promise<PiRpcMessage>;
	send?(type: string, payload?: PiRpcObject): void;
	dispose(): void;
}

interface IPiClientFactoryOptions {
	readonly cwd?: string;
}

type PiClientFactory = (options: IPiClientFactoryOptions) => IPiSessionClient;

/**
 * First Typio-owned Agent Host provider.
 *
 * This implementation keeps Pi behind the Agent Host provider boundary:
 * Typio starts `pi --mode rpc` locally and lets Pi own auth, subscriptions,
 * provider configuration, and tool policy.
 */
export class PiAgent extends Disposable implements IAgent {
	readonly id: AgentProvider = PI_AGENT_PROVIDER_ID;

	private readonly _onDidSessionProgress = this._register(new Emitter<AgentSignal>());
	readonly onDidSessionProgress = this._onDidSessionProgress.event;

	private readonly _models = observableValue<readonly IAgentModelInfo[]>(this, []);
	readonly models: IObservable<readonly IAgentModelInfo[]> = this._models;

	private readonly _sessions = new Map<string, IPiSessionRecord>();
	private readonly _pendingExtensionRequests = new Map<string, { readonly client: IPiSessionClient; readonly method: string }>();
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
			if (record.activeTurn) {
				const queuedTurn: IPiQueuedTurn = { id: generateUuid(), turnId: turnId ?? generateUuid(), chat, prompt };
				record.queuedTurns.push(queuedTurn);
				this._fireChatAction(chat, {
					type: ActionType.ChatPendingMessageSet,
					kind: PendingMessageKind.Queued,
					id: queuedTurn.id,
					message: { text: prompt, origin: { kind: MessageKind.User } },
				});
				try {
					await record.client.request('prompt', { message: prompt, streamingBehavior: 'followUp' });
				} catch (error) {
					removeQueuedTurn(record, queuedTurn.id);
					this._fireChatAction(chat, { type: ActionType.ChatPendingMessageRemoved, kind: PendingMessageKind.Queued, id: queuedTurn.id });
					this._fireChatAction(chat, createPiChatError(queuedTurn.turnId, error, record.client.stderr));
					throw error;
				}
				return;
			}
			const state: IPiTurnMapState = { turnId: turnId ?? generateUuid(), prompt, toolCalls: new Map() };
			record.activeTurn = { chat, state };
			this._fireChatAction(chat, startPiTurn(state.turnId, prompt));
			try {
				await record.client.request('prompt', { message: prompt });
			} catch (error) {
				record.activeTurn = undefined;
				this._fireChatAction(chat, createPiChatError(state.turnId, error, record.client.stderr));
				throw error;
			}
		},
		abort: async (chat: URI): Promise<void> => {
			const record = this._getRecordForChat(chat);
			const activeTurn = record.activeTurn;
			await record.client.request('abort');
			if (activeTurn) {
				this._fireChatAction(activeTurn.chat, { type: ActionType.ChatTurnCancelled, turnId: activeTurn.state.turnId });
				record.activeTurn = undefined;
			}
		},
		changeModel: async (chat: URI, _model: ModelSelection): Promise<void> => {
			this._assertKnownChat(chat);
		},
		changeAgent: async (chat: URI, _agent: AgentSelection | undefined): Promise<void> => {
			this._assertKnownChat(chat);
		},
		getMessages: async (chat: URI): Promise<readonly Turn[]> => {
			return this.getSessionMessages(this._getSessionForChat(chat));
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
		const now = Date.now();
		const workingDirectory = config?.workingDirectory;
		const summary = workingDirectory ? `Pi Agent · ${basename(workingDirectory.fsPath) || workingDirectory.fsPath}` : 'Pi Agent Quick Chat';
		const client = this._createClient({ cwd: workingDirectory?.fsPath });
		let state: PiRpcMessage;
		try {
			state = await client.request('get_state');
		} catch (error) {
			client.dispose();
			throw new Error(formatPiSetupError(error, client.stderr));
		}
		const stateData = getPiResponseData(state);
		const piSessionId = typeof stateData?.sessionId === 'string' ? stateData.sessionId : undefined;
		const piSessionFile = typeof stateData?.sessionFile === 'string' ? stateData.sessionFile : undefined;
		const piSessionName = typeof stateData?.sessionName === 'string' ? stateData.sessionName : undefined;
		const actualSession = config?.session ?? AgentSession.uri(this.id, piSessionId ? sanitizePiSessionId(piSessionId) : `pi-session-${this._nextSessionId++}`);
		const disposables = new DisposableStore();
		const record: IPiSessionRecord = { session: actualSession, startTime: now, modifiedTime: now, workingDirectory, summary: piSessionName || summary, piSessionId, piSessionFile, piSessionName, client, disposables, queuedTurns: [] };
		disposables.add(client.onDidEvent(event => this._handlePiEvent(record, event)));
		disposables.add(client.onDidExit(exit => this._handlePiExit(record, exit)));
		this._sessions.set(AgentSession.id(actualSession), record);
		return {
			session: actualSession,
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
		const record = this._getRecord(session);
		const response = await record.client.request('get_messages');
		return piMessagesToTurns(getPiMessages(response));
	}

	async disposeSession(session: URI): Promise<void> {
		const record = this._sessions.get(AgentSession.id(session));
		if (record) {
			record.disposing = true;
		}
		record?.disposables.dispose();
		record?.client.dispose();
		this._sessions.delete(AgentSession.id(session));
	}

	respondToPermissionRequest(_requestId: string, _approved: boolean): void {
		// Pi RPC permission mapping will be introduced with subprocess support.
	}

	respondToUserInputRequest(requestId: string, response: ChatInputResponseKind, answers?: Record<string, ChatInputAnswer>): void {
		const pending = this._pendingExtensionRequests.get(requestId);
		if (!pending) {
			return;
		}
		this._pendingExtensionRequests.delete(requestId);
		if (response === ChatInputResponseKind.Cancel || response === ChatInputResponseKind.Decline) {
			pending.client.send?.('extension_ui_response', { id: requestId, cancelled: true });
			return;
		}
		pending.client.send?.('extension_ui_response', extensionUiResponsePayload(requestId, pending.method, answers));
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
		this._disposeSessions();
	}

	override dispose(): void {
		this._disposeSessions();
		super.dispose();
	}

	private _disposeSessions(): void {
		for (const record of this._sessions.values()) {
			record.disposing = true;
			record.disposables.dispose();
			record.client.dispose();
		}
		this._sessions.clear();
	}

	private _handlePiEvent(record: IPiSessionRecord, event: PiRpcMessage): void {
		if (event.type === 'extension_ui_request') {
			this._handleExtensionUiRequest(record, event);
			return;
		}
		let activeTurn = record.activeTurn;
		if (!activeTurn) {
			const queuedTurn = record.queuedTurns[0];
			if (!queuedTurn || !isPiTurnStartingEvent(event)) {
				return;
			}
			record.queuedTurns.shift();
			const state: IPiTurnMapState = { turnId: queuedTurn.turnId, prompt: queuedTurn.prompt, toolCalls: new Map() };
			activeTurn = { chat: queuedTurn.chat, state };
			record.activeTurn = activeTurn;
			this._fireChatAction(activeTurn.chat, { type: ActionType.ChatPendingMessageRemoved, kind: PendingMessageKind.Queued, id: queuedTurn.id });
			this._fireChatAction(activeTurn.chat, startPiTurn(state.turnId, queuedTurn.prompt));
		}
		for (const action of mapPiRpcEventToActions(activeTurn.state, event)) {
			this._fireChatAction(activeTurn.chat, action);
		}
		if (activeTurn.state.completed) {
			record.activeTurn = undefined;
		}
	}

	private _handleExtensionUiRequest(record: IPiSessionRecord, event: PiRpcMessage): void {
		const activeTurn = record.activeTurn;
		if (!activeTurn || typeof event.id !== 'string' || typeof event.method !== 'string') {
			return;
		}
		if (event.method === 'notify' || event.method === 'setStatus' || event.method === 'setWidget' || event.method === 'setTitle' || event.method === 'set_editor_text') {
			const message = extensionUiNotificationText(event);
			if (message) {
				this._fireChatAction(activeTurn.chat, {
					type: ActionType.ChatResponsePart,
					turnId: activeTurn.state.turnId,
					part: { kind: ResponsePartKind.SystemNotification, content: message },
				});
			}
			return;
		}
		this._pendingExtensionRequests.set(event.id, { client: record.client, method: event.method });
		this._fireChatAction(activeTurn.chat, {
			type: ActionType.ChatInputRequested,
			request: extensionUiInputRequest(event),
		});
	}

	private _handlePiExit(record: IPiSessionRecord, exit: { readonly code: number | null; readonly signal: NodeJS.Signals | null }): void {
		const activeTurn = record.activeTurn;
		record.activeTurn = undefined;
		if (!activeTurn || record.disposing) {
			return;
		}
		this._fireChatAction(activeTurn.chat, {
			type: ActionType.ChatError,
			turnId: activeTurn.state.turnId,
			error: {
				errorType: 'pi.rpc.exit',
				message: formatPiExitMessage(exit, record.client.stderr),
			},
		});
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
			summary: record.piSessionName || record.summary,
			_meta: {
				pi: {
					sessionId: record.piSessionId,
					sessionFile: record.piSessionFile,
					sessionName: record.piSessionName,
				},
			},
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

function extensionUiInputRequest(event: PiRpcMessage): ChatInputRequest {
	const id = typeof event.id === 'string' ? event.id : generateUuid();
	const title = typeof event.title === 'string' ? event.title : 'Pi needs input';
	const message = typeof event.message === 'string' ? event.message : title;
	if (event.method === 'select') {
		const options = Array.isArray(event.options) ? event.options.filter(option => typeof option === 'string') : [];
		return {
			id,
			message: title,
			questions: [{
				id: 'value',
				kind: ChatInputQuestionKind.SingleSelect,
				message,
				title,
				required: true,
				options: options.map(option => ({ id: option, label: option })),
			}],
		};
	}
	if (event.method === 'confirm') {
		return {
			id,
			message: title,
			questions: [{ id: 'confirmed', kind: ChatInputQuestionKind.Boolean, message, title, required: true }],
		};
	}
	return {
		id,
		message: title,
		questions: [{
			id: 'value',
			kind: ChatInputQuestionKind.Text,
			message,
			title,
			required: true,
			defaultValue: typeof event.prefill === 'string' ? event.prefill : undefined,
		}],
	};
}

function extensionUiResponsePayload(id: string, method: string, answers?: Record<string, ChatInputAnswer>): PiRpcObject {
	if (method === 'confirm') {
		return { id, confirmed: getBooleanAnswer(answers?.confirmed) ?? false };
	}
	return { id, value: getStringAnswer(answers?.value) ?? '' };
}

function getStringAnswer(answer: ChatInputAnswer | undefined): string | undefined {
	if (!answer || answer.state !== ChatInputAnswerState.Submitted || answer.value.kind !== ChatInputAnswerValueKind.Text && answer.value.kind !== ChatInputAnswerValueKind.Selected) {
		return undefined;
	}
	return answer.value.value;
}

function getBooleanAnswer(answer: ChatInputAnswer | undefined): boolean | undefined {
	if (!answer || answer.state !== ChatInputAnswerState.Submitted || answer.value.kind !== ChatInputAnswerValueKind.Boolean) {
		return undefined;
	}
	return answer.value.value;
}

function extensionUiNotificationText(event: PiRpcMessage): string | undefined {
	if (event.method === 'setStatus') {
		return typeof event.statusText === 'string' ? event.statusText : undefined;
	}
	if (event.method === 'setTitle') {
		return typeof event.title === 'string' ? event.title : undefined;
	}
	if (event.method === 'setWidget') {
		return Array.isArray(event.widgetLines) ? event.widgetLines.filter(line => typeof line === 'string').join('\n') : undefined;
	}
	if (event.method === 'set_editor_text') {
		return typeof event.text === 'string' ? event.text : undefined;
	}
	return typeof event.message === 'string' ? event.message : undefined;
}

function removeQueuedTurn(record: IPiSessionRecord, id: string): void {
	const index = record.queuedTurns.findIndex(turn => turn.id === id);
	if (index >= 0) {
		record.queuedTurns.splice(index, 1);
	}
}

function isPiTurnStartingEvent(event: PiRpcMessage): boolean {
	return event.type === 'agent_start'
		|| event.type === 'turn_start'
		|| event.type === 'message_start'
		|| event.type === 'message_update'
		|| event.type === 'tool_execution_start';
}

function createPiChatError(turnId: string, error: unknown, stderr: string): ChatAction {
	return {
		type: ActionType.ChatError,
		turnId,
		error: {
			errorType: classifyPiError(error),
			message: formatPiRuntimeError(error, stderr),
		},
	};
}

function formatPiSetupError(error: unknown, stderr: string): string {
	const message = getErrorMessage(error);
	const detail = appendStderr(message, stderr);
	if (isMissingExecutableError(error, message)) {
		return `Pi CLI was not found. Install Pi and make sure the \`pi\` command is on PATH, then try again.${detail ? ` Details: ${detail}` : ''}`;
	}
	if (isAuthError(message)) {
		return `Pi Agent could not start because Pi is not signed in. Sign in to Pi from your terminal, then try again.${detail ? ` Details: ${detail}` : ''}`;
	}
	if (isSubscriptionError(message)) {
		return `Pi Agent could not start because your Pi subscription is not active.${detail ? ` Details: ${detail}` : ''}`;
	}
	if (isProviderConfigError(message)) {
		return `Pi Agent could not start because Pi has no usable provider configured.${detail ? ` Details: ${detail}` : ''}`;
	}
	return `Pi Agent failed to start. Make sure Pi is installed, signed in, and configured.${detail ? ` Details: ${detail}` : ''}`;
}

function formatPiRuntimeError(error: unknown, stderr: string): string {
	const message = getErrorMessage(error);
	const detail = appendStderr(message, stderr);
	if (isAuthError(message)) {
		return `Sign in to Pi from your terminal, then try again.${detail ? ` Details: ${detail}` : ''}`;
	}
	if (isSubscriptionError(message)) {
		return `Your Pi subscription is not active.${detail ? ` Details: ${detail}` : ''}`;
	}
	if (isProviderConfigError(message)) {
		return `Pi has no usable provider configured.${detail ? ` Details: ${detail}` : ''}`;
	}
	return detail || message || 'Pi Agent encountered an error.';
}

function formatPiExitMessage(exit: { readonly code: number | null; readonly signal: NodeJS.Signals | null }, stderr: string): string {
	const exitMessage = `Pi RPC process exited${exit.code === null ? '' : ` with code ${exit.code}`}${exit.signal ? ` and signal ${exit.signal}` : ''}.`;
	return appendStderr(exitMessage, stderr) || exitMessage;
}

function classifyPiError(error: unknown): string {
	const message = getErrorMessage(error);
	if (isAuthError(message)) {
		return 'pi.auth.required';
	}
	if (isSubscriptionError(message)) {
		return 'pi.subscription.required';
	}
	if (isProviderConfigError(message)) {
		return 'pi.provider.notConfigured';
	}
	return 'pi.rpc.error';
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isMissingExecutableError(error: unknown, message: string): boolean {
	return getErrorCode(error) === 'ENOENT' || /\bENOENT\b|command not found|not found/i.test(message);
}

function getErrorCode(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null || !Object.hasOwn(error, 'code')) {
		return undefined;
	}
	const code = (error as { readonly code?: unknown }).code;
	return typeof code === 'string' ? code : undefined;
}

function isAuthError(message: string): boolean {
	return /not logged in|sign in|signin|login required|unauthorized|authentication/i.test(message);
}

function isSubscriptionError(message: string): boolean {
	return /subscription|billing|payment required|quota|plan required/i.test(message);
}

function isProviderConfigError(message: string): boolean {
	return /provider.*config|no provider|api key|model provider|not configured/i.test(message);
}

function appendStderr(message: string, stderr: string): string {
	const trimmedMessage = message.trim();
	const trimmedStderr = stderr.trim();
	if (!trimmedStderr || trimmedMessage.includes(trimmedStderr)) {
		return trimmedMessage;
	}
	return `${trimmedMessage}${trimmedMessage ? '\n' : ''}${trimmedStderr}`;
}

function getPiResponseData(message: PiRpcMessage): Record<string, unknown> | undefined {
	return typeof message.data === 'object' && message.data !== null && !Array.isArray(message.data)
		? message.data as Record<string, unknown>
		: undefined;
}

function getPiMessages(message: PiRpcMessage): readonly unknown[] {
	const data = getPiResponseData(message);
	return Array.isArray(data?.messages) ? data.messages : [];
}

function sanitizePiSessionId(sessionId: string): string {
	return sessionId.replace(/[^A-Za-z0-9._-]/g, '-');
}

function piMessagesToTurns(messages: readonly unknown[]): readonly Turn[] {
	const turns: Turn[] = [];
	let current: Turn | undefined;
	for (const raw of messages) {
		const message = getPiMessageObject(raw);
		if (!message) {
			continue;
		}
		if (message.role === 'user') {
			if (current) {
				turns.push(current);
			}
			current = {
				id: generateUuid(),
				message: { text: piMessageText(message.content), origin: { kind: MessageKind.User } },
				responseParts: [],
				usage: undefined,
				state: TurnState.Complete,
			};
			continue;
		}
		if (!current) {
			current = {
				id: generateUuid(),
				message: { text: '', origin: { kind: MessageKind.Agent } },
				responseParts: [],
				usage: undefined,
				state: TurnState.Complete,
			};
		}
		if (message.role === 'assistant') {
			current.responseParts.push(...piAssistantResponseParts(message.content));
			current.usage = piUsage(message);
			if (message.stopReason === 'aborted') {
				current.state = TurnState.Cancelled;
			} else if (message.stopReason === 'error') {
				current.state = TurnState.Error;
				current.error = { errorType: 'pi.stopReason.error', message: 'Pi assistant response ended with an error.' };
			}
			continue;
		}
		if (message.role === 'toolResult' || message.role === 'bashExecution') {
			const text = piMessageText(message.content) || piToolExecutionText(message);
			if (text) {
				current.responseParts.push({ kind: ResponsePartKind.SystemNotification, content: text });
			}
		}
	}
	if (current) {
		turns.push(current);
	}
	return turns;
}

function getPiMessageObject(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function piAssistantResponseParts(content: unknown): ResponsePart[] {
	if (typeof content === 'string') {
		return content ? [{ kind: ResponsePartKind.Markdown, id: generateUuid(), content }] : [];
	}
	if (!Array.isArray(content)) {
		return [];
	}
	const parts: ResponsePart[] = [];
	for (const raw of content) {
		const item = getPiMessageObject(raw);
		if (!item) {
			continue;
		}
		if (item.type === 'text' && typeof item.text === 'string' && item.text.length > 0) {
			parts.push({ kind: ResponsePartKind.Markdown, id: generateUuid(), content: item.text });
		} else if (item.type === 'thinking' && typeof item.thinking === 'string' && item.thinking.length > 0) {
			parts.push({ kind: ResponsePartKind.Reasoning, id: generateUuid(), content: item.thinking });
		} else if (item.type === 'toolCall') {
			const name = typeof item.name === 'string' ? item.name : 'tool';
			parts.push({ kind: ResponsePartKind.SystemNotification, content: `Called ${name}` });
		}
	}
	return parts;
}

function piMessageText(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}
	if (!Array.isArray(content)) {
		return '';
	}
	return content
		.map(item => getPiMessageObject(item))
		.filter(item => item?.type === 'text' && typeof item.text === 'string')
		.map(item => item!.text as string)
		.join('');
}

function piToolExecutionText(message: Record<string, unknown>): string {
	const command = typeof message.command === 'string' ? message.command : undefined;
	const output = typeof message.output === 'string' ? message.output : undefined;
	if (command && output) {
		return `$ ${command}\n${output}`;
	}
	return output ?? '';
}

function piUsage(message: Record<string, unknown>): Turn['usage'] {
	const usage = getPiMessageObject(message.usage);
	if (!usage) {
		return undefined;
	}
	return {
		inputTokens: typeof usage.input === 'number' ? usage.input : undefined,
		outputTokens: typeof usage.output === 'number' ? usage.output : undefined,
		cacheReadTokens: typeof usage.cacheRead === 'number' ? usage.cacheRead : undefined,
		model: typeof message.model === 'string' ? message.model : undefined,
		_meta: { provider: message.provider, cost: usage.cost },
	};
}
