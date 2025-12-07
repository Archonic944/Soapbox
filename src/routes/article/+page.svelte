<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Quiz from '../Quiz.svelte';
	import type { QuizQuestion } from '$lib/db';

	export let data;

	type Article = {
		id: string;
		group_id: string;
		member_id: string;
		rotation_number: number;
		content: string;
		word_count: number;
		created_at: string;
		article_read?: boolean;
		group_members: {
			id: string;
			name: string;
		};
	};

	type QuizData = {
		id: string;
		article_id: string;
		questions: QuizQuestion[];
		created_at: string;
	};

	type QuizAttempt = {
		id: string;
		quiz_id: string;
		member_id: string;
		answers: number[];
		score: number;
		attempted_at: string;
		group_members: {
			id: string;
			name: string;
		};
	};

	let article: Article | null = null;
	let loading = true;
	let error: string | null = null;
	let articleMarkedAsRead = false;
	let showReadBadge = false;
	let articleContentEl: HTMLElement;

	// Quiz state
	let quiz: QuizData | null = null;
	let showQuiz = false;
	let quizCompleted = false;
	let quizScore: number | null = null;
	let quizAttempts: QuizAttempt[] = [];
	let isAuthor = false;

	// Track scroll progress to detect when user has read the article
	function checkIfArticleRead() {
		if (!articleContentEl || articleMarkedAsRead) return;

		const rect = articleContentEl.getBoundingClientRect();
		const windowHeight = window.innerHeight;
		
		// Check if user has scrolled past 80% of the article content
		const articleBottom = rect.bottom;
		const scrollProgress = (windowHeight - rect.top) / rect.height;
		
		if (scrollProgress >= 0.8 || articleBottom <= windowHeight) {
			markAsRead();
		}
	}

	async function markAsRead() {
		if (articleMarkedAsRead || !article) return;
		
		articleMarkedAsRead = true;
		showReadBadge = true;
		
		try {
			await fetch(`/api/articles/${article.id}`, {
				method: 'PATCH'
			});
		} catch (e) {
			console.error('Failed to mark article as read:', e);
		}
	}

	async function fetchQuiz() {
		if (!article) return;
		
		try {
			const response = await fetch(`/api/quizzes?articleId=${article.id}`);
			if (response.ok) {
				quiz = await response.json();
			}
		} catch (e) {
			console.error('Failed to fetch quiz:', e);
		}
	}

	async function fetchQuizAttempts() {
		if (!article) return;
		
		try {
			const response = await fetch(`/api/quizzes/attempts?articleId=${article.id}`);
			if (response.ok) {
				quizAttempts = await response.json();
				
				// Check if current user has already completed the quiz
				if (data.memberId) {
					const myAttempt = quizAttempts.find(a => a.member_id === data.memberId);
					if (myAttempt) {
						quizCompleted = true;
						quizScore = myAttempt.score;
					}
				}
			}
		} catch (e) {
			console.error('Failed to fetch quiz attempts:', e);
		}
	}

	async function handleQuizSubmit(answers: number[], score: number) {
		if (!quiz || !data.memberId) return;
		
		try {
			const response = await fetch('/api/quizzes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					quizId: quiz.id,
					memberId: data.memberId,
					answers,
					score
				})
			});
			
			if (response.ok) {
				quizCompleted = true;
				quizScore = score;
				// Refresh attempts list
				await fetchQuizAttempts();
			}
		} catch (e) {
			console.error('Failed to save quiz attempt:', e);
		}
	}

	onMount(async () => {
		if (!data.articleId) {
			error = 'No article ID provided';
			loading = false;
			return;
		}

		try {
			const response = await fetch(`/api/articles/${data.articleId}`);
			if (!response.ok) {
				throw new Error('Article not found');
			}
			article = await response.json();
			
			// Check if current user is the author
			isAuthor = article?.member_id === data.memberId;
			
			// If article was already marked as read, show the badge
			if (article?.article_read) {
				articleMarkedAsRead = true;
				showReadBadge = true;
			}
			
			// Fetch quiz and attempts
			await Promise.all([fetchQuiz(), fetchQuizAttempts()]);
		} catch (e: any) {
			error = e.message || 'Failed to load article';
		} finally {
			loading = false;
		}

		// Add scroll listener to detect when user finishes reading
		window.addEventListener('scroll', checkIfArticleRead);
		// Check immediately in case article is short
		setTimeout(checkIfArticleRead, 500);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', checkIfArticleRead);
		}
	});

	const formatDate = (dateStr: string) =>
		new Date(dateStr).toLocaleString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
