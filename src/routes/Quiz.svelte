<script context="module" lang="ts">
export async function createGroup(settings: any) {
	// Simple POST — adjust endpoint/payload to match your backend
	const res = await fetch('/api/groups', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(settings)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`createGroup failed: ${res.status} ${res.statusText} ${text}`);
	}

	return res.json();
}
</script>

<script lang="ts">
	import type { QuizQuestion } from '$lib/db';

	export let questions: QuizQuestion[] = [];
	export let articleTitle: string = 'Article Quiz';
	export let onSubmit: (answers: number[], score: number) => void = () => {};

	let userAnswers: (number | null)[] = questions.map(() => null);
	let submitted = false;
	let score = 0;

	function handleAnswerSelect(questionIdx: number, optionIdx: number) {
		if (!submitted) {
			userAnswers[questionIdx] = optionIdx;
		}
	}

	function submitQuiz() {
		if (userAnswers.some((a) => a === null)) {
			alert('Please answer all questions before submitting');
			return;
		}

		let correctCount = 0;
		userAnswers.forEach((answer, idx) => {
			if (answer === questions[idx].correctAnswer) {
				correctCount++;
			}
		});

		score = Math.round((correctCount / questions.length) * 100);
		submitted = true;
		onSubmit(userAnswers as number[], score);
	}

	function resetQuiz() {
		userAnswers = questions.map(() => null);
		submitted = false;
		score = 0;
	}
</script>

<div class="quiz-container">
	<h2>{articleTitle} - Quiz</h2>
	<p class="quiz-subtitle">Test your understanding of this article</p>

	{#if submitted}
		<div class="quiz-results">
			<h3>Quiz Complete!</h3>
			<div class="score-display">
				<div class="score-number">{score}%</div>
				<p class="score-message">
					{#if score === 100}
						Perfect score! Excellent understanding of the material.
					{:else if score >= 80}
						Great job! You have a strong grasp of the material.
					{:else if score >= 60}
						Good effort! You understood most of the material.
					{:else}
						Keep reviewing the article for a better understanding.
					{/if}
				</p>
			</div>

			<div class="review-section">
				<h4>Review Your Answers</h4>
				{#each questions as question, idx}
					<div class="review-item">
						<p class="review-question">
							<strong>Q{idx + 1}:</strong> {question.question}
						</p>
						<p class="review-answer">
							Your answer: <span class={userAnswers[idx] === question.correctAnswer ? 'correct' : 'incorrect'}>
								{question.options[userAnswers[idx] ?? 0]}
							</span>
						</p>
						{#if userAnswers[idx] !== question.correctAnswer}
							<p class="correct-answer">
								Correct answer: <span class="correct">{question.options[question.correctAnswer]}</span>
							</p>
						{/if}
					</div>
				{/each}
			</div>

			<button class="btn-reset" on:click={resetQuiz}>Retake Quiz</button>
		</div>
	{:else}
		<div class="quiz-questions">
			{#each questions as question, idx}
				<div class="question-card">
					<h4>Question {idx + 1} of {questions.length}</h4>
					<p class="question-text">{question.question}</p>

					<div class="options">
						{#each question.options as option, optionIdx}
							<label class="option-label">
								<input
									type="radio"
									name={`question-${idx}`}
									value={optionIdx}
									checked={userAnswers[idx] === optionIdx}
									on:change={() => handleAnswerSelect(idx, optionIdx)}
								/>
								<span class="option-text">{option}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}

			<button class="btn-submit" on:click={submitQuiz}>Submit Quiz</button>
		</div>
	{/if}
</div>

<style>
	.quiz-container {
		max-width: 700px;
		margin: 2rem auto;
		padding: 2rem;
		background: #f9f9f9;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	h2 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	.quiz-subtitle {
		color: #666;
		font-size: 0.95rem;
		margin-bottom: 2rem;
	}

	.quiz-questions {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.question-card {
		background: white;
		padding: 1.5rem;
		border-radius: 6px;
		border-left: 4px solid #0066cc;
	}

	.question-card h4 {
		color: #0066cc;
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
	}

	.question-text {
		font-size: 1.1rem;
		margin-bottom: 1.5rem;
		color: #333;
		line-height: 1.5;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.option-label {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		background: #f0f0f0;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.option-label:hover {
		background: #e0e0e0;
	}

	.option-label input[type='radio'] {
		margin-right: 0.75rem;
		cursor: pointer;
	}

	.option-text {
		flex: 1;
		color: #333;
	}

	.btn-submit {
		padding: 0.75rem 2rem;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-submit:hover {
		background: #0052a3;
	}

	.quiz-results {
		text-align: center;
	}

	.quiz-results h3 {
		color: #333;
		margin-bottom: 2rem;
	}

	.score-display {
		margin-bottom: 3rem;
	}

	.score-number {
		font-size: 4rem;
		font-weight: bold;
		color: #0066cc;
		margin-bottom: 0.5rem;
	}

	.score-message {
		font-size: 1.1rem;
		color: #666;
	}

	.review-section {
		text-align: left;
		margin-bottom: 2rem;
	}

	.review-section h4 {
		color: #333;
		margin-bottom: 1.5rem;
	}

	.review-item {
		background: white;
		padding: 1.5rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		border-left: 4px solid #999;
	}

	.review-question {
		color: #333;
		margin-bottom: 0.75rem;
		font-weight: 500;
	}

	.review-answer,
	.correct-answer {
		margin: 0.5rem 0;
		font-size: 0.95rem;
	}

	.correct {
		color: #00aa00;
		font-weight: bold;
	}

	.incorrect {
		color: #cc0000;
		font-weight: bold;
	}

	.btn-reset {
		padding: 0.75rem 2rem;
		background: #666;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-reset:hover {
		background: #555;
	}
</style>
