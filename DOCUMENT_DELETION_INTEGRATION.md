# Document Deletion Service Integration

Complete integration guide for the enhanced document lifecycle management in ChatFactoryApp.

## 🎯 **Overview**

ChatFactoryApp now integrates with the `document-deletion-gcp-wizechat` container to provide **complete document lifecycle management** across all storage systems:

- ✅ **Pinecone** - Vector embeddings with `document_id` metadata
- ✅ **Neo4j** - Graph nodes and relationships with `document_id` property  
- ✅ **Firebase Storage** - Images and files containing `document_id` in filename
- ✅ **Local Database** - Document metadata in Firestore

## 🏗️ **Architecture**

```
┌─────────────────┐    HTTP API    ┌─────────────────┐    HTTP API    ┌─────────────────┐
│ ChatFactoryApp  │──────────────>│ Document        │──────────────>│ Storage Systems │
│                 │                │ Deletion        │                │                 │
│ - User UI       │<──────────────│ Service         │<──────────────│ - Pinecone      │
│ - Validation    │   Response     │                 │   Results     │ - Neo4j         │
│ - Local DB      │                │ - Multi-system  │                │ - Firebase      │
│   cleanup       │                │   coordination  │                │   Storage       │
└─────────────────┘                │ - Error         │                └─────────────────┘
                                   │   handling      │
                                   │ - Retry logic   │
                                   └─────────────────┘
```

## 📁 **New Files Added**

### **Core Service**
- `src/services/documentDeletionService.ts` - Main integration service
- `src/app/api/chatbot-deletion/route.ts` - Enhanced chatbot deletion API
- `src/app/api/documents/route.ts` - Updated with enhanced deletion

### **Database Extensions**
- Updated `src/services/databaseService.ts` with deletion support methods:
  - `getDocumentIdsByChatbot()` - Get all document IDs for chatbot
  - `getDocumentByDocumentId()` - Find document by ID
  - `deleteDocumentMetadata()` - Remove local metadata
  - `getChatbotDeletionConfig()` - Get deletion service configuration

### **Environment Configuration**
- Updated `.env.example` with `DOCUMENT_DELETION_SERVICE_URL`

## 🚀 **Usage Examples**

### **1. Single Document Deletion**

```typescript
import { DocumentDeletionService } from '@/services/documentDeletionService';

// Delete specific document
const result = await DocumentDeletionService.deleteDocument(
  'document-uuid-123',
  'user-456', 
  'chatbot-789'
);

if (result.success) {
  console.log('Document deleted from all systems');
  console.log(`Items deleted: ${result.details.total_items_deleted}`);
} else {
  console.error('Deletion failed:', result.error);
}
```

### **2. Complete Chatbot Deletion**

```typescript
// Delete all documents for a chatbot
const result = await DocumentDeletionService.deleteChatbotDocuments(
  'chatbot-789',
  'user-456'
);

console.log(`Deleted ${result.successful_deletions} documents`);
if (result.failed_deletions > 0) {
  console.warn(`${result.failed_deletions} documents had issues`);
}
```

### **3. API Usage**

```javascript
// Enhanced document deletion API
fetch('/api/documents', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentId: 'document-uuid-123',  // NEW: Use document_id
    userId: 'user-456',
    chatbotId: 'chatbot-789'
  })
});

// Enhanced chatbot deletion API  
fetch('/api/chatbot-deletion', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatbotId: 'chatbot-789',
    userId: 'user-456', 
    deleteVectorstore: true  // Complete cleanup
  })
});
```

## 🔧 **Configuration**

### **Environment Variables**

Add to your `.env.local`:

```bash
# Document Deletion Service URL
DOCUMENT_DELETION_SERVICE_URL=https://your-deletion-service-url.run.app
```

### **Service Dependencies**

The deletion service requires these environment variables to be configured in the deletion container:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=wizechat-docs

# Neo4j Configuration
NEO4J_URI=bolt://your-neo4j-host:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=wizechat-images
```

## 📡 **API Endpoints**

### **Enhanced Document Deletion**
```http
DELETE /api/documents
Content-Type: application/json

{
  "documentId": "uuid-abc-123",    // NEW: document_id based deletion
  "userId": "user_456", 
  "chatbotId": "chatbot_789"
}

// Legacy support still available:
{
  "documentName": "my-document.pdf",  // LEGACY: filename based
  "userId": "user_456",
  "chatbotId": "chatbot_789"
}
```

### **Enhanced Chatbot Deletion**
```http
DELETE /api/chatbot-deletion
Content-Type: application/json

{
  "chatbotId": "chatbot_789",
  "userId": "user_456",
  "deleteVectorstore": true    // Complete cleanup
}

// Health check
POST /api/chatbot-deletion
{
  "action": "health-check"
}

