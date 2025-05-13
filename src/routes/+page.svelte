<script>
	import LoginPerson from "$lib/components/LoginPerson.svelte";
	import { Button, P } from "flowbite-svelte";
	import { nostrAuth } from "$lib/nostr";
</script>

<div class="flex flex-col h-full justify-center items-center gap-4 p-4">
	<div class="flex justify-center flex-col">
		<P size="4xl" weight="normal">PLS Web Of Trust</P>
	</div>
	{#if $nostrAuth?.pubkey}
		<a href="/keys">
			<LoginPerson pubkey={$nostrAuth.pubkey} />
		</a>
		<a href="/rate">
			<Button class="w-48 m:w-48">Give rating</Button>
		</a>
		<a href="/graph">
			<Button class="w-48 m:w-48">View your graph</Button>
		</a>
	{:else}
		<a href="/login">
			<Button class="w-48 m:w-64">Login</Button>
		</a>
	{/if}
	<a href="/table">
		<Button class="w-48 m:w-64">Ratings table</Button>
	</a>
</div>
