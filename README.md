# LeerTwitchChatBot
A simple chat bot for twitch, mostly showcase of my typescript module twitch.ts
## Commands
- `!uptime` - sends uptime of bot
- `!sex` - "checks" your age, if not confirmed, sends [tutorial for confirmation of your age](https://www.youtube.com/watch?v=j-iheFkstFQ), *haha so funny*
- `!nuke <object>` - sends nuke to object you specified! however arrival time is random...
- `!russianroulette` - with chance 1/6 timeouts you for random duration
- `!blockedtermadd <term>` - makes term be blocked by twitch automod, works only if you are moderator!
- `!blockedtermremove <term>` - removes term from blocked by twitch automod, works only if you are moderator!
- `!blockedtermlist` - sends the link for showing blocked terms of channel, works only if you are moderator!
- `!game <game_id_or_name>` - changes game on stream, works only if you are moderator!
- `!title <title>` - changes title of stream, works only if you are moderator!
- `!followtime` - shows your follow time
- `!followtime <username>` - shows follow time of user you specified
- `!watchtime` - shows your total watch time of streams in minutes
- `!watchtime <username>` - shows total watch time of streams of user you specified in minutes
## BUILDING
1. `npm i`
2. `npm run build`
3. `node index.js` - "first" running gives you instructions to how to run the app
## Which scopes are used by bot?
- `user:write:chat` - answering to commands of the chat
## Which scopes are used by each twitch channel?
- `user:read:chat` - reading the chat messages, this scope is not on bot because channel.chat.message event costs 0 if you reading own chat
- `moderator:manage:blocked_terms` - manage blocked terms by commands `!blockedtermadd` or `!blockedtermremove`
- `moderator:manage:banned_users` - used by command `!russianroulette` for timeout user
- `channel:manage:broadcast` - used by commands `!game` `!title` for changing stream information
- `moderator:read:followers` - used by command `!followtime` to get follow time of user
- `moderator:read:chatters` - used for `!watchtime` command system (polling Request.GetChatters)
## TODO
- add translations, cuz bot answers on russian language