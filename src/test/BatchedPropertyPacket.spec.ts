/// <reference types="@rbxts/testez/globals" />

import { Players } from "@rbxts/services";
import Environment from "../Environment";
import BatchedPropertyPacketClass from "../BatchedPropertyPacket";
import { batchedProperty } from "../PacketMacro";

export = function () {
    describe("batchedProperty", () => {
        const originalVirtualState = Environment.IS_VIRTUAL;

        beforeAll(() => {
            Environment.setVirtualState(true);
        });

        afterAll(() => {
            Environment.setVirtualState(originalVirtualState);
        });

        it("batches rapid global updates", () => {
            const prop = batchedProperty<number>(50, 0);
            let changeCount = 0;
            let lastValue: number | undefined;

            const connection = prop.changed.connect((value) => {
                changeCount++;
                lastValue = value;
            });

            prop.set(1);
            prop.set(2);
            prop.set(3);

            task.wait(0.15);

            expect(changeCount).to.equal(1);
            expect(lastValue).to.equal(3);
            expect(prop.get()).to.equal(3);

            connection.disconnect();
            prop.destroy();
        });

        it("batches per-player overrides", () => {
            const prop = batchedProperty<number>(50, 10);
            const player = {
                Parent: Players,
            } as unknown as Player;

            prop.setFor(player, 20);
            prop.setFor(player, 30);

            task.wait(0.15);

            expect(prop.getFor(player)).to.equal(30);

            prop.destroy();
        });

        it("setTop keeps player overrides intact", () => {
            const prop = batchedProperty<number>(50, 0);
            const playerWithOverride = { Parent: Players } as unknown as Player;
            const playerWithoutOverride = { Parent: Players } as unknown as Player;

            let getPlayersCalled = false;
            BatchedPropertyPacketClass.setPlayersProvider(() => {
                getPlayersCalled = true;
                return [playerWithOverride, playerWithoutOverride];
            });

            try {
                prop.setFor(playerWithOverride, 42);
                prop.setTop(100);

                task.wait(0.15);

                expect(prop.getFor(playerWithOverride)).to.equal(42);
                expect(prop.getFor(playerWithoutOverride)).to.equal(100);
                expect(getPlayersCalled).to.equal(true);
            } finally {
                BatchedPropertyPacketClass.setPlayersProvider();
                prop.destroy();
            }
        });

        it("supports zero interval for immediate dispatch", () => {
            const prop = batchedProperty<number>(0, 5);
            let changeCount = 0;
            let lastValue: number | undefined;

            const connection = prop.changed.connect((value) => {
                changeCount++;
                lastValue = value;
            });

            prop.set(7);

            expect(changeCount).to.equal(1);
            expect(lastValue).to.equal(7);
            expect(prop.get()).to.equal(7);

            connection.disconnect();
            prop.destroy();
        });
    });
};
