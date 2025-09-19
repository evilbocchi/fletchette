import { RunService } from "@rbxts/services";

class Environment {
    /**
     * Whether the current environment is server.
     */
    static IS_SERVER = RunService.IsServer();

    /**
     * Whether the current environment is in virtual mode (edit mode).
     * This is true when in Studio and not playing.
     * Virtual mode enables features like virtual properties that can be used in edit mode.
     */
    static IS_VIRTUAL = RunService.IsStudio() && !RunService.IsRunning();

    /**
     * Sets whether Fletchette should treat the environment as virtual mode,
     * enabling features like virtual properties.
     *
     * @param value Whether to enable virtual mode.
     */
    static setVirtualState(value: boolean) {
        this.IS_VIRTUAL = value;
    }
}

export = Environment;
