<script lang="ts">
	import { ReviewEvent } from '$lib';
	import { relayList, relayPool } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import ZapModal from '$lib/components/ZapModal.svelte';

	let ZapModalComponent: ZapModal;

	let ratings: {
		from: string;
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
						ratings = [
							...ratings,
							{
								from: npubEncode(c.from),
								to: npubEncode(c.to),
								date: e.created_at * 1000,
								score: c.score,
								businessAlreadyDone: c.businessAlreadyDone,
								description: c.description
							}
						];
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
				<td>{rating.from}</td>
				<td>{rating.to}</td>
				<td>
					{new Date(rating.date).toLocaleDateString()}
					<br />
					{new Date(rating.date).toLocaleTimeString()}
				</td>
				<td>{rating.score ? '👍' : '👎'}</td>
				<td>{rating.businessAlreadyDone ? '👍' : '👎'}</td>
				<td>{rating.description}</td>
				<td class="p-2">
					<button
						type="button"
						class="rounded-lg p-2.5 text-sm text-orange-500 transition-colors hover:bg-orange-600 hover:text-white focus:ring-2 focus:ring-orange-300"
						on:click={() => ZapModalComponent.openModal(rating.from)}
					>
						Send Zap
					</button>
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
