<script lang="ts">
	import { ReviewEvent } from '$lib';
	import {
		getProfileMetadata,
		nostrAuth,
		parseProfileFromJsonString,
		relayList,
		relayPool,
		type ProfileType
	} from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import ZapModal from '$lib/components/ZapModal.svelte';
	import ProfileAvatar from '$lib/components/ProfileAvatar.svelte';
	import { Input, Select } from 'flowbite-svelte';

	let ZapModalComponent: ZapModal;

	interface Rating {
		eventId: string;
		from: ProfileType;
		to: ProfileType;
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
			fromMatch = rating.from.npub.toLowerCase().includes(filterFrom.toLowerCase());
		}

		let toMatch = true;
		if (filterTo.trim() !== '') {
			toMatch = rating.to.npub.toLowerCase().includes(filterTo.toLowerCase());
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

						const from: ProfileType = {
							npub: npubEncode(c.from),
							pubkey: c.from
						};

						const to: ProfileType = {
							npub: npubEncode(c.to),
							pubkey: c.to
						};

						const newRating: Rating = {
							eventId: e.id,
							from: from,
							to: to,
							date: e.created_at * 1000,
							score: c.score,
							businessAlreadyDone: c.businessAlreadyDone,
							description: c.description
						};

						ratings = ratings.filter((r) => !(r.eventId === newRating.eventId));

						ratings = [...ratings, newRating];

						Promise.all([getProfileMetadata(c.from), getProfileMetadata(c.to)])
							.then(([fromEvent, toEvent]) => {
								Object.assign(from, parseProfileFromJsonString(fromEvent?.content || '{}', from));

								Object.assign(to, parseProfileFromJsonString(toEvent?.content || '{}', to));
							})
							.catch((error) => {
								console.error('Error when processing the profile metadata:', error);
							})
							.finally(() => {
								const ratingIndex = ratings.findIndex((r) => r.eventId === newRating.eventId);
								ratings[ratingIndex] = newRating;
							});
					} catch (error) {
						console.error('Error processing the event:', error);
					}
				}
			}
		);
	});

	const download = (filename: string, text: any) => {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	};

	const handleDownload = (myRatings: boolean = false) => {
		if (myRatings) {
			if (!$nostrAuth?.pubkey) {
				alert('You must be logged');
				return;
			}

			let allMyRatings = ratings.filter(
				(r) => r.from.pubkey === $nostrAuth?.pubkey || r.to.pubkey === $nostrAuth?.pubkey
			);

			return download('ratings.json', JSON.stringify(allMyRatings, null, '\t'));
		}

		return download('ratings.json', JSON.stringify(filteredRatings, null, '\t'));
	};
</script>

<ZapModal bind:this={ZapModalComponent} />

<div class="flex flex-col items-center gap-8">
	<h1 class="text-2xl font-bold">Ratings table (Currently using replaceable events)</h1>

	<div class="flex w-full flex-wrap justify-center gap-4">
		<div class="flex flex-col">
			<label for="filterRating" class="font-semibold">Filter by Rating:</label>
			<Select
				id="filterRating"
				bind:value={filterRating}
				items={[
					{ value: 'all', name: 'All' },
					{ value: 'positive', name: '✅ Positive' },
					{ value: 'negative', name: '❌ Negative' }
				]}
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex flex-col">
			<label for="filterBusiness" class="font-semibold">Filter by Had Business:</label>
			<Select
				id="filterBusiness"
				bind:value={filterBusiness}
				items={[
					{ value: 'all', name: 'All' },
					{ value: 'yes', name: '✅ Yes' },
					{ value: 'no', name: 'No' }
				]}
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex flex-col">
			<label for="filterFrom" class="font-semibold">Filter by Who Rated:</label>
			<Input
				id="filterFrom"
				bind:value={filterFrom}
				placeholder="Enter Rater Key"
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex flex-col">
			<label for="filterTo" class="font-semibold">Filter by Who Was Rated:</label>
			<Input
				id="filterTo"
				bind:value={filterTo}
				placeholder="Enter Rated Key"
				class="rounded border border-gray-300 bg-white px-2 py-1 text-black
				       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex flex-col">
			<label for="downloadReviews" class="font-semibold">Download reviews:</label>

			<div class="flex grid-cols-2 gap-2">
				<button
					type="button"
					class="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white transition-colors hover:bg-orange-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
					on:click={() => handleDownload()}
				>
					From filters
				</button>

				{#if $nostrAuth?.pubkey}
					<button
						type="button"
						class="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white transition-colors hover:bg-orange-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
						on:click={() => handleDownload(true)}
					>
						All My Reviews
					</button>
				{/if}
			</div>
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
					<td>
						<a href="https://njump.me/{rating.from.npub}" target="_blank">
							<div class="flex items-center gap-4 px-2">
								<ProfileAvatar source={rating.from.picture} />

								<div class="font-medium text-white">
									<div>{rating.from.display_name || rating.from.name || ''}</div>

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
						</a>
					</td>
					<td>
						<a href="https://njump.me/{rating.to.npub}" target="_blank">
							<div class="flex items-center gap-4 px-2">
								<ProfileAvatar source={rating.to.picture} />

								<div class="font-medium text-white">
									<div>{rating.to.display_name || rating.to.name || ''}</div>

									<div class="group relative">
										<span class="block max-w-24 text-sm text-gray-400">
											{`${rating.to.npub.slice(0, 5)}...${rating.to.npub.slice(-5)}`}
										</span>

										<span
											class="absolute left-0 top-full z-10 hidden whitespace-nowrap rounded-md border border-white bg-gray-800 p-2 text-sm text-white group-hover:block"
										>
											{rating.to.npub}
										</span>
									</div>
								</div>
							</div>
						</a>
					</td>
					<td>
						{new Date(rating.date).toLocaleDateString()}
						<br />
						{new Date(rating.date).toLocaleTimeString()}
					</td>
					<td>{rating.score ? '✅' : '❌'}</td>
					<td>{rating.businessAlreadyDone ? '✅' : 'No'}</td>
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
