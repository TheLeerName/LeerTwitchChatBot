//#region imports
import { Request, Response } from ".";
import { authorization } from "../twitch-authorization";
import { isModerator } from "../utils";
import * as Twitch from "twitch.ts";
//#endregion

export default {
	prefixes: ["!blockedtermremove", "!банвордудалить"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;

		if (!isModerator(req.message.payload))
			return res.twitch = `❌ Нет полномочий.`;

		const term = req.args.join(" ");
		if (term.length < 1)
			return res.twitch = `❌ Банворд должен быть длиннее 1 символа!`;

		const a = authorization[req.message.payload.event.broadcaster_user_id];
		const getblockedterms = await getBlockedTerms(a, a.user_id);
		res.log += `\tgetblockedterms: ${JSON.stringify(getblockedterms)}\n`;
		if (!getblockedterms.ok)
			return res.twitch = `❌ Ошибка! (${getblockedterms.ok} - ${getblockedterms.message})`;

		const id = getblockedterms.data.find(e => e.text === term)?.id;
		if (!id)
			return res.twitch = `❌ Банворд не найден!`;

		const removeblockedterm = await Twitch.Request.RemoveBlockedTerm(a, a.user_id, id);
		res.log += `\tremoveblockedterm: ${JSON.stringify(removeblockedterm)}\n`;
		res.twitch = removeblockedterm.ok ? `✅ Успешно!` : `❌ Ошибка! (${removeblockedterm.status} - ${removeblockedterm.message})`;
	}
};

async function getBlockedTerms<S extends Twitch.Authorization.Scope[]>(...args: Parameters<typeof Twitch.Request.GetBlockedTerms<S>>) {
	const res_data: Twitch.ResponseBody.GetBlockedTerms["data"] = [];
	var cursor: string | undefined;
	async function func() {
		const response = await Twitch.Request.GetBlockedTerms(args[0], args[1], undefined, cursor);
		if (response.ok) {
			res_data.push(...response.data);
			cursor = response.pagination?.cursor;
			if (cursor) return await func();
			return response;
		}
		else
			return response;
	}
	const r = await func();
	if (r.ok) {
		r.data = res_data;
		return r;
	}
	else
		return r;
}