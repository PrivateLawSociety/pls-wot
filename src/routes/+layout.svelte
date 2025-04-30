<script>
	import '../app.css';
	import { ToastContainer, FlatToast } from "svelte-toasts";
</script>

<ToastContainer
	placement="top-right"
	theme="dark"
	duration={3000}
	showProgress={true}
	let:data={data}
>
	<FlatToast {data} />
</ToastContainer>

<div class="flex flex-col h-screen">
	<slot />
</div>
