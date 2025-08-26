import { RunService } from "@rbxts/services";

/**
    * Whether the current environment is server.
    */
export const IS_SERVER = RunService.IsServer();

/**
 * Whether the current environment is in edit mode.
 */
export const IS_EDIT = RunService.IsStudio() && !RunService.IsRunning();