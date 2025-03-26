import { config } from './index';

export async function main() {
	try {
		if (process.argv[3]) {
			if (process.argv[3] === `${parseInt(process.argv[3])}`)
				delete config.channels[process.argv[3]];
			else {
				const argLower = process.argv[3].toLowerCase();
				for (let entry of Object.values(config.channels)) if (entry.login === argLower)
					return console.log(`Channel ${entry.display_name} was removed from bot! Restart the bot to see changes`);

				throw `Channel ${process.argv[3]} was not found!`;
			}
		} else throw "You forgot an argument!";
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}