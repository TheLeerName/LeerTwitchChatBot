import readline from 'readline';
import fs from 'fs';
import { Response as TwitchResponse, RequestBody, RequestQuery, EventSub } from './types';
import { main as ChannelAdd } from './channeladd';
import { main as ChannelRemove } from './channelremove';
import { humanizer } from 'humanize-duration';

export interface ConfigChannelsEntry {
	login: string;
	display_name: string;
}
export interface Config {
	client_id: string;
	access_token: string;
	user_id: string;
	scopes: string[];
	channels: Record<string, ConfigChannelsEntry>;
}
export const config: Config = {client_id: "", scopes: [], access_token: "", user_id: "", channels: {}};
export function saveConfig() {
	fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));
}

const WebSocketSSLURL = "wss://eventsub.wss.twitch.tv/ws";
const redirect_uri = "http://localhost";
const HumanizeDuration = humanizer({largest: 3, round: true, delimiter: " ", language: "ru"});

interface Session {
	ws: WebSocket;
	channel_id: string;
	login: string;
	display_name: string;
	is_reconnecting: boolean;
	keepalive_timeout?: NodeJS.Timeout;
	eventsub?: EventSub.Session;
}
export const sessions: Record<string, Session> = {};
function connectWebSocket(channel_id: string, reconnect_url?: string) {
	let session = sessions[channel_id];
	if (session) {
		session.ws.close();
		delete session.eventsub;
		delete sessions[channel_id];
	}
	const channelConfig = config.channels[channel_id];
	session = {channel_id, login: channelConfig.login, display_name: channelConfig.display_name, is_reconnecting: reconnect_url != null, ws: new WebSocket(reconnect_url ?? WebSocketSSLURL)};

	session.ws.addEventListener('close', e => {
		console.log(`WebSocket closed\n\t${session.display_name}\n\t${e.code}\n\t${e.reason}\n`);
		connectWebSocket(channel_id, e.code === 4008 ? WebSocketSSLURL : undefined);
	});
	session.ws.addEventListener('message', e => onMessage(session, JSON.parse(e.data)));
	sessions[channel_id] = session;
	console.log(`WebSocket opened\n\t${session.display_name}\n\t${session.ws.url}\n`);
}

async function onMessage(session: Session, data: EventSub.Message.Any) {
	if (session.keepalive_timeout) {
		clearTimeout(session.keepalive_timeout);
		delete session.keepalive_timeout;
	}

	if (EventSub.Message.isSessionWelcome(data)) onSessionWelcome(session, data);
	else if (EventSub.Message.isSessionKeepalive(data)) onSessionKeepalive(session, data);
	else if (EventSub.Message.isNotification(data)) onNotification(session, data);
	else if (EventSub.Message.isSessionReconnect(data)) onSessionReconnect(session, data);
	else console.log(`Unsupported message type\n\t${data.metadata.message_type}\n\t${JSON.stringify(data)}\n`);
}

async function onSessionWelcome(session: Session, data: EventSub.Message.SessionWelcome) {
		session.eventsub = data.payload.session;
		const m = JSON.stringify(await TwitchResponse.CreateEventSubSubscription(config.client_id, config.access_token, RequestBody.Subscription.ChannelChatMessage(session.eventsub.id, session.channel_id, session.channel_id)));
		console.log(`Bot initialized\n\t${session.display_name}\n\t${m}\n`);
}

async function onSessionKeepalive(session: Session, data: EventSub.Message.SessionKeepalive) {
	session.keepalive_timeout = setTimeout(() => session.ws.close(4005, 'session_keepalive timeout'), (session.eventsub!.keepalive_timeout_seconds + 2) * 1000);
}

