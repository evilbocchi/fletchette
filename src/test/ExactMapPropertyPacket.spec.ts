/// <reference types="@rbxts/testez/globals" />

import Environment from "../Environment";
import { exactMapProperty } from "../PacketMacro";
import type { ExactMapDiffPayload } from "../ExactMapPropertyPacket";

export = function () {
    describe("primitiveMapProperty", () => {
        const originalVirtualState = Environment.IS_VIRTUAL;

        beforeAll(() => {
            Environment.setVirtualState(true);
        });

        afterAll(() => {
            Environment.setVirtualState(originalVirtualState);
        });

        it("emits diffs for set and delete operations", () => {
            const packet = exactMapProperty<string, number>();
            const snapshots = new Array<Map<string, number>>();
            const diffs = new Array<ExactMapDiffPayload<string, number>>();

            const connection = packet.observe((snapshot, diff) => {
                snapshots.push(snapshot);
                diffs.push(diff);
            });

            task.wait();

            packet.setEntry("coins", 100);
            task.wait();

            packet.deleteEntry("coins");
            task.wait();

            expect(diffs.size()).to.equal(3);

            const setDiff = diffs[1];
            expect(setDiff.full).to.equal(false);
            expect(setDiff.changes.size()).to.equal(1);
            const setChange = setDiff.changes[0];
            expect(setChange.type).to.equal("set");
            expect(setChange.key).to.equal("coins");
            if (setChange.type === "set") {
                expect(setChange.value).to.equal(100);
            }
            expect(snapshots[1].get("coins")).to.equal(100);

            const deleteDiff = diffs[2];
            expect(deleteDiff.full).to.equal(false);
            expect(deleteDiff.changes.size()).to.equal(1);
            expect(deleteDiff.changes[0].type).to.equal("delete");
            expect(deleteDiff.changes[0].key).to.equal("coins");
            expect(snapshots[2].get("coins")).to.equal(undefined);

            connection.disconnect();
        });

        it("computes minimal diffs when replacing map", () => {
            const initialEntries = new Map([
                ["coins", 100],
                ["gems", 5],
            ]);
            const packet = exactMapProperty<string, number>(initialEntries);
            const diffs = new Array<ExactMapDiffPayload<string, number>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            const replacement = new Map([
                ["coins", 100],
                ["gems", 10],
                ["tokens", 1],
            ]);
            packet.set(replacement);
            task.wait();

            expect(diffs.size()).to.equal(2);

            const diff = diffs[1];
            expect(diff.changes.size()).to.equal(2);

            const setChange = diff.changes.find((change) => change.type === "set" && change.key === "gems");
            expect(setChange).to.be.ok();
            if (setChange && setChange.type === "set") {
                expect(setChange.value).to.equal(10);
            }

            const addChange = diff.changes.find((change) => change.type === "set" && change.key === "tokens");
            expect(addChange).to.be.ok();
            if (addChange && addChange.type === "set") {
                expect(addChange.value).to.equal(1);
            }

            connection.disconnect();
        });

        it("ignores no-op updates", () => {
            const packet = exactMapProperty<string, boolean>();
            const diffs = new Array<ExactMapDiffPayload<string, boolean>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            packet.setEntry("flag", true);
            task.wait();

            const diffCountAfterSet = diffs.size();
            packet.setEntry("flag", true);
            task.wait();

            expect(diffs.size()).to.equal(diffCountAfterSet);

            connection.disconnect();
        });
    });
};
