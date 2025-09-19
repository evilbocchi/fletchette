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
    });
};
