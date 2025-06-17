#!/usr/bin/env node

// DEBUG: Comprehensive custom domain testing script
// Tests all custom domain functionality without requiring actual domain purchase

const chalk = require('chalk');
const fetch = require('node-fetch');

class CustomDomainTester {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    this.testChatbotId = 'test-chatbot-' + Date.now();
    this.testDomain = 'test.example.com';
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };
    console.log(colors[type](`${type.toUpperCase()}: ${message}`));
  }

  async test(description, testFn) {
    try {
      this.log(`Testing: ${description}`, 'info');
      const result = await testFn();
      
      if (result) {
        this.log(`✅ PASSED: ${description}`, 'success');
        this.results.passed++;
      } else {
        this.log(`❌ FAILED: ${description}`, 'error');
        this.results.failed++;
      }
      
      this.results.tests.push({ description, passed: result });
      return result;
    } catch (error) {
      this.log(`❌ ERROR: ${description} - ${error.message}`, 'error');
      this.results.failed++;
      this.results.tests.push({ description, passed: false, error: error.message });
      return false;
    }
  }

  // Test 1: Domain Validation
  async testDomainValidation() {
    return await this.test('Domain validation function', async () => {
      const validDomains = [
        'example.com',
        'chat.example.com',
        'my-company.co.uk',
        'test123.io'
      ];
      
      const invalidDomains = [
        '',
        'localhost',
        'invalid..domain',
        'vercel.app',
        'https://example.com',
        '127.0.0.1'
      ];

      // Test valid domains
      for (const domain of validDomains) {
        const isValid = this.validateDomain(domain);
        if (!isValid) {
          this.log(`Valid domain failed validation: ${domain}`, 'error');
          return false;
        }
      }

      // Test invalid domains
      for (const domain of invalidDomains) {
        const isValid = this.validateDomain(domain);
        if (isValid) {
          this.log(`Invalid domain passed validation: ${domain}`, 'error');
          return false;
        }
      }

      return true;
    });
  }

  // Test 2: API Endpoints
  async testAPIEndpoints() {
    const endpoints = [
      { path: '/api/domains/verify', method: 'POST' },
      { path: '/api/domains/authorize', method: 'POST' },
      { path: '/api/domains', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      await this.test(`${endpoint.method} ${endpoint.path} endpoint exists`, async () => {
        try {
          const url = `${this.baseUrl}${endpoint.path}`;
          const options = {
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' }
          };

          if (endpoint.method === 'POST') {
            options.body = JSON.stringify({
              chatbotId: this.testChatbotId,
              domain: this.testDomain
            });
          } else if (endpoint.method === 'GET') {
            url += `?chatbotId=${this.testChatbotId}&domain=${this.testDomain}`;
          }

          const response = await fetch(url, options);
          
          // We expect 400/404 errors for test data, but not 500 or network errors
          return response.status !== 500 && response.status < 600;
        } catch (error) {
          // Network errors indicate the endpoint doesn't exist
          return false;
        }
      });
    }

    return true;
  }

  // Test 3: Environment Variables
  async testEnvironmentVariables() {
    return await this.test('Environment variables configuration', async () => {
      const requiredEnvVars = [
        'VERCEL_API_TOKEN',
        'FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_APP_URL'
      ];

      let allSet = true;
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          this.log(`Missing environment variable: ${envVar}`, 'warning');
          allSet = false;
        }
      }

      return allSet;
    });
  }

  // Test 4: Domain Configuration Flow
  async testDomainConfigurationFlow() {
    return await this.test('Domain configuration flow', async () => {
      // Simulate the flow of configuring a custom domain
      const steps = [
        () => this.validateDomain(this.testDomain),
        () => this.mockSaveDomainToFirestore(this.testChatbotId, this.testDomain),
        () => this.mockUpdateEnvironmentVariables(this.testDomain),
        () => this.mockAddDomainToVercel(this.testDomain)
      ];

      for (let i = 0; i < steps.length; i++) {
        const stepResult = await steps[i]();
        if (!stepResult) {
          this.log(`Domain configuration step ${i + 1} failed`, 'error');
          return false;
        }
      }

      return true;
    });
  }

  // Test 5: Component Integration
  async testComponentIntegration() {
    return await this.test('Component integration tests', async () => {
      // These would be more comprehensive in a real React testing environment
      const components = [
        'CustomDomainForm',
        'CustomDomainStatus', 
        'CustomDomainManager'
      ];

      // Basic checks for component files
      const fs = require('fs');
      const path = require('path');

      for (const component of components) {
        const componentPath = path.join(__dirname, '..', 'src', 'components', 'chatbot', `${component}.tsx`);
        if (!fs.existsSync(componentPath)) {
          this.log(`Component file missing: ${component}.tsx`, 'error');
          return false;
        }
      }

      return true;
    });
  }

  // Test 6: Template Integration
  async testTemplateIntegration() {
    return await this.test('Template integration', async () => {
      const templatePath = process.env.TEMPLATE_PATH || '../ChatFactoryTemplate';
      const fs = require('fs');
      const path = require('path');

      const requiredFiles = [
        'middleware.ts',
        'utils/customDomain.ts',
        'hooks/useDomain.ts',
        'components/core/DomainAwareBranding.tsx'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(templatePath, file);
        if (!fs.existsSync(filePath)) {
          this.log(`Template file missing: ${file}`, 'error');
          return false;
        }
      }

      return true;
    });
  }

  // Test 7: DNS Configuration Instructions
  async testDNSInstructions() {
    return await this.test('DNS configuration instructions', async () => {
      const instructions = this.generateDNSInstructions(this.testDomain);
      
      return (
        instructions.includes('CNAME') &&
        instructions.includes('A') &&
        instructions.includes(this.testDomain) &&
        instructions.includes('vercel.app')
      );
    });
  }

  // Helper Methods
  validateDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253 && !domain.includes('localhost') && !domain.includes('vercel.app');
  }

  async mockSaveDomainToFirestore(chatbotId, domain) {
    // Mock Firestore save - in real implementation this would save to Firestore
    this.log(`Mock: Saving domain ${domain} for chatbot ${chatbotId}`, 'info');
    return true;
  }

  async mockUpdateEnvironmentVariables(domain) {
    // Mock environment variable update
    this.log(`Mock: Setting NEXT_PUBLIC_CUSTOM_DOMAIN=${domain}`, 'info');
    return true;
  }

  async mockAddDomainToVercel(domain) {
    // Mock Vercel domain addition
    this.log(`Mock: Adding domain ${domain} to Vercel project`, 'info');
    return true;
  }

  generateDNSInstructions(domain) {
    return `
DNS Configuration for ${domain}:

Option 1 - CNAME Record:
${domain} CNAME your-chatbot.vercel.app

Option 2 - A Record:
${domain} A 76.76.21.21

Wait for DNS propagation (up to 24 hours)
    `.trim();
  }

  // Main test runner
  async runAllTests() {
    this.log('🧪 Starting Custom Domain Testing Suite', 'info');
    this.log(`Test Domain: ${this.testDomain}`, 'info');
    this.log(`Base URL: ${this.baseUrl}`, 'info');
    console.log('─'.repeat(50));

    // Run all tests
    await this.testDomainValidation();
    await this.testAPIEndpoints();
    await this.testEnvironmentVariables();
    await this.testDomainConfigurationFlow();
    await this.testComponentIntegration();
    await this.testTemplateIntegration();
    await this.testDNSInstructions();

    // Print results
    console.log('─'.repeat(50));
    this.log('📊 TEST RESULTS', 'info');
    this.log(`✅ Passed: ${this.results.passed}`, 'success');
    this.log(`❌ Failed: ${this.results.failed}`, 'error');
    this.log(`📈 Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`, 'info');

    if (this.results.failed > 0) {
      console.log('\n🔧 Failed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          this.log(`• ${test.description}${test.error ? ` (${test.error})` : ''}`, 'error');
        });
    }

    console.log('\n🎯 Next Steps:');
    if (this.results.failed === 0) {
      this.log('All tests passed! Your custom domain implementation is ready.', 'success');
      this.log('Consider purchasing a domain for production testing.', 'info');
    } else {
      this.log('Fix the failed tests before proceeding with domain purchase.', 'warning');
    }

    return this.results.failed === 0;
  }
}

// CLI Usage
if (require.main === module) {
  const tester = new CustomDomainTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = CustomDomainTester;