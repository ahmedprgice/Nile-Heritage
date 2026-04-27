# Chat MVP Contract

## Socket Connection
- URL: `ws://<host>` using Socket.IO
- Auth: provide JWT in either:
  - `auth.token`
  - `Authorization: Bearer <token>` header

On successful connect, server auto-joins:
- `user:{userId}`
- `channel:{channelId}` for member channels
- `direct:{conversationId}` for member direct conversations

Server emits presence updates:
- Event: `presence:update`
- Payload:
```json
{
  "userId": "...",
  "status": "online|offline",
  "lastSeenAt": "ISO"
}
```

## Incoming Socket Events

### `message:send`
Payload:
```json
{
  "conversationType": "channel|direct",
  "channelId": "...",
  "conversationId": "...",
  "contentHtml": "<p>Hello</p>",
  "contentText": "Hello",
  "messageType": "update|question|announcement|action|message",
  "clientMessageId": "uuid"
}
```
ACK:
```json
{ "ok": true, "message": { ...savedMessage } }
```
or
```json
{ "ok": false, "error": "..." }
```
Server emit on success: `message:new`

### `typing:start` / `typing:stop`
Payload:
```json
{
  "conversationType": "channel|direct",
  "channelId": "...",
  "conversationId": "..."
}
```
Server emits `typing:update` to other room members:
```json
{
  "conversationType": "channel|direct",
  "channelId": "...",
  "conversationId": "...",
  "userId": "...",
  "name": "...",
  "isTyping": true
}
```

### `read:update`
Payload:
```json
{
  "conversationType": "channel|direct",
  "channelId": "...",
  "conversationId": "...",
  "lastReadMessageId": "...",
  "lastReadAt": "ISO optional"
}
```
ACK:
```json
{ "ok": true, "read": { ... } }
```
Server emit: `read:updated`

## REST Endpoints (auth required)

### `GET /api/chat/channels`
Response:
```json
{ "channels": [ ... ] }
```

### `GET /api/chat/conversations/direct`
Response:
```json
{ "conversations": [ ... ] }
```

### `GET /api/chat/messages?conversationType=channel&channelId=...&cursor=...&limit=30`
(or `conversationType=direct&conversationId=...`)

Response:
```json
{
  "items": [ ...messagesNewestFirst ],
  "nextCursor": "ISO|null"
}
```

### `POST /api/chat/direct/start`
Body:
```json
{ "targetUserId": "..." }
```
Response:
```json
{ "conversation": { ... } }
```

### `GET /api/chat/unread-counts`
Response:
```json
{
  "channels": { "channelId": 3 },
  "directs": { "conversationId": 1 }
}
```

## Example client flow (send -> ack -> read)
1. Client emits `message:send` with `clientMessageId` and optimistic local message.
2. Server ACK returns saved message payload with DB `id` and timestamps.
3. Server emits `message:new` to all room members.
4. Client updates optimistic item using ACK/`clientMessageId` mapping.
5. After render/scroll, client emits `read:update` with last message id.
6. Server emits `read:updated` so participants can update read state.
