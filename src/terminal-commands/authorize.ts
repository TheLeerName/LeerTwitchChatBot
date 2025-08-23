//#region imports
import { data } from "../data";
import TwitchAuthorizationInit, { authorization_bot, redirect_uri, port, scopes_bot } from "../twitch-authorization";
import { Command, commandToString } from ".";
import { command as InitCommand } from "./init";
import { Request, Authorization } from "twitch.ts";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
//#endregion

export const command: Command = {
	name: "authorize",
	description: "authorize user as bot for sending messages and reading chat, requires access token of that user"
};

var server: Server | undefined;
export default async() => {
	//#region data validation
	if (data.authorization.client_id.length < 1 || data.authorization.client_secret.length < 1) {
		console.error(`App isn't initialized, fix this by running command: ${commandToString(InitCommand)}`);
		process.exit(1);
	}
	//#endregion
	//#region http server initialization and callbacks
	const time = Date.now();
	server = createServer(async(req, res) => {
		res.setHeader("Content-Type", "text/plain;charset=utf-8");
		console.log(`${req.method ?? "IDK"} ${req.url ?? "/"}`);
		if (req.method === "GET") await onGET(req, res);
		else {
			res.statusCode = 405;
			res.write(`${req.method} is not supported`);
			res.end();
		}
	});
	server.on("close", () => {
		console.log(`HTTP server was closed`);
	});
	server.listen(port, () => {
		console.log(`HTTP server started (${Date.now() - time}ms)\n`);
		console.log(`App will send messages and reading chat as authorized user by link below (you will need to click to it and authorize):\n${Authorization.URL.Code(data.authorization.client_id, redirect_uri, scopes_bot)}\n`);
		// now waiting for user to authorize
	});
	//#endregion
	await new Promise(resolve=>{});
}

async function onGET(req: IncomingMessage, res: ServerResponse<IncomingMessage> & { req: IncomingMessage }) {
	// user authorized, making some things
	//#region calling onGottenCode if we got field code in URL search parameters
	var url = req.url ?? "/";
	if (url.startsWith("/?")) {
		url = url.substring(2);
		for (const v of url.split("&")) if (v.startsWith("code=")) {
			await onGottenCode(req, res, v.substring(5));
			return;
		}
	}
	//#endregion
	//#region returning 400 if we dont have field code
	res.statusCode = 400;
	res.write("URL search parameters do not have the field code");
	res.end();
	//#endregion
}

async function onGottenCode(req: IncomingMessage, res: ServerResponse<IncomingMessage> & { req: IncomingMessage }, code: string) {
	//#region returning 202 and closing http server cuz we dont need it anymore
	res.statusCode = 202;
	res.write("You can close this window now");
	res.end();
	server!.close();
	//#endregion
	//#region getting tokens from authorization code
	console.log(`Authorization code: ${code}`);
	const response = await Request.OAuth2Token.AuthorizationCode(data.authorization.client_id, data.authorization.client_secret, redirect_uri, code);
	if (response.ok) {
		data.bot.access_token = response.access_token;
		data.bot.refresh_token = response.refresh_token;
		const validate = await Request.OAuth2Validate(data.bot.access_token);
		if (!validate.ok || validate.type === "app") throw new Error("Impossible error");
		data.bot.login = validate.user_login;
		data.save();
		console.log(`\nUser ${validate.user_login} will be used as bot for sending/reading chat messages! Restart the app to see changes\n`);
		process.exit(0);
	}
	else {
		console.error(`Getting token from authorization code failed!\n\tcode: ${response.status} - ${response.message}`);
		process.exit(1);
	}
	//#endregion
}