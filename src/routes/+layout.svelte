<script>
	import '../app.css';
	import { ToastContainer, FlatToast } from 'svelte-toasts';
</script>

<ToastContainer placement="top-right" theme="dark" duration={3000} showProgress={true} let:data>
	<FlatToast {data} />
</ToastContainer>

<div class="flex h-screen flex-col">
	<slot />
</div>
