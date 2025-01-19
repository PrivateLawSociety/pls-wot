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

	let filterFrom: string = "";
	let filterTo: string = "";

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

		let fromMatch = true;
		if (filterFrom.trim() !== "") {
			fromMatch = rating.from.toLowerCase().includes(filterFrom.toLowerCase());
		}

		let toMatch = true;
		if (filterTo.trim() !== "") {
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
			<label for="filterRating" class="font-semibold">Filter by Rating:</label>
			<select id="filterRating" bind:value={filterRating} class="custom-select">
				<option value="all">All</option>
				<option value="positive">Positive (👍)</option>
				<option value="negative">Negative (👎)</option>
			</select>
		</div>

		<div class="flex flex-col">
			<label for="filterBusiness" class="font-semibold">Filter by Had Business:</label>
			<select id="filterBusiness" bind:value={filterBusiness} class="custom-select">
				<option value="all">All</option>
				<option value="yes">Yes (👍)</option>
				<option value="no">No (👎)</option>
			</select>
		</div>

		<div class="flex flex-col">
			<label for="filterFrom" class="font-semibold">Filter by Who Rated:</label>
			<input id="filterFrom" bind:value={filterFrom} placeholder="Enter Rater Key" class="custom-input" />
		</div>

		<div class="flex flex-col">
			<label for="filterTo" class="font-semibold">Filter by Who Was Rated:</label>
			<input id="filterTo" bind:value={filterTo} placeholder="Enter Rated Key" class="custom-input" />
		</div>
	</div>

	<table class="mt-4">
		<thead>
		<tr>
			<th>Rater Nostr Key</th>
			<th>Rated Nostr Key</th>
			<th>Date</th>
			<th>Rating</th>
			<th>Had <br> business</th>
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

<style>
    table,
    th,
    td {
        border: 1px solid;
    }

    td {
        text-align: center;
        padding: 8px;
    }

    table {
        width: 80%;
        border-collapse: collapse;
    }

    select.custom-select {
        border-radius: 1px;
        padding: 8px;
        background-color: #f0f4f8;
        color: #333;
        border: 1px solid #ccc;
    }

    select.custom-select:hover {
        background-color: #e0e7ef;
        border-color: #999;
    }

    select.custom-select:focus {
        outline: none;
        background-color: #d0dae8;
        border-color: #666;
    }

    select.custom-select option {
        background-color: #f0f4f8;
        color: #333;
    }

    input.custom-input {
        border-radius: 1px;
        padding: 8px;
        background-color: #f0f4f8;
        color: #333;
        border: 1px solid #ccc;
    }

    input.custom-input:hover {
        background-color: #e0e7ef;
        border-color: #999;
    }

    input.custom-input:focus {
        outline: none;
        background-color: #d0dae8;
        border-color: #666;
    }
</style>