async function onNotification(session: Session, data: EventSub.Message.Notification) {
	if (EventSub.Message.Notification.isChannelChatMessage(data)) {
		const text = data.payload.event.message.text;
		let index = text.indexOf(" ");
		const command = text.substring(0, index > -1 ? index : text.length);
		let answer: string | null = null;
		if (command === "!пинг") {
			console.log(`Got command\n\t${data.payload.event.chatter_user_name}\n\t${text}`);
			answer = `🏓 Понг! (${new Date(data.metadata.message_timestamp).getTime() - Date.now()}ms)`;
		}
		else if (command === "!аптайм") {
			console.log(`Got command\n\t${data.payload.event.chatter_user_name}\n\t${text}`);
			answer = `⏱️ ${HumanizeDuration(new Date(data.payload.subscription.created_at).getTime() - Date.now())}`;
		}
		else if (command === "!банворд_добавить") {
			console.log(`Got command\n\t${data.payload.event.chatter_user_name}\n\t${text}`);
			const term = text.substring(command.length + 1);
			if (term.length > 1) {
				const response = await TwitchResponse.AddBlockedTerm(config.client_id, config.access_token, RequestQuery.AddBlockedTerm(session.channel_id, config.user_id), RequestBody.AddBlockedTerm(term));
				console.log(`\t${JSON.stringify(response)}`);
				answer = response.status === 200 ? `✅ Успешно! (${new Date(data.metadata.message_timestamp).getTime() - Date.now()}ms)` : `❌ Ошибка! (${response.message})`;
			} else {
				answer = `❌ Банворд должен быть длиннее 1 символа!`;
			}
		}
		else if (command === "!банворд_удалить") {
			console.log(`Got command\n\t${data.payload.event.chatter_user_name}\n\t${text}`);
			const term = text.substring(command.length + 1);
			if (term.length > 1) {
				let response = await TwitchResponse.GetBlockedTerms(config.client_id, config.access_token, RequestQuery.GetBlockedTerms(session.channel_id, config.user_id));
				console.log(`\t${JSON.stringify(response)}`);
				if (response.status === 200) {
					let id: string | null = null;
					for (let entry of response.data) if (entry.text === term) id = entry.id;
					if (id) {
						let response = await TwitchResponse.RemoveBlockedTerm(config.client_id, config.access_token, RequestQuery.RemoveBlockedTerm(session.channel_id, config.user_id, id));
						console.log(`\t${JSON.stringify(response)}`);
						if (response.status === 204) {
							answer = `✅ Успешно! (${new Date(data.metadata.message_timestamp).getTime() - Date.now()}ms)`;
						} else
							answer = `❌ Ошибка! (${response.message})`;
					} else
						answer = `❌ Банворд не найден!`;
				} else
					answer = `❌ Ошибка! (${response.message})`;
			} else {
				answer = `❌ Банворд должен быть длиннее 1 символа!`;
			}
		}
		else if (command === "!банворд_лист") {
			console.log(`Got command\n\t${data.payload.event.chatter_user_name}\n\t${text}`);
			answer = `📜 https://dashboard.twitch.tv/u/${session.login}/settings/moderation/blocked-terms`;
		}

		if (answer) {
			console.log(`\t${answer}\n\t${JSON.stringify(await TwitchResponse.SendChatMessage(config.client_id, config.access_token, RequestQuery.SendChatMessage(session.channel_id, config.user_id, answer, data.payload.event.message_id)))}\n`);
		}
	}
}

async function onSessionReconnect(session: Session, data: EventSub.Message.SessionReconnect) {
	session.ws.close(4008, data.payload.session.reconnect_url);
}

export async function main() {
	try {
		if (!fs.existsSync('config.json')) throw "config.json is not exists";

		const configJSON = JSON.parse(fs.readFileSync('config.json').toString());
		if (!configJSON.client_id) throw `Corrupted config entry: client_id`;
		if (!configJSON.access_token) throw `Corrupted config entry: access_token`;
		if (!configJSON.user_id) throw `Corrupted config entry: user_id`;
		if (!configJSON.scopes) throw `Corrupted config entry: scopes`;
		if (!configJSON.channels) throw `Corrupted config entry: channels`;

		config.client_id = configJSON.client_id;
		config.user_id = configJSON.user_id;
		config.access_token = configJSON.access_token;
		config.scopes = configJSON.scopes;
		for (let [user_id, entry] of Object.entries<any>(configJSON.channels)) {
			if (typeof entry?.login === "string" && typeof entry?.display_name === "string")
				config.channels[user_id] = {login: entry.login, display_name: entry.display_name};
			else throw `Corrupted config.channels entry: ${user_id}`;
		}
	} catch(e) {
		console.error(`Parsing config.json failed!\n\t${e}`);
		process.exit(1);
	}

	const commandsStr = "Commands:\n - " + [
		"node dist/index.js add <user_login>     - adds twitch channel to chatbot",
		"node dist/index.js add <user_id>        - adds twitch channel to chatbot",
		"node dist/index.js remove <user_login>  - removes twitch channel to chatbot",
		"node dist/index.js remove <user_id>     - removes twitch channel to chatbot",
		"node dist/index.js                      - starts the bot"
	].join('\n - ');
	const commandName = process.argv[2];
	if (commandName) {
		if (commandName === "add") ChannelAdd();
		else if (commandName === "remove") ChannelRemove();
		else if (commandName === "help") console.log(commandsStr);
		else {
			console.error(`Unknown command!\n\n${commandsStr}`);
			process.exit(1);
		}
		return;
	}

	const response = await TwitchResponse.OAuth2Validate(config.access_token);
	console.log("Validating access token...");
	console.log(`\t${JSON.stringify(response)}\n`);
	if (response.status === 400 || response.status === 401 || (response.status === 200 && response.scopes.sort().join('') !== config.scopes.sort().join(''))) {
		console.log(`Access token expired!`);
		console.log(`Go to link and authorize the app: https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${config.client_id}&redirect_uri=${redirect_uri}&scope=${config.scopes.join('%20')}\n`);
		const rl = readline.createInterface({input: process.stdin, output: process.stdout});
		rl.question(`Insert link here (example: ${redirect_uri}#access_token=dsfalg34jd34gsdk3): `, link => {
			rl.close();
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
						config.access_token = access_token;
						saveConfig();
						console.log(`New access token saved: ${config.access_token}\n`);
						return main2();
					}
				}
			} catch(e) {
				console.error(e);
				process.exit(1);
			}
		});
	} else
		main2();
}

async function main2() {
	for (let channel_id of Object.keys(config.channels))
		connectWebSocket(channel_id);
}