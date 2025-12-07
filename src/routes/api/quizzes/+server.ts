import { json } from '@sveltejs/kit';
import { saveQuiz, getQuiz, saveQuizAttempt } from '$lib/db';

// POST - Generate and save a new quiz
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { articleId, questions } = body;

		const result = await saveQuiz(articleId, questions);
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

// GET - Retrieve a quiz by article ID
export async function GET({ url }) {
	try {
		const articleId = url.searchParams.get('articleId');
		if (!articleId) {
			return json({ error: 'articleId query parameter required' }, { status: 400 });
		}

		const result = await getQuiz(articleId);
		return json(result);
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

// PUT - Save quiz attempt
export async function PUT({ request }) {
	try {
		const body = await request.json();
		const { quizId, memberId, answers, score } = body;

		const result = await saveQuizAttempt(quizId, memberId, answers, score);
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}
