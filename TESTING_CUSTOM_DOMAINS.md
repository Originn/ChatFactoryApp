# Custom Domain Testing Guide

## 🧪 Testing Without Domain Purchase

### 1. Component & Database Testing
Test the core functionality without DNS configuration:

```bash
# Test chatbot creation with custom domain
1. Create chatbot with domain: "test.example.com"
2. Check Firestore: domain field saved correctly
3. Check deployment API: domain passed to Vercel API
4. Check Firebase: domain added to authorized domains
```

### 2. API Endpoint Testing

Test all custom domain endpoints:

```bash
# Test domain verification API
curl -X POST http://localhost:3000/api/domains/verify \
  -H "Content-Type: application/json" \
  -d '{"chatbotId":"test-chatbot-id","domain":"test.example.com"}'

# Test domain status API  
curl "http://localhost:3000/api/domains?chatbotId=test-chatbot-id&domain=test.example.com"

# Test Firebase authorization API
curl -X POST http://localhost:3000/api/domains/authorize \
  -H "Content-Type: application/json" \
  -d '{"chatbotId":"test-chatbot-id","customDomain":"test.example.com"}'
```

### 3. Hosts File Testing (Free)

Test domain routing without purchasing domain:

```bash
# 1. Edit your hosts file
# Windows: C:\Windows\System32\drivers\etc\hosts
# Mac/Linux: /etc/hosts

# Add this line:
127.0.0.1 test.example.com

# 2. Run your app on localhost:3000
npm run dev

# 3. Access via: http://test.example.com:3000
# Should trigger custom domain detection
```

### 4. ngrok Testing (Free)

Test with public URLs using ngrok:

```bash
# 1. Install ngrok
npm install -g ngrok

# 2. Start your app
npm run dev

# 3. Expose via ngrok
ngrok http 3000

# You get: https://abc123.ngrok.io
# Use this as your "custom domain" for testing
```

### 5. Vercel Preview Domains (Free)

Use Vercel's preview URLs for testing:

```bash
# Deploy to Vercel
vercel --prod

# You get: https://your-app-abc123.vercel.app
# Use a subdomain like: https://chat.your-app-abc123.vercel.app
```

## 🔍 What to Test

### Frontend (ChatFactory App)
- [ ] Custom domain field in chatbot creation form
- [ ] Domain validation (format checking)
- [ ] Domain saved to Firestore correctly
- [ ] CustomDomainStatus component shows correct status
- [ ] Error handling for invalid domains

### Backend APIs
- [ ] `/api/vercel-deploy` - Domain configuration
- [ ] `/api/domains` - Domain status checking
- [ ] `/api/domains/verify` - Domain verification
- [ ] `/api/domains/authorize` - Firebase authorization

### Template (ChatFactoryTemplate)
- [ ] Middleware detects custom domains
- [ ] `useDomain` hook returns correct info
- [ ] DomainAwareBranding shows/hides "Powered by"
- [ ] Environment variables set correctly

### Firebase Integration
- [ ] Custom domain added to authorized domains
- [ ] Authentication works on custom domain
- [ ] Error handling if authorization fails

## 📊 Testing Checklist

### Phase 1: Basic Functionality
```bash
✅ Create chatbot with custom domain
✅ Check domain saved in Firestore
✅ Verify API responses
✅ Test validation logic
```

### Phase 2: Integration Testing
```bash
✅ Deploy chatbot with custom domain
✅ Check Vercel project configuration
✅ Verify Firebase authorized domains
✅ Test template environment variables
```

### Phase 3: End-to-End Testing
```bash
✅ Access via custom domain (hosts file)
✅ Check branding changes
✅ Test authentication flow
✅ Verify debug information
```

## 🆓 Free Domain Options (If Needed)

If you want to test with real domains:

### Free DNS Services
- **Freenom**: .tk, .ml, .ga, .cf domains
- **Duck DNS**: free dynamic DNS
- **No-IP**: free hostnames

### Subdomain Testing
- Use existing domain subdomains
- GitHub Pages: username.github.io
- Netlify: app-name.netlify.app

### Development Domains
- **localhost.run**: automatic HTTPS tunnels
- **serveo.net**: SSH tunnels
- **localtunnel**: expose local servers

## 🛠 Quick Test Script

Create this test script to verify functionality:

```javascript
// test-custom-domain.js
const testDomain = 'test.example.com';
const chatbotId = 'test-chatbot-123';

async function testCustomDomain() {
  console.log('🧪 Testing Custom Domain Functionality...');
  
  // 1. Test domain validation
  const isValid = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(testDomain);
  console.log('✅ Domain validation:', isValid);
  
  // 2. Test API endpoints
  try {
    const response = await fetch('/api/domains/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId, domain: testDomain })
    });
    
    console.log('✅ API endpoint test:', response.status);
  } catch (error) {
    console.log('❌ API endpoint test failed:', error.message);
  }
  
  // 3. Test environment variables
  console.log('✅ Custom domain env var:', process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || 'Not set');
}

testCustomDomain();
```

## 🎯 Recommended Testing Order

1. **Start with hosts file testing** (5 minutes)
2. **Test API endpoints** (10 minutes)  
3. **Verify database storage** (5 minutes)
4. **Test template components** (10 minutes)
5. **End-to-end flow testing** (15 minutes)

**Total testing time: ~45 minutes without domain purchase!**

## 🚀 Production Testing (When Ready)

Only purchase domain when you're confident:
- All tests pass locally
- API endpoints work correctly
- Firebase integration works
- Template renders properly
- Error handling works

Then buy a cheap domain (~$10/year) for final verification.
