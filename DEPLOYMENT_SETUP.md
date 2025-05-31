# ChatFactory Deployment - Simplified

## ✅ **SIMPLIFIED DEPLOYMENT**

The deployment system has been simplified to deploy directly to production without staging complexity.

### **How It Works:**

1. **Single Deploy Button**: Deploy directly to production from main branch
2. **No Staging**: No preview/staging workflow needed
3. **No Go Live Button**: Deployments are live immediately

### **Deployment Process:**

```javascript
POST /api/vercel-deploy
{
  "chatbotId": "xxx",
  "chatbotName": "My Bot"
}

// Creates production deployment from 'main' branch
// Result: Live deployment with production domain
```

### **What Changed:**

- ✅ Always deploys from `main` branch
- ✅ Always uses `target: 'production'`  
- ✅ No staging branch required
- ✅ No promotion logic needed
- ✅ Deployments are immediately live

### **Database Status:**

All deployments are saved with:
- `status: 'live'`
- `isStaged: false`
- `target: 'production'`
- `gitRef: 'main'`

### **Cleaned Up Files:**

- ❌ **DELETED**: `/api/deployment/promote/route.ts` - No longer needed
- ❌ **DELETED**: `/api/deployment/check/route.ts` - No longer needed  
- ❌ **DELETED**: `/api/deployment/` directory - Empty after cleanup

### **Remaining Files:**

- ✅ **KEPT**: `/api/vercel-deploy/route.ts` - Main deployment logic
