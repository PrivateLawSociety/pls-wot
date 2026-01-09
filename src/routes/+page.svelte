<script>
	import LoginPerson from '$lib/components/LoginPerson.svelte';
	import { Button } from 'flowbite-svelte';
	import { nostrAuth } from '$lib/nostr';
	import Header from '$lib/components/Header.svelte';
</script>

<Header />
<div class="flex h-full flex-col items-center justify-center gap-4 text-lg ">
	<div class="flex flex-col gap-4 bg-gray-200 px-6 py-4 rounded-xl shadow-sm">
		{#if $nostrAuth?.pubkey}
			<a href="/keys">
				<LoginPerson divClass="text-black" pubkey={$nostrAuth.pubkey} />
			</a>
			<Button href="/rate" color="none" class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
				Give rating
			</Button>
		{:else}
			<LoginPerson pubkey="" divClass="text-black" size={20} />
			<Button href="/login" color="none" class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
				Login
			</Button>
		{/if}
		<Button href="/graph" color="none" class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
			View graph
		</Button>
		<Button href="/table" color="none" class="text-black hover:bg-wot_blue-100 hover:text-white md:w-64 w-48">
			Ratings table
		</Button>
	</div>
</div>
