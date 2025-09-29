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
  - `BatchedPropertyPacket`: For batching property updates over configurable intervals
  - `ExactMapPropertyPacket`: For diff-synchronizing values that do not require deep equality checks
  - `ShallowMapPropertyPacket`: For diff-synchronizing values that require first-level deep equality checks

## Installation

[Flamework](https://flamework.fireboltofdeath.dev/docs/introduction/) is required to use Fletchette. This automatically sets up metadata for Fletchette packets.

In `tsconfig.json`, add `rbxts-transform-flamework` to the `plugins` array:
```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "rbxts-transform-flamework" }
    ]
  }
}
```

Then, install Fletchette via npm:

```bash
npm install @rbxts/fletchette
```

## Basic Usage

### Importing

```ts
import {
  signal,
  request,
  property,
  batchedProperty,
  primitiveMapProperty,
  shallowObjectMapProperty,
  smartProperty,
  packet,
} from "@rbxts/fletchette";
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

While sending the whole value on each update is simple and generally sufficient for 90% of use cases, Fletchette also provides specialized property packets for scenarios that demand more efficient synchronization.

### BatchedPropertyPacket

For synchronizing properties while coalescing rapid updates into batches:

```ts
// Shared code – batch updates every 100 ms with an initial value of 0
const playerScore = batchedProperty<number>(100, 0);

// Server code
playerScore.set(1250); // Queued and broadcast after the next batch interval
playerScore.setTop(1000); // Only players without overrides receive the new value

// Client code
playerScore.observe((score) => {
  scoreLabel.Text = `Score: ${score}`;
});
```

### ExactMapPropertyPacket

For synchronizing `Map` values that have primitive keys and values, with clients receiving only diff payloads:

```ts
// Shared code – primitive map of player stats
const playerStats = primitiveMapProperty<string, number>();

// Server code
playerStats.setEntry("kills", 5);      // Sends a single diff entry
playerStats.set(new Map([["deaths", 2]])); // Sends a full replace diff
```

### ShallowMapPropertyPacket

For synchronizing maps whose values are shallow objects while sending minimal field-level diffs:

```ts
// Shared code – map of player loadouts
const playerLoadouts = shallowObjectMapProperty<string, { weapon: string; ammo: number; shield: boolean }>();

// Server code
playerLoadouts.setEntry("player1", { weapon: "Pistol", ammo: 12, shield: false });
playerLoadouts.patchEntry("player1", { ammo: 18 });       // Sends a patch diff with just the ammo change
playerLoadouts.deleteFields("player1", ["shield"]);      // Sends a patch diff removing the shield field
playerLoadouts.set(new Map([["player2", { weapon: "Rifle", ammo: 30, shield: true }]])); // Sends a full replace diff

// Client code
playerLoadouts.observe((snapshot, diff) => {
  for (const change of diff.changes) {
    if (change.type === "replace") {
      print(`${change.key} loadout replaced`, change.value);
    } else if (change.type === "patch") {
      print(`${change.key} loadout patched`, change.sets, change.deletes);
    } else {
      print(`${change.key} loadout removed`);
    }
  }

  updateLoadoutUI(snapshot);
});
```

## Advanced Features

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

// Batched property with a 100 ms flush interval
const leaderboardScore = packet<number>({ initialValue: 0, batchIntervalMs: 100 });
```

It is not recommended to use `packet` for properties that require specialized diffing behavior, such as `primitiveMapProperty` or `shallowObjectMapProperty`.

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

