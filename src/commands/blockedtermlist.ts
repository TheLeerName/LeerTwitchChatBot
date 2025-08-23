//#region imports
import { Request, Response } from ".";
import { isModerator } from "../utils";
//#endregion

export default {
	prefixes: ["!blockedtermlist", "!банвордлист"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		res.twitch = `📜 https://dashboard.twitch.tv/u/${req.message.payload.event.broadcaster_user_login}/settings/moderation/blocked-terms`;
	}
};