import { json } from '@sveltejs/kit';
import { generateQuizFromArticle } from '$lib/quizGenerator';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { articleContent, numQuestions = 5, useAI = true } = body;

		if (!articleContent) {
			return json({ error: 'articleContent is required' }, { status: 400 });
		}

		let questions;

		if (useAI) {
			// Try to use AI-powered generation with Gemini
			try {
				const apiKey = process.env.GEMINI_API_KEY;
				console.log('Gemini API Key exists:', !!apiKey);

				if (!apiKey) {
					console.warn('GEMINI_API_KEY not set, falling back to algorithm-based generation');
					questions = generateQuizFromArticle(articleContent, numQuestions);
				} else {
					const prompt = `Generate ${numQuestions} multiple-choice quiz questions based on this article. Each question should test understanding of key concepts.

Article:
${articleContent}

Return ONLY valid JSON in this exact format (no markdown, no extra text):
[
  {
    "id": "q1",
    "question": "What is being discussed?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0
  }
]

Make sure:
- correctAnswer is the index (0-3) of the correct option
- All 4 options are plausible
- Questions test understanding, not just memory
- Questions are clear and concise`;

					console.log('Calling Gemini API...');
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

					console.log('Gemini Response Status:', geminiResponse.status);

					if (!geminiResponse.ok) {
						const error = await geminiResponse.json();
						console.error('Gemini API error:', error);
						questions = generateQuizFromArticle(articleContent, numQuestions);
					} else {
						const data = await geminiResponse.json();
						const content_text = data.candidates[0].content.parts[0].text.trim();

						// Parse the JSON response
						questions = JSON.parse(content_text);

						// Validate the response
						if (!Array.isArray(questions) || questions.length === 0) {
							questions = generateQuizFromArticle(articleContent, numQuestions);
						} else {
							console.log('Successfully generated quiz with Gemini');
						}
					}
				}
			} catch (aiError) {
				console.error('Error with AI generation:', aiError);
				questions = generateQuizFromArticle(articleContent, numQuestions);
			}
		} else {
			// Use algorithm-based generation
			questions = generateQuizFromArticle(articleContent, numQuestions);
		}

		return json({ questions }, { status: 200 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
}
