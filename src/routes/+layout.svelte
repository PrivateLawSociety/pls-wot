<script>
	import '../app.css';
	import { ToastContainer, FlatToast } from 'svelte-toasts';
	import { page } from '$app/stores';
</script>

<ToastContainer placement="top-right" theme="dark" duration={3000} showProgress={true} let:data>
	<FlatToast {data} />
</ToastContainer>

<div class="flex h-screen flex-col">
	{#if $page.route.id != '/'}
		<div class="p-5">
			<a href="/">
				<button
					type="button"
					class="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white transition-colors hover:bg-orange-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
				>
					Back to home
				</button>
			</a>
		</div>
	{/if}

	<slot />
</div>
