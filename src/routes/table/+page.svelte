<script lang="ts">
	import { ReviewEvent } from "$lib";
	import { relayList, relayPool } from "$lib/nostr";
	import { npubEncode } from "nostr-tools/nip19";
	import { onMount } from "svelte";

	interface Rating {
		from: string;
		to: string;
		date: number;
		score: boolean;
		businessAlreadyDone: boolean;
		description: string;
	}

	let ratings: Rating[] = [];

	let filterRating: string = "all";
	let filterBusiness: string = "all";

	$: filteredRatings = ratings.filter(rating => {
		let ratingMatch = true;
		if (filterRating === "positive") {
			ratingMatch = rating.score === true;
		} else if (filterRating === "negative") {
			ratingMatch = rating.score === false;
		}

		let businessMatch = true;
		if (filterBusiness === "yes") {
			businessMatch = rating.businessAlreadyDone === true;
		} else if (filterBusiness === "no") {
			businessMatch = rating.businessAlreadyDone === false;
		}

		return ratingMatch && businessMatch;
	});

	$: ratings.sort((a, b) => b.date - a.date);

	onMount(() => {
		relayPool.subscribeMany(
			relayList,
			[
				{
					kinds: [ReviewEvent],
					"#l": ["pls-wot-rating"],
				},
			],
			{
				onevent(e) {
					try {
						const c = JSON.parse(e.content);
						const newRating: Rating = {
							from: npubEncode(c.from),
							to: npubEncode(c.to),
							date: e.created_at * 1000,
							score: c.score,
							businessAlreadyDone: c.businessAlreadyDone,
							description: c.description,
						};

						const existingIndex = ratings.findIndex(
							(r) => r.from === newRating.from && r.to === newRating.to
						);

						if (existingIndex !== -1) {
							ratings = [
								...ratings.slice(0, existingIndex),
								newRating,
								...ratings.slice(existingIndex + 1),
							];
						} else {
							ratings = [...ratings, newRating];
						}
					} catch (error) {
						console.error("Error processing the event:", error);
					}
				},
			}
		);
	});
</script>

<div class="flex flex-col items-center gap-8 p-4">
	<h1 class="text-2xl font-bold">Ratings table (Currently using replaceable events)</h1>

	<div class="flex flex-wrap justify-center gap-4 w-full">

		<div class="flex flex-col">
			<label for="filterRating" class="font-semibold mb-1">Filter by Rating:</label>
			<select
				id="filterRating"
				bind:value={filterRating}
				class="px-2 py-1 rounded border border-gray-300
         bg-white text-black
         focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
			>
				<option value="all" class="text-black">All</option>
				<option value="positive" class="text-black">Yes (👍)</option>
				<option value="negative" class="text-black">No (👎)</option>
			</select>
		</div>

		<div class="flex flex-col">
			<label for="filterBusiness" class="font-semibold mb-1">Filter by Had Business:</label>
			<select
				id="filterBusiness"
				bind:value={filterBusiness}
				class="px-2 py-1 rounded border border-gray-300
         bg-white text-black
         focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
			>
				<option value="all" class="text-black">All</option>
				<option value="yes" class="text-black">Yes (👍)</option>
				<option value="no" class="text-black">No (👎)</option>
			</select>
		</div>

	</div>

	<div class="overflow-x-auto w-full">
		<table>
			<thead>

			<tr>
				<th>Rater Nostr Key</th>
				<th>Rated Nostr Key</th>
				<th>Date</th>
				<th>Rating</th>
				<th>Had <br /> business</th>
				<th>Description</th>
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
					<td>{rating.score ? "👍" : "👎"}</td>
					<td>{rating.businessAlreadyDone ? "👍" : "👎"}</td>
					<td>{rating.description}</td>
				</tr>
			{/each}
			</tbody>

		</table>
	</div>
</div>

<style>
    table, th, td {
        border: 1px solid;
    }

    td {
        text-align: center;
    }

    table {
        width: 80%;
        margin: 0 auto;
    }
</style>