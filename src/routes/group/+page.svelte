<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatTimeOffset } from '$lib/demoTime';

	export let data;

	// Types for API data
	type Member = {
		id: string;
		group_id: string;
		name: string;
		joined_at: string;
	};

	type Topic = {
		id: string;
		group_id: string;
		member_id: string;
		topic_text: string;
		rotation_cycle: number;
		submitted_at: string;
	};

	type Article = {
		id: string;
		group_id: string;
		member_id: string;
		rotation_number: number;
		content: string;
		word_count: number;
		created_at: string;
		article_read?: boolean;
	};

	type QueuePerson = {
		id: string;
		name: string;
		dueDate: Date;
		topic: string;
		submitted: boolean;
		articleId?: string;
		article_read?: boolean;
	};

	// Process the data from the server
	const { group, members, topics, articles, currentMemberId, completedQuizArticleIds } = data;

	// Check if quizzes are enabled for this group
	const quizzesEnabled = group?.quizzes_enabled ?? true;

	// Demo time offset (in milliseconds)
	let demoTimeOffset = group?.demo_time_offset || 0;

	// Helper to get member name by ID
	function getMemberName(memberId: string): string {
		const member = members?.find((m: Member) => m.id === memberId);
		return member?.name || 'Unknown';
	}

	// Helper to get topic for a member in current rotation
	function getMemberTopic(memberId: string): string {
		const latestRotation = Math.max(...(topics?.map((t: Topic) => t.rotation_cycle) || [1]), 1);
		const topic = topics?.find((t: Topic) => t.member_id === memberId && t.rotation_cycle === latestRotation);
		return topic?.topic_text || 'Topic pending';
	}

	// Helper to get article for a member
	function getMemberArticle(memberId: string): Article | undefined {
		return articles?.find((a: Article) => a.member_id === memberId);
	}

	// Calculate due dates based on rotation period (days)
	// Uses demo time offset to simulate time passing
	function calculateDueDate(index: number): Date {
		const rotationPeriod = group?.rotation_period || 7; // days
		// Apply demo time offset to "now"
		const demoNow = new Date(Date.now() + demoTimeOffset);
		const dueDate = new Date(demoNow);
		dueDate.setDate(dueDate.getDate() + (rotationPeriod * (index + 1)));
		return dueDate;
	}

	// Build queue from real data
	const queue: QueuePerson[] = (members || []).map((member: Member, index: number) => {
		const article = getMemberArticle(member.id);
		return {
			id: member.id,
			name: member.name,
			dueDate: calculateDueDate(index),
			topic: getMemberTopic(member.id),
			submitted: !!article,
			articleId: article?.id,
			article_read: article?.article_read ?? false
		};
	});

	// First person in queue is "on deck"
	const onDeck = queue.length > 0 ? queue[0] : {
		id: '',
		name: 'No one',
		topic: 'Waiting for members...',
		dueDate: new Date(),
		submitted: false
	};

	// Rest of queue (excluding on deck)
	const restOfQueue = queue.slice(1);

	// Check if user has a draft or queued article saved locally
	let hasDraft = false;
	let hasQueued = false;
	import { browser } from '$app/environment';
	if (browser) {
		const DRAFT_KEY = `soapbox_draft_${group?.id}_${currentMemberId}`;
		const QUEUED_KEY = `soapbox_queued_${group?.id}_${currentMemberId}`;
		hasDraft = !!localStorage.getItem(DRAFT_KEY);
		hasQueued = !!localStorage.getItem(QUEUED_KEY);
	}

	// Find current user in queue
	const currentUserInQueue = queue.find(p => p.id === currentMemberId);
	const isCurrentUserOnDeck = onDeck.id === currentMemberId;

	function viewArticle(articleId: string | undefined) {
		if (articleId) {
			goto(`/article?id=${articleId}`);
		}
	}

	const dueTimestamp = onDeck.dueDate.getTime();

	type TimeLeft = {
		hours: string;
		minutes: string;
		seconds: string;
	};

	let timeLeft: TimeLeft = calculateTimeLeft();
	let timer: number;

	function calculateTimeLeft(): TimeLeft {
		// Apply demo time offset to simulate time passing
		const demoNow = Date.now() + demoTimeOffset;
		const diff = Math.max(0, dueTimestamp - demoNow);
		const totalSeconds = Math.floor(diff / 1000);
		const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
		const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
		const seconds = String(totalSeconds % 60).padStart(2, '0');
		return { hours, minutes, seconds };
	}

	const formatDate = (date: Date) =>
		date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});

	// Demo time skip functions
	async function skipTime(hours: number) {
		const milliseconds = hours * 60 * 60 * 1000;
		const res = await fetch('/api/demo-time', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ groupId: group?.id, skipMs: milliseconds })
		});
		if (res.ok) {
			window.location.reload();
		}
	}

	async function resetTime() {
		const res = await fetch('/api/demo-time', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ groupId: group?.id, reset: true })
		});
		if (res.ok) {
			window.location.reload();
		}
	}

	let showDemoControls = false;

	onMount(() => {
		timer = window.setInterval(() => {
			timeLeft = calculateTimeLeft();
		}, 1000);

		return () => window.clearInterval(timer);
	});

	// Get list of people whose articles still need action (excluding current user)
	// An article needs action if:
	// 1. It's submitted and has an ID
	// 2. AND either: the article hasn't been read, OR (quizzes are enabled AND quiz hasn't been completed)
	const articlesNeedingAction = queue.filter(person => {
		if (!person.submitted || !person.articleId || person.id === currentMemberId) {
			return false;
		}
		
		const hasReadArticle = person.article_read;
		const hasCompletedQuiz = completedQuizArticleIds?.includes(person.articleId) ?? false;
		
		// If quizzes are enabled, user needs to both read AND complete the quiz
		// If quizzes are disabled, user just needs to read the article
		if (quizzesEnabled) {
			return !hasReadArticle || !hasCompletedQuiz;
		} else {
			return !hasReadArticle;
		}
	});
	
	// Separate into "need to read" and "need to take quiz" for banner messaging
	const needToReadNames = articlesNeedingAction
		.filter(p => !p.article_read)
		.map(p => p.name);
	
	const needToQuizNames = quizzesEnabled 
		? articlesNeedingAction
			.filter(p => p.article_read && !(completedQuizArticleIds?.includes(p.articleId!) ?? false))
			.map(p => p.name)
		: [];

	function formatNames(names: string[]): string {
		if (names.length === 0) return '';
		if (names.length === 1) return names[0];
		if (names.length === 2) return `${names[0]} and ${names[1]}`;
		return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
	}
	
	// Generate banner message
	function getBannerMessage(): string {
		const parts: string[] = [];
		
		if (needToReadNames.length > 0) {
			parts.push(`read ${formatNames(needToReadNames)}'s article${needToReadNames.length > 1 ? 's' : ''}`);
		}
		
		if (needToQuizNames.length > 0) {
			parts.push(`take ${formatNames(needToQuizNames)}'s quiz${needToQuizNames.length > 1 ? 'zes' : ''}`);
		}
		
		if (parts.length === 0) return '';
		
		return `You still need to ${parts.join(' and ')}!`;
	}
	
	const bannerMessage = getBannerMessage();
	const showBanner = articlesNeedingAction.length > 0;
