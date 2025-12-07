<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let data;

	const { group, currentMember, topic, dueDate, maxWordCount, memberId, groupId, demoTimeOffset = 0 } = data;

	// Local storage keys
	const DRAFT_KEY = `soapbox_draft_${groupId}_${memberId}`;
	const QUEUED_KEY = `soapbox_queued_${groupId}_${memberId}`;

	let content = '';
	let wordCount = 0;
	let saving = false;
	let submitting = false;
	let lastSaved: Date | null = null;
	let error = '';
	let showSuccessToast = false;
	let toastMessage = '';
	let isQueued = false;

	// Calculate word count
	$: {
		const trimmed = content.trim();
		wordCount = trimmed.length > 0 ? trimmed.split(/\s+/).length : 0;
	}

	// Word count status
	$: wordCountStatus = wordCount > maxWordCount 
		? 'over' 
		: wordCount > maxWordCount * 0.9 
			? 'warning' 
			: 'normal';

	// Check if due date has passed (applying demo time offset)
	$: isDueDatePassed = new Date(dueDate).getTime() <= (Date.now() + demoTimeOffset);

	// Format the due date
	const formattedDueDate = new Date(dueDate).toLocaleString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	// Calculate time remaining (applying demo time offset)
	function getTimeRemaining(): string {
		const demoNow = new Date(Date.now() + demoTimeOffset);
		const due = new Date(dueDate);
		const diff = due.getTime() - demoNow.getTime();
		
		if (diff <= 0) return 'Due now!';
		
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		
		if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours}h remaining`;
		return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
	}

	let timeRemaining = getTimeRemaining();

	// Load draft or queued article from local storage
	onMount(() => {
		// First check if there's a queued article
		const queued = localStorage.getItem(QUEUED_KEY);
		if (queued) {
			try {
				const queuedData = JSON.parse(queued);
				content = queuedData.content || '';
				isQueued = true;
				lastSaved = queuedData.queuedAt ? new Date(queuedData.queuedAt) : null;
			} catch (e) {
				console.error('Failed to load queued article:', e);
			}
		} else {
			// Otherwise load draft
			const saved = localStorage.getItem(DRAFT_KEY);
			if (saved) {
				try {
					const draft = JSON.parse(saved);
					content = draft.content || '';
					lastSaved = draft.savedAt ? new Date(draft.savedAt) : null;
				} catch (e) {
					console.error('Failed to load draft:', e);
				}
			}
		}

		// Update time remaining every minute
		const interval = setInterval(() => {
			timeRemaining = getTimeRemaining();
		}, 60000);

		return () => clearInterval(interval);
	});

	// Auto-save draft (only if not queued)
	function saveDraft() {
		if (isQueued) return; // Don't auto-save if already queued
		try {
			const draft = {
				content,
				savedAt: new Date().toISOString()
			};
			localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
			lastSaved = new Date();
		} catch (e) {
			console.error('Failed to save draft:', e);
		}
	}

	// Debounced auto-save on content change
	let saveTimeout: ReturnType<typeof setTimeout>;
	$: if (content !== undefined) {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveDraft, 1000);
	}

	// Manual save
	function handleSave() {
		saving = true;
		saveDraft();
		showSuccessToast = true;
		toastMessage = 'Draft saved!';
		setTimeout(() => {
			saving = false;
			showSuccessToast = false;
		}, 2000);
	}

	// Queue article for submission (saves locally, will be published at due date)
	function handleQueue() {
		if (wordCount > maxWordCount) {
			error = `Your article is ${wordCount - maxWordCount} words over the limit. Please shorten it.`;
			return;
		}

		if (wordCount < 10) {
			error = 'Please write at least 10 words before queuing.';
			return;
		}

		submitting = true;
		error = '';

		try {
			const queuedArticle = {
				content,
				queuedAt: new Date().toISOString(),
				dueDate,
				groupId,
				memberId
			};
			localStorage.setItem(QUEUED_KEY, JSON.stringify(queuedArticle));
			// Clear draft since it's now queued
			localStorage.removeItem(DRAFT_KEY);
			
			isQueued = true;
			showSuccessToast = true;
			toastMessage = 'Article queued! It will be published at your due date.';
			setTimeout(() => {
				showSuccessToast = false;
				goto('/group');
			}, 2000);
		} catch (e: any) {
			error = e.message || 'Something went wrong';
		} finally {
			submitting = false;
		}
	}

	// Unqueue - go back to draft mode
	function handleUnqueue() {
		const queued = localStorage.getItem(QUEUED_KEY);
		if (queued) {
			try {
				const queuedData = JSON.parse(queued);
				// Move content back to draft
				const draft = {
					content: queuedData.content,
					savedAt: new Date().toISOString()
				};
				localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
				localStorage.removeItem(QUEUED_KEY);
				isQueued = false;
				showSuccessToast = true;
				toastMessage = 'Article unqueued. You can continue editing.';
				setTimeout(() => {
					showSuccessToast = false;
				}, 2000);
			} catch (e) {
				console.error('Failed to unqueue:', e);
			}
		}
	}

	// Submit article immediately (only available after due date)
	async function handleSubmit() {
		if (wordCount > maxWordCount) {
			error = `Your article is ${wordCount - maxWordCount} words over the limit. Please shorten it.`;
			return;
		}

		if (wordCount < 10) {
			error = 'Please write at least 10 words before submitting.';
			return;
		}

		submitting = true;
		error = '';

		try {
			const response = await fetch('/api/articles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					group_id: groupId,
					member_id: memberId,
					rotation_number: 1, // TODO: Get actual rotation number
					content
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to submit article');
			}

			// Clear both draft and queued on successful submission
			localStorage.removeItem(DRAFT_KEY);
			localStorage.removeItem(QUEUED_KEY);
			
			// Redirect to group page
			goto('/group');
		} catch (e: any) {
			error = e.message || 'Something went wrong';
		} finally {
			submitting = false;
		}
	}

	function formatLastSaved(date: Date | null): string {
		if (!date) return '';
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		
		if (diff < 60000) return 'just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Write Your Article | Soapbox</title>
</svelte:head>

<main class="submit-page">
	<header class="page-header">
		<a href="/group" class="back-link">← Back to group</a>
		<h1 class="page-title">Your Turn to Write</h1>
	</header>

	<div class="info-bar">
		<div class="info-item">
			<span class="info-label">Topic</span>
			<span class="info-value topic-value">"{topic}"</span>
		</div>
		<div class="info-item">
			<span class="info-label">Due</span>
			<span class="info-value">{formattedDueDate}</span>
		</div>
		<div class="info-item time-remaining">
			<span class="info-label">Time Left</span>
			<span class="info-value countdown">{timeRemaining}</span>
		</div>
	</div>

	<div class="editor-container">
		{#if isQueued}
			<div class="queued-banner">
				<span class="queued-icon">✓</span>
				<span class="queued-text">Article queued for publication</span>
			</div>
		{/if}
		<div class="editor-header">
			<div class="word-count-wrapper">
				<span class="word-count {wordCountStatus}">
					{wordCount} / {maxWordCount} words
				</span>
				{#if wordCountStatus === 'warning'}
					<span class="word-warning">Approaching limit</span>
				{:else if wordCountStatus === 'over'}
					<span class="word-warning over">Over limit!</span>
				{/if}
			</div>
			<div class="save-status">
				{#if isQueued}
					<span class="queued-indicator">📋 Queued</span>
				{:else if lastSaved}
					<span class="saved-indicator">✓ Saved {formatLastSaved(lastSaved)}</span>
				{/if}
			</div>
		</div>

		<textarea
			class="editor"
			class:readonly={isQueued}
			bind:value={content}
			disabled={isQueued}
			placeholder="Start writing your article here..."
		></textarea>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<div class="action-bar">
			{#if isQueued}
				<button 
					class="unqueue-button"
					on:click={handleUnqueue}
				>
					Edit Article
				</button>
				<button 
					class="submit-button"
					on:click={handleSubmit}
					disabled={submitting}
				>
					{submitting ? 'Publishing...' : 'Publish Now'}
				</button>
			{:else}
				<button 
					class="save-button"
					on:click={handleSave}
					disabled={saving}
				>
					{saving ? 'Saving...' : 'Save Draft'}
				</button>
				<button 
					class="submit-button"
					on:click={handleSubmit}
					disabled={submitting || wordCount > maxWordCount}
				>
					{submitting ? 'Publishing...' : 'Publish Article'}
				</button>
			{/if}
		</div>
	</div>

	{#if showSuccessToast}
		<div class="toast">{toastMessage}</div>
	{/if}
</main>

<style>
	:global(body) {
		background: linear-gradient(180deg, #f4f8ff 0%, #e8f0ff 100%);
	}

	.submit-page {
		min-height: 100vh;
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		box-sizing: border-box;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.back-link {
		font-family: 'Monomaniac One', sans-serif;
		font-size: 14px;
		color: #666;
		text-decoration: none;
		transition: color 150ms ease;
	}

	.back-link:hover {
		color: #000;
	}

	.page-title {
		font-family: 'Red Hat Display', sans-serif;
		font-weight: 700;
		font-size: 2.5rem;
		margin: 0.5rem 0 0;
		color: #000;
	}

	.info-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		padding: 1.25rem 1.5rem;
		background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.05);
		margin-bottom: 1.5rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-label {
		font-family: 'Monomaniac One', sans-serif;
		font-size: 12px;
		text-transform: uppercase;
		color: #888;
		letter-spacing: 0.5px;
	}

	.info-value {
		font-family: 'Red Hat Display', sans-serif;
		font-weight: 600;
		font-size: 1rem;
		color: #333;
	}

	.topic-value {
		font-family: 'Lora', serif;
		font-style: italic;
		font-weight: 400;
		color: #000;
		max-width: 400px;
	}

	.time-remaining {
		margin-left: auto;
	}

	.countdown {
		color: #098CFF;
	}

	.editor-container {
		background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
		border-radius: 20px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
		border: 1px solid rgba(0, 0, 0, 0.05);
		overflow: hidden;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		background: rgba(255, 255, 255, 0.8);
	}

	.word-count-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.word-count {
		font-family: 'Monomaniac One', sans-serif;
		font-size: 14px;
		color: #666;
		transition: color 200ms ease;
	}

	.word-count.warning {
		color: #f59e0b;
	}

	.word-count.over {
		color: #ef4444;
		font-weight: 600;
	}

	.word-warning {
		font-family: 'Red Hat Display', sans-serif;
		font-size: 12px;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		background: #fef3c7;
		color: #92400e;
	}

	.word-warning.over {
		background: #fee2e2;
		color: #991b1b;
	}

	.save-status {
		font-family: 'Red Hat Display', sans-serif;
		font-size: 13px;
		color: #10b981;
	}

	.saved-indicator {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.editor {
		width: 100%;
		min-height: 450px;
		padding: 1.5rem;
		border: none;
		outline: none;
		resize: vertical;
		font-family: 'Lora', serif;
		font-size: 1.125rem;
		line-height: 1.8;
		color: #222;
		background: transparent;
		box-sizing: border-box;
	}

	.editor::placeholder {
		color: #aaa;
		font-style: italic;
	}

	.error-message {
		padding: 0.75rem 1.5rem;
		background: #fee2e2;
		color: #991b1b;
		font-family: 'Red Hat Display', sans-serif;
		font-size: 14px;
	}

	.action-bar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		background: rgba(255, 255, 255, 0.8);
	}

	.save-button,
	.submit-button,
	.queue-button,
	.unqueue-button {
		font-family: 'Monomaniac One', sans-serif;
		font-size: 16px;
		padding: 0.75rem 1.5rem;
		border-radius: 12px;
		cursor: pointer;
		transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
	}

	.save-button {
		background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
		border: 1px solid #dee2e6;
		color: #495057;
	}

	.save-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.submit-button {
		background: linear-gradient(180deg, #60c5f1 0%, #3ba8d8 100%);
		border: 1px solid #2d8fc0;
		color: white;
		box-shadow: 0 2px 8px rgba(59, 168, 216, 0.3);
	}

	.submit-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(59, 168, 216, 0.4);
	}

	.queue-button {
		background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
		border: 1px solid #7c3aed;
		color: white;
		box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
	}

	.queue-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
	}

	.unqueue-button {
		background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
		border: 1px solid #dee2e6;
		color: #495057;
	}

	.unqueue-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.queue-info {
		font-family: 'Lora', serif;
		font-style: italic;
		font-size: 14px;
		color: #666;
	}

	.save-button:disabled,
	.submit-button:disabled,
	.queue-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.queued-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
		border-bottom: 1px solid #86efac;
	}

	.queued-icon {
		font-size: 1.25rem;
		color: #16a34a;
	}

	.queued-text {
		font-family: 'Red Hat Display', sans-serif;
		font-weight: 600;
		font-size: 14px;
		color: #166534;
	}

	.queued-indicator {
		color: #8b5cf6;
		font-weight: 600;
	}

	.editor.readonly {
		background: #f9fafb;
		color: #666;
	}

	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #10b981;
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-family: 'Red Hat Display', sans-serif;
		font-weight: 600;
		box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
		animation: fadeInUp 0.3s ease;
		max-width: 90%;
		text-align: center;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	@media (max-width: 640px) {
		.submit-page {
			padding: 1rem;
		}

		.page-title {
			font-size: 1.75rem;
		}

		.info-bar {
			flex-direction: column;
			gap: 1rem;
		}

		.time-remaining {
			margin-left: 0;
		}

		.editor {
			min-height: 350px;
			font-size: 1rem;
		}

		.action-bar {
			flex-direction: column;
		}

		.save-button,
		.submit-button {
			width: 100%;
		}
	}
</style>
