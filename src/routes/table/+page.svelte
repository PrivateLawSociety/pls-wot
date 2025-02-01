<script lang="ts">
	import { ReviewEvent } from '$lib';
	import { getProfileMetadata, relayList, relayPool } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import ZapModal from '$lib/components/ZapModal.svelte';
	import ProfileAvatar from '$lib/components/ProfileAvatar.svelte';

	let ZapModalComponent: ZapModal;

	let defaultPicture: HTMLDivElement;

	type profileType = {
		npub: string;
		name?: string;
		picture?: string;
		banner?: string;
		about?: string;
		nip05?: string;
		website?: string;
		lud16?: string;
		pubkey: string;
		display_name?: string;
		displayName?: string;
	};

	let ratings: {
		eventId: string;
		from: profileType;
		to: string;
		date: number;
		score: boolean;
		businessAlreadyDone: boolean;
		description: string;
	}[] = [];

	$: ratings.sort((a, b) => b.date - a.date);

	onMount(() => {
		relayPool.subscribeMany(
			relayList,
			[
				{
					kinds: [ReviewEvent],
					'#l': ['pls-wot-rating']
				}
			],
			{
				onevent(e) {
					try {
						const c = JSON.parse(e.content);

						const from: profileType = {
							npub: npubEncode(c.from),
							pubkey: c.from
						};

						getProfileMetadata(c.from)
							.then((event) => {
								const metadata = JSON.parse(event?.content || '');

								from.name = metadata?.name || '';
								from.picture = metadata?.picture || '';
								from.banner = metadata?.banner || '';
								from.about = metadata?.about || '';
								from.nip05 = metadata?.nip05 || '';
								from.website = metadata?.website || '';
								from.lud16 = metadata?.lud16 || '';
								from.display_name = metadata?.display_name || '';
								from.displayName = metadata?.displayName || '';
							})
							.finally(() => {
								ratings = [
									...ratings,
									{
										eventId: e.id,
										from: from,
										to: npubEncode(c.to),
										date: e.created_at * 1000,
										score: c.score,
										businessAlreadyDone: c.businessAlreadyDone,
										description: c.description
									}
								];
							});
					} catch {}
				}
			}
		);
	});
</script>

<ZapModal bind:this={ZapModalComponent} />

<div class="flex flex-col items-center gap-8">
	<h1 class="text-2xl font-bold">Ratings table (Currently using replaceable events)</h1>

	<table>
		<tr>
			<th>Rater Nostr Key</th>
			<th>Rated Nostr Key</th>
			<th>Date</th>
			<th>Rating</th>
			<th>Had <br /> business</th>
			<th>Description</th>
			<th>Zap</th>
		</tr>
		{#each ratings as rating}
			<tr>
				<td>
					<div class="flex items-center gap-4 px-2">
						<ProfileAvatar source={rating.from.picture} />

						<div class="font-medium text-white">
							{#if rating.from.display_name}
								<div>{rating.from.display_name}</div>
							{/if}

							<div class="group relative">
								<span class="block max-w-24 text-sm text-gray-400">
									{`${rating.from.npub.slice(0, 5)}...${rating.from.npub.slice(-5)}`}
								</span>

								<span
									class="absolute left-0 top-full z-10 hidden whitespace-nowrap rounded-md border border-white bg-gray-800 p-2 text-sm text-white group-hover:block"
								>
									{rating.from.npub}
								</span>
							</div>
						</div>
					</div>
				</td>
				<td>{rating.to}</td>
				<td>
					{new Date(rating.date).toLocaleDateString()}
					<br />
					{new Date(rating.date).toLocaleTimeString()}
				</td>
				<td>{rating.score ? '👍' : '👎'}</td>
				<td>{rating.businessAlreadyDone ? '👍' : '👎'}</td>
				<td>{rating.description}</td>
				<td>
					{#if rating.from.lud16}
						<div class="p-2">
							<button
								type="button"
								class="rounded-lg p-2.5 text-sm text-orange-500 transition-colors hover:bg-orange-600 hover:text-white focus:ring-2 focus:ring-orange-300"
								on:click={() => ZapModalComponent.openModal(rating.from.npub, rating.eventId)}
							>
								Send Zap
							</button>
						</div>
					{/if}
				</td>
			</tr>
		{/each}
	</table>
</div>

<style>
	table,
	th,
	td {
		border: 1px solid;
	}

	td {
		text-align: center;
	}

	table {
		width: 80%;
	}
</style>
