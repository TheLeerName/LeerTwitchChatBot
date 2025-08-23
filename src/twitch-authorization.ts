//#region imports
import { data, ChannelData } from "./data";
import { command as InitCommand } from "./terminal-commands/init";
import { command as SetCommand } from "./terminal-commands/authorize";
import { command as AddCommand } from "./terminal-commands/add";
import { commandToString } from "./terminal-commands";
import { Request, Authorization, ResponseBody, ResponseBodyError } from "twitch.ts";
//#endregion

export const scopes_bot = [
	"user:write:chat"
] as const satisfies Authorization.Scope[];
export const scopes = [
	"user:read:chat",
	"moderator:manage:blocked_terms",
	"moderator:manage:banned_users",
	"channel:manage:broadcast",
	"moderator:read:followers",
	"moderator:read:chatters",
] as const satisfies Authorization.Scope[];

export const authorization_bot: Authorization.User<typeof scopes_bot> = { type: "user", token: "", client_id: "", scopes: scopes_bot, expires_in: 0, user_login: "", user_id: "" };
export const authorization: Record<string, Authorization.User<typeof scopes>> = {};
export const port = 44026;
export const redirect_uri = `http://localhost:${port}`;

export async function refreshTokenOfBot() {
	const refresh = await Request.OAuth2Token.RefreshToken(data.authorization.client_id, data.authorization.client_secret, data.bot.refresh_token);
	if (refresh.ok) {
		data.bot.access_token = authorization_bot.token = refresh.access_token;
		data.bot.refresh_token = refresh.refresh_token;
		data.save();
	}
	else
		console.error(`Refreshing token of bot failed!\n\tcode: ${refresh.status} - ${refresh.message}`);
}
export async function refreshTokenOfChannel(channel_id: string) {
	const channel = data.channels[channel_id];
	const refresh = await Request.OAuth2Token.RefreshToken(data.authorization.client_id, data.authorization.client_secret, channel.user.refresh_token);
	if (refresh.ok) {
		const a = authorization[channel_id];
		channel.user.access_token = a.token = refresh.access_token;
		channel.user.refresh_token = refresh.refresh_token;
	}
	else
		console.error(`Refreshing token of bot failed!\n\tcode: ${refresh.status} - ${refresh.message}`);
}
export async function runRequestWithTokenRefreshing<R extends ResponseBody<true, number>, A extends any[]>(refresh: ()=>Promise<void>, request: (...args: A)=>Promise<R | ResponseBodyError>, ...args: A): Promise<R | ResponseBodyError> {
	return await new Promise(resolve => {
		async function fun() {
			const r = await request(...args);

			if (r.status === 401) await refresh();
			else if (r.status === 408) setTimeout(fun, 1000);
			else return resolve(r);
		}
		fun();
	});
}

var initialized = false;
export default async() => {
	if (initialized) return;
	initialized = true;

	//#region data validation
	if (data.authorization.client_id.length < 1 || data.authorization.client_secret.length < 1) {
		console.error(`App isn't initialized, fix this by running command: ${commandToString(InitCommand)}`);
		process.exit(1);
	}
	if (data.bot.access_token.length < 1 || data.bot.refresh_token.length < 1) {
		console.error(`Bot credentials isn't initialized, fix this by running command: ${commandToString(SetCommand)}`);
		process.exit(1);
	}
	//#endregion
	//#region bot token validation
	const validate = await runRequestWithTokenRefreshing<ResponseBody.OAuth2Validate<Authorization.Scope[]>, [string]>(async() => await refreshTokenOfBot(), Request.OAuth2Validate, data.bot.access_token);
	if (!validate.ok) {
		console.error(`Bot token validating failed, try to fix this by running command: ${commandToString(InitCommand)}\n\tcode: ${validate.status} - ${validate.message}`);
		process.exit(1);
	}
	if (Authorization.hasScopes(validate, ...scopes_bot)) {
		authorization_bot.client_id = validate.client_id;
		authorization_bot.expires_in = validate.expires_in;
		authorization_bot.scopes = validate.scopes;
		authorization_bot.token = validate.token;
		if (validate.type === "user") {
			authorization_bot.user_id = validate.user_id;
			data.bot.login = authorization_bot.user_login = validate.user_login;
			data.save();
		}
	}
	else {
		console.error(`Bot token has wrong scopes, fix this by running command: ${commandToString(InitCommand)}`);
		process.exit(1);
	}
	//#endregion
	//#region channel tokens validation
	for (const [id, channel] of Object.entries(data.channels)) {
		if (!channel.enabled) continue;
		const a = authorization[id] = {
			type: "user",
			token: channel.user.access_token,
			client_id: data.authorization.client_id,
			scopes,
			expires_in: 0,
			user_login: channel.user.login,
			user_id: ""
		};
		const validate = await runRequestWithTokenRefreshing<ResponseBody.OAuth2Validate<Authorization.Scope[]>, [string]>(async() => await refreshTokenOfChannel(id), Request.OAuth2Validate, channel.user.access_token);
		if (!validate.ok) {
			console.error(`Token of channel ${channel.user.login} failed, try to fix this by running command: ${commandToString(AddCommand)}\n\tcode: ${validate.status} - ${validate.message}`);
			process.exit(1);
		}
		if (Authorization.hasScopes(validate, ...scopes)) {
			a.expires_in = validate.expires_in;
			a.token = validate.token;
			if (validate.type === "user") {
				a.user_id = validate.user_id;
				channel.user.login = a.user_login = validate.user_login;
				data.save();
			}
		}
		else {
			console.error(`Token of channel ${channel.user.login} has wrong scopes, fix this by running command: ${commandToString(AddCommand)}`);
			process.exit(1);
		}
	}
	//#endregion
}