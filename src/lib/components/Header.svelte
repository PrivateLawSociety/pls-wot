<script lang="ts">
	import { getProfileMetadata, parseProfileFromJsonString, type ProfileType } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import { nostrAuth } from '$lib/nostr';

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

<div class="flex w-full justify-center p-5">
	<div class="flex w-3/4 items-center">
		<div class="w-full flex-col">
			<a href="/">
				<button
					type="button"
					class="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white transition-colors hover:bg-orange-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
				>
					Back to home
				</button>
			</a>
		</div>

		{#if $nostrAuth?.pubkey}
		<div class="relative">
			<a
				href="/keys"
				class="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-gray-700/50"
			>
			<div class="flex items-center gap-4 px-2 relative">
					<div class="w-10">
						<ProfileAvatar source={profileMetadata?.picture} alt={username} />
					</div>
					<div class="font-medium text-white">
						<div>{username || ''}</div>
						<div class="group relative">
							<span class="block max-w-24 text-sm text-gray-400">
								{`${profileMetadata?.npub.slice(0, 5)}...${profileMetadata?.npub.slice(-5)}`}
							</span>

							<span
								class="absolute right-0 top-full z-10 hidden whitespace-nowrap rounded-md border border-white bg-gray-800 p-2 text-sm text-white group-hover:block"
							>
								{profileMetadata?.npub}
							</span>
						</div>
					</div>
				</div>
			</a>
		</div>
		{/if}
	</div>
</div>
