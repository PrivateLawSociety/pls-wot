<script lang="ts">
	import { nostrAuth } from '$lib/nostr';
	import { Button, Input, Label } from 'flowbite-svelte';
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

<div class="flex h-full w-full items-center justify-center p-4">
	<div class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
		<div class="mb-6 text-center">
			<h1 class="text-3xl font-bold text-gray-900">Import PLS Identity</h1>
			<p class="mt-2 text-sm text-gray-600">Enter your secret key to import your identity</p>
		</div>

		<div class="space-y-6">
			<div class="flex flex-col gap-2">
				<Label class="pb-1 text-gray-900" color="none">Secret key:</Label>
				<Input
					type="password"
					placeholder="nsec1..."
					bind:value={nsecInput}
					color="none"
					defaultClass="border-2 border-wot_blue-100 bg-white text-gray-900 placeholder-gray-400 focus:border-wot_blue-200 focus:ring-wot_blue-100"
				/>
				{#if nsecInput && !secretKeyStr}
					<p class="text-sm text-red-500">Invalid secret key format. Please use nsec format.</p>
				{/if}
				{#if secretKeyStr}
					<p class="text-sm font-semibold text-wot_blue-100">Valid secret key detected</p>
				{/if}
			</div>

			<Button
				disabled={secretKeyStr === null}
				href={npubParam ? `/rate${urlParams}` : '/'}
				on:click={() => {
					if (secretKeyStr) nostrAuth.loginWithPrivkey(secretKeyStr);
				}}
				color="none"
				class="w-full border border-wot_blue-100 bg-wot_blue-100 text-white hover:bg-wot_blue-200 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Continue
			</Button>

			<div class="text-center">
				<a href="/login" class="text-sm text-wot_blue-100 hover:text-wot_blue-200">
					← Back to login options
				</a>
			</div>
		</div>
	</div>
</div>
