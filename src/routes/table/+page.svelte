<script lang="ts">
	import { ReviewEvent } from "$lib";
	import { createInvoice, relayList, relayPool } from "$lib/nostr";
	import { npubEncode } from "nostr-tools/nip19";
	import { onMount } from "svelte";
	import QRCode from "qrcode";

	let modalIsOpen = false;
	let zapDestination: HTMLInputElement;
	
	let invoice = ""
	let invoiceQR = ""

	function openZapModal(receiver: string) {
		zapDestination.value = receiver;
		modalIsOpen = true;
	}

	function handleSubmit(e) {
		const formData = new FormData(e.target)

		const data: {
			destination?: string;
			message?: string;
			amount?: number;
		} = {};
		for (let field of formData) {
			const [key, value] = field;
			data[key] = value;
		}
		
		createInvoice(data.destination, data.message, data.amount).then(async (data) => {
			invoice = data.pr;
			invoiceQR = await QRCode.toDataURL(invoice)
		});
	}

	let ratings: {
		from: string;
		to: string;
		date: number;
		score: boolean;
		businessAlreadyDone: boolean;
		description: string;
	}[] = []
	
	$: ratings.sort((a, b) => b.date - a.date)

	onMount(() => {
		relayPool.subscribeMany(relayList, [{
			kinds: [ReviewEvent],
			"#l": ["pls-wot-rating"]
		}], {
			onevent(e) {
				try {
					const c = JSON.parse(e.content)
					ratings = [...ratings, {
						from: npubEncode(c.from),
						to: npubEncode(c.to),
						date: e.created_at*1000,
						score: c.score,
						businessAlreadyDone: c.businessAlreadyDone,
						description: c.description,
					}]
				} catch {}
			}
		})
	})
</script>

<div class="{modalIsOpen ? '' : 'hidden'} fixed top-0 right-0 left-0 z-10 justify-center items-center w-full h-full backdrop-blur-sm">
	<div class="flex items-center justify-center min-h-screen">
		<div class="relative mx-auto p-4 w-full max-w-2xl z-20">
			<div class="relative bg-gray-700 rounded-lg">
				<div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white">
						Send Zap
					</h3>
	
					<button type="button" on:click={() => {modalIsOpen = false}} class="inline-flex justify-center items-center text-sm text-white rounded-lg w-8 h-8">
						<svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
							<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
						</svg>
					</button>
				</div>

				<div class="p-4">
					{#if invoiceQR !== ""}
						<div class="space-y-8">
							<div class="flex items-center justify-center">
								<img src={invoiceQR} alt="qrcode" width="256" height="256">
							</div>
	
							<div class="flex items-center justify-center gap-4 px-4">
								<input type="text" class="bg-gray-700 text-sm text-white border border-gray-600 rounded-lg w-full p-2.5" value={invoice} readonly />
								<!-- <span class="text-wrap truncate max-w-96">{invoice}</span> -->
								<button type="button" class="text-white bg-gray-800 rounded-lg px-5 py-2"
								on:click={(e) => {
									e.target.innerHTML = "Copied";
									navigator.clipboard.writeText(invoice)
								}}>
									Copy
								</button>
							</div>

							<div class="flex items-center justify-center">
								<button type="button" class="text-white bg-gray-800 rounded-lg px-5 py-2 w-full"
								on:click={() => (invoiceQR = "")}>
									Return
								</button>
							</div>
						</div>
					{:else}
						<form on:submit|preventDefault={handleSubmit}>
							<input bind:this={zapDestination} name="destination" type="hidden" required>
	
							<div class="mb-5 space-y-2">
								<label for="amount" class="text-sm text-white mb-2">Amount:</label>
								<input id="amount" name="amount" type="number" class="bg-gray-700 text-sm text-white placeholder-gray-400 border border-gray-600 rounded-lg w-full p-2.5" value=21 min=1 required />
							</div>
	
							<div class="mb-5 space-y-2">
								<label for="message" class="text-sm text-white">Message:</label>
								<textarea id="message" name="message" rows="3" class="bg-gray-700 text-sm text-white placeholder-gray-400 border border-gray-600 rounded-lg w-full p-2.5" placeholder="Leave a message..."></textarea>
							</div>
	
							<div class="flex items-center justify-center">
								<button type="submit" class="text-sm text-white bg-orange-500 rounded-lg px-5 py-2 w-full">
									Create Invoice
								</button>
							</div>
						</form>
					{/if}
				</div>
				
			</div>
		</div>
	</div>
</div>

<div class="flex items-center flex-col gap-8">
	<h1 class="text-2xl font-bold">Ratings table (Currently using replaceable events)</h1>

	<table>
		<tr>
			<th>Rater Nostr Key</th>
			<th>Rated Nostr Key</th>
			<th>Date</th>
			<th>Rating</th>
			<th>Had <br> business</th>
			<th>Description</th>
			<th>Zap</th>
		</tr>
		{#each ratings as rating}
			<tr>
				<td>{rating.from}</td>
				<td>{rating.to}</td>
				<td>
					{new Date(rating.date).toLocaleDateString()}
					<br>
					{new Date(rating.date).toLocaleTimeString()}
					</td>
				<td>{rating.score ? "👍" : "👎"}</td>
				<td>{rating.businessAlreadyDone ? "👍" : "👎"}</td>
				<td>{rating.description}</td>
				<td>
					<button on:click={() => openZapModal(rating.from)}>
						Send Zap
					</button>
				</td>
			</tr>
		{/each}
	</table>
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
	}
</style>