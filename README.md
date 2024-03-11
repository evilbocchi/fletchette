<p align="center">
  <img width="350" alt="Fletchette logo" src="assets/icon.jpg">
</p>

# Fletchette

A simple networking library for roblox-ts, and a modified TypeScript port of sleitnick's Comm module for Knit.

Here's an example of Fletchette for keeping track of a player's Money.
```typescript
// >> main.server.ts


// Register the MoneyCanister for use client-side
declare global {
    interface FletchetteCanisters {
        MoneyCanister: typeof MoneyCanister
    }
}

const MoneyCanister = Fletchette.createCanister("MoneyCanister", {
    // Create a new RemoteProperty for Money.
    money: new RemoteProperty<number>(0)
});

Players.PlayerAdded.Connect((player) => {
    const money = // ...data getting here
    MoneyCanister.money.setFor(player, money);
});


// >> main.client.ts

// Observe the money property, which will be called immediately and
// when the value changes
Fletchette.getCanister("MoneyCanister").money.observe((value) => {
    print("I have " + value + " dollars!");
});
```

## Documentation

TODO