import axios from 'axios';

export interface PostSymptomReportRequest {
  symptomDescription: string;
  location: { city: string; country: string };
  severity?: number;
}

export interface PostSymptomReportResponse {
  id: string;
  symptoms: any;
  location: string;
  timestamp: string;
  gpt4_response?: any;
}

/**
 * postSymptomReport
 * Sends a new symptom report to the backend API.
 *
 * @param data - Object containing the natural language description and location.
 * @param data.symptomDescription - Free-text user description of symptoms.
 * @param data.location - Object with city and country fields.
 * @param data.severity - Optional severity 1-10 for additional context.
 * @returns The created report object returned by the backend.
 */
export async function postSymptomReport(
  data: PostSymptomReportRequest
): Promise<PostSymptomReportResponse> {
  const res = await axios.post('/api/reports', data);
  return res.data as PostSymptomReportResponse;
}

/**
 * fetchReports
 * Fetches recent symptom reports from the backend for display.
 * Uses a simple GET endpoint designed for polling.
 *
 * @returns Array of recent reports.
 */
export async function fetchReports<T = any[]>(): Promise<T> {
  const res = await axios.get('/api/reports');
  return res.data as T;
}

export interface ChatbotMessageRequest {
  message: string;
  conversationId?: string;
  language?: string;
  imageDataUrl?: string;
}

export interface ChatbotMessageResponse {
  conversationId: string;
  text: string;
}

/**
 * sendChatbotMessage
 * Sends a message to the chatbot backend and returns the assistant's reply.
 *
 * @param payload - Contains user message, optional conversationId, and language hint.
 * @returns Chatbot response with conversationId and text.
 */
export async function sendChatbotMessage(payload: ChatbotMessageRequest): Promise<ChatbotMessageResponse> {
  const res = await axios.post('/api/chatbot', payload);
  return res.data as ChatbotMessageResponse;
}
