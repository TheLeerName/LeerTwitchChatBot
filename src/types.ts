import { fetch, RequestInit, RequestInitUndici } from './advanced-fetch';

export namespace EventSub {
	export interface Transport {
		/** The transport method. */
		method: "websocket";
		/** An ID that identifies the WebSocket to send notifications to. When you connect to EventSub using WebSockets, the server returns the ID in the [Welcome message](https://dev.twitch.tv/docs/eventsub/handling-websocket-events#welcome-message). */
		session_id: string;
	}
	export function Transport(session_id: string): Transport {return {method: "websocket", session_id}}
	export namespace Transport {
		export interface CreateEventSubSubscription extends Transport {
			/** The UTC date and time that the WebSocket connection was established. This is a response-only field that [Create EventSub Subscription](https://dev.twitch.tv/docs/api/reference#create-eventsub-subscription) and [Get EventSub Subscription](https://dev.twitch.tv/docs/api/reference#get-eventsub-subscriptions) returns. */
			connected_at: string;
		}
		export interface GetEventSubSubscription extends CreateEventSubSubscription {
			/** The UTC date and time that the WebSocket connection was lost. This is a response-only field that [Get EventSub Subscription](https://dev.twitch.tv/docs/api/reference#get-eventsub-subscriptions) returns. */
			disconnected_at: string;
		}
	}

	export interface Session<
		Status extends string = "connected",
		KeepaliveTimeoutSeconds extends number | null = number,
		ReconnectURL extends string | null = null
	> {
		/** An ID that uniquely identifies this WebSocket connection. Use this ID to set the `session_id` field in all [subscription requests](https://dev.twitch.tv/docs/eventsub/manage-subscriptions#subscribing-to-events). */
		id: string;
		/** The connection’s status. */
		status: Status;
		/** The maximum number of seconds that you should expect silence before receiving a [keepalive message](https://dev.twitch.tv/docs/eventsub/websocket-reference/#keepalive-message). For a welcome message, this is the number of seconds that you have to [subscribe to an event](https://dev.twitch.tv/docs/eventsub/manage-subscriptions#subscribing-to-events) after receiving the welcome message. If you don’t subscribe to an event within this window, the socket is disconnected. */
		keepalive_timeout_seconds: KeepaliveTimeoutSeconds;
		/** The URL to reconnect to if you get a [Reconnect message](https://dev.twitch.tv/docs/eventsub/websocket-reference/#reconnect-message). */
		reconnect_url: ReconnectURL;
		/** Not officially documented by Twitch */
		recovery_url: null;
		/** The UTC date and time that the connection was created. */
		connected_at: string;
	}

	export namespace Subscription {
		export type Version = "1" | "2";

		export type Condition = {};
		export namespace Condition {
			export interface BroadcasterAndUserID extends Condition {
				/** The User ID of the channel to receive chat message events for. */
				broadcaster_user_id: string;
				/** The User ID to read chat as. */
				user_id: string;
			}
		}

		export type Event = {};
		export namespace Event {
			export interface MessageFragment<Type extends string = string> {
				/** The type of message fragment. */
				type: string;
				/** Message text in fragment. */
				text: string;
			}
			export namespace MessageFragment {
				export type Text = MessageFragment<"text">;
				export interface Cheermote extends MessageFragment<"cheermote"> {
					/** Metadata pertaining to the cheermote. */
					cheermote: {
						/**
						 * The name portion of the Cheermote string that you use in chat to cheer Bits.
						 * The full Cheermote string is the concatenation of {prefix} + {number of Bits}.
						 * For example, if the prefix is "Cheer" and you want to cheer 100 Bits,
						 * the full Cheermote string is Cheer100.
						 */
						prefix: string;
						/** The amount of Bits cheered. */
						bits: number;
						/** The tier level of the cheermote. */
						tier: number;
					};
				}
				export interface Emote extends MessageFragment<"emote"> {
					/** Metadata pertaining to the emote. */
					emote: {
						/** An ID that uniquely identifies this emote. */
						id: string;
						/** An ID that identifies the emote set that the emote belongs to. */
						emote_set_id: string;
						/** The ID of the broadcaster who owns the emote. */
						owner_id: string;
						/**
						 * The formats that the emote is available in. Possible values:
						 * - `animated` - An animated GIF is available for this emote
						 * - `static` - A static PNG file is available for this emote
						 */
						format: Array<"animated" | "static">;
					};
				}
				export interface Mention extends MessageFragment<"mention"> {
					/** Metadata pertaining to the mention. */
					mention: {
						/** The user ID of the mentioned user. */
						user_id: string;
						/** The user name of the mentioned user. */
						user_name: string;
						/** The user login of the mentioned user. */
						user_login: string;
					};
				}
			}

