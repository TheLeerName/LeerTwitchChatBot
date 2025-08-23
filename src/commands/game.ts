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
		const game = req.args.join(" ").toLowerCase();
		var game_id: string | undefined;
		if (game === "общение" || game === "just chatting") game_id = "509658";
		else {
			const response = await Twitch.Request.SearchCategories(a, game, 1);
			res.log += `\tsearchcategories: ${JSON.stringify(response)}\n`;
			if (!response.ok) return res.twitch = `❌ Ошибка! (${response.status} - ${response.message})`;
			if (response.data.length === 0) return res.twitch = `❌ Игра не найдена!`;
			game_id = response.data[0].id;
		}
		if (!game_id)
			return res.twitch = `❌ Игра не найдена!`;

		const response = await Twitch.Request.ModifyChannelInformation(a, { game_id });
		res.log += `\tmodifychannelinformation: ${JSON.stringify(response)}\n`;
		return res.twitch = response.ok ? `✅ Успешно!` : `❌ Ошибка! (${response.status} - ${response.message})`;
	}
};