</script>

<svelte:head>
	<title>{article?.group_members?.name ? `${article.group_members.name}'s Article` : 'Article'} | Soapbox</title>
</svelte:head>

<main class="article-page">
	{#if loading}
		<div class="loading">
			<p>Loading article...</p>
		</div>
	{:else if error}
		<div class="error">
			<h1>Oops!</h1>
			<p>{error}</p>
			<a href="/group" class="back-link">← Back to group</a>
		</div>
	{:else if article}
		<article class="article-container">
			<header class="article-header">
				<a href="/group" class="back-link">← Back to group</a>
				<div class="author-badge">
					<span class="author-name">{article.group_members?.name || 'Unknown'}</span>
					{#if showReadBadge}
						<span class="read-badge" class:animate={articleMarkedAsRead}>✓ Read</span>
					{/if}
				</div>
				<p class="meta">
					{formatDate(article.created_at)} · {article.word_count} words
				</p>
			</header>

			<div class="article-content" bind:this={articleContentEl}>
				{@html article.content.replace(/\n/g, '<br />')}
			</div>

			<!-- Quiz Section -->
			{#if quiz && quiz.questions && quiz.questions.length > 0}
				<section class="quiz-section">
					{#if showQuiz}
						<Quiz 
							questions={quiz.questions} 
							articleTitle={article.group_members?.name ? `${article.group_members.name}'s Article` : 'Article'}
							onSubmit={handleQuizSubmit}
						/>
						<button class="hide-quiz-button" on:click={() => showQuiz = false}>
							Hide Quiz
						</button>
					{:else if quizCompleted}
						<div class="quiz-completed-banner">
							<span class="quiz-score-badge">✓ Quiz Completed: {quizScore}%</span>
							<button class="retake-quiz-button" on:click={() => showQuiz = true}>
								View Quiz Again
							</button>
						</div>
					{:else if articleMarkedAsRead && !isAuthor}
						<div class="take-quiz-prompt">
							<p>You've finished reading! Test your understanding:</p>
							<button class="take-quiz-button" on:click={() => showQuiz = true}>
								Take Quiz
							</button>
						</div>
					{/if}

					<!-- Author view: Show quiz scores from others -->
					{#if isAuthor && quizAttempts.length > 0}
						<div class="quiz-scores-section">
							<h3>Quiz Scores</h3>
							<div class="scores-list">
								{#each quizAttempts as attempt}
									<div class="score-item">
										<span class="scorer-name">{attempt.group_members?.name || 'Unknown'}</span>
										<span class="scorer-score" class:high={attempt.score >= 80} class:medium={attempt.score >= 60 && attempt.score < 80} class:low={attempt.score < 60}>
											{attempt.score}%
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</section>
			{/if}

			<footer class="article-footer">
				<a href="/group" class="back-button">Back to Group</a>
			</footer>
		</article>
	{/if}
</main>

<style>
	:global(body) {
		background: linear-gradient(180deg, #f4f8ff 0%, #d8e7ff 45%, #eef6ff 100%);
	}

	.article-page {
		min-height: 100vh;
		display: flex;
		justify-content: center;
		padding: 2rem 1.5rem 4rem;
		box-sizing: border-box;
	}

	.loading,
	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-family: 'Lora';
		padding: 3rem;
	}

	.error h1 {
		font-family: 'Red Hat Display';
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	.article-container {
		width: min(800px, 100%);
		background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
		border-radius: 24px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 
					inset 0 1px 0 rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(0, 0, 0, 0.05);
		overflow: hidden;
	}

	.article-header {
		padding: 2rem 2.5rem 1.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.back-link {
		font-family: 'Monomaniac One';
		font-size: 14px;
		color: #666;
		text-decoration: none;
		transition: color 150ms ease;
	}

	.back-link:hover {
		color: #000;
	}

	.author-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
	}

	.author-name {
		font-family: 'Red Hat Display';
		font-weight: 700;
		font-size: 2.5rem;
		color: #000;
	}

	.read-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.75rem;
		font-family: 'Monomaniac One';
		font-size: 14px;
		background: linear-gradient(180deg, #d4f5d4 0%, #a8e6a8 100%);
		color: #2d7d2d;
		border-radius: 20px;
		border: 1px solid #6dbf6d;
		box-shadow: 0 2px 8px rgba(45, 125, 45, 0.2);
		opacity: 1;
		transform: scale(1);
		transition: transform 0.3s ease, opacity 0.3s ease;
	}

	.read-badge.animate {
		animation: popIn 0.4s ease-out;
	}

	@keyframes popIn {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		70% {
			transform: scale(1.1);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.meta {
		font-family: 'Monomaniac One';
		font-size: 14px;
		color: #888;
		margin: 0;
	}

	.article-content {
		padding: 2.5rem;
		font-family: 'Lora';
		font-size: 1.125rem;
		line-height: 1.8;
		color: #222;
	}

	.article-footer {
		padding: 1.5rem 2.5rem 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		display: flex;
		justify-content: center;
	}

	.back-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-family: 'Monomaniac One';
		font-size: 16px;
		text-transform: lowercase;
		border-radius: 12px;
		border: 1px solid #000;
		background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
		color: #000;
		text-decoration: none;
		cursor: pointer;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.back-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
	}

	.back-button:active {
		transform: translateY(0);
		box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.12);
	}

	@media (max-width: 640px) {
		.article-page {
			padding: 1rem;
		}

		.article-header {
			padding: 1.5rem;
		}

		.author-name {
			font-size: 2rem;
		}

		.article-content {
			padding: 1.5rem;
			font-size: 1rem;
		}

		.article-footer {
			padding: 1.5rem;
		}
	}

	/* Quiz Section Styles */
	.quiz-section {
		padding: 2rem 2.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}

	.take-quiz-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: linear-gradient(180deg, #e8f4ff 0%, #d4ebff 100%);
		border-radius: 16px;
		border: 1px solid #a8d4ff;
	}

	.take-quiz-prompt p {
		margin: 0;
		font-family: 'Lora';
		font-style: italic;
		font-size: 1.1rem;
		color: #333;
	}

	.take-quiz-button {
		padding: 0.75rem 2rem;
		font-family: 'Monomaniac One';
		font-size: 16px;
		text-transform: lowercase;
		border-radius: 12px;
		border: 2px solid #0066cc;
		background: linear-gradient(180deg, #0077ee 0%, #0055cc 100%);
		color: #fff;
		cursor: pointer;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.take-quiz-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 102, 204, 0.3);
	}

	.quiz-completed-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: linear-gradient(180deg, #e8ffe8 0%, #d4f5d4 100%);
		border-radius: 16px;
		border: 1px solid #6dbf6d;
	}

	.quiz-score-badge {
		font-family: 'Monomaniac One';
		font-size: 18px;
		color: #2d7d2d;
	}

	.retake-quiz-button {
		padding: 0.5rem 1rem;
		font-family: 'Monomaniac One';
		font-size: 14px;
		text-transform: lowercase;
		border-radius: 8px;
		border: 1px solid #666;
		background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
		color: #333;
		cursor: pointer;
		transition: background 120ms ease;
	}

	.retake-quiz-button:hover {
		background: linear-gradient(180deg, #f0f0f0 0%, #e0e0e0 100%);
	}

	.hide-quiz-button {
		display: block;
		margin: 1rem auto 0;
		padding: 0.5rem 1.5rem;
		font-family: 'Monomaniac One';
		font-size: 14px;
		text-transform: lowercase;
		border-radius: 8px;
		border: 1px solid #999;
		background: #fff;
		color: #666;
		cursor: pointer;
	}

	.quiz-scores-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(180deg, #fff8e8 0%, #fff0d4 100%);
		border-radius: 16px;
		border: 1px solid #ffc857;
	}

	.quiz-scores-section h3 {
		margin: 0 0 1rem;
		font-family: 'Red Hat Display';
		font-size: 1.25rem;
		color: #333;
	}

	.scores-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.score-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.7);
		border-radius: 8px;
	}

	.scorer-name {
		font-family: 'Lora';
		font-size: 1rem;
		color: #333;
	}

	.scorer-score {
		font-family: 'Monomaniac One';
		font-size: 1.1rem;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
	}

	.scorer-score.high {
		background: #d4f5d4;
		color: #2d7d2d;
	}

	.scorer-score.medium {
		background: #fff0d4;
		color: #b38600;
	}

	.scorer-score.low {
		background: #ffd4d4;
		color: #cc3333;
	}
</style>
