<script lang="ts">
	import { Button, Checkbox, Input, Label, P, Toast } from 'flowbite-svelte';
	import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
	import { Buffer } from 'buffer';
	import { slide } from 'svelte/transition';
	import { nostrAuth } from '$lib/nostr';

	import { page } from '$app/state';
	const npubParam = page.url.searchParams.get('npub');
	const urlParams = npubParam ? `?npub=${npubParam}` : '';

	let privateKey = generateSecretKey();
	let privateKeyStr = Buffer.from(privateKey).toString('hex');

	$: nsec = nip19.nsecEncode(privateKey);
	$: publicKey = getPublicKey(privateKey);
	$: npub = nip19.npubEncode(publicKey);

	let hasStoredKey = false;

	let copiedPubkey = false;
	let copiedPrivkey = false;
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
	<div class="flex justify-center">
		<P align="center" size="4xl" weight="normal">Generated PLS Identity</P>
	</div>

	<div class="flex h-full w-full flex-col items-center justify-center gap-4">
		<div>
			<Label class="mb-2">Public ID</Label>
			<Input
				type="text"
				class="cursor-pointer"
				readonly
				value={npub}
				on:click={async () => {
					await navigator.clipboard.writeText(npub ?? '');

					copiedPubkey = true;

					setTimeout(() => (copiedPubkey = false), 3000);
				}}
			/>
		</div>
		<Toast
			class="m-3 w-max rounded-lg dark:bg-slate-700"
			dismissable={false}
			bind:toastStatus={copiedPubkey}
			transition={slide}
		>
			Copied public ID to clipboard.
		</Toast>

		<div>
			<Label class="mb-2">Secret key</Label>
			<Input
				type="text"
				class="cursor-pointer"
				readonly
				value={nsec}
				on:click={async () => {
					await navigator.clipboard.writeText(nsec ?? '');

					copiedPrivkey = true;

					setTimeout(() => (copiedPrivkey = false), 3000);
				}}
			/>
		</div>
		<Toast
			class="m-3 w-max rounded-lg dark:bg-slate-700"
			dismissable={false}
			bind:toastStatus={copiedPrivkey}
			transition={slide}
		>
			Copied secret key to clipboard.
		</Toast>
	</div>

	<Checkbox bind:checked={hasStoredKey} spacing="me-4">
		I've stored my secret key in a safe and private place
	</Checkbox>

	<a href={npubParam ? `/rate${urlParams}` : '/'}>
		<Button disabled={!hasStoredKey} on:click={() => nostrAuth.loginWithPrivkey(privateKeyStr)}>
			Continue
		</Button>
	</a>
</div>
