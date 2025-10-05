import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, supportEmail = '', chatbotType, additionalInstructions = '' } = body;

    if (!productName || !chatbotType) {
      return NextResponse.json(
        { error: 'Missing required fields: productName, chatbotType' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    // Create the prompt for Gemini to generate the system prompt
    const generationPrompt = `You are a professional AI system prompt creator. Your task is to create a well-structured system prompt for a chatbot based on the user's requirements.

**User Requirements:**
- Product/Company Name: ${productName}
- Chatbot Type/Role: ${chatbotType}
${supportEmail ? `- Support Contact Email: ${supportEmail}` : ''}
${additionalInstructions ? `- Additional Instructions: ${additionalInstructions}` : ''}

**Format Requirements:**
1. Start with a clear introduction that defines the chatbot's role and capabilities
2. Include "Answer in the {language} language" in the introduction
3. Reference helping "${productName} users" in the introduction
4. Follow the introduction with a blank line (\\n\\n)
5. Then list behavioral instructions, each on a new line starting with "-"
6. Each instruction should end with "\\n"
7. Instructions should be clear, specific, and actionable
8. Include instructions about:
   - Handling unknown information (admit when you don't know)
   - Staying on topic (${productName}-related)
   - Using provided CONTEXT appropriately
   - Not making up information or links
   - When to include code examples
   - User feedback for missing information
${supportEmail ? `   - When users need additional help beyond the chatbot's capabilities, direct them to contact ${supportEmail} for human support` : ''}

**Example Structure:**
"You are a [role] that can [capabilities]. Answer in the {language} language. You focus on helping [ProductName] users with their questions.\\n\\n" +
"- [Instruction 1]\\n" +
"- [Instruction 2]\\n" +
"- [Instruction 3]\\n" +
...

**Important:**
- DO NOT include any markdown formatting, code blocks, or explanatory text
- Return ONLY the system prompt text exactly as it should be used
- DO NOT include the template variables section (CONTEXT, Image Description, etc.) - those are added automatically
- Make it professional and aligned with the chatbot type: ${chatbotType}
- The response should be a single continuous string with proper \\n line breaks

Generate the system prompt now:`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(generationPrompt);
    const response = await result.response;
    let systemPrompt = response.text();

    // Clean up the response - remove any markdown code blocks if present
    systemPrompt = systemPrompt.replace(/```[\w]*\n?/g, '').trim();

    // Remove any quotes wrapping the entire response
    if ((systemPrompt.startsWith('"') && systemPrompt.endsWith('"')) ||
        (systemPrompt.startsWith("'") && systemPrompt.endsWith("'"))) {
      systemPrompt = systemPrompt.slice(1, -1);
    }

    return NextResponse.json({
      success: true,
      systemPrompt,
    });

  } catch (error: any) {
    console.error('System prompt generation error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate system prompt',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
