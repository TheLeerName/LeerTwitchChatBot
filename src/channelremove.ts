//#region imports
import { client_id, data, saveData, DataChannelsEntry } from './index';
import { Request } from 'twitch.ts';
//#endregion

export async function main() {
	try {
		if (process.argv[3]) {
			var channel_id: string;
			var entry: DataChannelsEntry;

			if (process.argv[3] === `${parseInt(process.argv[3])}`) {
				channel_id = process.argv[3];
				entry = data.channels[process.argv[3]];
				if (entry == null) throw `Channel was not found!`;
			} else {
				const argLower = process.argv[3].toLowerCase();
				for (let [id, e] of Object.entries(data.channels)) if (e.user.login === argLower) {
					channel_id = id;
					entry = e;
				}
				throw `Channel was not found!`;
			}

			await Request.OAuth2Revoke({ type: "app", client_id, token: entry.user.token, scopes: [], expires_in: 0 });
			delete data.channels[channel_id];
			saveData();
			console.log(`Channel was removed from bot! Restart the bot to see changes`);
		} else throw "You forgot an argument!";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}