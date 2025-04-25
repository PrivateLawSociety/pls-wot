<script lang="ts">
	import { goto } from '$app/navigation';
	import { nostrAuth } from '$lib/nostr';
	import { P, Button } from 'flowbite-svelte';

	import { page } from '$app/state';
	const npub = page.url.searchParams.get('npub');
	const urlParams = npub ? `?npub=${npub}` : '';

	async function useAlby() {
		try {
			await window.nostr!.getPublicKey();

			await nostrAuth.tryLogin();

			if (npub) {
				return goto(`/rate${urlParams}`);
			}

			goto('/');
		} catch (error) {
			alert("You haven't allowed Alby to connect with the app");
		}
	}
</script>

<div class="flex h-full flex-col justify-center gap-4 p-4">
	<div class="flex justify-center">
		<P size="4xl" weight="normal">PLS Identity Login</P>
	</div>

	<div class="flex h-full flex-col items-center justify-center gap-4">
		<a href={`/login/new${urlParams}`}>
			<Button class="w-48 md:w-64">New</Button>
		</a>
		<a href={`/login/import${urlParams}`}>
			<Button class="w-48 md:w-64">Import / Recover</Button>
		</a>
		{#if window.nostr}
			<Button class="w-48 md:w-64" on:click={useAlby}>Use Alby</Button>
		{/if}
	</div>
</div>