			export interface ChannelChatMessage {
				/** The broadcaster user ID. */
				broadcaster_user_id: string;
				/** The broadcaster display name. */
				broadcaster_user_name: string;
				/** The broadcaster login. */
				broadcaster_user_login: string;
				/** The user ID of the user that sent the message. */
				chatter_user_id: string;
				/** The user name of the user that sent the message. */
				chatter_user_name: string;
				/** The user login of the user that sent the message. */
				chatter_user_login: string;
				/** A UUID that identifies the message. */
				message_id: string;
				/** The structured chat message. */
				message: {
					/** The chat message in plain text. */
					text: string;
					/** Ordered list of chat message fragments. */
					fragments: Array<MessageFragment.Text | MessageFragment.Cheermote | MessageFragment.Emote | MessageFragment.Mention>;
				};
				/**
				 * The type of message. Possible values:
				 * - `text`
				 * - `channel_points_highlighted`
				 * - `channel_points_sub_only`
				 * - `user_intro`
				 * - `power_ups_message_effect`
				 * - `power_ups_gigantified_emote`
				 */
				message_type: "text" | "channel_points_highlighted" | "channel_points_sub_only" | "user_intro" | "power_ups_message_effect" | "power_ups_gigantified_emote";
				/** List of chat badges. */
				badges: Array<{
					/** An ID that identifies this set of chat badges. For example, Bits or Subscriber. */
					set_id: string;
					/** An ID that identifies this version of the badge. */
					id: string;
					/** Contains metadata related to the chat badges. Currently only for subscriber months. */
					info: string;
				}>;
				/** 
				 * **Optional**. Metadata if this message is a cheer.
				 */
				cheer?: {
					/** The amount of Bits the user cheered. */
					bits: number;
				};
				/** 
				 * The color of the user's name in the chat room. 
				 * This is a hexadecimal RGB color code in the form `#<RGB>`. 
				 * May be empty if never set.
				 */
				color: string;
				/** 
				 * **Optional**. Metadata if this message is a reply.
				 */
				reply?: {
					/** An ID that uniquely identifies the parent message that this message is replying to. */
					parent_message_id: string;
					/** The message body of the parent message. */
					parent_message_body: string;
					/** User ID of the sender of the parent message. */
					parent_user_id: string;
					/** User name of the sender of the parent message. */
					parent_user_name: string;
					/** User login of the sender of the parent message. */
					parent_user_login: string;
					/** An ID that identifies the parent message of the reply thread. */
					thread_message_id: string;
					/** User ID of the sender of the thread's parent message. */
					thread_user_id: string;
					/** User name of the sender of the thread's parent message. */
					thread_user_name: string;
					/** User login of the sender of the thread's parent message. */
					thread_user_login: string;
				};
				/** 
				 * **Optional**. The ID of a channel points custom reward that was redeemed.
				 */
				channel_points_custom_reward_id?: string;
				/** 
				 * **Optional**. The broadcaster user ID of the channel the message was sent from.
				 * Null when in the same channel as the broadcaster.
				 */
				source_broadcaster_user_id?: string | null;
				/** 
				 * **Optional**. The user name of the broadcaster of the channel the message was sent from.
				 * Null when in the same channel as the broadcaster.
				 */
				source_broadcaster_user_name?: string | null;
				/** 
				 * **Optional**. The login of the broadcaster of the channel the message was sent from.
				 * Null when in the same channel as the broadcaster.
				 */
				source_broadcaster_user_login?: string | null;
				/** 
				 * **Optional**. The UUID that identifies the source message from the channel the message was sent from.
				 * Null when in the same channel as the broadcaster.
				 */
				source_message_id?: string | null;
				/** 
				 * **Optional**. The list of chat badges for the chatter in the channel the message was sent from.
				 * Null when in the same channel as the broadcaster.
				 */
				source_badges?: Array<{
					/** The ID that identifies this set of chat badges. */
					set_id: string;
					/** The ID that identifies this version of the badge. */
					id: string;
					/** Contains metadata related to the chat badges. */
					info: string;
				}> | null;
			}
		}
	}

