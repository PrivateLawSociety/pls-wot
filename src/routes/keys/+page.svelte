<script lang="ts">
	import { goto } from '$app/navigation';
	import { nostrAuth } from '$lib/nostr';
	import { Button } from 'flowbite-svelte';
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';

	import { page } from '$app/state';

	onMount(() => {
		if (window.nostr) nostrAuth.tryLogin();
	});
</script>

<div class="flex h-screen w-full flex-col items-center justify-center gap-4">
	{#if !$nostrAuth?.privkey && $nostrAuth?.pubkey}
		<h1 class="text-center text-3xl">Logged in with nostr browser extension</h1>
	{/if}

	{#if $nostrAuth?.pubkey}
		<p class="break-all px-2 text-center">
			Your public ID: <br />
			{nip19.npubEncode($nostrAuth?.pubkey)}
		</p>

		<Button
			on:click={async () => {
				try {
					await navigator.clipboard.writeText(
						`${page.url.origin}/rate?npub=${nip19.npubEncode($nostrAuth?.pubkey)}`
					);
					alert('URL Copied!');
				} catch (error) {
					console.error('Failed to copy share URL:', error);
				}
			}}
		>
			Copy rate url
		</Button>

		<Button
			on:click={() => {
				nostrAuth.signOut();
				goto('/');
			}}
		>
			Sign out
		</Button>
	{/if}
</div>
