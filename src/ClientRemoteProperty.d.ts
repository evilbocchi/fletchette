import Signal from "./Signal";

interface ClientRemoteProperty<T> {
	get(): T;
	isReady(): boolean;
	destroy(): void;
	observe(observer: (value: T) => void): void; 
	readonly changed: Signal<(value: T) => void>;
}

interface ClientRemotePropertyConstructor {
	new <T>(valueObject: RemoteEvent): ClientRemoteProperty<T>;
	new <T>(valueObject: Instance): ClientRemoteProperty<T>;
}

declare const ClientRemoteProperty: ClientRemotePropertyConstructor;

export = ClientRemoteProperty;
