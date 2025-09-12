import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSymptoStore } from '@/store/symptoStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { postSymptomReport } from '@/api/symptom-api';

interface ReportStep {
  id: string;
  question: string;
  type: 'text' | 'severity' | 'demographic' | 'travel' | 'confirmation';
  placeholder?: string;
  options?: string[];
}

const REPORT_STEPS: ReportStep[] = [
  {
    id: 'symptoms',
    question: "Hi there! I'm here to help track health patterns globally. How are you feeling today? Please describe your symptoms in your own words.",
    type: 'text',
    placeholder: "I've been experiencing a headache and fever for the past 2 days..."
  },
  {
    id: 'severity',
    question: "Thanks for sharing. On a scale of 1-10, how would you rate the overall severity of your symptoms?",
    type: 'severity'
  },
  {
    id: 'demographic',
    question: "To help with pattern analysis, what's your age range?",
    type: 'demographic',
    options: ['18-25', '26-35', '36-45', '46-55', '55+', 'Prefer not to say']
  },
  {
    id: 'travel',
    question: "Have you traveled to any other cities or countries in the past 14 days?",
    type: 'travel',
    options: ['Yes', 'No']
  },
  {
    id: 'confirmation',
    question: "Perfect! Your anonymous report will help health experts detect patterns early. Ready to submit?",
    type: 'confirmation'
  }
];

const SymptomReporter = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, city: string, country?: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { loadOutbreaksData } = useSymptoStore();

  // Get user location (city-level only for privacy)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const mockCities = [
            "New York", "London", "Tokyo", "Sydney", "Berlin", 
            "Paris", "Toronto", "Mumbai", "São Paulo", "Bangkok"
          ];
          const city = mockCities[Math.floor(Math.random() * mockCities.length)];
          setUserLocation({ lat: latitude, lng: longitude, city, country: 'Unknown' });
        },
        () => {
          setUserLocation({
            lat: 40.7128 + (Math.random() - 0.5) * 0.1,
            lng: -74.0060 + (Math.random() - 0.5) * 0.1,
            city: "Demo City",
            country: 'Unknown'
          });
        }
      );
    }
  }, []);

  // Voice input using Web Speech API
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input",
        variant: "destructive"
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setResponses(prev => ({ ...prev, [REPORT_STEPS[currentStep].id]: transcript }));
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast({ title: "Voice input error", description: "Please try again or use text input", variant: "destructive" });
    };
    recognition.start();
  };

  const handleStepResponse = (value: any) => {
    setResponses(prev => ({ ...prev, [REPORT_STEPS[currentStep].id]: value }));
  };

  const nextStep = () => {
    if (currentStep < REPORT_STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const submitReport = async () => {
    if (!userLocation) {
      toast({ title: "Location required", description: "Location is needed for outbreak detection", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const description = responses.symptoms || '';
      await postSymptomReport({
        symptomDescription: description,
        location: { city: userLocation.city, country: userLocation.country || 'Unknown' },
        severity: responses.severity || 5,
      });

      // Refresh latest data from backend
      await loadOutbreaksData(7);

      setIsSubmitting(false);
      setIsOpen(false);
      setCurrentStep(0);
      setResponses({});
      toast({ title: "Report submitted successfully!", description: "Your report is now helping detect health patterns globally" });
    } catch (error) {
      console.error('Submission error:', error);
      setIsSubmitting(false);
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const currentStepData = REPORT_STEPS[currentStep];
  const isLastStep = currentStep === REPORT_STEPS.length - 1;
  const canProceed = responses[currentStepData.id] !== undefined || currentStepData.type === 'confirmation';

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 z-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0 -6h6m-6 0H6" />
          </svg>
          <span className="font-medium">Report Symptoms</span>
        </div>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Health Check</h2>
                    <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {REPORT_STEPS.length}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full bg-secondary rounded-full h-2">
                  <motion.div
                    className="bg-primary h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / REPORT_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Current Step */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <p className="text-foreground leading-relaxed">{currentStepData.question}</p>

                  {currentStepData.type === 'text' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Textarea
                          ref={textareaRef}
                          placeholder={currentStepData.placeholder}
                          value={responses[currentStepData.id] || ''}
                          onChange={(e) => handleStepResponse(e.target.value)}
                          className="min-h-[100px] resize-none"
                        />
                        <button
                          onClick={startVoiceInput}
                          disabled={isListening}
                          className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
                            isListening 
                              ? 'bg-red-500 text-white pulse-medical' 
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                      </div>
                      {isListening && (
                        <p className="text-sm text-primary animate-pulse">Listening... Speak clearly</p>
                      )}
                      {responses[currentStepData.id]?.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const evt = new CustomEvent('symptomap:openChat', { detail: { message: responses[currentStepData.id] } });
                              window.dispatchEvent(evt);
                              setIsOpen(false);
                            }}
                            className="text-xs underline text-primary"
                          >
                            Talk to AI about these symptoms
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStepData.type === 'severity' && (
                    <div className="space-y-4">
                      <div className="px-3">
                        <Slider
                          value={[responses[currentStepData.id] || 5]}
                          onValueChange={(value) => handleStepResponse(value[0])}
                          max={10}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>Mild (1)</span>
                          <span className="font-medium text-primary">
                            {responses[currentStepData.id] || 5}/10
                          </span>
                          <span>Severe (10)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center text-2xl">
                        {responses[currentStepData.id] <= 3 ? '😊' : 
                         responses[currentStepData.id] <= 6 ? '😐' : 
                         responses[currentStepData.id] <= 8 ? '😰' : '😵'}
                      </div>
                    </div>
                  )}

                  {(currentStepData.type === 'demographic' || currentStepData.type === 'travel') && (
                    <div className="grid grid-cols-2 gap-2">
                      {currentStepData.options?.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleStepResponse(option)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                            responses[currentStepData.id] === option
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card hover:bg-accent border-border'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStepData.type === 'confirmation' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Anonymous & Secure</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your report will be completely anonymous and help detect health patterns early to protect communities worldwide.
                      </p>
                      {userLocation && (
                        <p className="text-xs text-muted-foreground">
                          📍 General location: {userLocation.city} (city-level only)
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>

                <Button
                  onClick={isLastStep ? submitReport : nextStep}
                  disabled={!canProceed || isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : isLastStep ? (
                    <>
                      Submit Report
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Continue
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SymptomReporter;