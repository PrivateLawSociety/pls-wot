<script lang="ts">
	import { goto } from '$app/navigation';
	import { nostrAuth } from '$lib/nostr';
	import { Button, P } from 'flowbite-svelte';

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
			alert('You haven\'t allowed Alby to connect with the app');
		}
	}
</script>


<div class="flex w-full h-full flex-col items-center justify-center gap-4 text-lg">
	<div class="flex flex-col gap-4 bg-gray-200 px-6 py-4 rounded-xl shadow-sm">
		<div class="flex justify-center mb-2">
			<P size="2xl" weight="semibold" color="none" class="text-black">PLS Identity Login</P>
		</div>

		<Button href={`/login/new${urlParams}`} color="none"
						class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48"
		>
			New
		</Button>

		<Button href={`/login/import${urlParams}`} color="none"
						class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
			Import / Recover
		</Button>

		{#if window.nostr}
			<Button on:click={useAlby} color="none" class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
				Use Alby
			</Button>
		{/if}
	</div>
</div>
