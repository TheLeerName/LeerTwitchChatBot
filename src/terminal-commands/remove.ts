//#region imports
import { data } from "../data";
import { Command, commandToString } from ".";
//#endregion

export const command: Command = {
	name: "remove",
	arguments: "<user_login>",
	description: "removes twitch channel from app, actually disables it cuz we need to save chatters watchtime"
};

export default async() => {
	if (process.argv.length < 3) {
		console.error(`Wrong arguments!\n\n${commandToString(command)}`);
		process.exit(1);
	}

	for (const channel of Object.values(data.channels)) if (channel.user.login === process.argv[3]) {
		channel.user.access_token = "";
		channel.user.refresh_token = "";
		channel.subscriptions_id = [];
		channel.enabled = false; // we are not removing them cuz we need to save chatters_watchtime
		data.save();
		console.log(`Channel ${channel.user.login} is disabled for bot! Restart the bot to see changes\n`);
		break;
	}
}