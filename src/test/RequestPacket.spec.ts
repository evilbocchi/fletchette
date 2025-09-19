/// <reference types="@rbxts/testez/globals" />

// import { DataType } from "@rbxts/flamework-binary-serializer";
// import { Players } from "@rbxts/services";
// import Environment from "../Environment";
// import { request } from "../PacketMacro";

export = function() {};

// export = function () {
//     describe("request", () => {
//         it("virtually sends request to server and receives response", () => {
//             const packet = request<(userId: DataType.u32, username: string) => { success: boolean; message: string; }>();
//             expect(packet).to.be.ok();

//             let serverReceived = false;
//             let clientReceived = false;

//             // Set up server handler
//             packet.fromClient((player, userId, username) => {
//                 expect(player).to.equal(Players.LocalPlayer);
//                 expect(userId).to.equal(12345);
//                 expect(username).to.equal("testuser");
//                 serverReceived = true;
//                 print("Server received:", player, userId, username);
//                 return { success: true, message: "User validated successfully" };
//             });

//             // Send request to server
//             const response = packet.toServer(12345, "testuser");

//             expect(response).to.be.ok();
//             expect(response.success).to.equal(true);
//             expect(response.message).to.equal("User validated successfully");
//             clientReceived = true;

//             expect(serverReceived).to.equal(true);
//             expect(clientReceived).to.equal(true);
//         });

//         it("virtually sends request to client and receives response", () => {
//             const packet = request<(questId: DataType.u16, questName: string) => { accepted: boolean; rewards: string[]; }>();
//             expect(packet).to.be.ok();

//             let clientReceived = false;
//             let serverReceived = false;

//             // Set up client handler
//             packet.fromServer((questId, questName) => {
//                 expect(questId).to.equal(101);
//                 expect(questName).to.equal("Dragon Slayer");
//                 clientReceived = true;
//                 print("Client received:", questId, questName);
//                 return { accepted: true, rewards: ["sword", "shield", "potion"] };
//             });

//             // Send request to client
//             const response = packet.toClient(Players.LocalPlayer, 101, "Dragon Slayer");

//             expect(response).to.be.ok();
//             expect(response.accepted).to.equal(true);
//             expect(response.rewards).to.be.a("table");
//             expect(response.rewards.size()).to.equal(3);
//             expect(response.rewards[0]).to.equal("sword");
//             serverReceived = true;

//             expect(clientReceived).to.equal(true);
//             expect(serverReceived).to.equal(true);
//         });

//         it("actually sends request data", () => {
//             const packet = request<(data: { id: DataType.u32; name: string; items: string[]; }) => { processed: boolean; itemCount: DataType.u16; }>();
//             expect(packet).to.be.ok();

//             let serverReceived = false;
//             let responseReceived = false;

//             // Set up server handler
//             packet.fromClient((player, data) => {
//                 expect(player).to.equal(Players.LocalPlayer);
//                 expect(data.id).to.equal(999);
//                 expect(data.name).to.equal("inventory");
//                 expect(data.items).to.be.a("table");
//                 expect(data.items.size()).to.equal(2);
//                 expect(data.items[0]).to.equal("apple");
//                 expect(data.items[1]).to.equal("bread");
//                 serverReceived = true;
//                 print("Server processed:", player, data);
//                 return { processed: true, itemCount: data.items.size() as DataType.u16 };
//             });

//             // Temporarily disable virtual state for actual transmission
//             Environment.setVirtualState(false);

//             const response = packet.toServer({
//                 id: 999,
//                 name: "inventory",
//                 items: ["apple", "bread"]
//             });

//             // Re-enable virtual state
//             Environment.setVirtualState(true);

//             expect(response).to.be.ok();
//             expect(response.processed).to.equal(true);
//             expect(response.itemCount).to.equal(2);
//             responseReceived = true;

