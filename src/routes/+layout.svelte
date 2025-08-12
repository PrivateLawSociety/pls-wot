<script>
	import '../app.css';
	import { ToastContainer, FlatToast } from 'svelte-toasts';
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
</script>

<ToastContainer placement="top-right" theme="dark" duration={3000} showProgress={true} let:data>
	<FlatToast {data} />
</ToastContainer>

<div class="flex h-screen flex-col">
	{#if $page.route.id != '/'}
		<Header/>
	{/if}

	<slot />
</div>
