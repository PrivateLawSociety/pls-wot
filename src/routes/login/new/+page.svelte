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

<div class="flex h-full w-full items-center justify-center p-4">
	<div class="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
		<div class="mb-8 flex justify-center">
			<P align="center" size="4xl" weight="normal" class="text-gray-900" color="none">Generated PLS Identity</P>
		</div>

		<div class="flex w-full flex-col items-center justify-center gap-6">
			<div class="w-full max-w-xl">
				<Label class="mb-2 text-gray-900" color="none">Public ID:</Label>
				<Input
					type="text"
					color="none"
					defaultClass="w-full cursor-pointer border-2 border-wot_blue-100 bg-white text-gray-900"
					readonly
					value={npub}
					on:click={async () => {
						await navigator.clipboard.writeText(npub ?? '');

						copiedPubkey = true;

						setTimeout(() => (copiedPubkey = false), 3000);
					}}
				/>
				<p class="mt-1 text-xs text-gray-500">
					This is your public identifier. You can share it with others.
				</p>
			</div>
			<Toast
				class="m-3 w-max rounded-lg border border-green-200 bg-green-50 text-green-700"
				dismissable={false}
				bind:toastStatus={copiedPubkey}
				transition={slide}
			>
				Copied public ID to clipboard.
			</Toast>

			<div class="w-full max-w-xl">
				<Label class="mb-2 text-gray-900" color="none">Secret key:</Label>
				<Input
					type="text"
					color="none"
					defaultClass="w-full cursor-pointer border-2 border-wot_blue-100 bg-white text-gray-900"
					readonly
					value={nsec}
					on:click={async () => {
						await navigator.clipboard.writeText(nsec ?? '');

						copiedPrivkey = true;

						setTimeout(() => (copiedPrivkey = false), 3000);
					}}
				/>
				<p class="mt-1 text-xs font-semibold text-red-600">
					⚠️ Keep this private! Anyone with this key can control your identity.
				</p>
			</div>
			<Toast
				class="m-3 w-max rounded-lg border border-green-200 bg-green-50 text-green-700"
				dismissable={false}
				bind:toastStatus={copiedPrivkey}
				transition={slide}
			>
				✓ Copied secret key to clipboard.
			</Toast>
		</div>

		<div class="mt-8 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
			<div class="flex items-start gap-3">
				<span class="text-2xl">⚠️</span>
				<div class="flex-1">
					<h3 class="font-semibold text-gray-900">Important Security Notice</h3>
					<ul class="mt-2 space-y-1 text-sm text-gray-700">
						<li>- Save your secret key in a secure location</li>
						<li>- Never share your secret key with anyone</li>
						<li>- There is no way to recover your secret key if you lose it</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- TODO: improve checkbox styles -->
		<div class="mt-6 flex items-center justify-center">
			<Label class="flex items-center text-gray-900" color="none">
				<Checkbox bind:checked={hasStoredKey} spacing="me-4" class="text-wot_blue-100" />
				I've stored my secret key in a safe and private place
			</Label>
		</div>

		<div class="mt-6 flex flex-col items-center gap-4">
			<a href={npubParam ? `/rate${urlParams}` : '/'} class="w-full max-w-xl">
				<Button
					disabled={!hasStoredKey}
					on:click={() => nostrAuth.loginWithPrivkey(privateKeyStr)}
					color="none"
					class="w-full border border-wot_blue-100 bg-wot_blue-100 text-white hover:bg-wot_blue-200 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Continue
				</Button>
			</a>

			<a href="/login" class="text-sm text-wot_blue-100 hover:text-wot_blue-200">
				← Back to login options
			</a>
		</div>
	</div>
</div>
