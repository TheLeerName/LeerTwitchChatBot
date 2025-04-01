//#region imports
import { data } from './index';
//#endregion

export async function main() {
	console.log(`id,login`);
	for (let [id, {login}] of Object.entries(data.channels))
		console.log(`${id},${login}`);
}