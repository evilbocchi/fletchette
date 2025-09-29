/// <reference types="@rbxts/testez/globals" />

import { packet } from "../PacketMacro";

export = function () {
    describe("packet", () => {
        it("creates a SignalPacket", () => {
            const test = packet<(test1: number) => void>();
            expect(test).to.be.ok();
            expect(test.className).to.equal("SignalPacket");
        });

        it("creates a RequestPacket", () => {
            const test = packet<(test1: number) => number>();
            expect(test).to.be.ok();
            expect(test.className).to.equal("RequestPacket");
        });

        it("creates a PropertyPacket without initialValue", () => {
            const test = packet<number>();
            expect(test).to.be.ok();
            expect(test.className).to.equal("PropertyPacket");
        });

        it("creates a PropertyPacket with initialValue", () => {
            const test = packet({ initialValue: 5 });
            expect(test).to.be.ok();
            expect(test.className).to.equal("PropertyPacket");
            expect(test.get()).to.equal(5);
        });

        it("creates an ExactSetPropertyPacket with a primitive", () => {
            const initialValues = new Set<string>();
            initialValues.add("coins");

            const test = packet<Set<string>>({ initialValue: initialValues });
            expect(test).to.be.ok();
            expect(test.className).to.equal("ExactSetPropertyPacket");

            const snapshot = test.get();
            expect(snapshot).to.be.ok();
            expect(snapshot.has("coins")).to.equal(true);
        });

        it("creates an ExactSetPropertyPacket with a non-primitive", () => {
            type TestType = { id: number; name: string };
            const initialValues = new Set<TestType>();
            const value = { id: 1, name: "coins" };
            initialValues.add(value);

            const test = packet<Set<TestType>>({ initialValue: initialValues });
            expect(test).to.be.ok();
            expect(test.className).to.equal("ExactSetPropertyPacket");

            const snapshot = test.get();
            expect(snapshot).to.be.ok();
            expect(snapshot.has(value)).to.equal(true);
        });
    });
};
