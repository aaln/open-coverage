/**
 * Main Assistant Component - Core application interface for health insurance analysis
 * 
 * This component serves as the primary interface for the Health Insurance Coverage
 * Analyzer application. It provides a comprehensive AI-powered analysis platform
 * for understanding health insurance benefits and coverage.
 * 
 * Key features:
 * - AI-powered chat interface with insurance expertise
 * - Policy document upload and analysis
 * - Interactive coverage category exploration
 * - Responsive design with mobile support
 * - Error boundaries for graceful error handling
 * 
 * Architecture:
 * - AssistantRuntimeProvider: Manages AI chat runtime and API communication
 * - PolicyProvider: Centralized policy data management with persistence
 * - Error boundaries: Graceful handling of AI and component errors
 * - Responsive layout: Mobile modal, desktop sidebar integration
 */

"use client";

import { AssistantModal } from "@/components/assistant-ui/assistant-modal";
import { AIErrorBoundary, GeneralErrorBoundary } from "@/components/error-boundaries";
import PolicyAnalysis from "@/components/policy-analysis";
import { PolicyOverview } from "@/components/policy-overview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHealthProfileStore } from "@/lib/health-profile-store";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import Link from "next/link";

/**
 * Main Assistant Application Component
 * 
 * Orchestrates the entire health insurance analysis application, providing
 * AI-powered insights, policy management, and interactive coverage exploration.
 * 
 * Component hierarchy:
 * 1. GeneralErrorBoundary - Catches all React errors
 * 2. AssistantRuntimeProvider - AI chat runtime management
 * 3. PolicyProvider - Insurance policy data context
 * 4. SidebarProvider - Responsive layout management
 * 5. Main content areas - Policy analysis and overview
 * 
 * @returns JSX.Element The complete application interface
 */
export const Assistant = () => {
  // ========================================================================
  // SETUP AND CONFIGURATION
  // ========================================================================
  
  /** Initialize the AI chat runtime with API endpoint */
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  /** Check if we're on a mobile device for responsive layout */
  const isMobile = useIsMobile();
  
  /** Get health profile data */
  const { members } = useHealthProfileStore();
  const hasHealthProfile = members.length > 0 && members[0].age && (
    members[0].conditions.length > 0 || 
    members[0].medications.length > 0 ||
    members[0].otherServices?.length > 0
  );
  
  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <GeneralErrorBoundary 
      onError={(error, errorInfo) => {
        // In production, send to monitoring service
        console.error("Application Error:", error, errorInfo);
        // Example: errorReportingService.report(error, errorInfo);
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
                {/* Main Content Area */}
                <main className="flex flex-col min-h-full p-6 w-full">
                  
                  {/* Policy Overview Section */}
                  <AIErrorBoundary 
                    context="Policy Overview"
                    fallback={() => (
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Policy overview is temporarily unavailable
                        </p>
                      </div>
                    )}
                  >
                    <PolicyOverview />
                  </AIErrorBoundary>

                  {/* Main Policy Analysis Interface */}
                  <div className="flex-1">
                    <PolicyAnalysis />
                  </div>
                  
                  {/* Main Policy Analysis Interface */}
                  {/* <div className="flex-1">
                    <AssistantPolicyAnalysis />
                  </div> */}
                  
                  {/* Footer */}
                  <footer className="mt-12 pt-6 border-t bg-muted/20">
                    <div className="flex items-center justify-center py-4">
                      <Link
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-md hover:bg-muted/50"
                        href="https://github.com/aaln/health-insurance-coverage"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>View Open Source Repo on GitHub</span>
                      </Link>
                    </div>
                  </footer>
                </main>
                
                {/* Mobile Chat Modal - Only shown on mobile devices */}
                {isMobile && (
                  <AIErrorBoundary 
                    context="Mobile Chat"
                    fallback={() => (
                      <div className="fixed bottom-4 right-4 p-2 bg-background border rounded">
                        Chat unavailable
                      </div>
                    )}
                  >
                    <AssistantModal />
                  </AIErrorBoundary>
                )}

      </AssistantRuntimeProvider>
    </GeneralErrorBoundary>
  );
};
