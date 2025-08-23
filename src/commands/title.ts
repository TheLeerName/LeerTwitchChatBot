//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!title", "!название"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		const a = authorization[req.message.payload.event.broadcaster_user_id];
		const title = req.args.join(" ").toLowerCase();
		const response = await Twitch.Request.ModifyChannelInformation(a, { title });
		res.log += `\tmodifychannelinformation: ${JSON.stringify(response)}\n`;
		return res.twitch = response.ok ? `✅ Успешно!` : `❌ Ошибка! (${response.status} - ${response.message})`;
	}
};