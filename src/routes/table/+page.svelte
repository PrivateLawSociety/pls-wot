<script lang="ts">
	import { ReviewEvent } from '$lib';
	import { relayList, relayPool } from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import ZapModal from '$lib/components/ZapModal.svelte';

	let ZapModalComponent: ZapModal;

	interface Rating {
		eventId: string;
		from: string;
		to: string;
		date: number;
		score: boolean;
		businessAlreadyDone: boolean;
		description: string;
	}

	let ratings: Rating[] = [];

	let filterRating: string = 'all';
	let filterBusiness: string = 'all';
	let filterFrom: string = '';
	let filterTo: string = '';

	$: filteredRatings = ratings.filter((rating) => {
		let ratingMatch = true;
		if (filterRating === 'positive') {
			ratingMatch = rating.score === true;
		} else if (filterRating === 'negative') {
			ratingMatch = rating.score === false;
		}

		let businessMatch = true;
		if (filterBusiness === 'yes') {
			businessMatch = rating.businessAlreadyDone === true;
		} else if (filterBusiness === 'no') {
			businessMatch = rating.businessAlreadyDone === false;
		}

		let fromMatch = true;
		if (filterFrom.trim() !== '') {
			fromMatch = rating.from.toLowerCase().includes(filterFrom.toLowerCase());
		}

		let toMatch = true;
		if (filterTo.trim() !== '') {
			toMatch = rating.to.toLowerCase().includes(filterTo.toLowerCase());
		}

		return ratingMatch && businessMatch && fromMatch && toMatch;
	});

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
						const newRating: Rating = {
							eventId: e.id,
							from: npubEncode(c.from),
							to: npubEncode(c.to),
							date: e.created_at * 1000,
							score: c.score,
							businessAlreadyDone: c.businessAlreadyDone,
							description: c.description
						};

						if (ratings.find((r) => r.from === newRating.from && r.to === newRating.to)) {
							ratings = ratings.filter(
								(r) => !(r.from === newRating.from && r.to === newRating.to)
							);
						}

						ratings = [...ratings, newRating];
					} catch (error) {
						console.error('Error processing the event:', error);
					}
				}
			}
		);
	});
</script>

<ZapModal bind:this={ZapModalComponent} />

<div class="flex flex-col items-center gap-8">
	<h1 class="text-2xl font-bold">Ratings table (Currently using replaceable events)</h1>

	<div class="flex w-full flex-wrap justify-center gap-4">
		<div class="flex flex-col">
			<label for="filterRating" class="font-semibold">Filter by Rating:</label>
			<select
				id="filterRating"
				bind:value={filterRating}
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="all" class="text-black">All</option>
				<option value="positive" class="text-black">Positive (👍)</option>
				<option value="negative" class="text-black">Negative (👎)</option>
			</select>
		</div>

		<div class="flex flex-col">
			<label for="filterBusiness" class="font-semibold">Filter by Had Business:</label>
			<select
				id="filterBusiness"
				bind:value={filterBusiness}
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="all" class="text-black">All</option>
				<option value="yes" class="text-black">Yes (👍)</option>
				<option value="no" class="text-black">No (👎)</option>
			</select>
		</div>

		<div class="flex flex-col">
			<label for="filterFrom" class="font-semibold">Filter by Who Rated:</label>
			<input
				id="filterFrom"
				bind:value={filterFrom}
				placeholder="Enter Rater Key"
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex flex-col">
			<label for="filterTo" class="font-semibold">Filter by Who Was Rated:</label>
			<input
				id="filterTo"
				bind:value={filterTo}
				placeholder="Enter Rated Key"
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>
	</div>

	<table class="w-3/4">
		<thead>
			<tr>
				<th>Rater Nostr Key</th>
				<th>Rated Nostr Key</th>
				<th>Date</th>
				<th>Rating</th>
				<th>Had <br /> business</th>
				<th>Description</th>
				<th>Zap</th>
			</tr>
		</thead>
		<tbody>
			{#each filteredRatings as rating}
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
							on:click={() => ZapModalComponent.openModal(rating.from, rating.eventId)}
						>
							Send Zap
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style lang="postcss">
	table,
	th,
	td {
		@apply border;
	}

	td {
		@apply text-center;
	}
</style>
