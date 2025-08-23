//#region imports
import { Request, Response } from ".";
//#endregion

export default {
	prefixes: ["!sex"],
	func: async(req: Request, res: Response) => {
		if (req.message.payload.event.message_type !== "text") return;
		res.twitch = `❌ Возраст не подтверждён! Посмотрите туториал по подтверждению возраста: https://www.youtube.com/watch?v=j-iheFkstFQ`;
	}
};