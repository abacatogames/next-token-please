export interface Scene<S> {
	id: string;
	mount(root: HTMLElement, state: S): void;
	update?(state: S): void;
	unmount?(): void;
}
