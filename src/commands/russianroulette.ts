//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { HumanizeDuration, getRandomInt } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!russianroulette", "!русскаярулетка"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (getRandomInt(0, 6) === 0) {
			const mute = getRandomInt(30, 300);
			res.twitch = `🐴🔫 Вы стреляете в себя... И получаете мут на ${HumanizeDuration(mute * 1000)}!`;

			setTimeout(async() => {
				const a = authorization[req.message.payload.event.broadcaster_user_id];
				const response = await Twitch.Request.BanUser(a, a.user_id, req.message.payload.event.chatter_user_id, mute, "Попадание русской рулеткой");
				if (!response.ok) console.log(`Timeoutting user failed!\n\tcode: ${response.status} - ${response.message}`);
			}, 500);
		} else
			res.twitch = `🐴🔫 Вы стреляете в себя... И не попадаете!`;
	}
};