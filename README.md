<p align="center">
  <img width="300" alt="Fletchette logo" src="assets/icon.png">
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
import { signal, request, property, packet } from "@rbxts/fletchette";
```

### SignalPacket

For one-way communication from server to client or client to server:

```ts
// Shared code
const playerJoined = signal<(player: Player, level: number) => void>();

// Server code
playerJoined.toAllClients(newPlayer, 5); // Broadcast to all clients
playerJoined.toClient(specificPlayer, 5); // Send to a specific client

// Client code
playerJoined.fromServer((player, level) => {
  print(`${player.Name} joined with level ${level}!`);
});

// Client to server
const requestItem = signal<(itemId: string) => void>();

// Client code
requestItem.toServer("sword123");

// Server code
requestItem.fromClient((player, itemId) => {
  print(`${player.Name} requested item: ${itemId}`);
});
```

### RequestPacket

For two-way communication (requests that expect a response):

```ts
// Shared code
const getPlayerData = request<(userId: number) => PlayerData>();

// Server code
getPlayerData.fromClient((player, userId) => {
  // Authenticate and return data
  return fetchPlayerData(userId);
});

// Client code
const data = getPlayerData.toServer(123456789);
print(`Got player data: ${data.level}`);

// Server querying client
const getClientInfo = request<() => ClientInfo>();

// Client code
getClientInfo.fromServer(() => {
  return {
    resolution: workspace.CurrentCamera!.ViewportSize,
    performance: stats().Memory,
  };
});

// Server code
const clientInfo = getClientInfo.toClient(player);
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

### Smart Packet Creation

The `packet` function automatically chooses the appropriate packet type based on your TypeScript types:

```ts
// Creates a SignalPacket (void return type)
const playerJoined = packet<(player: Player, level: number) => void>();

// Creates a RequestPacket (non-void return type)
const getPlayerData = packet<(userId: number) => PlayerData>();

// Creates a PropertyPacket (initial value provided)
const playerHealth = packet<number>({ initialValue: 100 });

// Creates a PropertyPacket (non-function type)
const gameSettings = packet<GameSettings>();
```

The `packet` function supports all the same options as the individual packet creators:

```ts
// With unreliable transmission
const fastUpdate = packet<(position: Vector3) => void>({ isUnreliable: true });

// PropertyPacket with initial value and unreliable transmission
const playerPosition = packet({ 
  initialValue: new Vector3(0, 0, 0), 
  isUnreliable: true 
});
```

## Advanced Features

### Area-Based Communication

Send signals only to players within a certain radius:

```ts
// Server code
explosion.toClientsInRadius(bombPosition, 100, explosionStrength);
```

### Selective Broadcasting

Send signals to specific groups of players:

```ts
// Server code
teamMessage.toClientsInList(teamMembers, "Let's coordinate our attack!");
teamMessage.toClientsExcept(traitor, "There's a traitor among us!");
```

## Documentation

For detailed API documentation, see the [API documentation](https://evilbocchi.github.io/fletchette/).

## License

MIT

