//#region imports
import { data } from './index';
//#endregion

export async function main() {
	console.log(`id,login`);
	for (let [id, { user: { login } }] of Object.entries(data.channels))
		console.log(`${id},${login}`);
}