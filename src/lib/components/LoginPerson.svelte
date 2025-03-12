<script lang="ts">
	import { getProfileMetadata, parseProfileFromJsonString, type ProfileType } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import ProfileAvatar from './ProfileAvatar.svelte';

	export let pubkey: string;
	export let hideName = false;
	export let divClass = '';

	let profileMetadata: ProfileType | undefined = undefined;

	let username = 'No name';

	async function loadProfile(pubkey: string) {
		if (!pubkey) return;

		const event = await getProfileMetadata(pubkey);

		if (!event) return;
		if (!pubkey) return;

		profileMetadata = parseProfileFromJsonString(event?.content || '{}', { npub: npubEncode(pubkey), pubkey: pubkey });
		username = profileMetadata.name ?? 'No name';
	}

	$: loadProfile(pubkey);
</script>

<div class="flex flex-col justify-center items-center {divClass}">
	<ProfileAvatar
		source={profileMetadata?.picture}
		alt={username}
		size={20}
	/>
	{#if !hideName}
		<p title={username} class="text-center w-20 line-clamp-2 break-words">{username}</p>
	{/if}
</div>
