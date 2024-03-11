interface ClientRemoteFunc<T extends Callback = Callback> {
	invoke(...args: Parameters<T>): void;
	onInvoke(handler: T): void;
	destroy(): void;
}

interface ClientRemoteFuncConstructor {
	new <T extends Callback>(remotefunction: RemoteFunction<T>): ClientRemoteFunc<T>;
}

declare const ClientRemoteFunc: ClientRemoteFuncConstructor;

export = ClientRemoteFunc;
