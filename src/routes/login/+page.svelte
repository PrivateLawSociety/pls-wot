<script lang="ts">
	import { goto } from '$app/navigation';
	import { nostrAuth } from '$lib/nostr';
	import { P, Button } from 'flowbite-svelte';

	async function useAlby() {
		try {
			await window.nostr!.getPublicKey();

			await nostrAuth.tryLogin();
			goto('/');
		} catch (error) {
			alert("You haven't allowed Alby to connect with the app");
		}
	}
</script>

<div class="flex flex-col justify-center h-full gap-4 p-4">
	<div class="flex justify-center">
		<P size="4xl" weight="normal">PLS Identity Login</P>
	</div>

	<div class="flex flex-col justify-center items-center h-full gap-4">
		<a href="/login/new">
			<Button class="w-48 md:w-64">New</Button>
		</a>
		<a href="/login/import">
			<Button class="w-48 md:w-64">Import / Recover</Button>
		</a>
		{#if window.nostr}
			<Button class="w-48 md:w-64" on:click={useAlby}>Use Alby</Button>
		{/if}
	</div>
</div>
