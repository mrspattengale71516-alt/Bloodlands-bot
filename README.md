# Bloodlands Trader Discord Bot

A Discord-native manual order system for Bloodlands PlayStation DayZ. It does **not** connect to the DayZ server, spawn items, use restart deliveries, or automatically move .b0ne Cash.

## Features
- `/trader shop` — browse custom catalog
- `/trader order item:<name> quantity:<number> notes:<optional>` — submit an order
- `/trader my-orders` — view your recent orders
- `/trader add-item` and `/trader remove-item` — staff catalog management
- `/trader items` and `/trader orders` — staff views
- Order embeds in a private order channel with staff buttons for Payment Verified, Ready for Pickup, Complete Order, and Reject
- Best-effort player DMs when status changes
- Payment instructions direct players to pay `PayHerFirst` via .b0ne `/pay`; staff must verify manually

## Requirements
- Node.js 20+
- A Discord application/bot you control
- A private Discord text channel for trader orders
- A persistent disk/volume if hosted in the cloud

## Configure Discord
1. Open https://discord.com/developers/applications and create an application.
2. Under **Bot**, create/reset its bot token. Keep the token secret; never put it in chat or commit it to GitHub.
3. Copy the Application ID.
4. Invite the bot to Bloodlands using OAuth2 URL Generator with scopes `bot` and `applications.commands`; bot permissions needed: View Channels, Send Messages, Embed Links, Read Message History, and Use Application Commands.
5. Copy your Bloodlands server ID and the private `#trader-orders` channel ID (enable Developer Mode in Discord, then right-click/long-press the channel and copy ID).
6. Optionally create a trader staff role and copy its role ID. If `STAFF_ROLE_ID` is blank, only server administrators can manage catalog and order statuses.

## Run locally
1. Extract the ZIP.
2. Copy `.env.example` to `.env` and fill in the variables.
3. Never share `.env` or commit it to a public repository.
4. In the project folder run:
   ```bash
   npm install
   npm run deploy-commands
   npm start
   ```
5. Keep the process running. For production, use a host with a persistent volume and TLS dashboard/provider account security.

## Environment variables
- `DISCORD_TOKEN`: secret bot token
- `DISCORD_CLIENT_ID`: Discord application ID
- `DISCORD_GUILD_ID`: Bloodlands server ID
- `ORDER_CHANNEL_ID`: private `#trader-orders` channel ID
- `STAFF_ROLE_ID`: optional authorized staff role ID
- `TRADER_ACCOUNT`: default `PayHerFirst`
- `DATA_FILE`: default `./data.json`; on Railway, use `/app/data/data.json` with a volume mounted at `/app/data`

## Recommended launch safety
- Make `#trader-orders` visible only to staff and the bot.
- Use a dedicated staff role with only trusted members.
- Test with a fake item and fake order before opening it to players.
- Verify every payment manually in .b0ne before pressing **Payment Verified**.
- Confirm the in-game handover before pressing **Complete Order**.
- Back up `data.json` regularly; it contains catalog and order records.
- This first version stores data in a JSON file and is intended for a small pilot. Before larger public use, upgrade to a database, audit log, and stronger recovery tooling.
- Bot commands and order notifications do not grant anyone control over .b0ne. No external .b0ne API has been assumed.
