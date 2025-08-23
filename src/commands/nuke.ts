//#region imports
import { Request, Response } from ".";
import { HumanizeDuration, getRandomInt } from "../utils";
//#endregion

export default {
	prefixes: ["!nuke", "!ядерка"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (req.args.length > 0)
			res.twitch = `☢️ Ядерка запущена на ${req.args.join(" ")}! Время прилёта: ${HumanizeDuration(getRandomInt(10, 600) * 1000)}`;
		else
			res.twitch = `❌ Нет цели.`;
	}
};