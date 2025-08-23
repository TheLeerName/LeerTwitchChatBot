//#region imports
import { data } from "../data";
import { Command } from ".";
//#endregion

export const command: Command = {
	name: "list",
	description: "shows added twitch channels to app in CSV format"
};

export default async() => {
	console.log(`id,login,is_enabled`);
	console.log(Object.entries(data.channels).map(([id, channel]) => `${id},${channel.user.login},${channel.enabled}`).join("\n"));
}