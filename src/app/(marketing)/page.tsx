import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import MarketingHeader from '@/components/shared/MarketingHeader';
import ComingSoonAwarePage from '@/components/ComingSoonAwarePage';

export default function LandingPage() {
  return (
    <ComingSoonAwarePage>
      <LandingPageContent />
    </ComingSoonAwarePage>
  );
}

function LandingPageContent() {

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header/Navigation */}
      <MarketingHeader showAuthButtons={true} currentPage="home" />
      
      {/* Hero Section */}
      <section className="w-full h-screen flex items-center justify-center text-center px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-white">
        <div>
          <h1
            className="text-5xl font-bold mb-4"
          >
            Turn Documentation Into AI Support
          </h1>
          <p
            className="text-xl mb-8 max-w-xl mx-auto"
          >
            We transform your product documentation into an intelligent AI chatbot that answers user questions instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
            <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white/10">
              Learn More
            </Button>
          </div>
        </div>
      </section>
      
      {/* What We Do */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-semibold mb-4">Smart Support, Powered by Your Docs</h2>
        <p className="text-gray-600 text-lg">
          Our tool reads and understands your existing documentation — turning it into a trained AI assistant ready to help your users, staff, or developers with real-time answers.
        </p>
      </section>
      
      {/* How It Works */}
      <section id="features" className="py-16 bg-muted/30 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold mb-12 text-center text-foreground">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold mb-4">1</div>
              <h3 className="text-xl font-medium mb-2 text-foreground">Upload Your Docs</h3>
              <p className="text-muted-foreground">Upload your existing documentation in PDF, Markdown, Word, or HTML formats.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold mb-4">2</div>
              <h3 className="text-xl font-medium mb-2 text-foreground">AI Processing</h3>
              <p className="text-muted-foreground">Our AI analyzes your content, creates embeddings, and builds a knowledge base.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-2xl font-bold mb-4">3</div>
              <h3 className="text-xl font-medium mb-2 text-foreground">Deploy Chatbot</h3>
              <p className="text-muted-foreground">Integrate your new AI assistant into your website, app, or internal tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold mb-12 text-center">Key Benefits</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "AI trained on your documentation",
                emoji: "🚀",
                description: "Custom-trained on your specific content for accurate, relevant responses."
              },
              {
                title: "Accurate, contextual responses",
                emoji: "🧠",
                description: "Provides precise answers based on your documentation context."
              },
              {
                title: "Easy website/app integration",
                emoji: "⚙️",
                description: "Simple integration options for any platform with our API or widgets."
              },
              {
                title: "Supports multiple formats",
                emoji: "📄",
                description: "Works with Markdown, PDF, HTML, Word docs and more."
              },
              {
                title: "Privacy-first design",
                emoji: "🔒",
                description: "Your data stays private and secure with our privacy-respecting architecture."
              },
              {
                title: "Detailed analytics",
                emoji: "📊",
                description: "Track usage, popular questions, and chatbot performance."
              }
            ].map((benefit, i) => (
              <Card key={i} className="shadow-md">
                <CardContent className="py-6">
                  <div className="text-3xl mb-2">{benefit.emoji}</div>
                  <h3 className="text-lg font-medium mb-2">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4 text-center text-foreground">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include our core features with different usage limits.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Tier */}
            <Card className="border-gray-200">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Free Trial</h3>
                  <div className="text-4xl font-bold mb-1">$0</div>
                  <p className="text-gray-500">14 days</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Limited document uploads
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Basic analytics
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Standard support
                  </li>
                </ul>
                <Button className="w-full">Start Free Trial</Button>
              </CardContent>
            </Card>
            
            {/* Pro Tier */}
            <Card className="border-blue-500 shadow-lg relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Pro</h3>
                  <div className="text-4xl font-bold mb-1">$49</div>
                  <p className="text-gray-500">per month</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Unlimited document uploads
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Advanced analytics
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Priority support
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Custom branding
                  </li>
                </ul>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Choose Pro</Button>
              </CardContent>
            </Card>
            
            {/* Enterprise Tier */}
            <Card className="border-gray-200">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
                  <div className="text-4xl font-bold mb-1">Custom</div>
                  <p className="text-gray-500">Contact us</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Unlimited everything
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Dedicated support team
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Custom integrations
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    SLA guarantees
                  </li>
                </ul>
                <Button variant="outline" className="w-full">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-muted/50 py-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h4 className="text-2xl font-semibold mb-4 text-foreground">Ready to Get Started?</h4>
          <p className="text-muted-foreground mb-8">Let's transform your documentation into an intelligent AI assistant that helps your users and reduces support costs.</p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Input type="email" placeholder="Your email" className="max-w-sm" />
            <Button className="bg-blue-600 hover:bg-blue-700">Start Free Trial</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h5 className="font-bold text-lg mb-4">WizeChat</h5>
            <p className="text-gray-400">Transforming documentation into intelligent AI support.</p>
          </div>
          <div>
            <h5 className="font-bold text-lg mb-4">Product</h5>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Features</a></li>
              <li><a href="#" className="hover:text-white">Pricing</a></li>
              <li><a href="#" className="hover:text-white">Documentation</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-lg mb-4">Company</h5>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Blog</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-lg mb-4">Legal</h5>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Privacy</a></li>
              <li><a href="#" className="hover:text-white">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} WizeChat. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
