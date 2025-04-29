//#region imports
import readline from 'readline';
import fs, { read } from 'fs';
import { Request, EventSub, Authorization } from 'twitch.ts';
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
] as const satisfies Authorization.Scope[];
export const scopes = [
	"moderator:manage:blocked_terms",
	"channel:manage:broadcast",
	"moderator:read:followers"
] as const satisfies Authorization.Scope[];
//#endregion

//#region interfaces
interface User {
	token: string;
	login: string;
}
export interface DataChannelsEntry {
	user: User;
	subscriptions_id: string[];
}
interface Data {
	bot: User;
	channels: Record<string, DataChannelsEntry>;
}
//#endregion

//#region some consts which usually you dont need to edit
export const data: Data = { bot: { token: "", login: "" }, channels: {} };
export var bot_authorization: Authorization.User<typeof bot_scopes>;
const WebSocketSSLURL = "wss://eventsub.wss.twitch.tv/ws";
const redirect_uri = "http://localhost";
const connections: Record<string, EventSub.Connection> = {};
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

/** Parses `session_welcome` message: sets gotten payload session to `session.eventsub` */
async function onSessionWelcome(connection: EventSub.Connection, message: EventSub.Message.SessionWelcome, is_reconnected: boolean) {
	var logmessage = `Got message\n\tchannel: ${connection.authorization.user_login}\n\ttype: ${message.metadata.message_type}\n\tpayload_session: ${JSON.stringify(message.payload.session)}`;

	if (!is_reconnected) {
		const response = await Request.CreateEventSubSubscription(bot_authorization, EventSub.Subscription.ChannelChatMessage({ transport: connection.transport, user_id: bot_authorization.user_id }, connection.authorization.user_id));
		if (response.ok) {
			data.channels[connection.authorization.user_id].subscriptions_id.push(response.data.id);
			saveData();
		}
		logmessage += `\n\tsubscription: ${JSON.stringify(response)}`;
	}
	console.log(`${logmessage}\n`);
}

function getPing(message_timestamp: string) {
	return Date.now() - new Date(message_timestamp).getTime();
}

