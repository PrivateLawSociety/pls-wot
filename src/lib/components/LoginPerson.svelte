<script lang="ts">
	import { getProfileMetadata, parseProfileFromJsonString, type ProfileType } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import ProfileAvatar from './ProfileAvatar.svelte';

	export let pubkey: string;
	export let hideName = false;
	export let divClass = '';
	export let size = 14;

	let profileMetadata: ProfileType | undefined = undefined;

	let username = 'Not logged in';

	async function loadProfile(pubkey: string) {
		if (!pubkey) return;

		const event = await getProfileMetadata(pubkey);

		if (!event) return;
		if (!pubkey) return;

		profileMetadata = parseProfileFromJsonString(event?.content || '{}', {
			npub: npubEncode(pubkey),
			pubkey: pubkey
		});
		username = profileMetadata.name ?? 'Not logged in';
	}

	$: loadProfile(pubkey);
</script>

<a href="/keys" class="flex flex-col items-center justify-center {divClass}">
	<ProfileAvatar source={profileMetadata?.picture} alt={username} size={size} />
	{#if !hideName}
		<p title={username} class="w-20 break-words text-center mt-2">{username}</p>
	{/if}
</a>
