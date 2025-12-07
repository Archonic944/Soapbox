import { json } from '@sveltejs/kit';

export async function GET() {
    // Try both variants
    const apiKey1 = process.env.OPENAI_API_KEY;
    const apiKey2 = process.env.VITE_OPENAI_API_KEY;
    
    return json({
        hasApiKey_normal: !!apiKey1,
        hasApiKey_vite: !!apiKey2,
        apiKeyLength: (apiKey1 || apiKey2)?.length || 0,
        apiKeyPrefix: (apiKey1 || apiKey2)?.slice(0, 10) || 'N/A'
    });
}