</script>

<svelte:head>
	<title>Group | Soapbox</title>
	{#if showBanner}
		<style>
			body { padding-top: 52px !important; }
		</style>
	{/if}
</svelte:head>

{#if showBanner}
	<div class="reading-banner">
		<p class="banner-text">{bannerMessage}</p>
	</div>
{/if}

<main class="group-page">
	<div class="board" aria-live="polite">
		<section class="countdown">
			<p class="time">{timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}</p>
			<p class="subtitle">until {onDeck.name}'s blog drops</p>
		</section>

		<section class="on-deck card">
			<p class="pill">on deck</p>
			<h2 class="name">{onDeck.name}</h2>
			<p class="due">{formatDate(onDeck.dueDate)}</p>
			<p class="topic">"{onDeck.topic}"</p>
			{#if isCurrentUserOnDeck && !onDeck.submitted}
				{#if hasQueued}
					<p class="queued-status on-deck-status">📋 Queued for publication</p>
					<button 
						class="draft-button on-deck-draft"
						type="button"
						on:click={() => goto('/submit')}
					>
						edit queued article
					</button>
				{:else}
					<button 
						class="draft-button on-deck-draft"
						type="button"
						on:click={() => goto('/submit')}
					>
						{hasDraft ? 'continue draft' : 'start draft'}
					</button>
				{/if}
			{:else if isCurrentUserOnDeck && onDeck.submitted}
				<button 
					class="view-button on-deck-view"
					type="button"
					on:click={() => viewArticle(onDeck.articleId)}
				>
					view your article
				</button>
			{:else if !isCurrentUserOnDeck && onDeck.submitted}
				<button 
					class="view-button on-deck-view"
					type="button"
					on:click={() => viewArticle(onDeck.articleId)}
				>
					read article
				</button>
			{/if}
		</section>

		<section class="queue-strip">
			<div class="queue-cards">
				{#each restOfQueue as person}
					<article class={`card queue-card ${person.submitted ? 'submitted' : ''} ${person.id === currentMemberId && hasQueued ? 'queued' : ''} ${person.id === currentMemberId ? 'is-you' : ''}`}>
						<h3 class="name">{person.name}{person.id === currentMemberId ? ' (you)' : ''}</h3>
						<p class="due">{formatDate(person.dueDate)}</p>
						<p class="topic">"{person.topic}"</p>
						{#if person.submitted}
							<button 
								class="view-button" 
								type="button"
								on:click={() => viewArticle(person.articleId)}
							>
								{person.id === currentMemberId ? 'view your article' : 'view article'}
							</button>
						{:else if person.id === currentMemberId}
							{#if hasQueued}
								<p class="queued-status">📋 Queued</p>
								<button 
									class="draft-button"
									type="button"
									on:click={() => goto('/submit')}
								>
									edit article
								</button>
							{:else}
								<button 
									class="draft-button"
									type="button"
									on:click={() => goto('/submit')}
								>
									{hasDraft ? 'continue draft' : 'start draft'}
								</button>
							{/if}
						{:else}
							<p class="status">draft pending</p>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	</div>
</main>

<!-- Demo Controls -->
<button 
	class="demo-toggle"
	type="button"
	on:click={() => showDemoControls = !showDemoControls}
	aria-label="Toggle demo controls"
>
	⏱️
</button>

{#if showDemoControls}
	<div class="demo-controls">
		<h3>Demo Time Controls</h3>
		{#if demoTimeOffset > 0}
			<p class="demo-status">⏩ Time skipped: {formatTimeOffset(demoTimeOffset)}</p>
		{:else}
			<p class="demo-status">🕐 Real time</p>
		{/if}
		<div class="demo-buttons">
			<button on:click={() => skipTime(1)}>+1 hour</button>
			<button on:click={() => skipTime(6)}>+6 hours</button>
			<button on:click={() => skipTime(24)}>+1 day</button>
			<button on:click={() => skipTime(24 * 7)}>+1 week</button>
			<button class="reset-btn" on:click={resetTime}>Reset</button>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background: linear-gradient(180deg, #f4f8ff 0%, #d8e7ff 45%, #eef6ff 100%);
	}

	.reading-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		width: 100%;
		display: flex;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		box-sizing: border-box;
		background: linear-gradient(180deg, rgba(255, 200, 87, 0) 0%, rgba(255, 200, 87, 0.15) 100%),
			linear-gradient(180deg, #fff5e1 0%, #ffe8b3 100%);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
		border-bottom: 2px solid #ffc857;
		animation: slideDown 0.4s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.banner-text {
		margin: 0;
		font-family: 'Lora';
		font-style: italic;
		font-weight: 600;
		font-size: 20px;
		line-height: 28px;
		text-align: center;
		color: #333333;
		max-width: 600px;
	}

	.group-page {
		min-height: 100vh;
		display: flex;
		justify-content: center;
		padding: 1rem 1.5rem 3rem;
		box-sizing: border-box;
	}
	

	.board {
		width: min(72rem, 100%);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.countdown {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.time {
		margin: 0;
		width: 100cqw;
		height: 185px;
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		font-size: 128px;
		line-height: 185px;
		text-align: center;
		background: linear-gradient(180deg, #A6D6FF 22.77%, #098CFF 40.99%, #096CFF 70.28%, #2B1984 94.36%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-fill-color: transparent;
		text-shadow: 0px 4px 5px rgba(0, 0, 0, 0.25);
	}

	.subtitle {
		margin: 0;
		width: 505px;
		font-family: 'Lora';
		font-style: italic;
		font-weight: 400;
		font-size: 48px;
		line-height: 61px;
		text-align: center;
		color: #000000;
	}

	.card {
		position: relative;
		border-radius: 8px;
		padding: 1.25rem 1.5rem 1.5rem;
		box-sizing: border-box;
	}

	.on-deck {
		width: 396px;
		max-width: 100%;
		min-height: 253px;
		padding-top: 8px;
		padding-bottom: 1rem;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%), #60c5f1;
		box-shadow: 0 0 20px 3px rgba(0, 0, 0, 0.25), inset 0 4px 10px 2px rgba(152, 152, 152, 0.25),
			inset 0 -10px 8px 2px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(2px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.25rem;
	}

	.queue-strip {
		width: 100%;
		max-width: 1091px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1rem;
	}

	.queue-cards {
		width: 100%;
		display: flex;
		gap: 24px;
		justify-content: center;
		align-items: stretch;
		flex-wrap: wrap;
	}

	.queue-card {
		width: fit-content;
		min-width: 261px;
		max-width: 300px;
		min-height: 226px;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%),
			linear-gradient(180deg, #dddddd 0%, #b1b1b1 100%);
		box-shadow: inset 0 -4px 4px rgba(0, 0, 0, 0.25), inset 0 10px 10px rgba(255, 255, 255, 0.2);
		border-radius: 28px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 1rem 1rem;
	}

	.queue-card.submitted {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 255, 149, 0.18) 100%),
			linear-gradient(180deg, #e6ffe9 0%, #cbffd6 100%);
		border: 0.5px solid #44ff00;
		box-shadow: 4px 4px 4px rgba(0, 0, 0, 0.25), inset 0 6px 12px rgba(255, 255, 255, 0.25);
	}

	.pill {
		margin-top: 4px;
        margin-bottom: 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.75rem;
		border-radius: 999px;
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		font-size: 14px;
		text-transform: lowercase;
		background: #000;
		color: #fff;
		border: 0.5px solid #000;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
	}

	.name {
		margin: 0.1rem 0 0.1rem 0rem;
		font-family: 'Red Hat Display';
		font-style: normal;
		font-weight: 700;
		font-size: 48px;
		line-height: 64px;
		text-align: center;
		color: #000000;
	}

	.on-deck .name {
		margin-top: 0.25rem;
	}

	.queue-card .name {
		font-size: 40px;
		line-height: 52px;
	}

	.due {
		margin: 0.05rem 0 0.2rem;
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		font-size: 36px;
		line-height: 52px;
		text-align: center;
		background: linear-gradient(270deg, rgba(168, 181, 151, 0.53) -23.59%, #44FF00 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-fill-color: transparent;
	}

	.queue-card .due {
		font-size: 28px;
		line-height: 40px;
	}

	.topic {
		margin: 0;
		font-family: 'Lora';
		font-style: italic;
		font-weight: 400;
		font-size: 28px;
		line-height: 36px;
		text-align: center;
		color: #000000;
		padding: 0 0.75rem;
		white-space: nowrap;
	}

	.queue-card .topic {
		font-size: 20px;
		line-height: 26px;
		font-weight: 700;
		margin-top: auto;
		margin-bottom: 14px;
		padding: 0 1rem;
		white-space: nowrap;
	}

	.status {
		margin: auto 0 14px;
		text-align: center;
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		font-size: 16px;
		color: rgba(0, 0, 0, 0.65);
	}

	.view-button {
		margin: auto 0 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.8rem;
		width: calc(100% - 36px);
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		text-transform: lowercase;
		font-size: 20px;
		border-radius: 10px;
		border: 0.5px solid #000;
		background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
		cursor: pointer;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.view-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
	}

	.view-button:active {
		transform: translateY(0);
		box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.12);
	}

	.draft-button {
		margin: auto 0 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		width: calc(100% - 36px);
		font-family: 'Monomaniac One';
		font-style: normal;
		font-weight: 400;
		text-transform: lowercase;
		font-size: 20px;
		border-radius: 10px;
		border: 1px solid #2d8fc0;
		background: linear-gradient(180deg, #60c5f1 0%, #3ba8d8 100%);
		color: white;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(59, 168, 216, 0.3);
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.draft-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(59, 168, 216, 0.4);
	}

	.draft-button:active {
		transform: translateY(0);
		box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.15);
	}

	.on-deck-draft,
	.on-deck-view {
		margin-top: 0.75rem;
		width: auto;
		padding: 0.6rem 1.5rem;
	}

	.on-deck-status {
		margin-top: 0.5rem;
	}

	.queue-card.is-you {
		border: 2px solid #60c5f1;
		box-shadow: 0 0 20px rgba(96, 197, 241, 0.3), 4px 4px 4px rgba(0, 0, 0, 0.25), inset 0 6px 12px rgba(255, 255, 255, 0.25);
	}

	.queue-card.queued {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(139, 92, 246, 0.15) 100%),
			linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%);
		border: 2px solid #a78bfa;
		box-shadow: 0 0 20px rgba(139, 92, 246, 0.2), 4px 4px 4px rgba(0, 0, 0, 0.25), inset 0 6px 12px rgba(255, 255, 255, 0.25);
	}

	.queued-status {
		margin: 0 0 8px;
		font-family: 'Monomaniac One';
		font-size: 14px;
		color: #7c3aed;
		text-align: center;
	}

	@media (max-width: 960px) {
		.board {
			min-height: auto;
			padding-top: 6rem;
		}

		.countdown,
		.on-deck,
		.queue-strip {
			position: static;
			transform: none;
			width: 100%;
		}

		.countdown {
			padding-top: 1rem;
		}

		.time,
		.subtitle {
			width: 100%;
		}

		.on-deck {
			margin-top: 1.5rem;
			width: 100%;
			height: auto;
		}

		.queue-strip {
			margin-top: 0.5rem;
			height: auto;
		}

		.queue-cards {
			justify-content: center;
		}

		.queue-card {
			width: min(320px, 100%);
			height: auto;
			padding-bottom: 1rem;
		}

		.view-button,
		.status {
			margin-bottom: 10px;
		}
	}

	/* Demo Controls */
	.demo-toggle {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
		border: none;
		font-size: 20px;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
		transition: transform 0.2s, box-shadow 0.2s;
		z-index: 100;
	}

	.demo-toggle:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 16px rgba(79, 70, 229, 0.5);
	}

	.demo-controls {
		position: fixed;
		bottom: 4.5rem;
		right: 1rem;
		background: white;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
		z-index: 100;
		min-width: 200px;
	}

	.demo-controls h3 {
		margin: 0 0 0.5rem 0;
		font-family: 'Lora', serif;
		font-size: 14px;
		font-weight: 600;
		color: #333;
	}

	.demo-status {
		margin: 0 0 0.75rem 0;
		font-size: 13px;
		color: #666;
	}

	.demo-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.demo-buttons button {
		padding: 0.4rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		background: #f9fafb;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.demo-buttons button:hover {
		background: #f3f4f6;
		border-color: #bbb;
	}

	.demo-buttons .reset-btn {
		background: #fee2e2;
		border-color: #fca5a5;
		color: #dc2626;
	}

	.demo-buttons .reset-btn:hover {
		background: #fecaca;
	}
</style>
