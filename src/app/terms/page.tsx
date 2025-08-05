import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - WizeChat AI',
  description: 'Terms of Service for WizeChat AI - Understanding your rights and responsibilities.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="text-sm text-gray-600 mb-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-4">
                Welcome to WizeChat AI. These Terms of Service ("Terms") govern your use of our platform 
                that creates AI-powered chatbots from your documentation and content. By accessing or using 
                our service, you agree to be bound by these Terms.
              </p>
              <p className="text-gray-700">
                If you do not agree to these Terms, please do not use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Description of Service</h2>
              <p className="text-gray-700 mb-4">
                WizeChat AI is a SaaS platform that allows you to:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Upload and process documents (PDFs, Word files, text files)</li>
                <li>Connect YouTube videos and extract transcripts</li>
                <li>Create AI-powered chatbots trained on your content</li>
                <li>Deploy chatbots to your websites</li>
                <li>Monitor chatbot performance and analytics</li>
              </ul>
            </section>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. User Accounts and Registration</h2>
              <p className="text-gray-700 mb-4">To use our service, you must:</p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Be at least 18 years old or have parental consent</li>
                <li>Notify us immediately of any unauthorized account access</li>
              </ul>
              <p className="text-gray-700">
                You are responsible for all activities that occur under your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Acceptable Use Policy</h2>
              <p className="text-gray-700 mb-4">You agree not to use our service to:</p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Upload illegal, harmful, or copyrighted content without permission</li>
                <li>Create chatbots that promote hate speech, violence, or discrimination</li>
                <li>Attempt to reverse engineer or compromise our systems</li>
                <li>Use the service for spam, phishing, or fraudulent activities</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Share adult content or material harmful to minors</li>
                <li>Impersonate others or provide false information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Content and Intellectual Property</h2>
              <h3 className="text-xl font-medium text-gray-800 mb-2">Your Content</h3>
              <p className="text-gray-700 mb-4">
                You retain ownership of all content you upload. By using our service, you grant us 
                a limited license to process, store, and use your content solely to provide our services.
              </p>
              
              <h3 className="text-xl font-medium text-gray-800 mb-2">Our Platform</h3>
              <p className="text-gray-700">
                We retain all rights to our platform, including software, algorithms, designs, 
                and trademarks. You may not copy, modify, or distribute our proprietary technology.
              </p>
            </section>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Pricing and Payment Terms</h2>
              <h3 className="text-xl font-medium text-gray-800 mb-2">Free Tier</h3>
              <p className="text-gray-700 mb-4">
                We offer a free tier with limited features and usage quotas. Free accounts may 
                have restrictions on storage, chatbot interactions, and advanced features.
              </p>
              
              <h3 className="text-xl font-medium text-gray-800 mb-2">Paid Plans</h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Subscription fees are billed in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable unless required by law</li>
                <li>Price changes will be communicated 30 days in advance</li>
                <li>Taxes may apply based on your location</li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800 mb-2">Payment Processing</h3>
              <p className="text-gray-700">
                Payments are processed through secure third-party providers. You authorize us to 
                charge your selected payment method for all applicable fees.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Service Availability and Support</h2>
              <p className="text-gray-700 mb-4">
                We strive to maintain high service availability but do not guarantee uninterrupted access. 
                We may perform maintenance, updates, or experience technical issues that temporarily 
                affect service availability.
              </p>
              <p className="text-gray-700">
                Support is provided through our designated channels. Response times may vary based 
                on your subscription tier and the nature of your inquiry.
              </p>
            </section>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Data Privacy and Security</h2>
              <p className="text-gray-700 mb-4">
                Your privacy is important to us. Our collection and use of your information is 
                governed by our Privacy Policy, which is incorporated into these Terms by reference.
              </p>
              <p className="text-gray-700">
                We implement reasonable security measures to protect your data, but cannot guarantee 
                absolute security. You are responsible for maintaining the confidentiality of your 
                account credentials.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Limitations of Liability</h2>
              <p className="text-gray-700 mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES AND LIMIT OUR 
                LIABILITY FOR ANY DAMAGES ARISING FROM YOUR USE OF OUR SERVICE.
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>We are not liable for indirect, incidental, or consequential damages</li>
                <li>Our total liability is limited to the amount you paid in the 12 months prior to the claim</li>
                <li>We do not warrant that our service will meet your specific requirements</li>
                <li>You use our service at your own risk</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Indemnification</h2>
              <p className="text-gray-700">
                You agree to indemnify and hold us harmless from any claims, damages, or expenses 
                arising from your use of our service, your content, or your violation of these Terms.
              </p>
            </section>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Account Termination</h2>
              <h3 className="text-xl font-medium text-gray-800 mb-2">By You</h3>
              <p className="text-gray-700 mb-4">
                You may terminate your account at any time through your account settings. 
                Termination does not entitle you to a refund of prepaid fees.
              </p>
              
              <h3 className="text-xl font-medium text-gray-800 mb-2">By Us</h3>
              <p className="text-gray-700 mb-4">
                We may suspend or terminate your account if you violate these Terms, engage in 
                fraudulent activity, or for other legitimate business reasons. We will provide 
                reasonable notice when possible.
              </p>
              
              <p className="text-gray-700">
                Upon termination, your access to the service will cease, and we may delete your 
                data after a reasonable grace period.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Third-Party Services</h2>
              <p className="text-gray-700 mb-4">
                Our service integrates with third-party platforms including OpenAI, Google Cloud, 
                and others. Your use of these integrations is subject to their respective terms 
                and privacy policies.
              </p>
              <p className="text-gray-700">
                We are not responsible for the availability, functionality, or policies of 
                third-party services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">13. Changes to Terms</h2>
              <p className="text-gray-700">
                We may modify these Terms at any time. Material changes will be communicated 
                through our service or via email. Your continued use of the service after 
                changes constitute acceptance of the new Terms.
              </p>
            </section>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">14. Governing Law and Disputes</h2>
              <p className="text-gray-700 mb-4">
                These Terms are governed by the laws of the jurisdiction where our company is 
                incorporated, without regard to conflict of law principles.
              </p>
              <p className="text-gray-700">
                Any disputes will be resolved through binding arbitration in accordance with 
                the rules of the applicable arbitration association, except where prohibited by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">15. Severability</h2>
              <p className="text-gray-700">
                If any provision of these Terms is found to be unenforceable, the remaining 
                provisions will continue in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">16. Contact Information</h2>
              <p className="text-gray-700 mb-2">
                If you have questions about these Terms of Service, please contact us:
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