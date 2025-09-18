/// <reference types="@rbxts/testez/globals" />

import { DataType } from "@rbxts/flamework-binary-serializer";
import { signal } from "../PacketMacro";
import { setVirtualState } from "../Environment";
import { Players } from "@rbxts/services";

export = function () {
    describe("signal", () => {
        it("virtually sends data", () => {
            const packet = signal<(test1: DataType.u16, test2: string, test3: { hamster123: DataType.u32; }) => void>();
            expect(packet).to.be.ok();

            let received = false;
            packet.fromClient((player, test1, test2, test3) => {
                expect(player).to.equal(Players.LocalPlayer);
                expect(test1).to.equal(123);
                expect(test2).to.equal("hello");
                expect(test3.hamster123).to.equal(456);
                received = true;
                print(Players.LocalPlayer, test1, test2, test3);
            });

            packet.toServer(123, "hello", { hamster123: 456 });

            let t = 0;
            while (!received && t < 1) {
                task.wait(0.1);
                t += 0.1;
            }
        });

        it("actually sends data", () => {
            const packet = signal<(test1: DataType.u16, test2: string, test3: { hamster123: DataType.u32; }) => void>();
            expect(packet).to.be.ok();

            let received = false;
            packet.fromClient((player, test1, test2, test3) => {
                expect(player).to.equal(Players.LocalPlayer);
                expect(test1).to.equal(123);
                expect(test2).to.equal("hello");
                expect(test3.hamster123).to.equal(456);
                print(Players.LocalPlayer, test1, test2, test3);
                received = true;
            });

            setVirtualState(false);
            packet.toServer(123, "hello", { hamster123: 456 });
            setVirtualState(true);

            let t = 0;
            while (!received && t < 1) {
                task.wait(0.1);
                t += 0.1;
            }
        });
    });
};