// Deletion preview
POST /api/chatbot-deletion  
{
  "action": "preview-deletion",
  "chatbotId": "chatbot_789",
  "userId": "user_456"
}
```

## 🔄 **Response Examples**

### **Successful Deletion**
```json
{
  "success": true,
  "message": "Document deleted successfully from all systems",
  "details": {
    "document_id": "uuid-abc-123",
    "total_items_deleted": 15,
    "services_cleaned": ["pinecone", "neo4j", "firebase", "database"]
  }
}
```

### **Partial Failure (207 Multi-Status)**
```json
{
  "success": false,
  "message": "Document deletion completed with errors", 
  "errors": ["Neo4j connection failed"],
  "details": {
    "document_id": "uuid-abc-123",
    "total_items_deleted": 8,
    "deletion_results": {
      "pinecone": {"success": true, "items_deleted": 1},
      "neo4j": {"success": false, "error": "Connection timeout"},
      "firebase": {"success": true, "items_deleted": 7}
    }
  }
}
```

## 🧪 **Testing**

### **Health Check**
```bash
curl https://your-chatfactory-app.vercel.app/api/chatbot-deletion \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "health-check"}'
```

### **Deletion Preview**
```bash
curl https://your-chatfactory-app.vercel.app/api/chatbot-deletion \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "preview-deletion", "chatbotId": "test-bot", "userId": "test-user"}'
```

## 🔒 **Security Features**

### **Access Control**
- ✅ User ID validation - Users can only delete their own documents
- ✅ Chatbot ownership verification - Prevents cross-user deletions
- ✅ Document ID validation - Prevents unauthorized access

### **Error Handling**  
- ✅ Graceful degradation - Partial success handling
- ✅ Detailed error reporting - Per-service status
- ✅ Timeout protection - 5-minute deletion timeout
- ✅ Retry logic - Automatic retry for transient failures

## 📊 **Monitoring**

### **Logging**
All deletion operations are logged with:
- Document ID and user context
- Per-service deletion results  
- Total items deleted
- Error details and partial failures
- Processing time

### **Metrics**
Track these metrics for production monitoring:
- Deletion success rate per service
- Average deletion time
- Partial failure frequency
- Service availability

## 🚀 **Migration Guide**

### **Existing Applications**

1. **Update Environment Variables**
   ```bash
   # Add to your .env.local
   DOCUMENT_DELETION_SERVICE_URL=https://your-deletion-service-url.run.app
   ```

2. **Update Document Deletion Calls**
   ```typescript
   // OLD: Pinecone-only deletion
   await PineconeService.deleteDocument(chatbotId, documentName);

   // NEW: Complete multi-system deletion  
   await DocumentDeletionService.deleteDocument(documentId, userId, chatbotId);
   ```

3. **Update Chatbot Deletion Logic**
   ```typescript
   // OLD: Manual Pinecone deletion
   if (deleteVectorstore) {
     await PineconeService.deleteIndex(indexName);
   }

   // NEW: Comprehensive cleanup
   const result = await DocumentDeletionService.deleteChatbotDocuments(chatbotId, userId);
   ```

## 🔮 **Future Enhancements**

Planned improvements for the document deletion system:

### **Phase 2: Advanced Features**
- **Bulk operations** - Delete multiple documents in single request
- **Scheduled cleanup** - Automatic cleanup of orphaned records
- **Soft delete** - Retention policies with recovery options
- **Webhook notifications** - Notify other services of deletion events

### **Phase 3: Analytics & Monitoring**
- **Deletion dashboard** - Real-time deletion metrics
- **Cost tracking** - Storage savings from deletions
- **Audit trail** - Complete deletion history
- **Performance optimization** - Faster deletion for large datasets

## 📞 **Support & Troubleshooting**

### **Common Issues**

1. **Deletion Service Unavailable**
   - Check `DOCUMENT_DELETION_SERVICE_URL` configuration
   - Verify deletion service deployment status
   - Review deletion service logs in Cloud Run

2. **Partial Failures**
   - Review individual service error messages
   - Check service-specific credentials and connectivity
   - Retry deletion after resolving connectivity issues

3. **Document Not Found**
   - Verify `document_id` exists in database
   - Check user ownership and permissions
   - Ensure document hasn't already been deleted

### **Debug Information**

Enable detailed logging by setting log level in your application:
```typescript
// Add detailed logging for deletion operations
console.log('🗑️ Starting deletion for document:', documentId);
```

### **Health Check**

Use the health check endpoint to verify service connectivity:
```bash
curl /api/chatbot-deletion -X POST -d '{"action": "health-check"}'
```

---

## 🎉 **Benefits Summary**

The enhanced document deletion integration provides:

✅ **Complete Cleanup** - No orphaned data across any system  
✅ **Cost Optimization** - Eliminate storage charges for deleted documents  
✅ **Data Privacy** - Ensure complete removal for GDPR compliance  
✅ **Production Ready** - Robust error handling and retry logic  
✅ **User Experience** - Clear feedback on deletion status  
✅ **Scalability** - Handle multiple concurrent deletions  
✅ **Monitoring** - Complete audit trail and metrics  

**ChatFactoryApp now provides enterprise-grade document lifecycle management with complete traceability and cleanup across all storage systems.**