	export namespace Message {
		export type Any = SessionWelcome | SessionKeepalive | Notification | SessionReconnect | Revocation;
		export function isSessionWelcome(data: Any): data is SessionWelcome { return data.metadata.message_type === "session_welcome" }
		export function isSessionKeepalive(data: Any): data is SessionKeepalive { return data.metadata.message_type === "session_keepalive" }
		export function isNotification(data: Any): data is Notification { return data.metadata.message_type === "notification" }
		export function isSessionReconnect(data: Any): data is SessionReconnect { return data.metadata.message_type === "session_reconnect" }
		export function isRevocation(data: Any): data is Revocation { return data.metadata.message_type === "revocation" }

		/** Defines the first message that the EventSub WebSocket server sends after your client connects to the server. [Read More](https://dev.twitch.tv/docs/eventsub/handling-websocket-events#welcome-message) */
		export interface SessionWelcome {
			/** An object that identifies the message. */
			metadata: {
				/** An ID that uniquely identifies the message. Twitch sends messages at least once, but if Twitch is unsure of whether you received a notification, it’ll resend the message. This means you may receive a notification twice. If Twitch resends the message, the message ID will be the same. */
				message_id: string;
				/** The type of message, which is set to **session_welcome**. */
				message_type: "session_welcome";
				/** The UTC date and time that the message was sent. */
				message_timestamp: string;
			};
			/** An object that contains the message. */
			payload: {
				/** An object that contains information about the connection. */
				session: Session;
			};
		}
		/** Defines the message that the EventSub WebSocket server sends your client to indicate that the WebSocket connection is healthy. [Read More](https://dev.twitch.tv/docs/eventsub/handling-websocket-events#keepalive-message) */
		export interface SessionKeepalive {
			/** An object that identifies the message. */
			metadata: {
				/** An ID that uniquely identifies the message. Twitch sends messages at least once, but if Twitch is unsure of whether you received a notification, it’ll resend the message. This means you may receive a notification twice. If Twitch resends the message, the message ID is the same. */
				message_id: string;
				/** The type of message, which is set to **session_keepalive**. */
				message_type: "session_keepalive";
				/** The UTC date and time that the message was sent. */
				message_timestamp: string;
			};
			/** An empty object. */
			payload: {};
		}

		export interface Notification<
			Type extends string = string,
			Version extends Subscription.Version = Subscription.Version,
			Condition extends Subscription.Condition = Subscription.Condition,
			Transport extends EventSub.Transport = EventSub.Transport,
			Event extends Subscription.Event = Subscription.Event
		> {
			/** An object that identifies the message. */
			metadata: {
				/** An ID that uniquely identifies the message. Twitch sends messages at least once, but if Twitch is unsure of whether you received a notification, it'll resend the message. This means you may receive a notification twice. If Twitch resends the message, the message ID will be the same. */
				message_id: string;
				/** The type of message, which is set to **notification**. */
				message_type: "notification";
				/** The UTC date and time that the message was sent. */
				message_timestamp: string;
				/** The type of event sent in the message. */
				subscription_type: Type;
				/** The version number of the subscription type's definition. This is the same value specified in the subscription request. */
				subscription_version: Version;
			};
			/** An object that contains the message. */
			payload: {
				/** An object that contains information about your subscription. */
				subscription: {
					/** An ID that uniquely identifies this subscription. */
					id: string;
					/** The subscription's status, which is set to **enabled**. */
					status: "enabled";
					/** The type of event sent in the message. See the `event` field. */
					type: Type;
					/** The version number of the subscription type's definition. */
					version: Version;
					/** The event's cost. See [Subscription limits](https://dev.twitch.tv/docs/eventsub/manage-subscriptions#subscription-limits). */
					cost: number;
					/** The conditions under which the event fires. For example, if you requested notifications when a broadcaster gets a new follower, this object contains the broadcaster's ID. For information about the condition's data, see the subscription type's description in [Subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types). */
					condition: Condition;
					/** An object that contains information about the transport used for notifications. */
					transport: Transport;
					/** The UTC date and time that the subscription was created. */
					created_at: string;
				};
				/** The event’s data. For information about the event’s data, see the subscription type’s description in [Subscription Types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types). */
				event: Event;
			};
		}
		export namespace Notification {
			export function isChannelChatMessage(data: EventSub.Message.Notification): data is ChannelChatMessage { return data.metadata.subscription_type === "channel.chat.message" && data.metadata.subscription_version === "1" }
			export type ChannelChatMessage = Message.Notification<"channel.chat.message", "1", Subscription.Condition.BroadcasterAndUserID, Transport, Subscription.Event.ChannelChatMessage>;
		}

