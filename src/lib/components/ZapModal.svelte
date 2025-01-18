<script lang="ts">
	import { createInvoice } from '$lib/nostr';
	import QRCode from 'qrcode';
	import { writable } from 'svelte/store';

	let textInvoiceInput;

	const modalState = writable({
		isOpen: false,
		destination: '',
		message: '',
		amount: 21,
		eventId: '',
		invoice: '',
		invoiceQR: ''
	});

	type ModalState = {
		isOpen: boolean;
		destination: string;
		message: string;
		amount: number;
		eventId: string;
		invoice: string;
		invoiceQR: string;
	};

	const initialState: ModalState = {
		isOpen: false,
		destination: '',
		message: '',
		amount: 21,
		eventId: '',
		invoice: '',
		invoiceQR: ''
	};

	export function openModal(receiver: string, eventId: string) {
		modalState.set({
			...initialState,
			isOpen: true,
			destination: receiver,
			eventId: eventId
		});
	}

	function closeModal() {
		modalState.set(initialState);
	}

	async function handleSubmit() {
		try {
			const { destination, message, amount, eventId } = $modalState;
			const data = await createInvoice(destination, message, amount, eventId);
			const invoiceQR = await QRCode.toDataURL(data.pr);

			modalState.update((state) => ({
				...state,
				invoice: data.pr,
				invoiceQR
			}));
		} catch (error) {
			console.error('Error creating invoice:', error);
			closeModal();
			alert('Error trying to create invoice');
		}
	}

	async function copyInvoice() {
		try {
			await navigator.clipboard.writeText($modalState.invoice);
			alert('Copied!');
		} catch (error) {
			console.error('Failed to copy invoice:', error);
		}
	}
</script>

<div
	class="fixed inset-0 z-10 flex items-center justify-center {$modalState.isOpen ? '' : 'hidden'}"
>
	<button class="fixed inset-0 cursor-default bg-black/30 backdrop-blur-sm" on:click={closeModal}
	></button>

	<div class="relative mx-auto w-full max-w-2xl p-4">
		<div class="relative rounded-lg bg-gray-700 shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-600 p-4">
				<h3 class="text-xl font-semibold text-white">Send Zap</h3>

				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-white transition-colors hover:bg-gray-600"
					on:click={closeModal}
					aria-label="Close modal"
				>
					<svg
						class="h-3 w-3"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 14 14"
					>
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
						/>
					</svg>
				</button>
			</div>

			<div class="p-4">
				{#if $modalState.invoiceQR}
					<div class="space-y-8">
						<div class="flex flex-col items-center justify-center gap-4">
							<img
								src={$modalState.invoiceQR}
								alt="QR code for lightning invoice"
								width="256"
								height="256"
								class="rounded-lg"
							/>

							<a
								href={`lightning:${$modalState.invoice}`}
								class="text-primary hover:text-secondary underline"
							>
								Pay with app
							</a>
						</div>

						<div class="flex items-center justify-center gap-4 px-4">
							<input
								bind:this={textInvoiceInput}
								type="text"
								class="w-full rounded-lg border border-gray-600 bg-gray-700 p-2.5 text-sm text-white focus:ring-2"
								value={$modalState.invoice}
								readonly
								aria-label="Lightning invoice"
							/>
							<button
								type="button"
								class="rounded-lg bg-orange-500 px-5 py-2 text-white transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-300"
								on:click={copyInvoice}
							>
								Copy
							</button>
						</div>

						<button
							type="button"
							class="w-full rounded-lg bg-gray-800 px-5 py-2 text-white transition-colors hover:bg-gray-600 focus:ring-2"
							on:click={() => modalState.update((state) => ({ ...state, invoiceQR: '' }))}
						>
							Return
						</button>
					</div>
				{:else}
					<form on:submit|preventDefault={handleSubmit} class="space-y-6">
						<input type="hidden" name="destination" bind:value={$modalState.destination} required />

						<div class="space-y-2">
							<label for="amount" class="block text-sm text-white"> Amount: </label>
							<input
								id="amount"
								name="amount"
								type="number"
								bind:value={$modalState.amount}
								class="w-full rounded-lg border border-gray-600 bg-gray-700 p-2.5 text-sm text-white focus:ring-2"
								min="1"
								required
							/>
						</div>

						<div class="space-y-2">
							<label for="message" class="block text-sm text-white"> Message: </label>
							<textarea
								id="message"
								name="message"
								bind:value={$modalState.message}
								rows="3"
								class="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 p-2.5 text-sm text-white focus:ring-2"
								placeholder="Leave a message..."
							></textarea>
						</div>

						<button
							type="submit"
							class="w-full rounded-lg bg-orange-500 px-5 py-2 text-sm text-white transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-300"
						>
							Create Invoice
						</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
