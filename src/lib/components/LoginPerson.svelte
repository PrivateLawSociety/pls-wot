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

		profileMetadata = parseProfileFromJsonString(event?.content || '{}', {
			npub: npubEncode(pubkey),
			pubkey: pubkey
		});
		username = profileMetadata.name ?? 'No name';
	}

	$: loadProfile(pubkey);
</script>

<div class="flex flex-col items-center justify-center {divClass}">
	<ProfileAvatar source={profileMetadata?.picture} alt={username} size={20} />
	{#if !hideName}
		<p title={username} class="line-clamp-2 w-20 break-words text-center">{username}</p>
	{/if}
</div>
