<script lang="ts">
	import Graph from "graphology";
	import Sigma from "sigma";
	import { onMount } from "svelte";

	import { NodeImageProgram } from "@sigma/node-image";
	import { dfsFromNode } from "graphology-traversal";

	const allRatings = [
	{
		"from": "pubkey5",
		"to": "pubkey1",
		"rating": 5
	},
	{
		"from": "pubkey4",
		"to": "pubkey3",
		"rating": 4
	},
	{
		"from": "pubkey10",
		"to": "pubkey3",
		"rating": 4
	},
	{
		"from": "pubkey8",
		"to": "pubkey10",
		"rating": 1
	},
	{
		"from": "pubkey7",
		"to": "pubkey2",
		"rating": 1
	},
	{
		"from": "pubkey6",
		"to": "pubkey4",
		"rating": 4
	},
	{
		"from": "pubkey8",
		"to": "pubkey3",
		"rating": 4
	},
	{
		"from": "pubkey2",
		"to": "pubkey9",
		"rating": 5
	},
	{
		"from": "pubkey5",
		"to": "pubkey8",
		"rating": 3
	},
	// {
	// 	"from": "pubkey10",
	// 	"to": "pubkey9",
	// 	"rating": 2
	// },
	{
		"from": "pubkey1",
		"to": "pubkey2",
		"rating": 3
	},
	{
		"from": "pubkey10",
		"to": "pubkey2",
		"rating": 5
	},
	{
		"from": "pubkey7",
		"to": "pubkey1",
		"rating": 1
	},
	{
		"from": "pubkey5",
		"to": "pubkey9",
		"rating": 2
	},
	{
		"from": "pubkey6",
		"to": "pubkey7",
		"rating": 4
	},
	{
		"from": "pubkey10",
		"to": "pubkey1",
		"rating": 5
	},
	{
		"from": "pubkey10",
		"to": "pubkey9",
		"rating": 1
	},
	{
		"from": "pubkey4",
		"to": "pubkey4",
		"rating": 2
	},
	{
		"from": "pubkey9",
		"to": "pubkey1",
		"rating": 4
	},
	{
		"from": "pubkey3",
		"to": "pubkey6",
		"rating": 4
	}
	]

	function getColorByRating(rating: number) {
		console.log(rating)
		return {
			1: "red",
			2: "orange",
			3: "yellow",
			4: "green",
			5: "cyan"
		}[rating]
	}

	let graphContainer: HTMLDivElement
	
	const yourPubkey = "pubkey3"
	const otherPubkey = "pubkey5"

	onMount(() => {
		graphContainer = document.getElementById("container")! as HTMLDivElement

		const allPubkeys = allRatings.reduce((pv, cv, i)=>{
			pv.add(cv.from)
			pv.add(cv.to)

			return pv
		}, new Set<string>())

		const graph = new Graph();

		const unrelatedPubkeys = allPubkeys.values().filter((pubkey) => pubkey != yourPubkey && pubkey != otherPubkey).toArray()

		unrelatedPubkeys.forEach((pubkey, i) => {
			graph.addNode(pubkey, {
				label: pubkey,
				x: i,
				y: (i % 2),
				size: 64,
				type:'image',
				color: "#00000028",
				image:`https://robohash.org/${pubkey}.png?set=set3`
			});
		})

		graph.addNode(yourPubkey, {
			label: `You (${yourPubkey})`,
			x: unrelatedPubkeys.length / 2,
			y: -1,
			size: 96,
			type:'image',
			color: "#0000ff28",
			image:`https://robohash.org/${yourPubkey}.png?set=set3`
		});

		graph.addNode(otherPubkey, {
			label: `Selected (${otherPubkey})`,
			x: unrelatedPubkeys.length / 2,
			y: 2,
			size: 96,
			type:'image',
			color: "#0000ff28",
			image:`https://robohash.org/${otherPubkey}.png?set=set3`
		});

		allRatings.forEach((rating) => {
			graph.addDirectedEdge(rating.from, rating.to, {
				size: 16,
				color: getColorByRating(rating.rating),
				type: "arrow",
				label: "asdasdasda",
				forceLabel: true
			});
		})

		new Sigma(graph, graphContainer, {
			nodeProgramClasses: {
				image: NodeImageProgram,
			},
			labelWeight: "bold",
			labelSize: 32,
		});

		removeIrrelevantEdges(graph, yourPubkey, otherPubkey);
		resizeCanvas();
	})

	function removeIrrelevantEdges(graph: Graph, sourceNode: string, targetNode: string) {
		const reachableNodes = new Set<string>(
			[sourceNode, targetNode]
		);

		dfsFromNode(graph, sourceNode, (key) => {
			reachableNodes.add(key);
		}, {
			mode: "out"
		})

		graph.filterNodes((node) => 
			!reachableNodes.has(node)
		).forEach((node)=>{
			graph.dropNode(node)
		})
	}

	function resizeCanvas() {
		graphContainer.style.width = window.innerWidth.toString()   + "px";
		graphContainer.style.height = window.innerHeight.toString() + "px";
	}
</script>

<svelte:window
	on:resize={resizeCanvas}
/>

<div
	id="container"
	style="width: 800px; height: 800px;"
	class="bg-slate-400"
/>

