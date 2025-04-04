//#region imports
import readline from 'readline';
import fs from 'fs';
import { fetch } from './advanced-fetch';
import { Request, RequestBody, RequestQuery, EventSub, ResponseBody, ResponseBodyError } from './types';
import { main as ChannelList } from './channellist';
import { main as ChannelAdd } from './channeladd';
import { main as ChannelRemove } from './channelremove';
import { humanizer } from 'humanize-duration';
//#endregion

//#region set some consts here
export const client_id = "0ho17t37uu3a4sfdrs6r76qwi51evf";
export const bot_id = "238330860";
export const bot_scopes = [
	"user:read:chat",
	"user:write:chat"
];
export const scopes = [
	"moderator:manage:blocked_terms",
	"channel:manage:broadcast",
];
//#endregion

//#region interfaces
export interface DataChannelsEntry {
	login: string;
	access_token: string;
	subscriptions_id: string[];
}
interface Data {
	bot_access_token: string;
	bot_login: string;
	channels: Record<string, DataChannelsEntry>;
}
interface Session {
	ws: WebSocket;
	channel_id: string;
	login: string;
	access_token: string;

	reconnect_url?: string;
	keepalive_timeout?: NodeJS.Timeout;
	eventsub?: EventSub.Session;
}
//#endregion

//#region some consts which usually you dont need to edit
export const data: Data = {bot_access_token: "", bot_login: "", channels: {}};
const WebSocketSSLURL = "wss://eventsub.wss.twitch.tv/ws";
const redirect_uri = "http://localhost";
const sessions: Record<string, Session> = {};
const HumanizeDuration = humanizer({largest: 3, round: true, delimiter: " ", language: "ru"});
//#endregion

/** Writes `const data` to `data.json` */
export function saveData() {
	fs.writeFileSync('data.json', JSON.stringify(data, null, '\t'));
}

/** @returns Chatter is moderator/broadcaster */
function isModerator(payload: EventSub.Payload.ChannelChatMessage): boolean {
	for (let badge of payload.event.badges) if (badge.set_id === "moderator" || badge.set_id === "broadcaster") return true;
	return false;
}

/** Connects WebSocket and starts session for channel */
function connectWebSocket(channel_id: string) {
	let reconnect_url: string | undefined;
	let session = sessions[channel_id];
	if (session) {
		reconnect_url = session.reconnect_url;
		session.ws.close();
		delete session.eventsub;
		delete sessions[channel_id];
	}
	const entry = data.channels[channel_id];
	session = {channel_id, login: entry.login, access_token: entry.access_token, ws: new WebSocket(reconnect_url ?? WebSocketSSLURL)};
	if (reconnect_url) session.reconnect_url = reconnect_url;

	session.ws.addEventListener('close', e => {
		console.log(`WebSocket closed\n\tchannel: ${entry.login}\n\tcode: ${e.code}\n\treason: ${e.reason}\n`);
		connectWebSocket(channel_id);
	});
	session.ws.addEventListener('message', e => onMessage(session, JSON.parse(e.data)));
	sessions[channel_id] = session;
	console.log(`WebSocket opened\n\tchannel: ${entry.login}\n\turl: ${session.ws.url}\n`);
}

/** Parses gotten message from WebSocket's: determines message_type and runs the corresponding function, also stops `session.keepalive_timeout` */
async function onMessage(session: Session, data: EventSub.Message.Any) {
	if (session.keepalive_timeout) {
		clearTimeout(session.keepalive_timeout);
		delete session.keepalive_timeout;
	}

	if (EventSub.Message.isSessionWelcome(data)) onSessionWelcome(session, data);
	else if (EventSub.Message.isSessionKeepalive(data)) onSessionKeepalive(session, data);
	else if (EventSub.Message.isNotification(data)) onNotification(session, data);
	else if (EventSub.Message.isSessionReconnect(data)) onSessionReconnect(session, data);
	else console.log(`Got unsupported message\n\tchannel: ${session.login}\n\ttype: ${data.metadata.message_type}\n\tdata: ${JSON.stringify(data)}\n`);
}

