<script lang="ts">
	import { getProfileMetadata, nostrAuth, parseProfileFromJsonString, type ProfileType } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import LoginPerson from '$lib/components/LoginPerson.svelte';

	let pubkey = $nostrAuth?.pubkey ?? '';
	let username = '';

	let profileMetadata: ProfileType | undefined = undefined;

	async function loadProfile(pubkey: string) {
		if (!pubkey) return;

		const event = await getProfileMetadata(pubkey);

		if (!event) return;
		if (!pubkey) return;

		profileMetadata = parseProfileFromJsonString(event?.content || '{}', {
			npub: npubEncode(pubkey),
			pubkey: pubkey
		});
		username = profileMetadata.name ?? 'No name';
	}

	if ($nostrAuth?.pubkey) {
		loadProfile(pubkey);
	}
</script>

<div class="flex w-full justify-between items-center px-10 py-3 bg-wot_blue-100 text-lg">
	<a href="/">
		<img src="logo.svg" alt="PLS Web Of Trust Logo" class="w-lg cursor-pointer" />
	</a>

	<p class="text-[2rem] text-bold">WoT</p>

	<span class="flex items-center justify-around gap-6 w-100">
		<a href="/" class="cursor-pointer hover:underline underline-offset-2">Home</a>
		<a href="/guides" class="cursor-pointer hover:underline underline-offset-2">Guides</a>
		<!--{#if $nostrAuth?.pubkey}-->
			<LoginPerson pubkey={$nostrAuth?.pubkey} hideName />
		<!--{/if}-->
	</span>
</div>