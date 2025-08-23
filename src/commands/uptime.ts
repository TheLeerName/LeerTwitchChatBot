//#region imports
import { Request, Response } from ".";
import { HumanizeDuration } from "../utils";
//#endregion

export default {
	prefixes: ["!uptime", "!аптайм"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		const t = Date.now() - new Date(req.message.payload.subscription.created_at).getTime();
		res.twitch = `⏱️ ${HumanizeDuration(t)}`;
		res.log += `\tuptime: ${t}ms\n`;
	}
};