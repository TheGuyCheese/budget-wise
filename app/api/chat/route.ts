// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { BudgetRAGSystem } from '@/lib/rag/budgetDataRetriever';
import { auth } from '@clerk/nextjs/server'; // Assuming you're using Clerk for auth, adjust as needed
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API for general queries
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Detect if a query is budget-related
function isBudgetQuery(message: string): boolean {
  const budgetKeywords = [
    'my budget', 'my spending', 'my expenses', 'my income',
    'how much did i spend', 'how much have i spent', 'my balance',
    'my account', 'my savings', 'my finances', 'my transactions',
    'my categories', 'spend on', 'spent on', 'this month', 'last month'
  ];
  
  const lowercaseMessage = message.toLowerCase();
  
  return budgetKeywords.some(keyword => lowercaseMessage.includes(keyword));
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Parse request
    const { message, history } = await req.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    let response;
    
    // Check if this is a budget-specific query
    if (isBudgetQuery(message)) {
      // Initialize the budget RAG system
      const budgetRag = new BudgetRAGSystem(userId);
      
      // Get personalized response based on user's budget data
      const budgetResponse = await budgetRag.answerBudgetQuery(message);
      response = budgetResponse.answer;
    } else {
      // For general financial advice, use the LLM directly
      response = await getGeneralFinancialAdvice(message, history);
    }
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Handle general financial questions
async function getGeneralFinancialAdvice(message: string, history: any[]): Promise<string> {
  try {
    // Format conversation history for Gemini
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Create a system prompt
    const systemPrompt = {
      role: 'model',
      parts: [{ text: "You are a helpful budget assistant providing general financial advice. You provide concise, practical financial guidance and budgeting tips." }]
    };
    
    // Combine system prompt with history
    const chatHistory = [systemPrompt, ...formattedHistory];
    
    // Add the user's current message
    chatHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });
    
    // Get model from Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Create chat session
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    
    // Generate response
    const result = await chat.sendMessage(message);
    return result.response.text();
  } catch (error) {
    console.error("Error getting general financial advice:", error);
    return "I'm sorry, I'm having trouble providing financial advice at the moment. Please try again later.";
  }
}