/** Parses `notification` message of `channel.chat.message` event: handles commands (if any) */
async function onNotification(connection: EventSub.Connection, message: EventSub.Message.Notification) {
	if (EventSub.Message.Notification.isChannelChatMessage(message)) {
		if (message.payload.event.message_type !== "text") return;

		const text = message.payload.event.message.text.trim();
		let index = text.indexOf(" ");
		let reply: string | null = null;
		const command = text.substring(0, index > -1 ? index : text.length).toLowerCase();

		var log = false;
		var logmessage = `Got message\n\tchannel: ${connection.authorization.user_login}\n\ttype: ${message.metadata.message_type} (${message.payload.subscription.type})\n\tpayload_event: ${JSON.stringify(message.payload.event)}\n\tchatter: ${message.payload.event.chatter_user_name}\n\ttext: ${text}`;

		if (command === "!ping" || command === "!пинг") {
			log = true;
			reply = `🏓 Понг! (${getPing(message.metadata.message_timestamp)}ms)`;
		}
		else if (command === "!uptime" || command === "!аптайм") {
			log = true;
			reply = `⏱️ ${HumanizeDuration(Date.now() - new Date(message.payload.subscription.created_at).getTime())}`;
		}
		else if (command === "!банворд_добавить") {
			log = true;
			if (isModerator(message.payload)) {
				const term = text.substring(command.length + 1);
				if (term.length > 1) {
					const response = await Request.AddBlockedTerm(connection.authorization, connection.authorization.user_id, term);
					logmessage += `\n\taddblockedterm: ${JSON.stringify(response)}`;
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
					let response = await Request.GetBlockedTerms(connection.authorization, connection.authorization.user_id);
					logmessage += `\n\tgetblockedterms: ${JSON.stringify(response)}`;
					if (response.status === 200) {
						let id: string | null = null;
						for (let entry of response.data) if (entry.text === term) id = entry.id;
						if (id) {
							let response = await Request.RemoveBlockedTerm(connection.authorization, connection.authorization.user_id, id);
							logmessage += `\n\tremoveblockedterm: ${JSON.stringify(response)}`;
							if (response.status === 204) {
								reply = `✅ Успешно! (${getPing(message.metadata.message_timestamp)}ms)`;
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
			reply = isModerator(message.payload) ? `📜 https://dashboard.twitch.tv/u/${connection.authorization.user_login}/settings/moderation/blocked-terms` : `❌ Нет полномочий.`;
		}
		else if (command === "!game" || command === "!игра") {
			log = true;
			if (isModerator(message.payload)) {
				var game = text.substring(command.length + 1).toLowerCase();
				var game_id: string | null = null;
				if (game === "общение" || game === "just chatting") game_id = "509658";
				else {
					const response = await Request.SearchCategories(connection.authorization, game, 1);
					logmessage += `\n\tsearchcategories: ${JSON.stringify(response)}`;
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
					const response = await Request.ModifyChannelInformation(connection.authorization, { game_id });
					logmessage += `\n\tmodifychannelinformation: ${JSON.stringify(response)}`;
					reply = response.status === 204 ? `✅ Успешно! (${getPing(message.metadata.message_timestamp)}ms)` : `❌ Ошибка! ${response.message}`;
				}
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}
		else if (command === "!title" || command === "!название") {
			log = true;
			if (isModerator(message.payload)) {
				const title = text.substring(command.length + 1);
				const response = await Request.ModifyChannelInformation(connection.authorization, { title });
				logmessage += `\n\tmodifychannelinformation: ${JSON.stringify(response)}`;
				reply = response.status === 204 ? `✅ Успешно! (${getPing(message.metadata.message_timestamp)}ms)` : `❌ Ошибка! ${response.message}`;
			} else {
				reply = `❌ Нет полномочий.`;
			}
		}
		else if (command === "!follow") {
			log = true;
			if (text.length > command.length) {
				const login = text.substring(command.length + 1);
				const response = await Request.GetUsers(connection.authorization, { login });
				logmessage += `\n\tgetusers: ${JSON.stringify(response)}`;
				if (response.ok && response.data.length > 0) {
					const response1 = await Request.GetChannelFollowers(connection.authorization, connection.authorization.user_id, response.data[0].id);
					if (response1.ok && response1.data.length > 0) {
						reply = `💜 ${response.data[0].display_name} отслеживает этот канал уже ${HumanizeDuration(Date.now() - new Date(response1.data[0].followed_at).getTime())}!`;
					}
					else {
						reply = `❌ ${response.data[0].display_name} не отслеживает этот канал.`;
					}
				}
				else {
					reply = `❌ Пользователя не существует.`;
				}
			}
		}

		if (reply) logmessage += `\n\treply_text: ${reply}\n\tsendchatmessage: ${JSON.stringify(await Request.SendChatMessage(bot_authorization, connection.authorization.user_id, reply, message.payload.event.message_id))}`;
		if (log) console.log(`${logmessage}\n`);
	}
}

/** Asks from user in console to authorize their twitch, asks to insert link, and then parses it to return twitch access token data */
export async function getAccessToken<S extends Authorization.Scope[]>(rl: readline.Interface, scopes: S): Promise<string> {
	console.log(`Authorize app: ${Authorization.authorizeURL(client_id, redirect_uri, scopes)}`);

	var link = await new Promise<string>(resolve => rl.question(`Insert link here (example: ${redirect_uri}#access_token=dsfalg34jd34gsdk3): `, answer => resolve(answer)));

	console.log("");

	try {
		if (!link.startsWith(redirect_uri)) throw "Wrong link";

		link = link.substring(redirect_uri.length);

		if (link.includes("?")) throw "Do not cancel the authorization!";
		let index = link.indexOf("#");
		if (index < 0) throw "Wrong link";

		link = link.substring(index + 1);
		for (let k_v of link.split("&")) {
			const [k, token] = k_v.split("=", 2);
			if (k === "access_token") return token;
		}

		throw "Wrong link";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}

/** Validates access token of channel, tries to revoke it (if wrong), and returns some entries from access token data */
async function getAuthorization<S extends Authorization.Scope[]>(rl: readline.Interface | null, user: User, scopes: S): Promise<{authorization: Authorization.User<S>, rl: readline.Interface | null}> {
	try {
		console.log(`Validating access token for ${user.login}...`);
		const response = await Request.OAuth2Validate(user.token);
		console.log(`\tresponse: ${JSON.stringify(response)}\n`);
		if (response.ok) {
			const authorization = Authorization.fromResponseBodyOAuth2Validate(response);
			if (authorization.type !== "user") throw `Token isn't user access token!\n`;

			if (!Authorization.hasScopes(authorization, ...scopes)) {
				console.log("Revoking access token... (has wrong scopes)");
				const response = await Request.OAuth2Revoke(authorization);
				console.log(`\tresponse: ${JSON.stringify(response)}\n`);
				throw "Revoked";
			}

			user.login = authorization.user_login;
			saveData();

			return {authorization, rl};
		}
		else {
			console.log(`Access token expired for ${user.login}!\n`);
			throw "Expired";
		}
	} catch(e) {
		rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });

		const token = await getAccessToken(rl, scopes);
		console.log(`Saving access token...`);
		const response = await Request.OAuth2Validate<S>(token);
		console.log(`\tvalidate: ${JSON.stringify(response)}`);
		if (response.ok) {
			const authorization = Authorization.fromResponseBodyOAuth2Validate(response);
			if (authorization.type !== "user") throw "bro how the fuck r u created app access token with implicit grant flow???";

			if (authorization.user_login !== user.login) {
				const response = await Request.OAuth2Revoke(authorization);
				console.log(`\trevoke: ${JSON.stringify(response)}`);
				throw `Access token belongs to other channel!`;
			}
			if (authorization.client_id !== client_id) {
				const response = await Request.OAuth2Revoke(authorization);
				console.log(`\trevoke: ${JSON.stringify(response)}`);
				throw `Access token belongs to other client_id!`;
			}

			return {authorization, rl};
		}

		throw `\nRequest.OAuth2Validate failed!\n\tcode: ${response.status}\n\terror: ${response.message}`;
	}

	/*if (response.status === 200 && response.scopes.sort().join('') !== scopes.sort().join('')) {
		console.log("Revoking access token... (has wrong scopes)");
		const response2 = await Request.OAuth2Revoke(client_id, access_token);
		console.log(`\tresponse: ${JSON.stringify(response2)}\n`);
		response = {status: 401, message: "invalid token"} as ResponseBodyError.OAuth2Validate;
	}

	if (response.status === 200) {
		const result: any = response;
		result.access_token = access_token;
		result.rl = rl;
		return result;
	} else {
		console.log(`Access token expired for ${login}!`);

		rl ??= readline.createInterface({input: process.stdin, output: process.stdout});
		const result: any = await getAccessToken(rl, scopes, channel_id);
		result.access_token = access_token;
		result.rl = rl;
		return result;
	}*/
}

async function main() {
	//#region parsing data.json and setting fields to data
	try {
		if (fs.existsSync('data.json')) {
			const json = JSON.parse(fs.readFileSync('data.json').toString());
			data.bot = json.bot;
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
	const { authorization, rl: newRL } = await getAuthorization(rl, data.bot, bot_scopes);
	bot_authorization = authorization;
	rl = newRL;
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
		const { authorization, rl: newRL } = await getAuthorization(rl, entry.user, scopes);
		rl = newRL;
		connected = true;

		if (entry.subscriptions_id.length > 0) {
			for (let id of entry.subscriptions_id)
				console.log(`Previous subscription deleted\n\tid: ${id}\n\tresponse: ${JSON.stringify(await Request.DeleteEventSubSubscription(bot_authorization, id))}\n`);
			entry.subscriptions_id = [];
		}

		const connection = EventSub.startWebSocket(authorization);
		console.log(`WebSocket opened\n\tchannel: ${connection.authorization.user_login}\n\turl: ${connection.ws.url}\n`);
		connections[channel_id] = connection;
		connection.onSessionWelcome = async(message, is_reconnected) => onSessionWelcome(connection, message, is_reconnected);
		connection.onNotification = async(message) => onNotification(connection, message);
		connection.onClose = async(code, reason) => {
			console.log(`WebSocket closed\n\tchannel: ${connection.authorization.user_login}\n\tcode: ${code}\n\treason: ${reason}\n`);
		};
	}

	if (!connected)
		console.error(`No channels to connect!`);
	//#endregion

	if (rl) rl.close();
	saveData();
}
main().catch(console.error);