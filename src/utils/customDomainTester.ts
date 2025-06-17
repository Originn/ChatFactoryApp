// Debug/Test script: Comprehensive custom domain testing
// This script validates all aspects of custom domain functionality

export interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  expected?: string;
  actual?: string;
}

export class CustomDomainTester {
  private chatbotId: string;
  private customDomain: string;
  private results: TestResult[] = [];

  constructor(chatbotId: string, customDomain: string) {
    this.chatbotId = chatbotId;
    this.customDomain = customDomain;
  }

  // Test 1: Domain format validation
  async testDomainValidation(): Promise<TestResult> {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    const isValid = domainRegex.test(this.customDomain) && this.customDomain.length <= 253;
    
    return {
      test: 'Domain Format Validation',
      passed: isValid,
      details: isValid ? 'Domain format is valid' : 'Invalid domain format',
      expected: 'Valid domain format',
      actual: isValid ? 'Valid' : 'Invalid'
    };
  }

  // Test 2: API endpoint availability
  async testAPIEndpoints(): Promise<TestResult[]> {
    const endpoints = [
      { name: 'Domain Status', url: `/api/domains?chatbotId=${this.chatbotId}&domain=${this.customDomain}` },
      { name: 'Domain Verification', url: '/api/domains/verify', method: 'POST' },
      { name: 'Firebase Authorization', url: '/api/domains/authorize', method: 'POST' }
    ];

    const results: TestResult[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = endpoint.method === 'POST' ? 
          await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatbotId: this.chatbotId, domain: this.customDomain, customDomain: this.customDomain })
          }) : 
          await fetch(endpoint.url);

        results.push({
          test: `API Endpoint - ${endpoint.name}`,
          passed: response.status < 500,
          details: `Status: ${response.status}`,
          expected: 'Status < 500',
          actual: `Status: ${response.status}`
        });
      } catch (error) {
        results.push({
          test: `API Endpoint - ${endpoint.name}`,
          passed: false,
          details: `Error: ${error}`,
          expected: 'Successful response',
          actual: 'Network error'
        });
      }
    }

    return results;
  }

  // Test 3: Firestore integration
  async testFirestoreIntegration(): Promise<TestResult> {
    try {
      // This would typically be done server-side
      const response = await fetch('/api/chatbots/' + this.chatbotId);
      const chatbot = await response.json();
      
      const hasDomainField = 'domain' in chatbot;
      const domainMatches = chatbot.domain === this.customDomain;

      return {
        test: 'Firestore Integration',
        passed: hasDomainField && domainMatches,
        details: hasDomainField ? 
          (domainMatches ? 'Domain correctly stored' : 'Domain mismatch') : 
          'Domain field missing',
        expected: this.customDomain,
        actual: chatbot.domain || 'undefined'
      };
    } catch (error) {
      return {
        test: 'Firestore Integration',
        passed: false,
        details: `Error: ${error}`,
        expected: 'Domain stored in Firestore',
        actual: 'Error accessing Firestore'
      };
    }
  }

  // Test 4: Environment variables in deployment
  async testDeploymentEnvironment(): Promise<TestResult> {
    try {
      // Check if the template has the correct environment variables
      const response = await fetch('/api/debug/environment');
      const env = await response.json();
      
      const hasCustomDomain = 'NEXT_PUBLIC_CUSTOM_DOMAIN' in env;
      const domainMatches = env.NEXT_PUBLIC_CUSTOM_DOMAIN === this.customDomain;

      return {
        test: 'Deployment Environment Variables',
        passed: hasCustomDomain && domainMatches,
        details: hasCustomDomain ? 
          (domainMatches ? 'Environment variables correctly set' : 'Environment variable mismatch') : 
          'NEXT_PUBLIC_CUSTOM_DOMAIN not set',
        expected: this.customDomain,
        actual: env.NEXT_PUBLIC_CUSTOM_DOMAIN || 'undefined'
      };
    } catch (error) {
      return {
        test: 'Deployment Environment Variables',
        passed: false,
        details: `Error: ${error}`,
        expected: 'Environment variables set',
        actual: 'Error checking environment'
      };
    }
  }

  // Test 5: DNS configuration check (simulation)
  async testDNSConfiguration(): Promise<TestResult> {
    try {
      // This is a simplified DNS check - in production you'd use actual DNS lookup
      const response = await fetch(`https://${this.customDomain}`, { 
        method: 'HEAD', 
        mode: 'no-cors' 
      });
      
      return {
        test: 'DNS Configuration',
        passed: true,
        details: 'Domain is reachable',
        expected: 'Domain resolves',
        actual: 'Domain accessible'
      };
    } catch (error) {
      return {
        test: 'DNS Configuration',
        passed: false,
        details: 'Domain not reachable - DNS may need configuration',
        expected: 'Domain resolves to deployment',
        actual: 'Domain not accessible'
      };
    }
  }

  // Run all tests
  async runAllTests(): Promise<TestResult[]> {
    console.log(`🧪 Starting comprehensive custom domain tests for: ${this.customDomain}`);
    
    const results: TestResult[] = [];

    // Test 1: Domain validation
    results.push(await this.testDomainValidation());

    // Test 2: API endpoints
    const apiResults = await this.testAPIEndpoints();
    results.push(...apiResults);

    // Test 3: Firestore integration
    results.push(await this.testFirestoreIntegration());

    // Test 4: Environment variables
    results.push(await this.testDeploymentEnvironment());

    // Test 5: DNS configuration
    results.push(await this.testDNSConfiguration());

    this.results = results;
    return results;
  }

  // Generate test report
  generateReport(): string {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    let report = `\n🧪 Custom Domain Test Report\n`;
    report += `Domain: ${this.customDomain}\n`;
    report += `Chatbot ID: ${this.chatbotId}\n`;
    report += `Results: ${passed}/${total} tests passed\n\n`;

    this.results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      report += `${index + 1}. ${icon} ${result.test}\n`;
      report += `   Details: ${result.details}\n`;
      if (result.expected && result.actual) {
        report += `   Expected: ${result.expected}\n`;
        report += `   Actual: ${result.actual}\n`;
      }
      report += '\n';
    });

    if (passed === total) {
      report += '🎉 All tests passed! Your custom domain implementation is working correctly.\n';
    } else {
      report += '⚠️  Some tests failed. Please review the details above and fix the issues.\n';
    }

    return report;
  }
}

// Usage example:
// const tester = new CustomDomainTester('chatbot-123', 'chat.example.com');
// const results = await tester.runAllTests();
// console.log(tester.generateReport());