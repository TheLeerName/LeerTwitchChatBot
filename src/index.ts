import readline from 'readline';
import fs from 'fs';
import { Request, RequestBody, RequestQuery, EventSub } from './types';
import { main as ChannelList } from './channellist';
import { main as ChannelAdd } from './channeladd';
import { main as ChannelRemove } from './channelremove';
import { humanizer } from 'humanize-duration';

export const client_id = "0ho17t37uu3a4sfdrs6r76qwi51evf";
export const scopes = [
	"moderator:manage:blocked_terms",
	"user:read:chat",
	"user:write:chat"
];

interface DataChannelsEntry {
	login: string;
	display_name: string;
}
interface Data {
	access_token: string;
	user_id: string;
	subscriptions_id: string[];
	channels: Record<string, DataChannelsEntry>;
}
interface Session {
	ws: WebSocket;
	channel_id: string;
	login: string;
	display_name: string;

	reconnect_url?: string;
	keepalive_timeout?: NodeJS.Timeout;
	eventsub?: EventSub.Session;
}

export const data: Data = {access_token: "", user_id: "", subscriptions_id: [], channels: {}};
export function saveData() {
	fs.writeFileSync('data.json', JSON.stringify(data, null, '\t'));
}

const WebSocketSSLURL = "wss://eventsub.wss.twitch.tv/ws";
const redirect_uri = "http://localhost";
const sessions: Record<string, Session> = {};
const HumanizeDuration = humanizer({largest: 3, round: true, delimiter: " ", language: "ru"});

function isModerator(payload: EventSub.Payload.ChannelChatMessage): boolean {
	for (let badge of payload.event.badges) if (badge.set_id === "moderator" || badge.set_id === "broadcaster") return true;
	return false;
}

function connectWebSocket(channel_id: string) {
	let reconnect_url: string | undefined;
	let session = sessions[channel_id];
	if (session) {
		reconnect_url = session.reconnect_url;
		session.ws.close();
		delete session.eventsub;
		delete sessions[channel_id];
	}
	const channelData = data.channels[channel_id];
	session = {channel_id, login: channelData.login, display_name: channelData.display_name, ws: new WebSocket(reconnect_url ?? WebSocketSSLURL)};
	if (reconnect_url) session.reconnect_url = reconnect_url;

	session.ws.addEventListener('close', e => {
		console.log(`WebSocket closed\n\tchannel: ${session.display_name}\n\tcode: ${e.code}\n\treason: ${e.reason}\n`);
		connectWebSocket(channel_id);
	});
	session.ws.addEventListener('message', e => onMessage(session, JSON.parse(e.data)));
	sessions[channel_id] = session;
	console.log(`WebSocket opened\n\tchannel: ${session.display_name}\n\turl: ${session.ws.url}\n`);
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
	else console.log(`Got unsupported message\n\tchannel: ${session.display_name}\n\ttype: ${data.metadata.message_type}\n\tdata: ${JSON.stringify(data)}\n`);
}

async function onSessionWelcome(session: Session, message: EventSub.Message.SessionWelcome) {
	var logmessage = `Got message\n\tchannel: ${session.display_name}\n\ttype: ${message.metadata.message_type}\n\tpayload_session: ${JSON.stringify(message.payload.session)}`;

	session.eventsub = message.payload.session;
	if (!session.reconnect_url) {
		const response = await Request.CreateEventSubSubscription(client_id, data.access_token, EventSub.Subscription.ChannelChatMessage(session.eventsub.id, session.channel_id, data.user_id));
		if (response.status === 202) {
			data.subscriptions_id.push(response.data.id);
			saveData();
		}
		logmessage += `\n\tsubscription: ${JSON.stringify(response)}`;
	} else
		delete session.reconnect_url;
	console.log(`${logmessage}\n`);
}

async function onSessionKeepalive(session: Session, message: EventSub.Message.SessionKeepalive) {
	//console.log(`Got message\n\tchannel: ${session.display_name}\n\ttype: ${message.metadata.message_type}\n\tmetadata: ${JSON.stringify(message.metadata)}\n`);
	session.keepalive_timeout = setTimeout(() => session.ws.close(4005, "session_keepalive timeout"), (session.eventsub!.keepalive_timeout_seconds + 2) * 1000);
}

