/// <reference types="@rbxts/testez/globals" />

import Environment from "../Environment";
import { exactSetProperty } from "../PacketMacro";
import type { ExactSetDiffPayload } from "../ExactSetPropertyPacket";

export = function () {
    describe("exactSetProperty", () => {
        const originalVirtualState = Environment.IS_VIRTUAL;

        beforeAll(() => {
            Environment.setVirtualState(true);
        });

        afterAll(() => {
            Environment.setVirtualState(originalVirtualState);
        });

        it("emits diffs for add and delete operations", () => {
            const packet = exactSetProperty<string>();
            const snapshots = new Array<Set<string>>();
            const diffs = new Array<ExactSetDiffPayload<string>>();

            const connection = packet.observe((snapshot, diff) => {
                snapshots.push(snapshot);
                diffs.push(diff);
            });

            task.wait();

            const added = packet.add("coins");
            expect(added).to.equal(true);
            task.wait();

            const deleted = packet.delete("coins");
            expect(deleted).to.equal(true);
            task.wait();

            expect(diffs.size()).to.equal(3);

            const addDiff = diffs[1];
            expect(addDiff.full).to.equal(false);
            expect(addDiff.changes.size()).to.equal(1);
            const addChange = addDiff.changes[0];
            expect(addChange.type).to.equal("add");
            expect(addChange.value).to.equal("coins");
            expect(snapshots[1].has("coins")).to.equal(true);

            const deleteDiff = diffs[2];
            expect(deleteDiff.full).to.equal(false);
            expect(deleteDiff.changes.size()).to.equal(1);
            expect(deleteDiff.changes[0].type).to.equal("delete");
            expect(deleteDiff.changes[0].value).to.equal("coins");
            expect(snapshots[2].has("coins")).to.equal(false);

            connection.disconnect();
        });

        it("computes minimal diffs when replacing set", () => {
            const initialValues = new Set(["coins", "gems"]);
            const packet = exactSetProperty<string>(initialValues);
            const diffs = new Array<ExactSetDiffPayload<string>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            const replacement = new Set(["coins", "tokens"]);
            packet.set(replacement);
            task.wait();

            expect(diffs.size()).to.equal(2);

            const diff = diffs[1];
            expect(diff.full).to.equal(false);
            expect(diff.changes.size()).to.equal(2);

            const addChange = diff.changes.find((change) => change.type === "add" && change.value === "tokens");
            expect(addChange).to.be.ok();

            const deleteChange = diff.changes.find((change) => change.type === "delete" && change.value === "gems");
            expect(deleteChange).to.be.ok();

            connection.disconnect();
        });

        it("ignores no-op add operations", () => {
            const packet = exactSetProperty<string>();
            const diffs = new Array<ExactSetDiffPayload<string>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            const firstAdd = packet.add("flag");
            expect(firstAdd).to.equal(true);
            task.wait();

            const diffCountAfterAdd = diffs.size();
            const secondAdd = packet.add("flag");
            expect(secondAdd).to.equal(false);
            task.wait();

            expect(diffs.size()).to.equal(diffCountAfterAdd);

            connection.disconnect();
        });
    });
};
