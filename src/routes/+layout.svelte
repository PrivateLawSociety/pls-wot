<script>
	import '../app.css';
	import { ToastContainer, FlatToast } from 'svelte-toasts';
	import { page } from '$app/stores';
	import LoginPerson from '$lib/components/LoginPerson.svelte';
	import { nostrAuth } from '$lib/nostr';
</script>

<ToastContainer placement="top-right" theme="dark" duration={3000} showProgress={true} let:data>
	<FlatToast {data} />
</ToastContainer>

<div class="flex h-screen flex-col">
	{#if $page.route.id != '/'}
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

				<div class="w-full flex-col flex justify-end items-end">
					{#if $nostrAuth?.pubkey}
						<LoginPerson pubkey={$nostrAuth.pubkey} />
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<slot />
</div>
