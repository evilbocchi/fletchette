/// <reference types="@rbxts/testez/globals" />

import { DataType } from "@rbxts/flamework-binary-serializer";
import { property } from "../PacketMacro";
import { setVirtualState } from "../Environment";
import { Players } from "@rbxts/services";

export = function () {
    describe("property", () => {
        it("creates property with initial value", () => {
            const prop = property<string>("initial_value");
            expect(prop).to.be.ok();
            expect(prop.get()).to.equal("initial_value");
        });

        it("creates property without initial value", () => {
            const prop = property<DataType.u32>();
            expect(prop).to.be.ok();
            // Value should be undefined initially
            expect(prop.get()).to.equal(undefined);
        });

        it("virtually sets and gets property value", () => {
            const prop = property<{ score: DataType.u32; name: string; }>();
            expect(prop).to.be.ok();

            const testData = { score: 1000, name: "player1" };
            prop.set(testData);

            const retrieved = prop.get();
            expect(retrieved).to.be.ok();
            expect(retrieved.score).to.equal(1000);
            expect(retrieved.name).to.equal("player1");
        });

        it("virtually observes property changes", () => {
            const prop = property<DataType.u16>(42);
            expect(prop).to.be.ok();

            let changeCount = 0;
            let lastValue: DataType.u16 | undefined = undefined;

            // Connect to changes
            const connection = prop.changed.connect((value) => {
                changeCount++;
                lastValue = value;
                print("Property changed to:", value);
            });

            expect(changeCount).to.equal(0);

            // Change the value
            prop.set(100);
            expect(changeCount).to.equal(1);
            expect(lastValue).to.equal(100);

            // Change again
            prop.set(200);
            expect(changeCount).to.equal(2);
            expect(lastValue).to.equal(200);

            // Disconnect and verify no more changes are detected
            connection.disconnect();
            prop.set(300);
            expect(changeCount).to.equal(2);
            expect(lastValue).to.equal(200);
        });

        it("virtually handles per-player values", () => {
            const prop = property<string>("default");
            expect(prop).to.be.ok();

            // Default value should be returned
            expect(prop.get()).to.equal("default");

            // In test environment, Players.LocalPlayer might be nil
            // So we'll test with a mock player if LocalPlayer exists
            if (Players.LocalPlayer) {
                const player = Players.LocalPlayer;
                prop.setFor(player, "player_specific");

                // getFor should return player-specific value
                expect(prop.getFor(player)).to.equal("player_specific");

                // get() should return player-specific value in edit mode
                expect(prop.get()).to.equal("player_specific");
            } else {
                // Skip per-player testing if no LocalPlayer available
                print("Skipping per-player test - no LocalPlayer available in test environment");
            }
        });

        it("virtually clears per-player values", () => {
            const prop = property<DataType.f32>(3.14);
            expect(prop).to.be.ok();

            // In test environment, Players.LocalPlayer might be nil
            if (Players.LocalPlayer) {
                const player = Players.LocalPlayer;

                // Set player-specific value
                prop.setFor(player, 2.71);
                expect(prop.getFor(player)).to.equal(2.71);

                // Clear player-specific value
                prop.clearFor(player);
                expect(prop.getFor(player)).to.equal(3.14); // Should return default
            } else {
                // Skip per-player testing if no LocalPlayer available
                print("Skipping per-player clear test - no LocalPlayer available in test environment");
            }
        });

        it("virtually sets value for multiple players", () => {
            const prop = property<{ level: DataType.u16; }>();
            expect(prop).to.be.ok();

            // In test environment, Players.LocalPlayer might be nil
            if (Players.LocalPlayer) {
                const players = [Players.LocalPlayer];
                const levelData = { level: 25 };

                prop.setForList(players, levelData);

                for (const player of players) {
                    const value = prop.getFor(player);
                    expect(value).to.be.ok();
                    expect(value.level).to.equal(25);
                }
            } else {
                // Skip per-player testing if no LocalPlayer available
                print("Skipping setForList test - no LocalPlayer available in test environment");
            }
        });

        it("virtually filters players for setting values", () => {
            const prop = property<boolean>(false);
            expect(prop).to.be.ok();

            // In test environment, Players.LocalPlayer might be nil
            if (Players.LocalPlayer) {
                // Create a predicate that always returns true for our test
                const predicate = (player: Player) => player === Players.LocalPlayer;

                prop.setFilter(predicate, true);

                // Check that the value was set for the filtered player
                expect(prop.getFor(Players.LocalPlayer)).to.equal(true);
            } else {
                // Skip per-player testing if no LocalPlayer available
                print("Skipping setFilter test - no LocalPlayer available in test environment");
            }
        });

        it("virtually clears values with filter", () => {
            const prop = property<string>("default");
            expect(prop).to.be.ok();

            // In test environment, Players.LocalPlayer might be nil
            if (Players.LocalPlayer) {
                const player = Players.LocalPlayer;

                // Set player-specific value
                prop.setFor(player, "specific");
                expect(prop.getFor(player)).to.equal("specific");

                // Clear using filter
                const predicate = (p: Player) => p === player;
                prop.clearFilter(predicate);

                expect(prop.getFor(player)).to.equal("default");
            } else {
                // Skip per-player testing if no LocalPlayer available
                print("Skipping clearFilter test - no LocalPlayer available in test environment");
            }
        });

        it("virtually sets top-level value", () => {
            const prop = property<DataType.u32>();
            expect(prop).to.be.ok();

            // setTop should set the default value for players without specific values
            prop.setTop(999);

            expect(prop.get()).to.equal(999);

            // Only test getFor if LocalPlayer exists
            if (Players.LocalPlayer) {
                expect(prop.getFor(Players.LocalPlayer)).to.equal(999);
            }
        });

        it("observes property and fires immediately if value exists", () => {
            const prop = property<string>("existing_value");
            expect(prop).to.be.ok();

            let observeCount = 0;
            let observedValue: string | undefined = undefined;

            // observe should fire immediately since value exists
            const connection = prop.observe((value) => {
                observeCount++;
                observedValue = value;
                print("Observed value:", value);
            });

            // Wait a brief moment for the async spawn to execute
            task.wait(0.1);

            expect(observeCount).to.equal(1);
            expect(observedValue).to.equal("existing_value");

            // Further changes should also trigger observation
            prop.set("new_value");
            expect(observeCount).to.equal(2);
            expect(observedValue).to.equal("new_value");

            connection.disconnect();
        });

        it("handles complex nested objects", () => {
            interface ComplexProperty {
                user: {
                    id: DataType.u32;
                    stats: {
                        health: DataType.f32;
                        mana: DataType.f32;
                        level: DataType.u16;
                    };
                    inventory: Array<{
                        itemId: DataType.u32;
                        quantity: DataType.u16;
                    }>;
                };
                settings: {
                    soundEnabled: boolean;
                    graphicsQuality: string;
                };
            }

            const complexData: ComplexProperty = {
                user: {
                    id: 12345,
                    stats: {
                        health: 100.0,
                        mana: 50.5,
                        level: 25
                    },
                    inventory: [
                        { itemId: 1, quantity: 10 },
                        { itemId: 2, quantity: 5 }
                    ]
                },
                settings: {
                    soundEnabled: true,
                    graphicsQuality: "high"
                }
            };

            const prop = property<ComplexProperty>(complexData);
            expect(prop).to.be.ok();

            const retrieved = prop.get();
            expect(retrieved).to.be.ok();
            expect(retrieved.user.id).to.equal(12345);
            expect(retrieved.user.stats.health).to.equal(100.0);
            expect(retrieved.user.stats.level).to.equal(25);
            expect(retrieved.user.inventory.size()).to.equal(2);
            expect(retrieved.user.inventory[0].itemId).to.equal(1);
            expect(retrieved.settings.soundEnabled).to.equal(true);
            expect(retrieved.settings.graphicsQuality).to.equal("high");
        });

        it("actually sends property data", () => {
            const prop = property<{ message: string; timestamp: DataType.f64; }>();
            expect(prop).to.be.ok();

            let changeReceived = false;
            let receivedData: { message: string; timestamp: DataType.f64; } | undefined = undefined;

            // Connect to changes
            const connection = prop.changed.connect((value) => {
                changeReceived = true;
                receivedData = value;
                print("Actually received property change:", value);
            });

            const testData = { message: "test_message", timestamp: os.clock() };

            // Temporarily disable virtual state
            setVirtualState(false);
            prop.set(testData);
            setVirtualState(true);

            // Wait for the change to propagate
            let t = 0;
            while (!changeReceived && t < 1) {
                task.wait(0.1);
                t += 0.1;
            }

            expect(changeReceived).to.equal(true);
            expect(receivedData).to.be.ok();
            expect(receivedData!.message).to.equal("test_message");
            expect(receivedData!.timestamp).to.be.a("number");

            connection.disconnect();
        });

        it("supports unreliable property transmission", () => {
            const prop = property<DataType.u16>(0, true); // unreliable = true
            expect(prop).to.be.ok();
            expect(prop.signalPacket).to.be.ok();

            // Basic functionality should still work
            prop.set(42);
            expect(prop.get()).to.equal(42);
        });

        it("properly destroys property resources", () => {
            const prop = property<string>("test");
            expect(prop).to.be.ok();
            expect(prop.signalPacket).to.be.ok();
            expect(prop.signalPacket.remoteEvent).to.be.ok();

            const remoteEventName = prop.signalPacket.remoteEvent.Name;
            expect(remoteEventName).to.be.a("string");

            // Destroy the property
            prop.destroy();

            // RemoteEvent should be destroyed
            // Note: We can't easily test if it's actually destroyed without causing errors,
            // but we can verify the destroy method doesn't throw
        });

        it("handles rapid property changes", () => {
            const prop = property<DataType.u32>(0);
            expect(prop).to.be.ok();

            let changeCount = 0;
            let lastValue: DataType.u32 | undefined = undefined;

            const connection = prop.changed.connect((value) => {
                changeCount++;
                lastValue = value;
            });

            // Rapidly change the property multiple times
            for (let i = 1; i <= 10; i++) {
                prop.set(i);
            }

            expect(changeCount).to.equal(10);
            expect(lastValue).to.equal(10);
            expect(prop.get()).to.equal(10);

            connection.disconnect();
        });

        it("handles undefined and nil values", () => {
            const prop = property<string | undefined>();
            expect(prop).to.be.ok();

            // Initially undefined
            expect(prop.get()).to.equal(undefined);

            // Set to a value
            prop.set("defined");
            expect(prop.get()).to.equal("defined");

            // Set back to undefined
            prop.set(undefined);
            expect(prop.get()).to.equal(undefined);
        });
    });
};