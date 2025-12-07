import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import { submitArticle, getArticles, saveQuiz } from '$lib/db';
import { generateQuizFromArticle } from '$lib/quizGenerator';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const result = await submitArticle(
			body.group_id,
			body.member_id,
			body.rotation_number,
			body.content
		);

		// Automatically generate and save quiz for the article
		try {
			console.log('Article submitted with ID:', result.id);
			console.log('Full result object:', result);
			
			const apiKey = GEMINI_API_KEY;
			let questions;

			if (apiKey) {
				// Use Gemini AI to generate quiz
				const prompt = `Read the following article and generate 5 multiple-choice comprehension questions about its content (should be about the person who wrote the article). For each question, provide 4 answer options and indicate the correct answer by index (0-based). Output your response as a JSON array in the following format:

[
  {
    "question": "Question text here",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0
  },
  ...
]

Article:
${body.content}`;

				const geminiResponse = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							contents: [
								{
									parts: [
										{
											text: prompt
										}
									]
								}
							]
						})
					}
				);

				if (geminiResponse.ok) {
					const data = await geminiResponse.json();
					let content_text = data.candidates[0].content.parts[0].text.trim();
					console.log('Gemini response text:', content_text);
					
					// Remove markdown code blocks if present
					if (content_text.startsWith('```json')) {
						content_text = content_text.slice(7);
					} else if (content_text.startsWith('```')) {
						content_text = content_text.slice(3);
					}
					if (content_text.endsWith('```')) {
						content_text = content_text.slice(0, -3);
					}
					content_text = content_text.trim();
					
					try {
						questions = JSON.parse(content_text);
						console.log('Successfully generated quiz with Gemini');
					} catch (e) {
						console.warn('Gemini response is not valid JSON. Printing plain text:');
						console.log(content_text);
						questions = generateQuizFromArticle(body.content, 5);
					}
				} else {
					console.warn('Gemini API failed, using algorithm-based generation');
					questions = generateQuizFromArticle(body.content, 5);
				}
			} else {
				// Fallback to algorithm-based generation
				questions = generateQuizFromArticle(body.content, 5);
			}

			// Save the generated quiz
			await saveQuiz(result.id, questions);
			console.log('Quiz saved for article:', result.id);
		} catch (quizError) {
			console.error('Error generating quiz:', quizError);
			// Quiz generation is optional, don't fail the article submission
		}

		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

export async function GET({ url }) {
	try {
		const groupId = url.searchParams.get('groupId');
		if (!groupId) {
			return json({ error: 'groupId query parameter required' }, { status: 400 });
		}
		const result = await getArticles(groupId);
		return json(result);
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}
