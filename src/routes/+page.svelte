<script>
	import LoginPerson from '$lib/components/LoginPerson.svelte';
	import { Button, P } from 'flowbite-svelte';
	import { nostrAuth } from '$lib/nostr';
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-4">
	<div class="flex flex-col justify-center">
		<P size="4xl" weight="normal">PLS Web Of Trust</P>
	</div>
	{#if $nostrAuth?.pubkey}
		<a href="/keys">
			<LoginPerson pubkey={$nostrAuth.pubkey} />
		</a>
		<a href="/rate">
			<Button class="m:w-48 w-48">Give rating</Button>
		</a>
	{:else}
		<a href="/login">
			<Button class="m:w-64 w-48">Login</Button>
		</a>
		<a href="/graph">
			<Button class="m:w-48 w-48">View graph</Button>
		</a>
	{/if}
	<a href="/table">
		<Button class="m:w-64 w-48">Ratings table</Button>
	</a>
</div>