async function onNotification(session: Session, message: EventSub.Message.Notification) {
	if (EventSub.Message.Notification.isChannelChatMessage(message)) {
		if (message.payload.event.message_type !== "text") return;

		const text = message.payload.event.message.text.trim();
		let index = text.indexOf(" ");
		let reply: string | null = null;
		const command = text.substring(0, index > -1 ? index : text.length).toLowerCase();

		var log = false;
		var logmessage = `Got message\n\tchannel: ${session.display_name}\n\ttype: ${message.metadata.message_type} (${message.payload.subscription.type})\n\tpayload_event: ${JSON.stringify(message.payload.event)}\n\tchatter: ${message.payload.event.chatter_user_name}\n\ttext: ${text}`;

		if (command === "!пинг") {
			log = true;
			reply = `🏓 Понг! (${new Date(message.metadata.message_timestamp).getTime() - Date.now()}ms)`;
		}
		else if (command === "!аптайм") {
			log = true;
			reply = `⏱️ ${HumanizeDuration(new Date(message.payload.subscription.created_at).getTime() - Date.now())}`;
		}
		else if (command === "!банворд_добавить") {
			log = true;
			if (isModerator(message.payload)) {
				const term = text.substring(command.length + 1);
				if (term.length > 1) {
					const response = await Request.AddBlockedTerm(client_id, data.access_token, RequestQuery.AddBlockedTerm(session.channel_id, data.user_id), RequestBody.AddBlockedTerm(term));
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
					let response = await Request.GetBlockedTerms(client_id, data.access_token, RequestQuery.GetBlockedTerms(session.channel_id, data.user_id));
					logmessage += `\n\tresponse_getblockedterms: ${JSON.stringify(response)}`;
					if (response.status === 200) {
						let id: string | null = null;
						for (let entry of response.data) if (entry.text === term) id = entry.id;
						if (id) {
							let response = await Request.RemoveBlockedTerm(client_id, data.access_token, RequestQuery.RemoveBlockedTerm(session.channel_id, data.user_id, id));
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

		if (reply) logmessage += `\n\treply_text: ${reply}\n\tresponse_sendchatmessage: ${JSON.stringify(await Request.SendChatMessage(client_id, data.access_token, RequestQuery.SendChatMessage(session.channel_id, data.user_id, reply, message.payload.event.message_id)))}`;
		if (log) console.log(`${logmessage}\n`);
	}
}

async function onSessionReconnect(session: Session, message: EventSub.Message.SessionReconnect) {
	session.reconnect_url = message.payload.session.reconnect_url;
	session.ws.close(4008, "session_reconnect message");
}

export async function main() {
	try {
		if (fs.existsSync('data.json')) {
			const dataJSON = JSON.parse(fs.readFileSync('data.json').toString());
			if (!dataJSON.access_token) throw `Corrupted data entry: access_token`;
			if (!dataJSON.user_id) throw `Corrupted data entry: user_id`;
			if (!dataJSON.subscriptions_id) throw `Corrupted data entry: subscriptions_id`;
			if (!dataJSON.channels) throw `Corrupted data entry: channels`;

			data.user_id = dataJSON.user_id;
			data.access_token = dataJSON.access_token;
			data.subscriptions_id = dataJSON.subscriptions_id;
			for (let [user_id, entry] of Object.entries<any>(dataJSON.channels)) {
				if (typeof entry?.login === "string" && typeof entry?.display_name === "string")
					data.channels[user_id] = {login: entry.login, display_name: entry.display_name};
				else throw `Corrupted data.channels entry: ${user_id}`;
			}
		}
	} catch(e) {
		console.error(`Parsing data.json failed!\n\t${e}`);
		process.exit(1);
	}

	const commandsStr = "Commands:\n - " + [
		"node dist/index.js list                 - shows added twitch channels to chatbot in CSV format",
		"node dist/index.js add <user_login>     - adds twitch channel to chatbot",
		"node dist/index.js add <user_id>        - adds twitch channel to chatbot",
		"node dist/index.js remove <user_login>  - removes twitch channel to chatbot",
		"node dist/index.js remove <user_id>     - removes twitch channel to chatbot",
		"node dist/index.js                      - starts the bot"
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
		return;
	}

	const response = await Request.OAuth2Validate(data.access_token);
	console.log("Validating access token...");
	console.log(`\tresponse: ${JSON.stringify(response)}\n`);

	const isWrongScopes = response.status === 200 && response.scopes.sort().join('') !== scopes.sort().join('');
	if (response.status === 400 || response.status === 401 || isWrongScopes) {
		if (isWrongScopes) {
			console.log("Revoking access token... (has wrong scopes)");
			const response2 = await Request.OAuth2Revoke(client_id, data.access_token);
			console.log(`\tresponse: ${JSON.stringify(response2)}\n`);
		}

		data.user_id = "";
		data.access_token = "";
		saveData();

		console.log(`Access token expired!`);
		console.log(`Go to link and authorize the app: https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scopes.join('%20')}\n`);
		const rl = readline.createInterface({input: process.stdin, output: process.stdout});
		rl.question(`Insert link here (example: ${redirect_uri}#access_token=dsfalg34jd34gsdk3): `, async(link) => {
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
						console.log(`Saving access token...\n\ttoken: ${access_token}`);
						const response = await Request.OAuth2Validate(access_token);
						console.log(`\tvalidate_response: ${JSON.stringify(response)}`);
						if (response.status === 200) {
							data.access_token = access_token;
							console.log(`\ttoken_owner_id: ${response.user_id}\n`);
							data.user_id = response.user_id;
							saveData();
							return main2();
						} else
							throw `\nRequest.OAuth2Validate failed!`;
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
	if (data.subscriptions_id.length > 0) {
		for (let id of data.subscriptions_id)
			console.log(`Previous subscription deleted\n\tid: ${id}\n\tresponse: ${JSON.stringify(await Request.DeleteEventSubSubscription(client_id, data.access_token, RequestQuery.DeleteEventSubSubscription(id)))}\n`);
		data.subscriptions_id = [];
		saveData();
	}

	for (let channel_id of Object.keys(data.channels))
		connectWebSocket(channel_id);
}