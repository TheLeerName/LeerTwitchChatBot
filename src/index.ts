//#region imports
import TerminalCommandsInit from "./terminal-commands";
import onChannelChatMessage from "./commands";
import DataInit, { data } from "./data";
import TwitchAuthorizationInit, { authorization, authorization_bot, runRequestWithTokenRefreshing, scopes_bot, refreshTokenOfBot, refreshTokenOfChannel } from "./twitch-authorization";
import { Request, EventSub, ResponseBody, Authorization } from "twitch.ts";
//#endregion

const polling_channels_id: string[] = [];
var connection: EventSub.Connection<typeof scopes_bot>;
async function main() {
	console.log(`Data initialized (${(await callWithElapsedTime(async() => await DataInit())).elapsed}ms)\n`);
	await TerminalCommandsInit();
	console.log(`Twitch authorization initialized (${(await callWithElapsedTime(async() => await TwitchAuthorizationInit())).elapsed}ms)\n`);

	connection = EventSub.startWebSocket(authorization_bot);
	connection.onSessionWelcome = async(message, is_reconnected) => {
		console.log(`EventSub session ${is_reconnected ? "re" : ""}connected\n\turl: ${connection.ws.url}\n`);
		if (!is_reconnected) await addSubscriptions();
	};
	connection.onNotification = async(message) => {
		if (EventSub.Message.Notification.isChannelChatMessage(message)) onChannelChatMessage(message);
		else if (EventSub.Message.Notification.isStreamOnline(message)) onStreamOnline(message);
		else if (EventSub.Message.Notification.isStreamOffline(message)) onStreamOffline(message);
	};
	connection.onRevocation = async(message) => {
		console.error(`EventSub subscription was revocated\n\tevent: ${message.payload.subscription.type} version ${message.payload.subscription.version}\n\tcondition: ${JSON.stringify(message.payload.subscription.condition)}\n\treason: ${message.payload.subscription.status}\n`);
		process.exit(1);
	};
	connection.onClose = async(code, reason) => {
		console.error(`EventSub session disconnected\n\tcode: ${code} - ${reason}\n`);
	};

	checkIfStreamersIsLive();
}

async function checkIfStreamersIsLive() {
	const enabled_channels = Object.entries(data.channels).filter(([_, channel]) => channel.enabled);
	const getstreams = await getStreams(async() => await refreshTokenOfBot(), authorization_bot, enabled_channels.map(([id, _]) => id), undefined, undefined, "live");
	if (!getstreams.ok)
		return console.error(`Checking if streamers is live failed!\n\tcode: ${getstreams.status} - ${getstreams.message}\n`);

	for (const entry of getstreams.data)
		polling_channels_id.push(entry.user_id);
	getChattersPolling();
}

async function onStreamOnline(message: EventSub.Message.Notification<EventSub.Payload.StreamOnline>) {
	console.log(`Stream started\n\tchannel: ${message.payload.event.broadcaster_user_login}\n`);
	const id = message.payload.event.broadcaster_user_id;
	if (!polling_channels_id.includes(id))
		polling_channels_id.push(id);
}
async function onStreamOffline(message: EventSub.Message.Notification<EventSub.Payload.StreamOffline>) {
	console.log(`Stream ended\n\tchannel: ${message.payload.event.broadcaster_user_login}\n`);
	const id = message.payload.event.broadcaster_user_id;
	const index = polling_channels_id.indexOf(id);
	if (index > -1) polling_channels_id.splice(index, 1);
}

async function getChattersPolling() {
	if (polling_channels_id.length > 0) {
		for (const id of polling_channels_id) {
			const a = authorization[id];
			const channel = data.channels[id];
			const response = await getChatters(async() => await refreshTokenOfChannel(id), a, a.user_id);
			if (response.ok) {
				if (response.data.length > 0) {
					for (const entry of response.data) {
						if (channel.chatters_watchtime[entry.user_id] == null) channel.chatters_watchtime[entry.user_id] = 0;
						else channel.chatters_watchtime[entry.user_id]++;
					}
					data.save();
				}
			}
			else
				console.error(`Getting chatters failed!\n\tchannel: ${channel.user.login}\n\tcode: ${response.status} - ${response.message}\n`);
		}
	}

	setTimeout(getChattersPolling, 60_000); // each minute
}

async function getStreams(refresh: () => Promise<void>, ...args: Parameters<typeof Request.GetStreams>) {
	const res_data: ResponseBody.GetStreams["data"] = [];
	var cursor: string | undefined;
	async function func() {
		const response = await runRequestWithTokenRefreshing(refresh, Request.GetStreams, args[0], args[1], args[2], args[3], args[4], args[5], undefined, undefined, cursor);
		if (response.ok) {
			res_data.push(...response.data);
			cursor = response.pagination?.cursor;
			if (cursor) return await func();
			return response;
		}
		else
			return response;
	}
	const r = await func();
	if (r.ok) {
		r.data = res_data;
		return r;
	}
	else
		return r;
}
async function getChatters(refresh: () => Promise<void>, ...args: Parameters<typeof Request.GetChatters>) {
	const res_data: ResponseBody.GetChatters["data"] = [];
	var cursor: string | undefined;
	async function func() {
		const response = await runRequestWithTokenRefreshing(refresh, Request.GetChatters, args[0], args[1], undefined, cursor);
		if (response.ok) {
			res_data.push(...response.data);
			cursor = response.pagination?.cursor;
			if (cursor) return await func();
			return response;
		}
		else
			return response;
	}
	const r = await func();
	if (r.ok) {
		r.data = res_data;
		return r;
	}
	else
		return r;
}

export async function callWithElapsedTime<R extends any>(func: ()=>Promise<R>): Promise<{ response: R, elapsed: number }> {
	const time = Date.now();
	const response = await func();
	return { response, elapsed: Date.now() - time };
}

async function addSubscriptions() {
	for (const [channel_id, channel] of Object.entries(data.channels)) {
		if (!channel.enabled) return;
		for (const id of channel.subscriptions_id) {
			const response = await runRequestWithTokenRefreshing(async() => await refreshTokenOfBot(), Request.DeleteEventSubSubscription, authorization[channel_id], id);
			if (!response.ok) console.error(`Removing previous subscription failed!\n\tid: ${id}\n\tcode: ${response.status} - ${response.message}\n`);
			channel.subscriptions_id.shift();
		}

		const a = authorization[channel_id];
		addSubscription(EventSub.Subscription.ChannelChatMessage(connection, channel_id), a);
		addSubscription(EventSub.Subscription.StreamOnline(connection, channel_id), a);
		addSubscription(EventSub.Subscription.StreamOffline(connection, channel_id), a);
	}
	data.save();
}

async function addSubscription(subscription: EventSub.Subscription, authorization: Authorization.User) {
	const response = await runRequestWithTokenRefreshing(async() => await refreshTokenOfChannel(authorization.user_id), Request.CreateEventSubSubscription, authorization, subscription);
	if (!response.ok) console.error(`Subscribing to event failed!\n\tevent: ${subscription.type} version ${subscription.version}\n\tchannel: ${authorization.user_login}\n\tcode: ${response.status} - ${response.message}`);
	else data.channels[authorization.user_id].subscriptions_id.push(response.data.id);
}

main().catch(console.error);