import { RunService } from "@rbxts/services";

/**
    * Whether the current environment is server.
    */
export const IS_SERVER = RunService.IsServer();

/**
 * Whether the current environment is in edit mode.
 */
export let IS_EDIT = RunService.IsStudio() && !RunService.IsRunning();

/**
 * Sets whether Fletchette should treat the environment as edit mode,
 * enabling features like virtual properties.
 *
 * @param value Whether to enable edit mode.
 */
export function setVirtualState(value: boolean) {
    IS_EDIT = value;
}