		/** Defines the message that the EventSub WebSocket server sends if the server must drop the connection. [Read More](https://dev.twitch.tv/docs/eventsub/handling-websocket-events#reconnect-message) */
		export interface SessionReconnect {
			metadata: {
				/** An ID that uniquely identifies the message. Twitch sends messages at least once, but if Twitch is unsure of whether you received a notification, it’ll resend the message. This means you may receive a notification twice. If Twitch resends the message, the message ID will be the same. */
				message_id: string;
				/** The type of message, which is set to **session_reconnect**. */
				message_type: "session_reconnect";
				/** The UTC date and time that the message was sent. */
				message_timestamp: string;
			};
			payload: {
				session: Session<"reconnecting", null, string>;
			};
		}

		/** Defines the message that the EventSub WebSocket server sends if the user no longer exists or they revoked the authorization token that the subscription relied on. [Read More](https://dev.twitch.tv/docs/eventsub/handling-websocket-events#revocation-message) */
		export interface Revocation {
			/** An object that identifies the message. */
			metadata: {
				/** An ID that uniquely identifies the message. Twitch sends messages at least once, but if Twitch is unsure of whether you received a notification, it'll resend the message. This means you may receive a notification twice. If Twitch resends the message, the message ID will be the same. */
				message_id: string;
				/** The type of message, which is set to **revocation**. */
				message_type: "revocation";
				/** The UTC date and time that the message was sent. */
				message_timestamp: string;
				/** The type of event sent in the message. */
				subscription_type: string,
				/** The version number of the subscription type's definition. This is the same value specified in the subscription request. */
				subscription_version: Subscription.Version;
			};
			/** An object that contains the message. */
			payload: {
				/** An object that contains information about your subscription. */
				subscription: {
					/** An ID that uniquely identifies this subscription. */
					id: string;
					/** 
					 * The subscription's status. Possible values:
					 * - `authorization_revoked` — The user in the condition object revoked the authorization
					 * - `user_removed` — The user in the condition object is no longer a Twitch user
					 * - `version_removed` — The subscribed to subscription type and version is no longer supported
					 */
					status: "authorization_revoked" | "user_removed" | "version_removed";
					/** The type of event sent in the message. */
					type: string;
					/** The version number of the subscription type's definition. */
					version: Subscription.Version;
					/** The event's cost. See [Subscription limits](https://dev.twitch.tv/docs/eventsub/manage-subscriptions#subscription-limits). */
					cost: number;
					/** The conditions under which the event fires. For example, if you requested notifications when a broadcaster gets a new follower, this object contains the broadcaster's ID. For information about the condition's data, see the subscription type's description in [Subscription Types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types). */
					condition: Subscription.Condition | any;
					/** An object that contains information about the transport used for notifications. */
					transport: Transport;
					/** The UTC date and time that the subscription was created. */
					created_at: string;
				};
			};
		}
	}
}

