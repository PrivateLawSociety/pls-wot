<script lang="ts">
	import { ReviewEvent } from '$lib';
	import {
		getProfileMetadata,
		nostrAuth,
		parseProfileFromJsonString,
		type ProfileType,
		type Rating,
		relayList,
		relayPool
	} from '$lib/nostr';
	import { npubEncode } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import ZapModal from '$lib/components/ZapModal.svelte';
	import ProfileAvatar from '$lib/components/ProfileAvatar.svelte';
	import { Button, Input, Label, Select } from 'flowbite-svelte';
	import type { Event } from 'nostr-tools';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { toasts } from 'svelte-toasts';

	let ZapModalComponent: ZapModal;

	let ratings: Rating[] = [];

	// Necessary to ensure that page is loaded before try to set any search param
	// It ensures that replaceState would not be called before router initialization
	let pageInitialized: boolean = false;

	let filterRating: string = 'all';
	let filterBusiness: string = 'all';
	let filterFrom: string = getRaterParam();
	let filterTo: string = getRatedParam();

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

	$: setRaterParam(filterFrom);
	$: setRatedParam(filterTo);

	const events: Event[] = [];

	onMount(() => {
		pageInitialized = true;

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
						events.push(e);

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

	function getRaterParam(): string {
		return page.url.searchParams.get('rater') || '';
	}

	function setRaterParam(rater: string) {
		// Ensure that page has initialized
		if (!pageInitialized) return;

		if (rater) {
			page.url.searchParams.set('rater', rater);
		} else {
			page.url.searchParams.delete('rater');
		}
		replaceState(page.url, page.state);
	}

	function getRatedParam(): string {
		return page.url.searchParams.get('rated') || '';
	}

	function setRatedParam(rated: string) {
		// Ensure that page has initialized
		if (!pageInitialized) return;

		if (rated) {
			page.url.searchParams.set('rated', rated);
		} else {
			page.url.searchParams.delete('rated');
		}
		replaceState(page.url, page.state);
	}

	async function copyNpub(npub: string) {
		await navigator.clipboard.writeText(npub);
		toasts.success({
			title: 'Copied NPUB!',
			description: 'NPUB copied to clipboard'
		});
	}

	async function copyLinkToClipboard() {
		await navigator.clipboard.writeText(page.url.toString());
		toasts.success({
			title: 'Copied!',
			description: 'Link copied to clipboard!'
		});
	}

	const handleDownload = (myRatings: boolean = false) => {
		if (myRatings) {
			if (!$nostrAuth?.pubkey) {
				toasts.error({
					title: 'Not logged in',
					description: 'You must be logged to perform this action'
				});
				return;
			}

			let myRatingsEventId = ratings
				.filter((r) => r.from.pubkey === $nostrAuth?.pubkey || r.to.pubkey === $nostrAuth?.pubkey)
				.map((r) => {
					return r.eventId;
				});

			let myRatingsEvents = events.filter((e) => myRatingsEventId.includes(e.id));

			return download('ratings.json', JSON.stringify(myRatingsEvents, null, '\t'));
		}

		let filteredRatingsEventId = filteredRatings.map((r) => {
			return r.eventId;
		});

		let filteredRatingsEvents = events.filter((e) => filteredRatingsEventId.includes(e.id));

		return download('ratings.json', JSON.stringify(filteredRatingsEvents, null, '\t'));
	};

	let expandedItems = new Set<string>();

	function toggleExpanded(id: string) {
		if (expandedItems.has(id)) {
			expandedItems.delete(id);
		} else {
			expandedItems.add(id);
		}
		expandedItems = expandedItems;
	}
</script>

<ZapModal bind:this={ZapModalComponent} />

<div class="flex flex-col items-center gap-8 mt-4">
	<h1 class="text-2xl font-bold">Ratings table</h1>

	<div class="flex w-full flex-wrap justify-center gap-4">
		<div class="flex flex-col gap-1">
			<Label for="filterRating" class="font-semibold text-white" color="none">Filter by Rating:</Label>
			<Select
				id="filterRating"
				bind:value={filterRating}
				items={[
					{ value: 'all', name: 'All' },
					{ value: 'positive', name: 'Positive' },
					{ value: 'negative', name: 'Negative' }
				]}
				defaultClass="rounded-md border border-wot_blue-100 border-2 bg-white text-wot_blue-100"
				color="none"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<Label for="filterBusiness" class="font-semibold text-white" color="none">Filter by Had Business:</Label>
			<Select
				id="filterBusiness"
				bind:value={filterBusiness}
				items={[
					{ value: 'all', name: 'All' },
					{ value: 'yes', name: 'Yes' },
					{ value: 'no', name: 'No' }
				]}
				defaultClass="rounded-md border border-wot_blue-100 border-2 bg-white text-wot_blue-100"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<Label for="filterFrom" class="font-semibold text-white" color="none">Filter by Who Rated:</Label>
			<Input
				id="filterFrom"
				bind:value={filterFrom}
				placeholder="Enter Rater Key"
				autocomplete="off"
				color="none"
				defaultClass="bg-white text-wot_blue-50 border border-wot_blue-100 border-2"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<Label for="filterTo" class="font-semibold text-white" color="none">Filter by Who Was Rated:</Label>
			<Input
				id="filterTo"
				bind:value={filterTo}
				placeholder="Enter Rated Key"
				autocomplete="off"
				color="none"
				defaultClass="bg-white text-wot_blue-50 border border-wot_blue-100 border-2"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<Label for="downloadReviews" class="font-semibold text-white" color="none">Download reviews:</Label>

			<div class="flex grid-cols-2 gap-2">
				<Button
					class="bg-wot_blue-100"
					color="none"
					on:click={() => handleDownload()}
				>
					From filters
				</Button>

				{#if $nostrAuth?.pubkey}
					<Button
						class="bg-wot_blue-100"
						color="none"
						on:click={() => handleDownload(true)}
					>
						All My Reviews
					</Button>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<Label for="getFilterLinks" class="font-semibold text-white" color="none">Get filters link:</Label>

			<div class="grid-cols flex gap-2">
				<Button
					class="bg-wot_blue-100"
					color="none"
					on:click={() => copyLinkToClipboard()}
				>
					Copy to clipboard
				</Button>
			</div>
		</div>
	</div>

	<!-- Modern card-based table -->
	<div class="w-full max-w-7xl space-y-4 px-4">
		{#each filteredRatings as rating}
			<div
				class="rounded-lg border border-wot_blue-100 bg-white p-6 shadow-lg transition-all hover:shadow-xl"
			>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					<!-- Rater Section -->
					<div class="flex flex-col gap-3">
						<span class="text-sm font-semibold text-wot_blue-100">Who Rated</span>
						<div class="flex items-center gap-3">
							<a href="https://njump.me/{rating.from.npub}" target="_blank">
								<ProfileAvatar source={rating.from.picture} />
							</a>
							<div class="flex-1">
								<div class="font-medium text-white">
									{rating.from.display_name || rating.from.name || 'Anonymous'}
								</div>
								<div class="group relative">
									<button
										on:click={() => copyNpub(rating.from.npub)}
										class="text-sm text-black hover:text-wot_blue-100"
									>
										{`${rating.from.npub.slice(0, 10)}...${rating.from.npub.slice(-10)}`}
									</button>
									<span
										class="absolute left-0 top-full z-10 hidden whitespace-nowrap rounded-md border border-wot_blue-100 bg-gray-900 p-2 text-sm text-white group-hover:block"
									>
										{rating.from.npub}
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Rated Section -->
					<div class="flex flex-col gap-3">
						<span class="text-sm font-semibold text-wot_blue-100">Who Was Rated</span>
						<div class="flex items-center gap-3">
							<a href="https://njump.me/{rating.to.npub}" target="_blank">
								<ProfileAvatar source={rating.to.picture} />
							</a>
							<div class="flex-1">
								<div class="font-medium text-white">
									{rating.to.display_name || rating.to.name || 'Anonymous'}
								</div>
								<div class="group relative">
									<button
										on:click={() => copyNpub(rating.to.npub)}
										class="text-sm text-black hover:text-wot_blue-100"
									>
										{`${rating.to.npub.slice(0, 10)}...${rating.to.npub.slice(-10)}`}
									</button>
									<span
										class="absolute left-0 top-full z-10 hidden whitespace-nowrap rounded-md border border-wot_blue-100 bg-gray-900 p-2 text-sm text-white group-hover:block"
									>
										{rating.to.npub}
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Info Section -->
					<div class="flex flex-col gap-3">
						<span class="text-sm font-semibold text-wot_blue-100">Rating Info</span>
						<div class="space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-black">Date:</span>
								<span class="text-black">
									{new Date(rating.date).toLocaleDateString()}
									{new Date(rating.date).toLocaleTimeString()}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-black">Rating:</span>
								{#if rating.score}
									<p class="shrink-0 h-6 w-6" />
								{/if}
								<span class="text-2xl">{rating.score ? '✅' : '❌'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-black">Had Business:</span>
								<span class="text-2xl">{rating.businessAlreadyDone ? '✅' : '❌'}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Description Section -->
				<div class="mt-4 border-t border-wot_blue-100 pt-4">
					<span class="mb-2 block text-sm font-semibold text-wot_blue-100">Description</span>
					<div class="text-black">
						<p
							class={expandedItems.has(rating.eventId) ? 'whitespace-pre-wrap break-words' : 'line-clamp-3 break-words'}>
							{rating.description || 'No description provided'}
						</p>
						{#if rating.description.length > 250}
							<button
								on:click={() => toggleExpanded(rating.eventId)}
								class="mt-2 text-sm text-wot_blue-100 transition-colors hover:text-wot_blue-50"
							>
								{expandedItems.has(rating.eventId) ? '▲ Show less' : '▼ Show more'}
							</button>
						{/if}
					</div>
				</div>

				<!-- Zap Button -->
				{#if rating.from.lud16}
					<div class="mt-4 flex justify-end border-t border-wot_blue-100 pt-4">
						<button
							type="button"
							class="rounded-lg border border-wot_blue-100 bg-wot_blue-100 px-4 py-2 text-sm text-white transition-all hover:bg-wot_blue-200 focus:outline-none focus:ring-2 focus:ring-wot_blue-100"
							on:click={() => ZapModalComponent.openModal(rating.from.npub, rating.eventId)}
						>
							⚡ Send Zap
						</button>
					</div>
				{/if}
			</div>
		{/each}

		{#if filteredRatings.length === 0}
			<div class="rounded-lg border border-wot_blue-100 bg-white p-8 text-center">
				<p class="text-black">No ratings found matching the current filters.</p>
			</div>
		{/if}
	</div>
</div>


