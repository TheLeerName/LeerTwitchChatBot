//#region imports
import { humanizer } from "humanize-duration";
import { EventSub } from "twitch.ts";
//#endregion

export const HumanizeDuration = humanizer({ largest: 3, round: true, delimiter: " ", language: "ru" });
/** The maximum is exclusive and the minimum is inclusive */
export function getRandomInt(min: number, max: number) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
/** @returns Chatter is moderator/broadcaster */
export function isModerator(payload: EventSub.Payload.ChannelChatMessage): boolean {
	for (let badge of payload.event.badges) if (badge.set_id === "moderator" || badge.set_id === "broadcaster") return true;
	return false;
}