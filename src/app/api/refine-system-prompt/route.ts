import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPrompt, refinementRequest } = body;

    if (!currentPrompt || !refinementRequest) {
      return NextResponse.json(
        { error: 'Missing required fields: currentPrompt, refinementRequest' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    // Create the prompt for Gemini to refine the system prompt
    const refinementPrompt = `You are an expert at refining AI system prompts. Your task is to improve an existing system prompt based on the user's feedback.

**Current System Prompt:**
${currentPrompt}

**User's Refinement Request:**
${refinementRequest}

**Your Task:**
Improve the system prompt based on the user's request while maintaining the overall structure and format:
- Keep the introduction with role definition and "{language} language" placeholder
- Maintain bullet points starting with "-" and ending with "\\n"
- Preserve any product-specific information
- Keep all existing good practices unless explicitly asked to change them
- Apply the user's requested changes or additions

**Format Requirements:**
- Return ONLY the improved system prompt text
- DO NOT include any markdown formatting, code blocks, or explanatory text
- DO NOT include template variables (CONTEXT, Image Description, etc.) - those are added automatically
- Maintain the exact same format as the current prompt (bullet points with - and \\n)
- DO NOT wrap the output in quotes

Generate the refined system prompt now:`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(refinementPrompt);
    const response = await result.response;
    let refinedPrompt = response.text();

    // Clean up the response - remove any markdown code blocks if present
    refinedPrompt = refinedPrompt.replace(/```[\w]*\n?/g, '').trim();

    // Remove any quotes wrapping the entire response
    if ((refinedPrompt.startsWith('"') && refinedPrompt.endsWith('"')) ||
        (refinedPrompt.startsWith("'") && refinedPrompt.endsWith("'"))) {
      refinedPrompt = refinedPrompt.slice(1, -1);
    }

    return NextResponse.json({
      success: true,
      refinedPrompt,
    });

  } catch (error: any) {
    console.error('System prompt refinement error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to refine system prompt',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
