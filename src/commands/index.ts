//#region imports
import { authorization_bot, refreshTokenOfBot, runRequestWithTokenRefreshing } from "../twitch-authorization";
import Uptime from "./uptime";
import Sex from "./sex";
import Nuke from "./nuke";
import RussianRoulette from "./russianroulette";
import BlockedTermAdd from "./blockedtermadd";
import BlockedTermRemove from "./blockedtermremove";
import BlockedTermList from "./blockedtermlist";
import Game from "./game";
import Title from "./title";
import FollowTime from "./followtime";
import WatchTime from "./watchtime";
import { EventSub, Request } from "twitch.ts";
//#endregion

export type Request = {
	message: EventSub.Message.Notification<EventSub.Payload.ChannelChatMessage>,
	prefix: string,
	args: string[]
};
export type Response = {
	twitch: string,
	log: string
};
const commands: {prefixes: string[], func: (req: Request, res: Response)=>Promise<any>}[] = [
	Uptime,
	Sex,
	Nuke,
	RussianRoulette,
	BlockedTermAdd,
	BlockedTermRemove,
	BlockedTermList,
	Game,
	Title,
	FollowTime,
	WatchTime
];

export default async(message: Request["message"]) => {
	//if (message.payload.event.message_type !== "text") return;

	const text = message.payload.event.message.text = message.payload.event.message.text.trim();
	const text_split = text.split(" ");
	const req: Request = {
		message,
		prefix: text_split[0],
		args: text_split.slice(1)
	};
	const res: Response = {
		twitch: "",
		log: ""
	};
	for (const { func, prefixes } of commands) {
		if (prefixes.includes(req.prefix)) {
			res.log = `Executed command\n\tchannel: ${message.payload.event.broadcaster_user_login}\n\ttype: ${req.prefix}\n\ttext: ${text}\n`;
			await func(req, res);
			if (res.twitch) {
				const sendchatmessage = await runRequestWithTokenRefreshing(async() => await refreshTokenOfBot(), Request.SendChatMessage, authorization_bot, message.payload.event.broadcaster_user_id, res.twitch, message.payload.event.message_id);
				if (res.log) {
					res.log += `\treply: ${res.twitch}\n`;
					if (sendchatmessage.ok) {
						if (sendchatmessage.data.drop_reason)
							res.log += `\treply_drop_reason: ${sendchatmessage.data.drop_reason.code} - ${sendchatmessage.data.drop_reason.message}\n`;
					}
					else
						res.log += `\treply_failed_reason: ${sendchatmessage.status} - ${sendchatmessage.message}\n`;
				}
			}
			console.log(res.log);
			break;
		}
	}
};