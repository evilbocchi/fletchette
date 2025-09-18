import { ReplicatedStorage } from "@rbxts/services";
import TestEZ from "@rbxts/testez";

const root = ReplicatedStorage;
print(`Running tests in: ${root.GetFullName()}`);
TestEZ.TestBootstrap.run([root]);
