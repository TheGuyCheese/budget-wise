// src/lib/rag/budgetDataRetriever.ts

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface BudgetQueryResponse {
  answer: string;
  relevantData?: any;
}

export class BudgetRAGSystem {
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
  }
  
  async answerBudgetQuery(query: string): Promise<BudgetQueryResponse> {
    try {
      // Step 1: Extract information about what data we need to retrieve
      const dataToRetrieve = await this.determineDataNeeded(query);
      
      // Step 2: Fetch the relevant budget data based on the query
      const budgetData = await this.fetchRelevantBudgetData(dataToRetrieve);
      
      // Step 3: Generate a response using Gemini with the retrieved data
      const answer = await this.generateResponse(query, budgetData);
      
      return {
        answer,
        relevantData: budgetData
      };
    } catch (error) {
      console.error("Error in budget RAG system:", error);
      return {
        answer: "I'm sorry, but I encountered an error while retrieving your budget information. Please try again later."
      };
    }
  }
  
  private async determineDataNeeded(query: string): Promise<string[]> {
    const lowerCaseQuery = query.toLowerCase();
    const dataNeeded = [];
    
    // Determine what types of data we need based on the query
    if (lowerCaseQuery.includes('transaction') || 
        lowerCaseQuery.includes('spent') || 
        lowerCaseQuery.includes('purchase') ||
        lowerCaseQuery.includes('bought')) {
      dataNeeded.push('transactions');
    }
    
    if (lowerCaseQuery.includes('category') || 
        lowerCaseQuery.includes('breakdown') || 
        lowerCaseQuery.includes('spent on')) {
      dataNeeded.push('categories');
    }
    
    if (lowerCaseQuery.includes('monthly') || 
        lowerCaseQuery.includes('this month') || 
        lowerCaseQuery.includes('last month')) {
      dataNeeded.push('monthHistory');
    }
    
    if (lowerCaseQuery.includes('yearly') || 
        lowerCaseQuery.includes('this year') || 
        lowerCaseQuery.includes('annual')) {
      dataNeeded.push('yearHistory');
    }
    
    if (lowerCaseQuery.includes('currency') || 
        lowerCaseQuery.includes('settings')) {
      dataNeeded.push('userSettings');
    }
    
    // If we couldn't determine specific data needs, get a summary of everything
    if (dataNeeded.length === 0) {
      dataNeeded.push('summary');
    }
    
    return dataNeeded;
  }
  
  private async fetchRelevantBudgetData(dataNeeded: string[]): Promise<any> {
    const result: any = {};
    
    // Execute queries in parallel for better performance
    const promises = [];
    
    if (dataNeeded.includes('transactions') || dataNeeded.includes('summary')) {
      promises.push(
        prisma.transaction.findMany({
          where: { userId: this.userId },
          orderBy: { date: 'desc' },
          take: 10
        }).then(data => { result.recentTransactions = data; })
      );
      
      // Also get transaction statistics
      promises.push(
        prisma.transaction.groupBy({
          by: ['type'],
          where: { userId: this.userId },
          _sum: { amount: true },
        }).then(data => { result.transactionStats = data; })
      );
    }
    
    if (dataNeeded.includes('categories') || dataNeeded.includes('summary')) {
      promises.push(
        prisma.category.findMany({
          where: { userId: this.userId }
        }).then(data => { result.categories = data; })
      );
      
      // Get spending by category
      promises.push(
        prisma.transaction.groupBy({
          by: ['category', 'type'],
          where: { userId: this.userId },
          _sum: { amount: true },
        }).then(data => { result.categorySpending = data; })
      );
    }
    
    if (dataNeeded.includes('monthHistory') || dataNeeded.includes('summary')) {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      const currentYear = currentDate.getFullYear();
      
      promises.push(
        prisma.monthHistory.findMany({
          where: { 
            userId: this.userId,
            month: currentMonth,
            year: currentYear
          }
        }).then(data => { result.currentMonthHistory = data; })
      );
      
      // Previous month for comparison
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      
      promises.push(
        prisma.monthHistory.findMany({
          where: { 
            userId: this.userId,
            month: prevMonth,
            year: prevMonthYear
          }
        }).then(data => { result.previousMonthHistory = data; })
      );
    }
    
    if (dataNeeded.includes('yearHistory') || dataNeeded.includes('summary')) {
      const currentYear = new Date().getFullYear();
      
      promises.push(
        prisma.yearHistory.findMany({
          where: { 
            userId: this.userId,
            year: currentYear
          }
        }).then(data => { result.currentYearHistory = data; })
      );
      
      // Previous year for comparison
      promises.push(
        prisma.yearHistory.findMany({
          where: { 
            userId: this.userId,
            year: currentYear - 1
          }
        }).then(data => { result.previousYearHistory = data; })
      );
    }
    
    if (dataNeeded.includes('userSettings') || dataNeeded.includes('summary')) {
      promises.push(
        prisma.userSettings.findUnique({
          where: { userId: this.userId }
        }).then(data => { result.userSettings = data; })
      );
    }
    
    // Wait for all queries to complete
    await Promise.all(promises);
    
    return result;
  }
  
  private async generateResponse(query: string, budgetData: any): Promise<string> {
    try {
      // Prepare data for the model
      const contextData = JSON.stringify(budgetData, null, 2);
      
      // Create a prompt for Gemini
      const prompt = `
You are a helpful budget assistant that provides personalized financial insights based on user data.
Answer the following question using ONLY the provided data. If you cannot answer based on the data, say so politely.

USER BUDGET DATA:
${contextData}

USER QUESTION:
${query}

Provide a helpful, concise response. Include specific numbers from the data when relevant.
Don't mention that you're using "the provided data" - just answer naturally as if you have direct access to their budget information.
`;

      // Get model from Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      return response.text();
    } catch (error) {
      console.error("Error generating response with Gemini:", error);
      return "I'm sorry, I couldn't generate a response based on your budget information at this time.";
    }
  }
}