/// <reference types="@rbxts/testez/globals" />

import Environment from "../Environment";
import { shallowMapProperty } from "../PacketMacro";
import type { ShallowObjectMapDiffPayload } from "../ShallowMapPropertyPacket";

type PlayerState = {
    status?: string;
    kills: number;
    alive: boolean;
};

export = function () {
    describe("shallowObjectMapProperty", () => {
        const originalVirtualState = Environment.IS_VIRTUAL;

        beforeAll(() => {
            Environment.setVirtualState(true);
        });

        afterAll(() => {
            Environment.setVirtualState(originalVirtualState);
        });

        it("emits replace, patch, and delete diffs", () => {
            const initialEntries = new Map([["p1", { kills: 0, status: "idle", alive: true }]]);
            const packet = shallowMapProperty<string, PlayerState>(initialEntries);
            const diffs = new Array<ShallowObjectMapDiffPayload<string, PlayerState>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            packet.patchEntry("p1", { kills: 5, status: "ready" });
            task.wait();

            packet.deleteEntry("p1");
            task.wait();

            expect(diffs.size()).to.equal(3);

            const initialDiff = diffs[0];
            expect(initialDiff.full).to.equal(true);
            expect(initialDiff.changes.size()).to.equal(1);
            const initialChange = initialDiff.changes[0];
            expect(initialChange.type).to.equal("replace");
            if (initialChange.type === "replace") {
                expect(initialChange.value.kills).to.equal(0);
                expect(initialChange.value.status).to.equal("idle");
                expect(initialChange.value.alive).to.equal(true);
            }

            const patchDiff = diffs[1];
            expect(patchDiff.full).to.equal(false);
            expect(patchDiff.changes.size()).to.equal(1);
            const patchChange = patchDiff.changes[0];
            expect(patchChange.type).to.equal("patch");
            if (patchChange.type === "patch") {
                expect(patchChange.key).to.equal("p1");
                expect(patchChange.sets.kills).to.equal(5);
                expect(patchChange.sets.status).to.equal("ready");
            }

            const deleteDiff = diffs[2];
            expect(deleteDiff.full).to.equal(false);
            expect(deleteDiff.changes.size()).to.equal(1);
            const deleteChange = deleteDiff.changes[0];
            expect(deleteChange.type).to.equal("delete");
            expect(deleteChange.key).to.equal("p1");

            connection.disconnect();
        });

        it("computes minimal diffs when replacing", () => {
            const packet = shallowMapProperty<string, PlayerState>(
                new Map([
                    ["p1", { kills: 1, status: "ready", alive: true }],
                    ["p2", { kills: 2, alive: true }],
                ]),
            );
            const diffs = new Array<ShallowObjectMapDiffPayload<string, PlayerState>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            packet.set(
                new Map([
                    ["p1", { kills: 3, alive: true }],
                    ["p2", { kills: 2, alive: false }],
                    ["p3", { kills: 0, alive: true }],
                ]),
            );
            task.wait();

            expect(diffs.size()).to.equal(2);

            const diff = diffs[1];
            expect(diff.full).to.equal(false);
            expect(diff.changes.size()).to.equal(3);

            const p1Patch = diff.changes.find((change) => change.type === "patch" && change.key === "p1");
            expect(p1Patch).to.be.ok();
            if (p1Patch && p1Patch.type === "patch") {
                expect(p1Patch.sets.kills).to.equal(3);
                expect(p1Patch.deletes.find((field) => field === "status")).to.be.ok();
            }

            const p2Patch = diff.changes.find((change) => change.type === "patch" && change.key === "p2");
            expect(p2Patch).to.be.ok();
            if (p2Patch && p2Patch.type === "patch") {
                expect(p2Patch.sets.alive).to.equal(false);
            }

            const p3Replace = diff.changes.find((change) => change.type === "replace" && change.key === "p3");
            expect(p3Replace).to.be.ok();

            connection.disconnect();
        });

        it("ignores no-op patches and handles field deletes", () => {
            const packet = shallowMapProperty<string, PlayerState>();
            const diffs = new Array<ShallowObjectMapDiffPayload<string, PlayerState>>();

            const connection = packet.observe((_, diff) => {
                diffs.push(diff);
            });

            task.wait();

            packet.setEntry("p1", { kills: 0, alive: true });
            task.wait();

            const diffCountAfterInitial = diffs.size();
            packet.patchEntry("p1", { kills: 0 });
            task.wait();

            expect(diffs.size()).to.equal(diffCountAfterInitial);

            packet.patchEntry("p1", { status: "afk" });
            task.wait();

            packet.deleteFields("p1", ["status"]);
            task.wait();

            const lastDiff = diffs[diffs.size() - 1];
            expect(lastDiff.changes.size()).to.equal(1);
            const change = lastDiff.changes[0];
            expect(change.type).to.equal("patch");
            if (change.type === "patch") {
                expect(change.deletes.size()).to.equal(1);
                expect(change.deletes[0]).to.equal("status");
            }

            connection.disconnect();
        });
    });
};