/** Parses `session_welcome` message: sets gotten payload session to `session.eventsub` */
async function onSessionWelcome(session: Session, message: EventSub.Message.SessionWelcome) {
	var logmessage = `Got message\n\tchannel: ${session.login}\n\ttype: ${message.metadata.message_type}\n\tpayload_session: ${JSON.stringify(message.payload.session)}`;

	session.eventsub = message.payload.session;
	if (!session.reconnect_url) {
		const response = await Request.CreateEventSubSubscription(client_id, data.bot_access_token, EventSub.Subscription.ChannelChatMessage(session.eventsub.id, session.channel_id, bot_id));
		if (response.status === 202) {
			data.channels[session.channel_id].subscriptions_id.push(response.data.id);
			saveData();
		}
		logmessage += `\n\tsubscription: ${JSON.stringify(response)}`;
	} else
		delete session.reconnect_url;
	console.log(`${logmessage}\n`);
}

/** Parses `session_keepalive` message: starts `session.keepalive_timeout` */
async function onSessionKeepalive(session: Session, message: EventSub.Message.SessionKeepalive) {
	//console.log(`Got message\n\tchannel: ${session.login}\n\ttype: ${message.metadata.message_type}\n\tmetadata: ${JSON.stringify(message.metadata)}\n`);
	session.keepalive_timeout = setTimeout(() => session.ws.close(4005, "session_keepalive timeout"), (session.eventsub!.keepalive_timeout_seconds + 2) * 1000);
}

