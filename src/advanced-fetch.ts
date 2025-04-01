//#region imports
import * as undici from 'undici';
//#endregion

export type HeadersInit = undici.HeadersInit;
export type RequestInitUndici = undici.RequestInit;
export interface RequestInit extends RequestInitUndici {
	search?: Record<string, string | undefined> | any;
}
export function fetch(input: string, init?: RequestInit): Promise<undici.Response> {
	let defaultInit: undici.RequestInit = {};
	if (init) {
		if (init.search) {
			input += "?";
			for (let [k, v] of Object.entries<string>(init.search)) if (v?.length > 0)
				input += encodeURI(`${k}=${v ?? ""}&`);
			delete init.search;
		}
		defaultInit = init;
	}
	//console.log(input, defaultInit);
	return undici.fetch(input, defaultInit);
}

export function setGlobalDispatcher(dispatcher: undici.Dispatcher) {
	undici.setGlobalDispatcher(dispatcher);
}
export function setGlobalTimeout(timeout: number) {
	setGlobalDispatcher(new undici.Agent({connect: {timeout}}));
}