//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!blockedtermadd", "!банворддобавить"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		const term = req.args.join(" ");
		if (term.length < 1)
			return res.twitch = `❌ Банворд должен быть длиннее 1 символа!`;

		const a = authorization[req.message.payload.event.broadcaster_user_id];
		const response = await Twitch.Request.AddBlockedTerm(a, a.user_id, term);
		res.log += `\taddblockedterm: ${JSON.stringify(response)}\n`;
		res.twitch = response.ok ? `✅ Успешно!` : `❌ Ошибка! (${response.status} - ${response.message})`;
	}
};