/** Parses `notification` message of `channel.chat.message` event: handles commands (if any) */
async function onNotification(session: Session, message: EventSub.Message.Notification) {
	if (EventSub.Message.Notification.isChannelChatMessage(message)) {
		if (message.payload.event.message_type !== "text") return;

		const text = message.payload.event.message.text.trim();
		let index = text.indexOf(" ");
		let reply: string | null = null;
		const command = text.substring(0, index > -1 ? index : text.length).toLowerCase();

		var log = false;
		var logmessage = `Got message\n\tchannel: ${session.login}\n\ttype: ${message.metadata.message_type} (${message.payload.subscription.type})\n\tpayload_event: ${JSON.stringify(message.payload.event)}\n\tchatter: ${message.payload.event.chatter_user_name}\n\ttext: ${text}`;

		if (command === "!ping" || command === "!пинг") {
			log = true;
			reply = `🏓 Понг! (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)`;
		}
		else if (command === "!uptime" || command === "!аптайм") {
			log = true;
			reply = `⏱️ ${HumanizeDuration(new Date(message.payload.subscription.created_at).getTime() - Date.now())}`;
		}
		else if (command === "!банворд_добавить") {
			log = true;
			if (isModerator(message.payload)) {
				const term = text.substring(command.length + 1);
				if (term.length > 1) {
					const response = await Request.AddBlockedTerm(client_id, session.access_token, {broadcaster_id: session.channel_id, moderator_id: session.channel_id}, {text: term});
					logmessage += `\n\tresponse_addblockedterm: ${JSON.stringify(response)}`;
					reply = response.status === 200 ? `✅ Успешно! (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)` : `❌ Ошибка! (${response.message})`;
				} else {
					reply = `❌ Банворд должен быть длиннее 1 символа!`;
				}
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}
		else if (command === "!банворд_удалить") {
			log = true;
			if (isModerator(message.payload)) {
				const term = text.substring(command.length + 1);
				if (term.length > 1) {
					let response = await Request.GetBlockedTerms(client_id, session.access_token, {broadcaster_id: session.channel_id, moderator_id: session.channel_id});
					logmessage += `\n\tresponse_getblockedterms: ${JSON.stringify(response)}`;
					if (response.status === 200) {
						let id: string | null = null;
						for (let entry of response.data) if (entry.text === term) id = entry.id;
						if (id) {
							let response = await Request.RemoveBlockedTerm(client_id, session.access_token, {broadcaster_id: session.channel_id, moderator_id: session.channel_id, id});
							logmessage += `\n\tresponse_removeblockedterm: ${JSON.stringify(response)}`;
							if (response.status === 204) {
								reply = `✅ Успешно! (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)`;
							} else
								reply = `❌ Ошибка! (${response.message})`;
						} else
							reply = `❌ Банворд не найден!`;
					} else
						reply = `❌ Ошибка! (${response.message})`;
				} else {
					reply = `❌ Банворд должен быть длиннее 1 символа!`;
				}
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}
		else if (command === "!банворд_лист") {
			log = true;
			reply = isModerator(message.payload) ? `📜 https://dashboard.twitch.tv/u/${session.login}/settings/moderation/blocked-terms` : `❌ Нет полномочий.`;
		}
		else if (command === "!game" || command === "!игра") {
			log = true;
			if (isModerator(message.payload)) {
				var game = text.substring(command.length + 1).toLowerCase();
				var game_id: string | null = null;
				if (game === "общение" || game === "just chatting") game_id = "509658";
				else {
					const response = await Request.SearchCategories(client_id, session.access_token, {query: game, first: 1});
					logmessage += `\n\tresponse_searchcategories: ${JSON.stringify(response)}`;
					if (response.status === 200) {
						if (response.data.length > 0) {
							game = response.data[0].name;
							game_id = response.data[0].id;
						} else
							reply = `❌ Игра не найдена!`;
					}
					else
						reply = `❌ Ошибка! ${response.message}`;
				}

				if (game_id) {
					const response = await Request.ModifyChannelInformation(client_id, session.access_token, {broadcaster_id: session.channel_id}, {game_id});
					logmessage += `\n\tresponse_modifychannelinformation: ${JSON.stringify(response)}`;
					reply = response.status === 204 ? `✅ Игра изменена на ${game} (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)` : `❌ Ошибка! ${response.message}`;
				}
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}
		else if (command === "!title" || command === "!название") {
			log = true;
			if (isModerator(message.payload)) {
				const title = text.substring(command.length + 1);
				const response = await Request.ModifyChannelInformation(client_id, session.access_token, {broadcaster_id: session.channel_id}, {title});
				logmessage += `\n\tresponse_modifychannelinformation: ${JSON.stringify(response)}`;
				reply = response.status === 204 ? `✅ Название изменено на ${title} (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)` : `❌ Ошибка! ${response.message}`;
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}

		if (reply) logmessage += `\n\treply_text: ${reply}\n\tresponse_sendchatmessage: ${JSON.stringify(await Request.SendChatMessage(client_id, data.bot_access_token, {broadcaster_id: session.channel_id, sender_id: bot_id, message: reply, reply_parent_message_id: message.payload.event.message_id}))}`;
		if (log) console.log(`${logmessage}\n`);
	}
}

/** Parses `session_reconnect` message: closes WebSocket and uses gotten `reconnect_url` as url to connect WebSocket */
async function onSessionReconnect(session: Session, message: EventSub.Message.SessionReconnect) {
	session.reconnect_url = message.payload.session.reconnect_url;
	session.ws.close(4008, "session_reconnect message");
}

/** Asks from user in console to authorize their twitch, asks to insert link, and then parses it to return twitch access token data */
export async function getAccessToken(rl: readline.Interface, scopes: string[], channel_id: string): Promise<ResponseBody.OAuth2Validate> {
	console.log(`Authorize app: https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scopes.join('%20')}`);

	var link = "";
	await new Promise<void>(resolve => rl.question(`Insert link here (example: ${redirect_uri}#access_token=dsfalg34jd34gsdk3): `, answer => { link = answer; resolve(); }));

	console.log("");

	try {
		if (!link.startsWith(redirect_uri)) throw "Wrong link";

		link = link.substring(redirect_uri.length);

		if (link.includes("?")) throw "Do not cancel the authorization!";
		let index = link.indexOf("#");
		if (index < 0) throw "Wrong link";

		link = link.substring(index + 1);
		for (let k_v of link.split("&")) {
			const [k, access_token] = k_v.split("=", 2);
			if (k === "access_token") {
				console.log(`Saving access token...`);
				const response = await Request.OAuth2Validate(access_token);
				console.log(`\tvalidate_response: ${JSON.stringify(response)}\n`);
				if (response.status === 200) {
					if (response.user_id !== channel_id) {
						await Request.OAuth2Revoke(client_id, access_token);
						throw `Access token belongs to other channel!`;
					}
					if (response.client_id !== client_id) {
						await Request.OAuth2Revoke(response.client_id, access_token);
						throw `Access token belongs to other client_id!`;
					}
					return response;
				} else
					throw `Request.OAuth2Validate failed!`;
			}
		}

		throw "Wrong link";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}

/** Validates access token of channel, tries to revoke it (if wrong), and returns some entries from access token data */
async function validateAccessToken(rl: readline.Interface | null, scopes: string[], channel_id: string, login: string, access_token: string) {
	console.log(`Validating access token for ${login}...`);
	let response = await Request.OAuth2Validate(access_token);
	console.log(`\tresponse: ${JSON.stringify(response)}\n`);

	if (response.status === 200 && response.scopes.sort().join('') !== scopes.sort().join('')) {
		console.log("Revoking access token... (has wrong scopes)");
		const response2 = await Request.OAuth2Revoke(client_id, access_token);
		console.log(`\tresponse: ${JSON.stringify(response2)}\n`);
		response = {status: 401, message: "invalid token"} as ResponseBodyError.OAuth2Validate;
	}

	if (response.status === 200) {
		access_token = response.access_token;
		login = response.login;
	} else {
		console.log(`Access token expired for ${login}!`);

		rl ??= readline.createInterface({input: process.stdin, output: process.stdout});
		const response = await getAccessToken(rl, scopes, channel_id);
		access_token = response.access_token;
		login = response.login;
	}

	return {access_token, login, rl};
}

/** Method which runs some methods for each channel */
async function runFor(channel_id: string, entry: DataChannelsEntry) {
	if (entry.subscriptions_id.length > 0) {
		for (let id of entry.subscriptions_id)
			console.log(`Previous subscription deleted\n\tid: ${id}\n\tresponse: ${JSON.stringify(await Request.DeleteEventSubSubscription(client_id, entry.access_token, {id}))}\n`);
		entry.subscriptions_id = [];
	}

	connectWebSocket(channel_id);
}

async function main() {
	//#region parsing data.json and setting fields to data
	try {
		if (fs.existsSync('data.json')) {
			const json = JSON.parse(fs.readFileSync('data.json').toString());
			data.bot_access_token = json.bot_access_token;
			data.bot_login = json.bot_login;
			for (let [id, entry] of Object.entries(json.channels))
				(data.channels as any)[id] = entry;
		}
	}
	catch(e) {
		console.error(`Parsing data.json failed!\n\t${e}`);
		process.exit(1);
	}
	//#endregion
	//#region validating access token of bot
	var rl: readline.Interface | null = null;
	const response_bot = await validateAccessToken(rl, bot_scopes, bot_id, "bot", data.bot_access_token);
	data.bot_access_token = response_bot.access_token;
	data.bot_login = response_bot.login;
	rl = response_bot.rl;
	//#endregion
	//#region parsing 2 process argument to find command
	const commandsStr = "Commands:\n - " + [
		"node index.js list                 - shows added twitch channels to chatbot in CSV format",
		"node index.js add <user_login>     - adds twitch channel to chatbot",
		"node index.js add <channel_id>     - adds twitch channel to chatbot",
		"node index.js remove <user_login>  - removes twitch channel to chatbot",
		"node index.js remove <channel_id>  - removes twitch channel to chatbot",
		"node index.js                      - starts the bot"
	].join('\n - ');
	const commandName = process.argv[2];
	if (commandName) {
		if (commandName === "list") ChannelList();
		else if (commandName === "add") ChannelAdd();
		else if (commandName === "remove") ChannelRemove();
		else if (commandName === "help") console.log(commandsStr);
		else {
			console.error(`Unknown command!\n\n${commandsStr}`);
			process.exit(1);
		}
		if (rl) rl.close();
		return;
	}
	//#endregion
	//#region validating access token of channels and running websockets
	var connected = false;
	for (let [channel_id, entry] of Object.entries(data.channels)) {
		const response = await validateAccessToken(rl, scopes, channel_id, entry.login, entry.access_token);
		entry.access_token = response.access_token;
		entry.login = response.login;
		rl = response.rl;
		await runFor(channel_id, entry);
		connected = true;
	}

	if (!connected)
		console.error(`No channels to connect!`);
	//#endregion

	if (rl) rl.close();
	saveData();
}
main().catch(console.error);