//             // Wait a bit for async operations
//             let t = 0;
//             while (!serverReceived && t < 1) {
//                 task.wait(0.1);
//                 t += 0.1;
//             }

//             expect(serverReceived).to.equal(true);
//             expect(responseReceived).to.equal(true);
//         });

//         it("handles complex nested data structures", () => {
//             interface ComplexData {
//                 user: {
//                     id: DataType.u32;
//                     profile: {
//                         name: string;
//                         level: DataType.u16;
//                         stats: {
//                             health: DataType.f32;
//                             mana: DataType.f32;
//                         };
//                     };
//                 };
//                 inventory: {
//                     items: Array<{
//                         id: DataType.u32;
//                         name: string;
//                         quantity: DataType.u16;
//                     }>;
//                 };
//             }

//             interface ResponseData {
//                 saved: boolean;
//                 errors: string[];
//                 timestamp: DataType.f64;
//             }

//             const packet = request<(data: ComplexData) => ResponseData>();
//             expect(packet).to.be.ok();

//             let received = false;

//             packet.fromClient((player, data) => {
//                 expect(player).to.equal(Players.LocalPlayer);
//                 expect(data.user.id).to.equal(12345);
//                 expect(data.user.profile.name).to.equal("TestPlayer");
//                 expect(data.user.profile.level).to.equal(50);
//                 expect(data.user.profile.stats.health).to.equal(100.5);
//                 expect(data.user.profile.stats.mana).to.equal(75.25);
//                 expect(data.inventory.items.size()).to.equal(2);
//                 expect(data.inventory.items[0].name).to.equal("Sword");
//                 expect(data.inventory.items[1].quantity).to.equal(10);
//                 received = true;

//                 return {
//                     saved: true,
//                     errors: [],
//                     timestamp: os.clock()
//                 };
//             });

//             const complexData: ComplexData = {
//                 user: {
//                     id: 12345,
//                     profile: {
//                         name: "TestPlayer",
//                         level: 50,
//                         stats: {
//                             health: 100.5,
//                             mana: 75.25
//                         }
//                     }
//                 },
//                 inventory: {
//                     items: [
//                         { id: 1, name: "Sword", quantity: 1 },
//                         { id: 2, name: "Potion", quantity: 10 }
//                     ]
//                 }
//             };

//             const response = packet.toServer(complexData);

//             expect(response.saved).to.equal(true);
//             expect(response.errors).to.be.a("table");
//             expect(response.errors.size()).to.equal(0);
//             expect(response.timestamp).to.be.a("number");
//             expect(received).to.equal(true);
//         });

//         it("supports multiple handlers", () => {
//             const packet1 = request<(value: DataType.u32) => string>();
//             const packet2 = request<(name: string) => DataType.u16>();

//             let handler1Called = false;
//             let handler2Called = false;

//             packet1.fromClient((player, value) => {
//                 expect(value).to.equal(42);
//                 handler1Called = true;
//                 return "Success";
//             });

//             packet2.fromClient((player, name) => {
//                 expect(name).to.equal("test");
//                 handler2Called = true;
//                 return 123;
//             });

//             const response1 = packet1.toServer(42);
//             const response2 = packet2.toServer("test");

//             expect(response1).to.equal("Success");
//             expect(response2).to.equal(123);
//             expect(handler1Called).to.equal(true);
//             expect(handler2Called).to.equal(true);
//         });

//         it("properly destroys packet resources", () => {
//             const packet = request<(test: string) => boolean>();
//             expect(packet).to.be.ok();
//             expect(packet.remoteFunction).to.be.ok();

//             // Verify the remote function exists
//             const remoteFunctionName = packet.remoteFunction.Name;
//             expect(remoteFunctionName).to.be.a("string");

//             // Destroy the packet
//             packet.destroy();

//             // After destruction, properties should be cleared
//             expect(next(packet as unknown as object)[0]).to.equal(undefined);
//         });
//     });
// };