//#region imports
import Init, { command as InitCommand } from "./init";
import Authorize, { command as AuthorizeCommand } from "./authorize";
import Add, { command as AddCommand } from "./add";
import Remove, { command as RemoveCommand } from "./remove";
import List, { command as ListCommand } from "./list";
//#endregion

const commands: [Command, ()=>Promise<void>][] = [
	[InitCommand, Init],
	[AuthorizeCommand, Authorize],
	[AddCommand, Add],
	[RemoveCommand, Remove],
	[ListCommand, List]
];
export interface Command {
	name: string;
	arguments?: string;
	description: string;
}
export function commandToString(command: Command, with_description: boolean = false): string {
	return `node index.js ${command.name}${command.arguments ? ` ${command.arguments}` : ""}${with_description ? `    ${command.description}` : ""}`;
}
function getAllCommands(): string {
	const commands_array: [string, string][] = [];
	[InitCommand, AuthorizeCommand, AddCommand, RemoveCommand, ListCommand].forEach(c => commands_array.push([commandToString(c), c.description]));
	var max_length = 0;
	commands_array.forEach(c => max_length = Math.max(max_length, c[0].length));
	commands_array.forEach(c => {while (c[0].length < max_length) c[0] += " "});

	return "Commands:\n" + commands_array.map(c => ` - ${c[0]}        ${c[1]}`).join("\n");
}

var initialized = false;
export default async() => {
	if (initialized) return;
	initialized = true;

	const cmd = process.argv[2];
	if (cmd) {
		var used = false;
		for (const [command, func] of commands) if (cmd === command.name) {
			await func();
			used = true;
		}
		if (cmd === "help") console.log(getAllCommands());
		if (!used) {
			console.error(`Unknown command!\n\n${getAllCommands()}`);
			process.exit(1);
		}
		process.exit(0);
	}
}