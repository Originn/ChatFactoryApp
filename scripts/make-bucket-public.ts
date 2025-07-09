// DEBUG: Simple script to make chatbot-document-images bucket public
import { BucketConfigService } from '../src/services/bucketConfigService';

async function makeBucketPublic() {
  try {
    console.log('🚀 Making chatbot-document-images bucket public...');
    
    const result = await BucketConfigService.makeImagesBucketPublic();
    
    if (result.success) {
      console.log('✅ Success:', result.message);
    } else {
      console.error('❌ Failed:', result.message);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

makeBucketPublic();