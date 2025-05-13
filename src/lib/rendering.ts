import type { ComponentType, ComponentProps, SvelteComponent } from "svelte";

export function renderVirtualSvelteElement<T extends SvelteComponent>(Component: ComponentType<T>, props: ComponentProps<T>): HTMLElement {
	const htmlComponent = document.createElement('div');

	new Component({
		target: htmlComponent,
		props,
	});

	return htmlComponent.children[0] as HTMLElement;
}