export namespace Request {
	export type Name = "AddBlockedTerm" | "RemoveBlockedTerm" | "GetBlockedTerms" | "OAuth2Validate" | "CreateEventSubSubscription" | "GetUsers" | "SendChatMessage" | "DeleteEventSubSubscription";
	export type Method = "GET" | "POST" | "DELETE";
}
export const Request: Record<Request.Name, {url: string, method: Request.Method}> = {
	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	AddBlockedTerm: {url: "https://api.twitch.tv/helix/moderation/blocked_terms", method: "POST"},
	/** https://dev.twitch.tv/docs/api/reference/#remove-blocked-term */
	RemoveBlockedTerm: {url: "https://api.twitch.tv/helix/moderation/blocked_terms", method: "DELETE"},
	/** https://dev.twitch.tv/docs/api/reference/#get-blocked-terms */
	GetBlockedTerms: {url: "https://api.twitch.tv/helix/moderation/blocked_terms", method: "GET"},
	/** https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token */
	OAuth2Validate: {url: "https://id.twitch.tv/oauth2/validate", method: "GET"},
	/** https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription */
	CreateEventSubSubscription: {url: "https://api.twitch.tv/helix/eventsub/subscriptions", method: "POST"},
	/** https://dev.twitch.tv/docs/api/reference/#get-users */
	GetUsers: {url: "https://api.twitch.tv/helix/users", method: "GET"},
	/** https://dev.twitch.tv/docs/api/reference/#send-chat-message */
	SendChatMessage: {url: "https://api.twitch.tv/helix/chat/messages", method: "POST"},
	/** https://dev.twitch.tv/docs/api/reference/#delete-eventsub-subscription */
	DeleteEventSubSubscription: {url: "https://api.twitch.tv/helix/eventsub/subscriptions", method: "DELETE"},
}
export namespace RequestQuery {
	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	export interface AddBlockedTerm {
		/** The ID of the broadcaster that owns the list of blocked terms. */
		broadcaster_id: string;
		/** The ID of the broadcaster or a user that has permission to moderate the broadcaster’s chat room. This ID must match the user ID in the user access token. */
		moderator_id: string;
	}
	export function AddBlockedTerm(broadcaster_id: string, moderator_id: string): AddBlockedTerm {return {broadcaster_id, moderator_id}}
	/** https://dev.twitch.tv/docs/api/reference/#remove-blocked-term */
	export interface RemoveBlockedTerm extends AddBlockedTerm {
		/** The ID of the blocked term to remove from the broadcaster’s list of blocked terms. */
		id: string;
	}
	export function RemoveBlockedTerm(broadcaster_id: string, moderator_id: string, id: string): RemoveBlockedTerm {return {broadcaster_id, moderator_id, id}}
	/** https://dev.twitch.tv/docs/api/reference/#get-blocked-terms */
	export interface GetBlockedTerms extends AddBlockedTerm {
		/** The maximum number of items to return per page in the response. The minimum page size is 1 item per page and the maximum is 100 items per page. The default is 20. */
		first?: string;
		/** The cursor used to get the next page of results. The Pagination object in the response contains the cursor’s value. */
		after?: string;
	}
	export function GetBlockedTerms(broadcaster_id: string, moderator_id: string, first?: string, after?: string): GetBlockedTerms {return {broadcaster_id, moderator_id, first, after}}
	/** https://dev.twitch.tv/docs/api/reference/#get-users */
	export namespace GetUsers {
		export type Any = ByID | ByLogin;
		/** https://dev.twitch.tv/docs/api/reference/#get-users */
		export interface ByID {
			/** The ID of the user to get. To specify more than one user, include the id parameter for each user to get. For example, `id=1234&id=5678`. The maximum number of IDs you may specify is 100. */
			id: string;
		}
		export function ByID(id: string): ByID {return {id}}
		/** https://dev.twitch.tv/docs/api/reference/#get-users */
		export interface ByLogin {
			/** The login name of the user to get. To specify more than one user, include the login parameter for each user to get. For example, `login=foo&login=bar`. The maximum number of login names you may specify is 100. */
			login: string;
		}
		export function ByLogin(login: string): ByLogin {return {login}}
	}
	/** https://dev.twitch.tv/docs/api/reference/#send-chat-message */
	export interface SendChatMessage {
		/** The ID of the broadcaster whose chat room the message will be sent to. */
		broadcaster_id: string;
		/** The ID of the user sending the message. This ID must match the user ID in the user access token. */
		sender_id: string;
		/** The message to send. The message is limited to a maximum of 500 characters. Chat messages can also include emoticons. To include emoticons, use the name of the emote. The names are case sensitive. Don’t include colons around the name (e.g., :bleedPurple:). If Twitch recognizes the name, Twitch converts the name to the emote before writing the chat message to the chat room */
		message: string;
		/** The ID of the chat message being replied to. */
		reply_parent_message_id?: string;
	}
	export function SendChatMessage(broadcaster_id: string, sender_id: string, message: string, reply_parent_message_id?: string): SendChatMessage {return {broadcaster_id, sender_id, message, reply_parent_message_id}}

