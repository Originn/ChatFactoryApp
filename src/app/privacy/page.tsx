import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - WizeChat AI',
  description: 'Privacy Policy for WizeChat AI - Learn how we collect, use, and protect your data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="text-sm text-gray-600 mb-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                Welcome to WizeChat AI ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service that transforms documentation and content into AI-powered chatbots.
              </p>
              <p className="text-gray-700">
                By using our service, you consent to the data practices described in this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-2">Personal Information</h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Email address and account credentials</li>
                <li>Name and profile information</li>
                <li>Payment and billing information</li>
                <li>Communication preferences</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-2">Content Data</h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Documents you upload (PDFs, Word files, text files, etc.)</li>
                <li>YouTube videos and transcripts you connect</li>
                <li>Website content you provide for scraping</li>
                <li>Custom training data and chatbot configurations</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-2">Usage Information</h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Chatbot interactions and conversations</li>
                <li>Analytics data and performance metrics</li>
                <li>Log files and technical data</li>
                <li>Device information and IP addresses</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Process and analyze your content to create AI embeddings</li>
                <li>Generate responses for your chatbots using AI models</li>
                <li>Provide customer support and technical assistance</li>
                <li>Improve our service performance and features</li>
                <li>Send service-related notifications and updates</li>
                <li>Process payments and manage subscriptions</li>
                <li>Comply with legal obligations and prevent fraud</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Data Processing and AI Services</h2>
              <p className="text-gray-700 mb-4">
                Your content is processed using third-party AI services including:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li><strong>OpenAI:</strong> For text embeddings and chat completions</li>
                <li><strong>Google Cloud:</strong> For document processing and YouTube integration</li>
                <li><strong>Pinecone:</strong> For vector storage and similarity search</li>
                <li><strong>Firebase:</strong> For authentication and data storage</li>
              </ul>
              <p className="text-gray-700">
                These services may process your data according to their respective privacy policies. We use encryption and secure transmission methods to protect your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-gray-700 mb-4">We do not sell your personal information. We may share information in these circumstances:</p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>With your explicit consent</li>
                <li>To comply with legal requirements or court orders</li>
                <li>To protect our rights, property, or safety</li>
                <li>With service providers who assist in our operations (under strict confidentiality)</li>
                <li>In connection with a business transfer or acquisition</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Data Security</h2>
              <p className="text-gray-700 mb-4">We implement industry-standard security measures:</p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Encryption in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and monitoring</li>
                <li>Compliance with data protection regulations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Your Rights and Choices</h2>
              <p className="text-gray-700 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Access, update, or delete your personal information</li>
                <li>Export your data in a portable format</li>
                <li>Opt-out of marketing communications</li>
                <li>Delete your chatbots and associated content</li>
                <li>Request restriction of processing</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Data Retention</h2>
              <p className="text-gray-700">
                We retain your data for as long as your account is active or as needed to provide services. 
                You can delete your data at any time through your account settings. We may retain certain 
                information for legal compliance or legitimate business purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-700">
                Your data may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place to protect your information in accordance 
                with applicable data protection laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700">
                Our service is not intended for children under 13. We do not knowingly collect 
                personal information from children under 13. If we become aware of such collection, 
                we will delete the information immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Changes to This Privacy Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of any 
                material changes by posting the new Privacy Policy on this page and updating 
                the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Contact Us</h2>
              <p className="text-gray-700 mb-2">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-gray-700">
                <li>Email: support-team@wizechat.ai</li>
                <li>Website: https://wizechat.ai</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}