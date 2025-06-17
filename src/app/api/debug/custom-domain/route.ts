// Debug API endpoint: Custom domain testing and validation
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');
    const domain = searchParams.get('domain');

    if (!chatbotId || !domain) {
      return NextResponse.json({ 
        error: 'Missing required parameters: chatbotId and domain' 
      }, { status: 400 });
    }

    // Test results object
    const testResults: {
      domain: string;
      chatbotId: string;
      timestamp: string;
      tests: any;
      summary?: {
        passed: number;
        total: number;
        percentage: number;
        status: string;
      };
    } = {
      domain,
      chatbotId,
      timestamp: new Date().toISOString(),
      tests: {} as any
    };

    // Test 1: Domain format validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    const isValidFormat = domainRegex.test(domain) && domain.length <= 253;
    
    testResults.tests.domainValidation = {
      passed: isValidFormat,
      details: isValidFormat ? 'Valid domain format' : 'Invalid domain format'
    };

    // Test 2: Chatbot exists in database
    try {
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      const chatbotExists = chatbotDoc.exists;
      const chatbotData = chatbotDoc.data();
      
      testResults.tests.chatbotExists = {
        passed: chatbotExists,
        details: chatbotExists ? 'Chatbot found in database' : 'Chatbot not found'
      };

      if (chatbotExists) {
        testResults.tests.domainStorage = {
          passed: chatbotData?.domain === domain,
          details: `Stored domain: ${chatbotData?.domain || 'None'}`,
          expected: domain,
          actual: chatbotData?.domain || null
        };

        testResults.tests.deployment = {
          passed: !!chatbotData?.deployment,
          details: chatbotData?.deployment ? 
            `Deployed to: ${chatbotData.deployment.deploymentUrl}` : 
            'Not deployed yet'
        };
      }
    } catch (error) {
      testResults.tests.database = {
        passed: false,
        details: `Database error: ${error}`
      };
    }

    // Test 3: Environment variables check
    const envVars = {
      VERCEL_API_TOKEN: !!process.env.VERCEL_API_TOKEN,
      NEXT_PUBLIC_CUSTOM_DOMAIN: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || null,
      NODE_ENV: process.env.NODE_ENV
    };

    testResults.tests.environment = {
      passed: envVars.VERCEL_API_TOKEN,
      details: 'Environment variables check',
      variables: envVars
    };

    // Generate summary
    const allTests = Object.values(testResults.tests);
    const passedTests = allTests.filter((test: any) => test.passed).length;
    const totalTests = allTests.length;

    testResults.summary = {
      passed: passedTests,
      total: totalTests,
      percentage: Math.round((passedTests / totalTests) * 100),
      status: passedTests === totalTests ? 'All tests passed' : 'Some tests failed'
    };

    return NextResponse.json({
      success: true,
      ...testResults
    });

  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      error: 'Failed to run debug tests',
      details: error.message 
    }, { status: 500 });
  }
}