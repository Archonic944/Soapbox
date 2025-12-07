import { json } from '@sveltejs/kit';
import { getQuizAttemptsForArticle } from '$lib/db';

// GET - Retrieve quiz attempts for an article
export async function GET({ url }) {
	try {
		const articleId = url.searchParams.get('articleId');
		if (!articleId) {
			return json({ error: 'articleId query parameter required' }, { status: 400 });
		}

		const result = await getQuizAttemptsForArticle(articleId);
		return json(result);
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}
