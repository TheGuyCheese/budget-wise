import { GoogleGenerativeAI } from "@google/generative-ai";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { GetFormatterForCurrency } from "@/lib/helpers";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { message, history } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    try {
      // Get model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // For simple text generation without chat history
      const prompt = `You are a helpful budget assistant. Answer the following question about finances: ${message}`;
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      return NextResponse.json({ response });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      return NextResponse.json(
        { error: "Failed to generate response from AI", details: error?.message || "Unknown error" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// Function to fetch user's budget data - will be used in the enhanced version
async function fetchUserBudgetData(userId: string) {
  try {
    // Get user settings for currency formatting
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings) {
      return { error: "User settings not found" };
    }

    const formatter = GetFormatterForCurrency(userSettings.currency);

    // Get recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // Get categories
    const categories = await prisma.category.findMany({
      where: {
        userId,
      },
    });

    // Calculate summary statistics
    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netBalance = totalIncome - totalExpense;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        if (!expensesByCategory[t.category]) {
          expensesByCategory[t.category] = 0;
        }
        expensesByCategory[t.category] += t.amount;
      });

    return {
      userSettings,
      recentTransactions: transactions.map(t => ({
        ...t,
        formattedAmount: formatter.format(t.amount),
      })),
      categories,
      summary: {
        totalIncome: formatter.format(totalIncome),
        totalExpense: formatter.format(totalExpense),
        netBalance: formatter.format(netBalance),
        expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
          category,
          amount: formatter.format(amount),
        })),
        currency: userSettings.currency,
      },
    };
  } catch (error: any) {
    console.error("Error fetching user budget data:", error);
    return { error: "Failed to fetch budget data", details: error?.message || "Unknown error" };
  }
}
