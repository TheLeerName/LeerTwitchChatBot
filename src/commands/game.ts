//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!game", "!игра"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		const a = authorization[req.message.payload.event.broadcaster_user_id];
		const query = req.args.join(" ").toLowerCase();

		const searchcategories = await Twitch.Request.SearchCategories(a, query, 1);
		res.log += `\tsearchcategories: ${JSON.stringify(searchcategories)}\n`;

		if (!searchcategories.ok)
			return res.twitch = `❌ Ошибка! (${searchcategories.status} - ${searchcategories.message})`;
		if (searchcategories.data.length === 0)
			return res.twitch = `❌ Игра не найдена!`;

		const game = searchcategories.data[0];

		const response = await Twitch.Request.ModifyChannelInformation(a, { game_id: game.id });
		res.log += `\tmodifychannelinformation: ${JSON.stringify(response)}\n`;
		return res.twitch = response.ok ? `✅ Игра изменена на ${game.name}!` : `❌ Ошибка! (${response.status} - ${response.message})`;
	}
};