//#region imports
import { existsSync, readFileSync, writeFileSync } from "fs";
import { Request } from "twitch.ts";
//#endregion

export type Data = Data.V2;
export namespace Data {
	export function isV1(data: any): data is V1 { return data.version === undefined && data.bot && data.channels }
	export function V1(bot = TokenData.V1(), channels: Record<string, ChannelData.V1> = {}) { return { version: undefined, bot, channels } }
	export type V1 = ReturnType<typeof V1>;
	export function isV2(data: any): data is V2 { return data.version === 2 && data.bot && data.channels }
	export function V2(authorization = AuthorizationData.V2(), bot = TokenData.V2(), channels: Record<string, ChannelData.V2> = {}): { version: 2, authorization: AuthorizationData.V2, bot: TokenData.V2, channels: Record<string, ChannelData.V2> } { return { version: 2, authorization, bot, channels } }
	export type V2 = ReturnType<typeof V2>;
}
export type AuthorizationData = AuthorizationData.V2;
export namespace AuthorizationData {
	export function V2(client_id: string = "", client_secret: string = "") { return { client_id, client_secret } }
	export type V2 = ReturnType<typeof V2>;
}
export type ChannelData = ChannelData.V2;
export namespace ChannelData {
	export function V1(user = TokenData.V1(), subscriptions_id: string[] = [], chatters_watchtime: Record<string, number> = {}) { return { user, subscriptions_id, chatters_watchtime } }
	export type V1 = ReturnType<typeof V1>;

	export function V2(user = TokenData.V2(), subscriptions_id: string[] = [], chatters_watchtime: Record<string, number> = {}) { return { enabled: true, user, subscriptions_id, chatters_watchtime } }
	export type V2 = ReturnType<typeof V2>;
}
export type TokenData = TokenData.V2;
export namespace TokenData {
	export function V1(token: string = "", login: string = "") { return { token, login } }
	export type V1 = ReturnType<typeof V1>;

	export function V2(access_token: string = "", refresh_token: string = "", login: string = "") { return { access_token, refresh_token, login } }
	export type V2 = ReturnType<typeof V2>;
}
export class DataClass implements Data {
	readonly file = "data.json";
	readonly version = 2 as const;
	readonly authorization = AuthorizationData.V2();
	readonly bot = TokenData.V2();
	readonly channels: Record<string, ChannelData> = {};

	private initialized = false;
	async init() {
		if (this.initialized) return;
		this.initialized = true;

		try {
			if (existsSync(this.file)) {
				const json: unknown = JSON.parse(readFileSync(this.file).toString());
				if (Data.isV1(json)) {
					const validate = await Request.OAuth2Validate(json.bot.token);
					if (validate.ok) {
						const response = await Request.OAuth2Revoke(validate);
						if (response.ok) console.log(`Revoking access token success\n\treason: data version upgrading 1 => 2\n`);
						else console.error(`Revoking access token failed\n\treason: data version upgrading 1 => 2\n\ttoken: ${validate.token}\n\tchannel: ${json.bot.login}\n`);
					}

					for (const [channel_id, channel] of Object.entries(json.channels)) {
						const validate = await Request.OAuth2Validate(channel.user.token);
						if (validate.ok) {
							const response = await Request.OAuth2Revoke(validate);
							if (response.ok) console.log(`Revoking access token success\n\treason: data version upgrading 1 => 2\n\tchannel: ${channel.user.login}\n`);
							else console.error(`Revoking access token from data version 1 failed\n\treason: data version upgrading 1 => 2\n\ttoken: ${validate.token}\n\tchannel: ${channel.user.login}\n`);
						}

						data.channels[channel_id] = ChannelData.V2(TokenData.V2(undefined, undefined, channel.user.login), [], channel.chatters_watchtime);
					}
					(json.version as any) = 2;
					this.save();
					console.log(`Data version upgrade 1 => 2 success\n`);
				}
				if (Data.isV2(json)) {
					this.bot.access_token = json.bot.access_token;
					this.bot.refresh_token = json.bot.refresh_token;
					this.bot.login = json.bot.login;
					this.authorization.client_id = json.authorization.client_id;
					this.authorization.client_secret = json.authorization.client_secret;
					for (const [k, v] of Object.entries(json.channels)) this.channels[k] = v;
				}

				if (Object.keys(this.channels).length === 0) {
					console.error("No channels are added, closing the app...");
					process.exit(1);
				}
			}
		}
		catch(e) {
			console.error(`Parsing data.json failed!\n\t${e instanceof Error ? e.message : e}`);
			process.exit(1);
		}
	}

	save() {
		writeFileSync(this.file, JSON.stringify({ version: this.version, authorization: this.authorization, bot: this.bot, channels: this.channels }));
	}
}

export const data: DataClass = new DataClass();
export default async() => {
	await data.init();
};