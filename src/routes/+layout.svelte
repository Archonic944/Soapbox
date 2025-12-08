<script>
	import './layout.css';
	
	let { children } = $props();
</script>

<header class="brand-title">🧼📦 Soapbox</header>
<h2 style="margin-top: 8px; font-family: Lora; text-align: center; font-size: 18px"><em>Talk about yourself</em></h2>

{@render children()}