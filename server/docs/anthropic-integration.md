# Anthropic API Integration for Question Generation

This document provides instructions for setting up and using the Anthropic API integration for generating quiz questions in the Quiz Game application.

## Overview

The Anthropic API integration allows the game to generate high-quality, contextually relevant quiz questions based on categories, difficulty levels, and player profiles. This feature enhances the game experience by providing dynamic content tailored to players.

## Prerequisites

- An Anthropic API key (Claude API)
- Node.js and npm installed
- Quiz Game server application set up

## Setup Instructions

### 1. Get an Anthropic API Key

1. Go to [Anthropic's website](https://www.anthropic.com/) and sign up for an account
2. Navigate to the API section in your dashboard
3. Create a new API key
4. Copy the API key for use in the next step

### 2. Configure Environment Variables

Add the Anthropic API key to your `.env` file in the server root directory:

```
# Existing environment variables
MONGODB_URI=mongodb://localhost:27017/quizgame
JWT_SECRET=your_jwt_secret
PORT=3000

# Add Anthropic API key
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Replace `your_anthropic_api_key_here` with the actual API key you obtained from Anthropic.

### 3. Install Required Dependencies

The following dependencies should be installed (these are already added to package.json):

```bash
npm install @anthropic-ai/sdk node-cache
```

## Usage

The Anthropic integration provides several endpoints for generating questions:

### Generate a Single Question

```http
POST /api/questions/generate
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "category": "Science",
  "difficulty": "medium",
  "type": "multipleChoice",
  "saveToDatabase": true
}
```

### Generate Multiple Questions

```http
POST /api/questions/generate-batch
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "category": "History",
  "difficulty": "hard",
  "type": "multipleChoice",
  "count": 5,
  "saveToDatabase": true
}
```

### Generate Questions for a Specific Player

```http
POST /api/questions/generate-for-player/:playerId
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "category": "Sports",
  "count": 3,
  "saveToDatabase": true
}
```

### Generate Specialist Questions

```http
POST /api/questions/generate-specialist/:playerId
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "specialistTopic": "Astronomy",
  "count": 5,
  "saveToDatabase": true
}
```

### Clear Question Cache

```http
POST /api/questions/clear-cache
Authorization: Bearer <your_jwt_token>
```

## Implementation Details

The Anthropic integration consists of:

1. **anthropicService.js**: Core service for communicating with the Anthropic API
2. **Question model**: Database schema for storing generated questions
3. **Question routes**: API endpoints for generating and managing questions

### Caching

Questions are cached for 24 hours to reduce API calls and improve performance. The cache is based on the question parameters (category, difficulty, type) and player profile if applicable.

### Error Handling

The service includes robust error handling for API failures, rate limiting, and validation errors. Errors are logged and appropriate error responses are returned to the client.

## Monitoring and Costs

- Monitor your Anthropic API usage through their dashboard
- Consider implementing additional rate limiting for high-traffic scenarios
- The API calls are made with the Claude 3 Haiku model to balance cost and quality

## Troubleshooting

If you encounter issues with the Anthropic API integration:

1. Verify your API key is correct in the `.env` file
2. Check the server logs for detailed error messages
3. Ensure you have sufficient credits in your Anthropic account
4. Verify network connectivity to the Anthropic API endpoints

## Security Considerations

- The Anthropic API key is stored in the `.env` file which should never be committed to version control
- API requests are authenticated using JWT tokens to prevent unauthorized access
- Content filtering is applied to ensure appropriate questions are generated
