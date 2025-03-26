import { config, saveConfig } from './index';
import { Request } from './types';

export async function main() {
	try {
		if (process.argv[3]) {
			const response = await Request.GetUsers(config.client_id, config.access_token, process.argv[3] === `${parseInt(process.argv[3])}` ? {id: process.argv[3]} : {login: process.argv[3].toLowerCase()});
			if (response.status !== 200) throw response.message;

			if (response.data.length === 0) throw `Channel ${process.argv[3]} was not found!`;

			const {id, login, display_name} = response.data[0];
			config.channels[id] = {login, display_name};
			saveConfig();
			console.log(`Channel ${display_name} was added to bot! Restart the bot to see changes`);
		} else throw "You forgot an argument!";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}