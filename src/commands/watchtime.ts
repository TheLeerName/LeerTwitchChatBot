//#region imports
import { Request, Response } from ".";
import { data } from "../data";
import { authorization } from "../twitch-authorization";
import { HumanizeDuration, isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!watchtime", "!времяпросмотра"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		const a = authorization[req.message.payload.event.broadcaster_user_id];
		var response: Pick<Twitch.ResponseBody.GetUsers["data"][0], "display_name" | "id"> | undefined;
		if (req.args.length > 0) {
			const login = req.args.join(" ").toLowerCase();
			const getusers = await Twitch.Request.GetUsers(a, { login });
			res.log += `\tgetusers: ${JSON.stringify(getusers)}\n`;
			if (!getusers.ok)
				return res.twitch = `❌ Ошибка! (${getusers.status} - ${getusers.message})`;
			if (getusers.data.length === 0)
				return res.twitch = `❌ Пользователь не найден.`;
			response = { id: getusers.data[0].id, display_name: getusers.data[0].display_name };
		}
		else
			response = { id: req.message.payload.event.chatter_user_id, display_name: req.message.payload.event.chatter_user_name };

		const watchtime = data.channels[a.user_id].chatters_watchtime[response.id];
		res.log += `\twatchtime: ${watchtime ?? "undefined"} minutes\n`;
		if (!watchtime)
			return res.twitch = `❌ ${response.display_name} не смотрит этот канал.`;

		res.twitch = `👀 Время просмотра ${response.display_name} составляет ${HumanizeDuration(watchtime * 60000)}!`;
	}
};