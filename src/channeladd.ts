//#region imports
import { client_id, data, getAccessToken, saveData, scopes, bot_authorization } from './index';
import readline from 'readline';
import { Request, Authorization } from 'twitch.ts';
//#endregion

export async function main() {
	try {
		if (process.argv[3]) {
			console.log(`Adding channel ${process.argv[3]}...`);
			const response = await Request.GetUsers(bot_authorization, process.argv[3] === `${parseInt(process.argv[3])}` ? {id: process.argv[3]} : {login: process.argv[3].toLowerCase()});
			if (response.status !== 200) throw response.message;
			else console.log(`\tresponse_getusers: ${JSON.stringify(response)}`);

			if (response.data.length > 0) {
				const {id, login} = response.data[0];
				console.log(`\tchannel_id: ${id}\n\nSend the link below to ${login}`);
				const rl = readline.createInterface({input: process.stdin, output: process.stdout});

				const token = await getAccessToken(rl, scopes);
				rl.close();

				const response1 = await Request.OAuth2Validate(token);
				console.log(`\tvalidate: ${JSON.stringify(response)}`);
				if (!response1.ok) throw "Request.OAuth2Validate failed!";

				const authorization = Authorization.fromResponseBodyOAuth2Validate(response1);
				if (authorization.type !== "user") throw "bro how the fuck r u created app access token with implicit grant flow???";
	
				if (authorization.user_id !== login) {
					const response = await Request.OAuth2Revoke(authorization);
					console.log(`\trevoke: ${JSON.stringify(response)}`);
					throw `Access token belongs to other channel!`;
				}
				if (authorization.client_id !== client_id) {
					const response = await Request.OAuth2Revoke(authorization);
					console.log(`\trevoke: ${JSON.stringify(response)}`);
					throw `Access token belongs to other client_id!`;
				}

				if (!Authorization.hasScopes(authorization, ...scopes)) {
					const response = await Request.OAuth2Revoke(authorization);
					console.log(`\tresponse: ${JSON.stringify(response)}\n`);
					throw `Access token has wrong scopes!`;
				}

				data.channels[id] = {
					user: { token, login: authorization.user_login },
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