import type { QuizQuestion } from './db';

/**
 * Generates quiz questions from article content.
 * This uses a simple algorithm to extract key sentences and create multiple-choice questions.
 * In a production app, you might integrate with an LLM API like OpenAI or Claude.
 */
export function generateQuizFromArticle(
	content: string,
	numQuestions: number = 5
): QuizQuestion[] {
	const sentences = content
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 20); // Filter out short fragments

	const questions: QuizQuestion[] = [];

	// Simple algorithm: extract key sentences and create fill-in-the-blank style questions
	for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
		const sentence = sentences[i];
		const words = sentence.split(/\s+/);

		// Pick a random word to remove (but skip short words)
		const meaningfulWords = words.filter((w) => w.length > 4);
		if (meaningfulWords.length === 0) continue;

		const removeWordIdx = Math.floor(Math.random() * meaningfulWords.length);
		const removedWord = meaningfulWords[removeWordIdx];
		const questionText = sentence.replace(removedWord, '______');

		// Generate distractor options (wrong answers)
		const options = [
			removedWord,
			generateDistractor(removedWord, 1),
			generateDistractor(removedWord, 2),
			generateDistractor(removedWord, 3)
		].sort(() => Math.random() - 0.5);

		const correctAnswerIdx = options.indexOf(removedWord);

		questions.push({
			id: `q${i + 1}`,
			question: questionText,
			options: options,
			correctAnswer: correctAnswerIdx
		});
	}

	return questions;
}

/**
 * Generates a distractor (wrong answer) for quiz questions.
 * This is a simple implementation - in production you'd want more sophisticated alternatives.
 */
function generateDistractor(word: string, variant: number): string {
	const wordLength = word.length;

	// Different strategies for creating wrong answers
	switch (variant) {
		case 1:
			// Add a suffix
			return word + (Math.random() > 0.5 ? 'ing' : 'ed');
		case 2:
			// Replace first letter
			return String.fromCharCode(Math.random() * 26 + 65) + word.slice(1);
		case 3:
			// Use a generic opposite/related word based on context
			return 'alternative_' + word.slice(0, 3);
		default:
			return word + '_option';
	}
}

/**
 * Scores a quiz attempt by comparing user answers to correct answers.
 */
export function scoreQuiz(userAnswers: number[], questions: QuizQuestion[]): number {
	let correctCount = 0;

	for (let i = 0; i < userAnswers.length; i++) {
		if (questions[i] && userAnswers[i] === questions[i].correctAnswer) {
			correctCount++;
		}
	}

	return Math.round((correctCount / questions.length) * 100);
}

/**
 * Integrates with OpenAI API to generate quiz questions.
 * Requires OPENAI_API_KEY in environment variables.
 */
export async function generateQuizWithAI(
	content: string,
	numQuestions: number = 5
): Promise<QuizQuestion[]> {
	try {
		// Try to fetch from server which has access to environment variable
		const response = await fetch('/api/generate-quiz', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				articleContent: content,
				numQuestions,
				useAI: true
			})
		});

		if (!response.ok) {
			console.warn('Failed to generate quiz with AI, falling back to algorithm');
			return generateQuizFromArticle(content, numQuestions);
		}

		const data = await response.json();
		return data.questions;
	} catch (error) {
		console.error('Error generating quiz with AI:', error);
		return generateQuizFromArticle(content, numQuestions);
	}
}
