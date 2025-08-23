//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { HumanizeDuration, isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!followtime", "!follow", "!времяотслеживания", "!времяфоллоу", "!фоллоу"],
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

		const getchannelfollowers = await Twitch.Request.GetChannelFollowers(a, a.user_id, response.id, 1);
		res.log += `\tgetchannelfollowers: ${JSON.stringify(getchannelfollowers)}\n`;
		if (!getchannelfollowers.ok)
			return res.twitch = `❌ Ошибка! (${getchannelfollowers.status} - ${getchannelfollowers.message})`;
		if (getchannelfollowers.data.length === 0)
			return res.twitch = `❌ ${response.display_name} не отслеживает этот канал.`;

		res.twitch = `💜 ${response.display_name} отслеживает этот канал уже ${HumanizeDuration(new Date(req.message.metadata.message_timestamp).getTime() - new Date(getchannelfollowers.data[0].followed_at).getTime())}!`;
	}
};