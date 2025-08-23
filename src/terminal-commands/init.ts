//#region imports
import { data } from "../data";
import { Command, commandToString } from ".";
import { command as SetCommand } from "./authorize";
import { redirect_uri } from "../twitch-authorization";
//#endregion

export const command: Command = {
	name: "init",
	arguments: "<client_id> <client_secret>",
	description: `initializes data for bot, needs some parameters from twitch dev console, redirect_uri must be ${redirect_uri}`
};

export default async() => {
	if (process.argv.length < 4) {
		console.error(`Wrong arguments!\n\n${commandToString(command)}`);
		process.exit(1);
	}

	data.authorization.client_id = process.argv[3];
	data.authorization.client_secret = process.argv[4];
	data.save();
	console.log(`Bot is initialized now, set bot credentials via command: node index.js ${SetCommand.name}${SetCommand.arguments ? ` ${SetCommand.arguments}` : ""}`);
}