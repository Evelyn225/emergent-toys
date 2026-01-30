import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse JSON body if POST
  let body = {};
  if (req.method === 'POST') {
    try {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          try {
            console.log('Raw POST data:', data);
            resolve(JSON.parse(data));
          } catch (err) {
            console.error('JSON parse error. Data received:', data);
            reject(err);
          }
        });
      });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { theme, prompt } = body;

  // Validate input
  if (!theme || !prompt) {
    return res.status(400).json({ error: "Missing 'theme' or 'prompt'." });
  }

  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });


    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a code generator. You ONLY output raw HTML/CSS/JavaScript code. You NEVER add explanations, descriptions, or any text before or after the code. You NEVER use markdown code blocks. Start directly with the first line of code (<!DOCTYPE, <style>, <script>, or <div>)."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 16384
    });

    let html = completion.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    html = html.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');
    
    // Remove any leading explanatory text before first HTML tag
    const firstTagMatch = html.match(/<!DOCTYPE|<style|<script|<div|<section|<article|<header|<main|<canvas/i);
    if (firstTagMatch) {
      html = html.substring(firstTagMatch.index);
    }
    
    // Remove any trailing explanatory text after last closing tag
    const lastTagMatch = html.match(/<\/(?:style|script|div|section|article|body|html)>(?!.*<\/)/i);
    if (lastTagMatch) {
      html = html.substring(0, lastTagMatch.index + lastTagMatch[0].length);
    }

    res.json({ html: html });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate website',
      details: error.message,
      errorType: error.type || error.code
    });
  }
}
