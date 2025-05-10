<script lang="ts">
	import { nostrAuth } from '$lib/nostr';
	import { Button, Input, Label, P } from 'flowbite-svelte';
	import { Buffer } from 'buffer';
	import { nip19 } from 'nostr-tools';

	import { page } from '$app/state';
	const npubParam = page.url.searchParams.get('npub');
	const urlParams = npubParam ? `?npub=${npubParam}` : '';

	let nsecInput = '';

	let secretKey: Uint8Array | null = null;
	let secretKeyStr: string | null = null;

	$: {
		try {
			let nsec = nip19.decode(nsecInput);

			if (nsec.type === 'nsec') {
				secretKey = new Uint8Array(nsec.data);
				secretKeyStr = Buffer.from(nsec.data).toString('hex');
			} else {
				secretKey = null;
				secretKeyStr = null;
			}
		} catch (error) {
			secretKey = null;
			secretKeyStr = null;
		}
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
	<div class="flex justify-center">
		<P align="center" size="4xl" weight="normal">Import PLS Identity</P>
	</div>
	<div class="flex h-full w-full flex-col items-center justify-center gap-4">
		<div>
			<Label class="mb-2">Secret key</Label>
			<Input type="text" bind:value={nsecInput}></Input>
		</div>
	</div>
	<a href={npubParam ? `/rate${urlParams}` : '/'}>
		<Button
			disabled={secretKeyStr === null}
			on:click={() => {
				if (secretKeyStr) nostrAuth.loginWithPrivkey(secretKeyStr);
			}}
		>
			Continue
		</Button>
	</a>
</div>
