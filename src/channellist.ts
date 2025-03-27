import { data } from './index';

export async function main() {
	console.log(`id,login,display_name`);
	for (let [id, {login, display_name}] of Object.entries(data.channels))
		console.log(`${id},${login},${display_name}`);
}