	/** https://dev.twitch.tv/docs/api/reference/#delete-eventsub-subscription */
	export interface DeleteEventSubSubscription {
		/** The ID of the subscription to delete. */
		id: string;
	}
	export function DeleteEventSubSubscription(id: string) {return {id}}
}
export namespace RequestBody {
	export interface Subscription<
		Type extends string = string,
		Version extends EventSub.Subscription.Version = EventSub.Subscription.Version,
		Condition extends EventSub.Subscription.Condition = EventSub.Subscription.Condition,
		Transport extends EventSub.Transport = EventSub.Transport
	> {
		/** The subscription type name. */
		type: Type;
		/** The subscription version. */
		version: Version;
		/** Subscription-specific parameters. */
		condition: Condition;
		/** Transport-specific parameters. */
		transport: Transport;
	}
	export namespace Subscription {
		export type ChannelChatMessage = Subscription<"channel.chat.message", "1", EventSub.Subscription.Condition.BroadcasterAndUserID, EventSub.Transport>;
		export function ChannelChatMessage(session_id: string, broadcaster_user_id: string, user_id: string): ChannelChatMessage {return {
			type: "channel.chat.message", version: "1", condition: {broadcaster_user_id, user_id}, transport: {method: "websocket", session_id}}}
	}

	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	export interface AddBlockedTerm {
		/** The word or phrase to block from being used in the broadcaster’s chat room. The term must contain a minimum of 2 characters and may contain up to a maximum of 500 characters. Terms may include a wildcard character (*). The wildcard character must appear at the beginning or end of a word or set of characters. For example, `*foo` or `foo*`. If the blocked term already exists, the response contains the existing blocked term. */
		text: string;
	}
	export function AddBlockedTerm(text: string): AddBlockedTerm {return {text}}
}
export namespace ResponseBody {
	/** https://dev.twitch.tv/docs/api/reference/#get-blocked-terms */
	export interface GetBlockedTerms {
		/** The list of blocked terms. The list is in descending order of when they were created (see the `created_at` timestamp). */
		data: {
			/** The broadcaster that owns the list of blocked terms. */
			broadcaster_id: string;
			/** The moderator that blocked the word or phrase from being used in the broadcaster’s chat room. */
			moderator_id: string;
			/** An ID that identifies this blocked term. */
			id: string;
			/** The blocked word or phrase. */
			text: string;
			/** The UTC date and time (in RFC3339 format) that the term was blocked. */
			created_at: string;
			/** The UTC date and time (in RFC3339 format) that the term was updated. When the term is added, this timestamp is the same as `created_at`. The timestamp changes as AutoMod continues to deny the term. */
			updated_at: string;
			/** The UTC date and time (in RFC3339 format) that the blocked term is set to expire. After the block expires, users may use the term in the broadcaster’s chat room. This field is `null` if the term was added manually or was permanently blocked by AutoMod. */
			expires_at: string;
			/** Contains the information used to page through the list of results. The object is empty if there are no more pages left to page through. [Read More](https://dev.twitch.tv/docs/api/guide#pagination) */
			pagination: {
				/** The cursor used to get the next page of results. Use the cursor to set the request’s after query parameter. */
				cursor: string;
			};
		}[];
		status: 200;
	}
	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	export interface AddBlockedTerm {
		/** A list that contains the single blocked term that the broadcaster added. */
		data: {
			/** The broadcaster that owns the list of blocked terms. */
			broadcaster_id: string;
			/** The moderator that blocked the word or phrase from being used in the broadcaster’s chat room. */
			moderator_id: string;
			/** An ID that identifies this blocked term. */
			id: string;
			/** The blocked word or phrase. */
			text: string;
			/** The UTC date and time (in RFC3339 format) that the term was blocked. */
			created_at: string;
			/** The UTC date and time (in RFC3339 format) that the term was updated. When the term is added, this timestamp is the same as `created_at`. The timestamp changes as AutoMod continues to deny the term. */
			updated_at: string;
			/** The UTC date and time (in RFC3339 format) that the blocked term is set to expire. After the block expires, users may use the term in the broadcaster’s chat room. This field is `null` if the term was added manually or was permanently blocked by AutoMod. */
			expires_at: string;
			/** Contains the information used to page through the list of results. The object is empty if there are no more pages left to page through. https://dev.twitch.tv/docs/api/guide#pagination */
			pagination: {
				/** The cursor used to get the next page of results. Use the cursor to set the request’s after query parameter. */
				cursor: string;
			};
		}[];
		status: 200;
	}
	/** https://dev.twitch.tv/docs/api/reference/#remove-blocked-term */
	export interface RemoveBlockedTerm {
		status: 204;
	}
	/** https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token */
	export interface OAuth2Validate {
		client_id: string;
		access_token: string;
		login: string;
		scopes: string[];
		user_id: string;
		expires_in: number;
		status: 200;
	}
	/** https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription */
	export interface CreateEventSubSubscription<
		Type extends string = string,
		Version extends EventSub.Subscription.Version = EventSub.Subscription.Version,
		Condition extends EventSub.Subscription.Condition = EventSub.Subscription.Condition,
		Transport extends EventSub.Transport = EventSub.Transport
	> {
		/** A object that contains the single subscription that you created. */
		data: {
			/** An ID that identifies the subscription. */
			id: string;
			/**
			 * The subscription’s status. The subscriber receives events only for enabled subscriptions. Possible values are:
			 * - `enabled` — The subscription is enabled.
			 * - `webhook_callback_verification_pending` — The subscription is pending verification of the specified callback URL (see [Responding to a challenge request](https://dev.twitch.tv/docs/eventsub/handling-webhook-events#responding-to-a-challenge-request)).
			 */
			status: "enabled" | "webhook_callback_verification_pending";
			/** The subscription’s type. See [Subscription Types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#subscription-types). */
			type: Type;
			/** The version number that identifies this definition of the subscription’s data. */
			version: Version;
			/** The subscription’s parameter values. */
			condition: Condition;
			/** The date and time (in RFC3339 format) of when the subscription was created. */
			created_at: string;
			/** The transport details used to send the notifications. */
			transport: Transport;
			/** The UTC date and time that the WebSocket connection was established. */
			connected_at: string;
			/** The amount that the subscription counts against your limit. [Learn More](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/#subscription-limits) */
			cost: number;
		};
		/** The total number of subscriptions you’ve created. */
		total: number;
		/** The sum of all of your subscription costs. [Learn More](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/#subscription-limits) */
		total_cost: number;
		/** The maximum total cost that you’re allowed to incur for all subscriptions you create. */
		max_total_cost: number;
		status: 202;
	}
	/** https://dev.twitch.tv/docs/api/reference/#get-users */
	export interface GetUsers {
		data: {
			/** An ID that identifies the user. */
			id: string;
			/** The user’s login name. */
			login: string;
			/** The user’s display name. */
			display_name: string;
			/** The type of user. Possible values are:
			 * - `admin` — Twitch administrator
			 * - `global_mod`
			 * - `staff` — Twitch staff
			 * - `""` — Normal user
			 */
			type: "admin" | "global_mod" | "staff" | "";
			/** The type of broadcaster. Possible values are:
			 * - `affiliate` — An affiliate broadcaster [affiliate broadcaster](https://help.twitch.tv/s/article/joining-the-affiliate-program%20target=)
			 * - `partner` — A partner broadcaster [partner broadcaster](https://help.twitch.tv/s/article/partner-program-overview)
			 * - `""` — A normal broadcaster
			 */
			broadcaster_type: "affiliate" | "partner" | "";
			/** The user’s description of their channel. */
			description: string;
			/** A URL to the user’s profile image. */
			profile_image_url: string;
			/** A URL to the user’s offline image. */
			offline_image_url: string;
			/** The number of times the user’s channel has been viewed. **NOTE**: This field has been deprecated (see [Get Users API endpoint – “view_count” deprecation](https://discuss.dev.twitch.tv/t/get-users-api-endpoint-view-count-deprecation/37777)). Any data in this field is not valid and should not be used. */
			view_count: number;
			/** The user’s verified email address. The object includes this field only if the user access token includes the **user:read:email** scope. If the request contains more than one user, only the user associated with the access token that provided consent will include an email address — the email address for all other users will be empty. */
			email?: string;
			/** The UTC date and time that the user’s account was created. The timestamp is in RFC3339 format. */
			created_at: string;
		}[];
		status: 200;
	}
	/** https://dev.twitch.tv/docs/api/reference/#send-chat-message */
	export interface SendChatMessage {
		data: {
			/** The message id for the message that was sent. */
			message_id: string;
			/** If the message passed all checks and was sent. */
			is_sent: boolean;
			/** The reason the message was dropped, if any. */
			drop_reason: {
				/** Code for why the message was dropped. */
				code: string;
				/** Message for why the message was dropped. */
				message: string;
			} | null;
		};
		status: 200;
	}
	/** https://dev.twitch.tv/docs/api/reference/#delete-eventsub-subscription */
	export interface DeleteEventSubSubscription {
		status: 204;
	}
}
export namespace ResponseBodyError {
	/** https://dev.twitch.tv/docs/api/reference/#get-blocked-terms */
	export interface GetBlockedTerms {
		status: 400 | 401 | 403;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	export interface AddBlockedTerm {
		status: 400 | 401 | 403;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#remove-blocked-term */
	export interface RemoveBlockedTerm {
		status: 400 | 401 | 403;
		message: string;
	}
	/** https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token */
	export interface OAuth2Validate {
		status: 400 | 401;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription */
	export interface CreateEventSubSubscription {
		status: 400 | 401 | 403 | 409 | 429;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#get-users */
	export interface GetUsers {
		status: 400 | 401;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#send-chat-message */
	export interface SendChatMessage {
		status: 400 | 401 | 403 | 422;
		message: string;
	}
	/** https://dev.twitch.tv/docs/api/reference/#delete-eventsub-subscription */
	export interface DeleteEventSubSubscription {
		status: 400 | 401 | 404;
		message: string;
	}
}
export namespace Response {
	/** https://dev.twitch.tv/docs/api/reference/#add-blocked-term */
	export async function AddBlockedTerm(client_id: string, access_token: string, query: RequestQuery.AddBlockedTerm, body: RequestBody.AddBlockedTerm, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.AddBlockedTerm.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.AddBlockedTerm.method, body: JSON.stringify(body), search: query}, init));
			const response: any = await request.json();
			response.status = request.status;
			return response as ResponseBody.AddBlockedTerm | ResponseBodyError.AddBlockedTerm;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.AddBlockedTerm;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#remove-blocked-term */
	export async function RemoveBlockedTerm(client_id: string, access_token: string, query: RequestQuery.RemoveBlockedTerm, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.RemoveBlockedTerm.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.RemoveBlockedTerm.method, search: query}, init));
			if (request.status === 204) return {status: 204} as ResponseBody.RemoveBlockedTerm;
			else return await request.json() as ResponseBodyError.RemoveBlockedTerm;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.RemoveBlockedTerm;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#get-blocked-terms */
	export async function GetBlockedTerms(client_id: string, access_token: string, query: RequestQuery.GetBlockedTerms, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.GetBlockedTerms.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.GetBlockedTerms.method, search: query}, init));
			const response: any = await request.json();
			response.status = request.status;
			return response as ResponseBody.GetBlockedTerms | ResponseBodyError.GetBlockedTerms;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.GetBlockedTerms;
		}
	}
	/** https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token */
	export async function OAuth2Validate(access_token: string, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.OAuth2Validate.url, FetchAddToInit({headers: {"Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.OAuth2Validate.method}, init));
			const response: any = await request.json();
			response.status = request.status;
			return response as ResponseBody.OAuth2Validate | ResponseBodyError.OAuth2Validate;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.OAuth2Validate;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription */
	export async function CreateEventSubSubscription(client_id: string, access_token: string, body: RequestBody.Subscription, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.CreateEventSubSubscription.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.CreateEventSubSubscription.method, body: JSON.stringify(body)}, init));
			const response: any = await request.json();
			response.status = request.status;
			if (response.status === 202) response.data = response.data[0];
			return response as ResponseBody.CreateEventSubSubscription<typeof body.type, typeof body.version, typeof body.condition, typeof body.transport> | ResponseBodyError.CreateEventSubSubscription;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.CreateEventSubSubscription;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#get-users */
	export async function GetUsers(client_id: string, access_token: string, query: RequestQuery.GetUsers.Any, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.GetUsers.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.GetUsers.method, search: query}, init));
			const response: any = await request.json();
			response.status = request.status;
			return response as ResponseBody.GetUsers | ResponseBodyError.GetUsers;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.GetUsers;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#send-chat-message */
	export async function SendChatMessage(client_id: string, access_token: string, query: RequestQuery.SendChatMessage, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.SendChatMessage.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.SendChatMessage.method, search: query}, init));
			const response: any = await request.json();
			response.status = request.status;
			if (response.status === 200) response.data = response.data[0];
			return response as ResponseBody.SendChatMessage | ResponseBodyError.SendChatMessage;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.SendChatMessage;
		}
	}
	/** https://dev.twitch.tv/docs/api/reference/#delete-eventsub-subscription */
	export async function DeleteEventSubSubscription(client_id: string, access_token: string, query: RequestQuery.DeleteEventSubSubscription, init?: RequestInitUndici) {
		try {
			const request = await fetch(Request.DeleteEventSubSubscription.url, FetchAddToInit({headers: {"Client-Id": client_id, "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json"}, method: Request.DeleteEventSubSubscription.method, search: query}, init));
			if (request.status === 204) return {status: 204} as ResponseBody.DeleteEventSubSubscription;
			else return await request.json() as ResponseBodyError.DeleteEventSubSubscription;
		} catch(e) {
			return {status: 400, message: e.toString()} as ResponseBodyError.DeleteEventSubSubscription;
		}
	}
}

function FetchAddToInit(OriginalInit?: RequestInit, AddInit?: RequestInitUndici): RequestInit {
	OriginalInit ??= {};
	if (AddInit) for (let [k, v] of Object.entries(AddInit))
		(OriginalInit as any)[k] = v;
	return OriginalInit;
}