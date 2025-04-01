//#region imports
import { client_id, data, getAccessToken, saveData, scopes } from './index';
import readline from 'readline';
import { Request } from './types';
//#endregion

export async function main() {
	try {
		if (process.argv[3]) {
			const response = await Request.GetUsers(client_id, data.bot_access_token, process.argv[3] === `${parseInt(process.argv[3])}` ? {id: process.argv[3]} : {login: process.argv[3].toLowerCase()});
			if (response.status !== 200) throw response.message;

			if (response.data.length > 0) {
				const {id} = response.data[0];
				const rl = readline.createInterface({input: process.stdin, output: process.stdout});
				const response2 = await getAccessToken(rl, scopes, id);
				data.channels[id] = {
					login: response2.login,
					access_token: response2.access_token,
					subscriptions_id: []
				};
				saveData();
				console.log(`Channel was added to bot! Restart the bot to see changes`);
			}
			else throw `Channel was not found!`;
		} else throw "You forgot an argument!";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}