<p align="center">
  <img width="350" alt="Fletchette logo" src="assets/icon.jpg">
</p>

# Fletchette

A type-safe networking library for roblox-ts that simplifies client-server communication.

## Features

- **Type Safety**: Fully typed interfaces using TypeScript to prevent runtime errors
- **Binary Serialization**: Efficient data transmission using binary serialization
- **Multiple Packet Types**:
  - `SignalPacket`: For one-way communication (like RemoteEvents)
  - `RequestPacket`: For request-response patterns (like RemoteFunctions)
  - `PropertyPacket`: For synchronizing properties between server and client

## Installation

```bash
npm install @rbxts/fletchette
```

## Basic Usage

### Importing

```ts
import { signal, request, property } from "@rbxts/fletchette";
```

### SignalPacket

For one-way communication from server to client or client to server:

```ts
// Shared code
const playerJoined = signal<(player: Player, level: number) => void>();

// Server code
playerJoined.fireAll(newPlayer, 5); // Broadcast to all clients
playerJoined.fire(specificPlayer, 5); // Send to a specific client

// Client code
playerJoined.connect((player, level) => {
  print(`${player.Name} joined with level ${level}!`);
});

// Client to server
const requestItem = signal<(itemId: string) => void>();

// Client code
requestItem.inform("sword123");

// Server code
requestItem.listen((player, itemId) => {
  print(`${player.Name} requested item: ${itemId}`);
});
```

### RequestPacket

For two-way communication (requests that expect a response):

```ts
// Shared code
const getPlayerData = request<(userId: number) => PlayerData>();

// Server code
getPlayerData.onInvoke((player, userId) => {
  // Authenticate and return data
  return fetchPlayerData(userId);
});

// Client code
const data = getPlayerData.invoke(123456789);
print(`Got player data: ${data.level}`);

// Server querying client
const getClientInfo = request<() => ClientInfo>();

// Client code
getClientInfo.onQuery(() => {
  return {
    resolution: workspace.CurrentCamera!.ViewportSize,
    performance: stats().Memory,
  };
});

// Server code
const clientInfo = getClientInfo.query(player);
print(`Client resolution: ${clientInfo.resolution.X}x${clientInfo.resolution.Y}`);
```

### PropertyPacket

For synchronizing state between server and client:

```ts
// Shared code
const playerHealth = property<number>(100);

// Server code
// Update when player takes damage
playerHealth.set(player, 80);

// Client code
playerHealth.observe((newHealth) => {
  healthBar.Size = new UDim2(newHealth / 100, 0, 1, 0);
});
```

## Advanced Features

### Area-Based Communication

Send signals only to players within a certain radius:

```ts
// Server code
explosion.fireInRadius(bombPosition, 100, explosionStrength);
```

### Selective Broadcasting

Send signals to specific groups of players:

```ts
// Server code
teamMessage.fireList(teamMembers, "Let's coordinate our attack!");
teamMessage.fireExcept(traitor, "There's a traitor among us!");
```

## Documentation

For detailed API documentation, see the [API documentation](https://evilbocchi.github.io/fletchette/).

## License

MIT

